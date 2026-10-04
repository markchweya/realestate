import { existsSync } from "node:fs";
import { basename } from "node:path";
import { ClaudeRunError, type ClaudeEvent, type RunOptions } from "./claude.js";
import type { Config } from "./config.js";
import type { SessionRow, Store } from "./db.js";
import type { ChatQueue } from "./queue.js";
import { MAX_TEXT, type IncomingMessage, type WhatsApp } from "./whatsapp.js";

export type Runner = (o: RunOptions) => AsyncIterable<ClaudeEvent>;

export interface BridgeDeps {
  config: Config;
  store: Store;
  wa: Pick<WhatsApp, "sendText" | "sendDocument" | "markReadTyping">;
  queue: ChatQueue;
  run: Runner;
}

const HELP = `*Claude Code on WhatsApp*

Just type to talk to Claude in your active session.

/new [name] – start a fresh session
/sessions – list recent sessions
/switch <n | session-id> – resume a session (an id from \`claude --resume\` on your computer works too)
/project [name] – show or change the project folder
/stop – cancel the current run
/status – what's running, where, last cost
/help – this message

Any other /command is passed to Claude Code as-is.`;

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

const titleFrom = (prompt: string) => {
  const t = prompt.replace(/\s+/g, " ").trim();
  return t.length > 40 ? `${t.slice(0, 39)}…` : t || "untitled";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class Bridge {
  constructor(private d: BridgeDeps) {}

  private reply(to: string, text: string) {
    return this.d.wa.sendText(to, text);
  }

  /** Working directory for the chat: active session's, else chosen project, else default. */
  private cwdFor(phone: string): string {
    const chat = this.d.store.getChat(phone);
    const session = chat.active_session ? this.d.store.getSession(chat.active_session) : undefined;
    return session?.cwd ?? chat.cwd ?? this.d.config.DEFAULT_CWD;
  }

  async handle(msg: IncomingMessage): Promise<void> {
    const phone = msg.from;
    if (msg.text === undefined) {
      await this.reply(phone, `I can only handle text messages for now (got: ${msg.type}).`);
      return;
    }
    const text = msg.text.trim();
    if (!text) return;

    const m = /^\/(\w+)\s*([\s\S]*)$/.exec(text);
    if (m) {
      const [, cmd, arg] = m;
      const handled = await this.command(phone, cmd!.toLowerCase(), arg!.trim());
      if (handled) return;
    }
    await this.prompt(msg, text);
  }

  /** Returns false for unknown commands so they pass through to Claude Code. */
  private async command(phone: string, cmd: string, arg: string): Promise<boolean> {
    const { store, queue, config } = this.d;
    switch (cmd) {
      case "help":
      case "start":
        await this.reply(phone, HELP);
        return true;

      case "new":
        store.startNew(phone, arg || null);
        await this.reply(phone, `🆕 New session${arg ? ` *${arg}*` : ""} – send your first prompt.\n📁 ${this.cwdFor(phone)}`);
        return true;

      case "sessions": {
        const rows = store.listSessions(phone);
        const active = store.getChat(phone).active_session;
        if (!rows.length) {
          await this.reply(phone, "No sessions yet. Just send a message to start one.");
          return true;
        }
        const lines = rows.map(
          (s, i) =>
            `${s.id === active ? "▶" : " "} *${i + 1}.* ${s.name}\n    📁 ${basename(s.cwd)} · ${ago(s.last_used)}`,
        );
        await this.reply(phone, `*Recent sessions*\n\n${lines.join("\n")}\n\nResume with /switch <n>`);
        return true;
      }

      case "switch":
      case "resume": {
        let target: SessionRow | undefined;
        if (/^\d+$/.test(arg)) {
          target = store.listSessions(phone)[Number(arg) - 1];
        } else if (UUID.test(arg)) {
          // Adopt a session started elsewhere (e.g. on the laptop) in the current project folder.
          target = store.getSession(arg);
          if (!target) {
            store.upsertSession({ id: arg, phone, name: `imported ${arg.slice(0, 8)}`, cwd: this.cwdFor(phone) });
            target = store.getSession(arg);
          }
        }
        if (!target) {
          await this.reply(phone, "Usage: /switch <number from /sessions> or /switch <session-id>");
          return true;
        }
        store.setActiveSession(phone, target.id);
        await this.reply(phone, `▶ Switched to *${target.name}*\n📁 ${target.cwd}`);
        return true;
      }

      case "project":
      case "cd": {
        const names = Object.keys(config.PROJECTS);
        if (!arg) {
          const list = names.length
            ? names.map((n) => `• ${n} → ${config.PROJECTS[n]}`).join("\n")
            : "_No projects configured (set PROJECTS in .env)._";
          await this.reply(phone, `📁 Current: ${this.cwdFor(phone)}\n\n${list}`);
          return true;
        }
        const dir = config.PROJECTS[arg.toLowerCase()];
        if (!dir) {
          await this.reply(phone, `Unknown project "${arg}". Available: ${names.join(", ") || "none"}`);
          return true;
        }
        if (!existsSync(dir)) {
          await this.reply(phone, `⚠️ Folder for "${arg}" doesn't exist on the host: ${dir}`);
          return true;
        }
        store.setCwd(phone, dir);
        store.startNew(phone, null); // sessions are tied to their folder
        await this.reply(phone, `📁 Now in *${arg}* (${dir}). Next message starts a new session.`);
        return true;
      }

      case "stop":
      case "cancel":
        await this.reply(phone, queue.stop(phone) ? "🛑 Stopping…" : "Nothing is running.");
        return true;

      case "status": {
        const chat = store.getChat(phone);
        const s = chat.active_session ? store.getSession(chat.active_session) : undefined;
        const q = queue.status(phone);
        const lines = [
          s ? `▶ *${s.name}*` : `🆕 No active session${chat.pending_name ? ` (next: *${chat.pending_name}*)` : ""}`,
          `📁 ${this.cwdFor(phone)}`,
          q.running ? `⏳ Running for ${Math.round(q.runningForMs / 1000)}s${q.queued ? `, ${q.queued} queued` : ""}` : "💤 Idle",
        ];
        if (s?.last_cost_usd != null) lines.push(`💰 Last run: $${s.last_cost_usd.toFixed(4)}`);
        if (s) lines.push(`🆔 ${s.id}`);
        await this.reply(phone, lines.join("\n"));
        return true;
      }

      default:
        return false;
    }
  }

  private async prompt(msg: IncomingMessage, text: string) {
    const phone = msg.from;
    const ahead = this.d.queue.enqueue(phone, (signal) => this.execute(msg, text, signal));
    if (ahead > 0) await this.reply(phone, `⏳ Queued (${ahead} ahead). /stop cancels everything.`);
  }

  private async execute(msg: IncomingMessage, prompt: string, signal: AbortSignal) {
    const { store, config, wa } = this.d;
    const phone = msg.from;
    const chat = store.getChat(phone);
    const cwd = this.cwdFor(phone);
    let sessionId = chat.active_session;
    const name = (sessionId && store.getSession(sessionId)?.name) || chat.pending_name || titleFrom(prompt);

    wa.markReadTyping(msg.id).catch((e) => console.warn("[wa] typing indicator failed:", e.message));

    let lastProgress = Date.now();
    let lastText = "";
    const tools: string[] = [];
    try {
      for await (const ev of this.d.run({
        prompt,
        cwd,
        sessionId,
        bin: config.CLAUDE_BIN,
        permissionMode: config.PERMISSION_MODE,
        allowedTools: config.ALLOWED_TOOLS,
        model: config.MODEL,
        signal,
        timeoutMs: config.RUN_TIMEOUT_MIN * 60_000,
      })) {
        if (ev.kind === "init" && ev.sessionId !== sessionId) {
          sessionId = ev.sessionId;
          store.upsertSession({ id: sessionId, phone, name, cwd });
          store.setActiveSession(phone, sessionId);
        } else if (ev.kind === "text") {
          lastText = ev.text;
        } else if (ev.kind === "tool") {
          tools.push(ev.summary ? `${ev.name}: ${ev.summary}` : ev.name);
          if (config.PROGRESS_INTERVAL_SEC > 0 && Date.now() - lastProgress >= config.PROGRESS_INTERVAL_SEC * 1000) {
            lastProgress = Date.now();
            const recent = tools.slice(-3).map((t) => `🔧 ${t}`).join("\n");
            await wa.sendText(phone, `⏳ Still working (${tools.length} steps)…\n${recent}`).catch(() => {});
          }
        } else if (ev.kind === "result") {
          if (sessionId) store.recordRun(sessionId, ev.costUsd);
          const body = ev.text.trim() || lastText.trim();
          if (ev.isError) {
            await wa.sendText(phone, `⚠️ Claude stopped (${ev.subtype}).${body ? `\n\n${body}` : ""}`);
          } else {
            await this.deliver(phone, body || "✅ Done (no text output).");
          }
        }
      }
    } catch (err) {
      if (err instanceof ClaudeRunError && err.aborted) {
        await wa.sendText(phone, "🛑 Stopped.");
      } else {
        console.error("[bridge] run failed", err);
        await wa.sendText(phone, `⚠️ ${(err as Error).message}`.slice(0, MAX_TEXT));
      }
    }
  }

  /** Short answers go inline; very long ones go as a preview plus a full .md attachment. */
  private async deliver(phone: string, text: string) {
    if (text.length <= MAX_TEXT * 3) {
      await this.d.wa.sendText(phone, text);
      return;
    }
    const preview = `${text.slice(0, 1500).trimEnd()}…\n\n📎 Full reply attached.`;
    await this.d.wa.sendText(phone, preview);
    await this.d.wa.sendDocument(phone, "claude-reply.md", text);
  }
}
