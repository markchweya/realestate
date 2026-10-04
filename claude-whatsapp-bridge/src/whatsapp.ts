import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_TEXT = 4000; // WhatsApp hard limit is 4096; leave headroom.

/** Verify Meta's `X-Hub-Signature-256` header against the raw request body. */
export function verifySignature(rawBody: Buffer | string, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody).digest("hex"));
  const given = Buffer.from(header.slice("sha256=".length));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Split text into WhatsApp-sized chunks, preferring paragraph, then line, then word boundaries. */
export function chunk(text: string, max = MAX_TEXT): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = window.lastIndexOf("\n\n");
    if (cut < max * 0.5) cut = window.lastIndexOf("\n");
    if (cut < max * 0.5) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

export interface IncomingMessage {
  id: string;
  from: string;
  name?: string;
  timestamp: number;
  type: string;
  /** Text body, or the reply id/title for interactive messages. */
  text?: string;
}

/** Extract user messages from a Cloud API webhook payload (statuses etc. are ignored). */
export function parseWebhook(body: any): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (change?.field !== "messages" || !value?.messages) continue;
      const names = new Map<string, string>(
        (value.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name]),
      );
      for (const m of value.messages) {
        const text =
          m.type === "text"
            ? m.text?.body
            : m.type === "interactive"
              ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title)
              : m.type === "button"
                ? m.button?.text
                : undefined;
        out.push({
          id: m.id,
          from: m.from,
          name: names.get(m.from),
          timestamp: Number(m.timestamp) * 1000,
          type: m.type,
          text,
        });
      }
    }
  }
  return out;
}

export interface WhatsAppOptions {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  fetch?: typeof fetch;
  baseUrl?: string;
}

export class WhatsApp {
  private fetch: typeof fetch;
  private base: string;

  constructor(private o: WhatsAppOptions) {
    this.fetch = o.fetch ?? fetch;
    this.base = `${o.baseUrl ?? "https://graph.facebook.com"}/${o.apiVersion}/${o.phoneNumberId}`;
  }

  private async call(path: string, init: RequestInit): Promise<any> {
    const res = await this.fetch(`${this.base}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.o.token}`, ...(init.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (body as any)?.error;
      throw new Error(`WhatsApp API ${res.status}: ${err?.message ?? JSON.stringify(body)}`);
    }
    return body;
  }

  private post(payload: Record<string, unknown>) {
    return this.call("/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
  }

  /** Send text, split across several messages if needed. */
  async sendText(to: string, text: string, replyTo?: string) {
    const parts = chunk(text);
    for (const [i, body] of parts.entries()) {
      await this.post({
        recipient_type: "individual",
        to,
        type: "text",
        text: { body, preview_url: false },
        ...(i === 0 && replyTo ? { context: { message_id: replyTo } } : {}),
      });
    }
  }

  /** Mark a message read and show the "typing…" indicator (lasts up to 25s or until we reply). */
  async markReadTyping(messageId: string) {
    await this.post({ status: "read", message_id: messageId, typing_indicator: { type: "text" } });
  }

  async sendButtons(to: string, body: string, buttons: { id: string; title: string }[]) {
    await this.post({
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body.slice(0, 1024) },
        action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
      },
    });
  }

  /** Upload content as a file and send it as a document message. */
  async sendDocument(to: string, filename: string, content: string, caption?: string) {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "text/plain");
    form.append("file", new Blob([content], { type: "text/plain" }), filename);
    const { id } = await this.call("/media", { method: "POST", body: form });
    await this.post({
      to,
      type: "document",
      document: { id, filename, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
    });
  }
}
