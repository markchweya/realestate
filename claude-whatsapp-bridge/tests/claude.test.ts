import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildArgs, ClaudeRunError, parseStreamLine, runClaude, summarizeTool } from "../src/claude.js";

const fixture = (f: string) => fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url));
const FAKE = fixture("fake-claude.mjs");
const SID = "0f3e2a1b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";

describe("parseStreamLine", () => {
  it("extracts init, tool, text and result events and skips noise", () => {
    const events = readFileSync(fixture("stream.ndjson"), "utf8").split("\n").flatMap(parseStreamLine);
    expect(events).toEqual([
      { kind: "init", sessionId: SID, cwd: "/home/me/project" },
      { kind: "tool", name: "Bash", summary: "List files in current directory" },
      { kind: "text", text: "The folder has README.md and src.\n\nDone." },
      {
        kind: "result",
        sessionId: SID,
        text: "The folder has README.md and src.\n\nDone.",
        isError: false,
        subtype: "success",
        costUsd: 0.099041,
        durationMs: 3165,
        numTurns: 2,
      },
    ]);
  });

  it("flags non-success results as errors", () => {
    const [ev] = parseStreamLine(JSON.stringify({ type: "result", subtype: "error_max_turns", is_error: false }));
    expect(ev).toMatchObject({ kind: "result", isError: true, subtype: "error_max_turns" });
  });
});

describe("summarizeTool", () => {
  it("summarises common tools", () => {
    expect(summarizeTool("Edit", { file_path: "/a/b/app.ts" })).toBe("app.ts");
    expect(summarizeTool("Bash", { command: "npm test" })).toBe("npm test");
    expect(summarizeTool("Grep", { pattern: "TODO" })).toBe("TODO");
    expect(summarizeTool("Mystery", {})).toBe("");
  });
});

describe("buildArgs", () => {
  it("adds resume, permission mode and tools", () => {
    const args = buildArgs({ prompt: "x", cwd: "/", sessionId: "abc", permissionMode: "acceptEdits", allowedTools: ["Read", "Bash(git:*)"] });
    expect(args).toContain("stream-json");
    expect(args.slice(args.indexOf("--resume"), args.indexOf("--resume") + 2)).toEqual(["--resume", "abc"]);
    expect(args.at(-1)).toBe("Read,Bash(git:*)");
    expect(args).not.toContain("x"); // prompt goes via stdin
  });
});

describe("runClaude", () => {
  const collect = async (it: AsyncIterable<unknown>) => {
    const out: any[] = [];
    for await (const e of it) out.push(e);
    return out;
  };

  it("streams events from the CLI and passes the prompt over stdin", async () => {
    const events = await collect(runClaude({ bin: FAKE, prompt: "--not-a-flag", cwd: "/tmp" }));
    expect(events.map((e) => e.kind)).toEqual(["init", "tool", "text", "result"]);
    expect(events.at(-1).text).toContain("[prompt=--not-a-flag]");
  });

  it("surfaces stderr when the CLI fails", async () => {
    await expect(collect(runClaude({ bin: FAKE, prompt: "CRASH", cwd: "/tmp" }))).rejects.toThrow(/not logged in/);
  });

  it("can be aborted", async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 200);
    const err = await collect(runClaude({ bin: FAKE, prompt: "HANG", cwd: "/tmp", signal: ac.signal })).catch((e) => e);
    expect(err).toBeInstanceOf(ClaudeRunError);
    expect(err.aborted).toBe(true);
  });

  it("times out", async () => {
    const err = await collect(runClaude({ bin: FAKE, prompt: "HANG", cwd: "/tmp", timeoutMs: 200 })).catch((e) => e);
    expect(err.message).toMatch(/timed out/);
  });
});
