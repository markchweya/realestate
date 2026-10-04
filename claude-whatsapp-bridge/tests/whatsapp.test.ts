import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chunk, parseWebhook, verifySignature, WhatsApp } from "../src/whatsapp.js";

describe("verifySignature", () => {
  const body = '{"hello":"world"}';
  const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
  it("accepts a valid signature", () => expect(verifySignature(body, sig, "s3cret")).toBe(true));
  it("rejects wrong secret, tampering and missing header", () => {
    expect(verifySignature(body, sig, "other")).toBe(false);
    expect(verifySignature(body + " ", sig, "s3cret")).toBe(false);
    expect(verifySignature(body, undefined, "s3cret")).toBe(false);
    expect(verifySignature(body, "sha256=abc", "s3cret")).toBe(false);
  });
});

describe("chunk", () => {
  it("leaves short text alone", () => expect(chunk("hi")).toEqual(["hi"]));
  it("splits on paragraph boundaries within the limit", () => {
    const text = ["a".repeat(60), "b".repeat(60), "c".repeat(60)].join("\n\n");
    const parts = chunk(text, 130);
    expect(parts).toEqual(["a".repeat(60) + "\n\n" + "b".repeat(60), "c".repeat(60)]);
  });
  it("hard-splits text with no whitespace", () => {
    const parts = chunk("x".repeat(250), 100);
    expect(parts.map((p) => p.length)).toEqual([100, 100, 50]);
  });
});

describe("parseWebhook", () => {
  it("extracts text and interactive messages, ignores statuses", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                contacts: [{ wa_id: "254700000000", profile: { name: "Mark" } }],
                messages: [
                  { id: "m1", from: "254700000000", timestamp: "1700000000", type: "text", text: { body: "hello" } },
                  { id: "m2", from: "254700000000", timestamp: "1700000001", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "y", title: "Yes" } } },
                  { id: "m3", from: "254700000000", timestamp: "1700000002", type: "image", image: { id: "img" } },
                ],
              },
            },
            { field: "messages", value: { statuses: [{ id: "s1", status: "read" }] } },
          ],
        },
      ],
    };
    const msgs = parseWebhook(body);
    expect(msgs.map((m) => [m.id, m.text, m.name])).toEqual([
      ["m1", "hello", "Mark"],
      ["m2", "Yes", "Mark"],
      ["m3", undefined, "Mark"],
    ]);
  });
});

describe("WhatsApp client", () => {
  it("sends chunked text with auth and reply context on the first part only", async () => {
    const calls: any[] = [];
    const wa = new WhatsApp({
      token: "T",
      phoneNumberId: "123",
      apiVersion: "v23.0",
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, auth: (init.headers as any).Authorization, body: JSON.parse(init.body as string) });
        return new Response('{"messages":[{"id":"x"}]}', { status: 200 });
      }) as any,
    });
    await wa.sendText("254700000000", "a".repeat(4500), "orig");
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("https://graph.facebook.com/v23.0/123/messages");
    expect(calls[0].auth).toBe("Bearer T");
    expect(calls[0].body.context).toEqual({ message_id: "orig" });
    expect(calls[1].body.context).toBeUndefined();
  });

  it("throws with the API's error message", async () => {
    const wa = new WhatsApp({
      token: "T",
      phoneNumberId: "123",
      apiVersion: "v23.0",
      fetch: (async () => new Response('{"error":{"message":"Re-engagement window closed"}}', { status: 400 })) as any,
    });
    await expect(wa.sendText("1", "hi")).rejects.toThrow(/400: Re-engagement window closed/);
  });
});
