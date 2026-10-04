import { z } from "zod";

const csv = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Normalise a phone number to WhatsApp's wa_id form: digits only, no "+". */
export const normalizeNumber = (n: string) => n.replace(/\D/g, "");

const schema = z.object({
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default("0.0.0.0"),

  WA_TOKEN: z.string().min(1),
  WA_PHONE_NUMBER_ID: z.string().min(1),
  WA_APP_SECRET: z.string().min(1),
  WA_VERIFY_TOKEN: z.string().min(1),
  WA_API_VERSION: z.string().default("v23.0"),
  /** Override only for testing against a mock Graph API. */
  WA_API_BASE_URL: z.string().url().default("https://graph.facebook.com"),

  ALLOWED_NUMBERS: z
    .string()
    .min(1, "ALLOWED_NUMBERS must list at least one number")
    .transform((s) => csv(s).map(normalizeNumber)),

  CLAUDE_BIN: z.string().default("claude"),
  DEFAULT_CWD: z.string().default(process.cwd()),
  /** Named projects, e.g. "web=/home/me/web,api=/home/me/api". */
  PROJECTS: z
    .string()
    .default("")
    .transform((s) =>
      Object.fromEntries(
        csv(s).map((pair) => {
          const i = pair.indexOf("=");
          if (i < 1) throw new Error(`Bad PROJECTS entry "${pair}" (expected name=/path)`);
          return [pair.slice(0, i).trim().toLowerCase(), pair.slice(i + 1).trim()];
        }),
      ) as Record<string, string>,
    ),
  PERMISSION_MODE: z
    .enum(["default", "acceptEdits", "auto", "bypassPermissions", "plan"])
    .default("acceptEdits"),
  ALLOWED_TOOLS: z.string().default("").transform(csv),
  MODEL: z.string().optional(),
  /** Hard cap for a single run, in minutes. */
  RUN_TIMEOUT_MIN: z.coerce.number().positive().default(30),
  /** Minimum seconds between progress pings while Claude works. */
  PROGRESS_INTERVAL_SEC: z.coerce.number().nonnegative().default(30),

  DB_PATH: z.string().default("./bridge.db"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  return parsed.data;
}
