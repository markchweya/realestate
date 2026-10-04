import Fastify, { type FastifyInstance } from "fastify";
import type { Bridge } from "./bridge.js";
import type { Config } from "./config.js";
import type { Store } from "./db.js";
import { parseWebhook, verifySignature } from "./whatsapp.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export interface ServerDeps {
  config: Pick<Config, "WA_APP_SECRET" | "WA_VERIFY_TOKEN" | "ALLOWED_NUMBERS">;
  store: Pick<Store, "markProcessed">;
  bridge: Pick<Bridge, "handle">;
  logger?: boolean;
}

export function buildServer({ config, store, bridge, logger = true }: ServerDeps): FastifyInstance {
  const app = Fastify({ logger, bodyLimit: 1024 * 1024 });
  const allowed = new Set(config.ALLOWED_NUMBERS);

  // Keep the raw bytes: the signature is computed over the exact body Meta sent.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    req.rawBody = body as Buffer;
    try {
      done(null, body.length ? JSON.parse(body.toString("utf8")) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.get("/health", async () => ({ ok: true }));

  // Meta's one-time verification handshake when you register the webhook URL.
  app.get("/webhook", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === config.WA_VERIFY_TOKEN) {
      return reply.type("text/plain").send(q["hub.challenge"] ?? "");
    }
    return reply.code(403).send("Forbidden");
  });

  app.post("/webhook", async (req, reply) => {
    if (!req.rawBody || !verifySignature(req.rawBody, req.headers["x-hub-signature-256"] as string, config.WA_APP_SECRET)) {
      req.log.warn("rejected webhook with bad signature");
      return reply.code(401).send("Bad signature");
    }

    // Acknowledge right away; Meta retries anything slower than a few seconds.
    reply.code(200).send("OK");

    for (const msg of parseWebhook(req.body)) {
      if (!allowed.has(msg.from)) {
        req.log.warn({ from: msg.from }, "ignoring message from non-allowlisted number");
        continue;
      }
      if (!store.markProcessed(msg.id)) continue; // webhook retry
      bridge.handle(msg).catch((err) => req.log.error(err, "failed to handle message"));
    }
  });

  return app;
}
