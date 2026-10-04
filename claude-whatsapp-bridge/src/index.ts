import "dotenv/config";
import { execFileSync } from "node:child_process";
import { Bridge } from "./bridge.js";
import { runClaude } from "./claude.js";
import { loadConfig } from "./config.js";
import { Store } from "./db.js";
import { ChatQueue } from "./queue.js";
import { buildServer } from "./server.js";
import { WhatsApp } from "./whatsapp.js";

const config = loadConfig();

try {
  const v = execFileSync(config.CLAUDE_BIN, ["--version"], { encoding: "utf8" }).trim();
  console.log(`Using ${v}`);
} catch {
  console.error(`Could not run "${config.CLAUDE_BIN} --version". Install Claude Code and log in first (run \`claude\` once).`);
  process.exit(1);
}

const store = new Store(config.DB_PATH);
store.pruneProcessed();
const queue = new ChatQueue();
const wa = new WhatsApp({
  token: config.WA_TOKEN,
  phoneNumberId: config.WA_PHONE_NUMBER_ID,
  apiVersion: config.WA_API_VERSION,
  baseUrl: config.WA_API_BASE_URL,
});
const bridge = new Bridge({ config, store, wa, queue, run: runClaude });
const app = buildServer({ config, store, bridge });

await app.listen({ port: config.PORT, host: config.HOST });

const shutdown = async () => {
  for (const n of config.ALLOWED_NUMBERS) queue.stop(n);
  await app.close();
  await Promise.race([queue.idle(), new Promise((r) => setTimeout(r, 10_000))]);
  store.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
