import { spawn } from "node:child_process";
import { basename } from "node:path";
import { createInterface } from "node:readline";

/** Events we care about from `claude -p --output-format stream-json`. */
export type ClaudeEvent =
  | { kind: "init"; sessionId: string; cwd: string }
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; summary: string }
  | {
      kind: "result";
      sessionId: string;
      text: string;
      isError: boolean;
      subtype: string;
      costUsd: number | null;
      durationMs: number | null;
      numTurns: number | null;
    };

const WHATSAPP_SYSTEM_PROMPT = [
  "The user is talking to you through WhatsApp on their phone.",
  "Keep replies concise and skimmable. Use WhatsApp formatting: *bold*, _italic_, ```code```; avoid markdown tables and headings.",
  "When you change files, end with a short summary of what changed.",
].join(" ");

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** One-line, human-readable summary of a tool call for progress pings. */
export function summarizeTool(name: string, input: Record<string, unknown> = {}): string {
  const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : undefined);
  const file = str("file_path") ?? str("notebook_path") ?? str("path");
  switch (name) {
    case "Bash":
      return short(str("description") ?? str("command") ?? "shell");
    case "Read":
    case "Edit":
    case "MultiEdit":
    case "Write":
    case "NotebookEdit":
      return file ? basename(file) : name;
    case "Grep":
    case "Glob":
      return short(str("pattern") ?? "");
    case "WebFetch":
      return short(str("url") ?? "");
    case "WebSearch":
      return short(str("query") ?? "");
    case "Task":
    case "Agent":
      return short(str("description") ?? "subagent");
    default:
      return file ? basename(file) : "";
  }
}

/** Parse one NDJSON line into zero or more bridge events. Unknown lines are ignored. */
export function parseStreamLine(line: string): ClaudeEvent[] {
  let msg: any;
  try {
    msg = JSON.parse(line);
  } catch {
    return [];
  }
  if (!msg || typeof msg !== "object") return [];

  if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
    return [{ kind: "init", sessionId: msg.session_id, cwd: msg.cwd ?? "" }];
  }

  // Only top-level assistant turns; subagent chatter carries a parent_tool_use_id.
  if (msg.type === "assistant" && !msg.parent_tool_use_id && Array.isArray(msg.message?.content)) {
    const out: ClaudeEvent[] = [];
    for (const block of msg.message.content) {
      if (block?.type === "text" && block.text?.trim()) out.push({ kind: "text", text: block.text });
      else if (block?.type === "tool_use")
        out.push({ kind: "tool", name: block.name, summary: summarizeTool(block.name, block.input) });
    }
    return out;
  }

  if (msg.type === "result") {
    return [
      {
        kind: "result",
        sessionId: msg.session_id ?? "",
        text: typeof msg.result === "string" ? msg.result : "",
        isError: Boolean(msg.is_error) || (msg.subtype && msg.subtype !== "success"),
        subtype: msg.subtype ?? "unknown",
        costUsd: typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : null,
        durationMs: typeof msg.duration_ms === "number" ? msg.duration_ms : null,
        numTurns: typeof msg.num_turns === "number" ? msg.num_turns : null,
      },
    ];
  }
  return [];
}

export interface RunOptions {
  prompt: string;
  cwd: string;
  sessionId?: string | null;
  bin?: string;
  permissionMode?: string;
  allowedTools?: string[];
  model?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function buildArgs(o: RunOptions): string[] {
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--append-system-prompt",
    WHATSAPP_SYSTEM_PROMPT,
  ];
  if (o.sessionId) args.push("--resume", o.sessionId);
  if (o.permissionMode) args.push("--permission-mode", o.permissionMode);
  if (o.model) args.push("--model", o.model);
  if (o.allowedTools?.length) args.push("--allowedTools", o.allowedTools.join(","));
  return args;
}

/**
 * Run one headless Claude Code turn and stream its events.
 * The prompt goes over stdin so it can never be mistaken for a CLI flag.
 */
export async function* runClaude(o: RunOptions): AsyncGenerator<ClaudeEvent> {
  const child = spawn(o.bin ?? "claude", buildArgs(o), {
    cwd: o.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  let stderr = "";
  child.stderr.on("data", (d) => {
    stderr = (stderr + d.toString()).slice(-4000);
  });

  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
    child.on("close", (code, signal) => resolve({ code, signal })),
  );
  const spawnError = new Promise<never>((_, reject) => child.on("error", reject));
  spawnError.catch(() => {}); // surfaced below via race

  let killReason: string | null = null;
  const kill = (reason: string) => {
    if (child.exitCode !== null || killReason) return;
    killReason = reason;
    child.kill("SIGTERM");
    setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 5000).unref();
  };
  const onAbort = () => kill("stopped");
  o.signal?.addEventListener("abort", onAbort, { once: true });
  if (o.signal?.aborted) onAbort();
  const timer = o.timeoutMs ? setTimeout(() => kill("timed out"), o.timeoutMs) : null;

  child.stdin.on("error", () => {}); // child may exit before reading stdin
  child.stdin.end(o.prompt);

  let sawResult = false;
  try {
    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    for await (const line of rl) {
      for (const ev of parseStreamLine(line)) {
        if (ev.kind === "result") sawResult = true;
        yield ev;
      }
    }
    const { code } = await Promise.race([exited, spawnError]);
    if (killReason) throw new ClaudeRunError(`Run ${killReason}.`, killReason === "stopped");
    if (!sawResult) {
      const hint = stderr.trim().split("\n").slice(-5).join("\n");
      throw new ClaudeRunError(`claude exited with code ${code}${hint ? `:\n${hint}` : ""}`);
    }
  } finally {
    if (timer) clearTimeout(timer);
    o.signal?.removeEventListener("abort", onAbort);
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}

export class ClaudeRunError extends Error {
  constructor(
    message: string,
    readonly aborted = false,
  ) {
    super(message);
    this.name = "ClaudeRunError";
  }
}
