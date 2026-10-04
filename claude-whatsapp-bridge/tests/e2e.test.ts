import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { Bridge } from "../src/bridge.js";
import { runClaude } from "../src/claude.js";
import { loadConfig } from "../src/config.js";
import { Store } from "../src/db.js";
import { ChatQueue } from "../src/queue.js";
import { buildServer } from "../src/server.js";

const FAKE = fileURLToPath(new URL("./fixtures/fake-claude.mjs", import.meta.url));
const SID = "0f3e2a1b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";
const ME = "254700000000";
const SECRET = "app-secret";

function setup() {
  const projDir = mkdtempSync(join(tmpdir(), "proj-"));
  const config = loadConfig({
    WA_TOKEN: "t",
    WA_PHONE_NUMBER_ID: "1",
    WA_APP_SECRET: SECRET,
    WA_VERIFY_TOKEN: "verify-me",
    ALLOWED_NUMBERS: "+254 700 000 000",
    CLAUDE_BIN: FAKE,
    DEFAULT_CWD: tmpdir(),
    PROJECTS: `web=${projDir},ghost=/does/not/exist`,
    PROGRESS_INTERVAL_SEC: "0",
  });
  const store = new Store(":memory:");
  const queue = new ChatQueue();
  const sent: { to: string; text: string }[] = [];
  const wa = {
    sendText: async (to: string, text: string) => void sent.push({ to, text }),
    sendDocument: async (to: string, filename: string) => void sent.push({ to, text: `[doc ${filename}]` }),
    markReadTyping: async () => {},
  };
  const bridge = new Bridge({ config, store, wa, queue, run: runClaude });
  const app = buildServer({ config, store, bridge, logger: false });

  let n = 0;
  const send = async (text: string, from = ME, id = `wamid.${++n}`) => {
    const payload = JSON.stringify({
      entry: [{ changes: [{ field: "messages", value: { messages: [{ id, from, timestamp: "1", type: "text", text: { body: text } }] } }] }],
    });
    const res = await app.inject({
      method: "POST",
      url: "/webhook",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=" + createHmac("sha256", SECRET).update(payload).digest("hex"),
      },
      payload,
    });
    await new Promise((r) => setTimeout(r, 20));
    await queue.idle();
    return res;
  };
  const last = () => sent.at(-1)?.text ?? "";
  return { app, store, queue, sent, send, last, projDir };
}

let t: ReturnType<typeof setup>;
beforeEach(() => {
  t = setup();
});

describe("webhook", () => {
  it("answers Meta's verification handshake", async () => {
    const ok = await t.app.inject({ url: "/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42" });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toBe("42");
    const bad = await t.app.inject({ url: "/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42" });
    expect(bad.statusCode).toBe(403);
  });

  it("rejects unsigned requests", async () => {
    const res = await t.app.inject({ method: "POST", url: "/webhook", headers: { "content-type": "application/json" }, payload: "{}" });
    expect(res.statusCode).toBe(401);
  });

  it("ignores numbers that aren't allowlisted and duplicate deliveries", async () => {
    await t.send("hi", "15550001111");
    expect(t.sent).toHaveLength(0);
    await t.send("/help", ME, "dup");
    await t.send("/help", ME, "dup");
    expect(t.sent).toHaveLength(1);
  });
});

describe("conversation flow", () => {
  it("creates a session, then resumes it on the next message", async () => {
    await t.send("what's in this folder?");
    expect(t.last()).toContain("The folder has README.md and src.");
    expect(t.last()).toContain("[prompt=what's in this folder?]");
    expect(t.store.getChat(ME).active_session).toBe(SID);
    expect(t.store.getSession(SID)).toMatchObject({ name: "what's in this folder?", last_cost_usd: 0.099041 });

    await t.send("and now?");
    expect(t.store.listSessions(ME)).toHaveLength(1); // resumed, not a new one

    await t.send("/sessions");
    expect(t.last()).toContain("▶ *1.* what's in this folder?");
  });

  it("/new names the next session and /switch goes back", async () => {
    await t.send("first");
    await t.send("/new refactor");
    expect(t.store.getChat(ME).active_session).toBeNull();
    // The fake CLI always reports the same id for fresh sessions, so adopt a laptop session instead.
    const laptop = "11111111-2222-4333-8444-555555555555";
    await t.send(`/switch ${laptop}`);
    expect(t.last()).toContain("Switched to *imported 11111111*");
    await t.send("continue");
    expect(t.store.getChat(ME).active_session).toBe(laptop);
    await t.send("/switch 2");
    expect(t.store.getChat(ME).active_session).toBe(SID);
  });

  it("/project changes the working directory", async () => {
    await t.send("/project ghost");
    expect(t.last()).toContain("doesn't exist");
    await t.send("/project web");
    await t.send("where am I?");
    expect(t.last()).toContain(`[cwd=${t.projDir}]`);
  });

  it("/stop aborts a running job", async () => {
    const payload = t.send("HANG please");
    await new Promise((r) => setTimeout(r, 300));
    await t.send("/stop");
    await payload;
    const texts = t.sent.map((s) => s.text);
    expect(texts).toContain("🛑 Stopping…");
    expect(texts).toContain("🛑 Stopped.");
  });

  it("reports CLI failures to the user", async () => {
    await t.send("CRASH");
    expect(t.last()).toMatch(/⚠️ claude exited with code 1:\nError: not logged in/);
  });

  it("passes unknown slash commands through to Claude", async () => {
    await t.send("/compact");
    expect(t.last()).toContain("[prompt=/compact]");
  });
});
