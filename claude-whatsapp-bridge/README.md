# claude-whatsapp-bridge

Use **your own Claude Code** from WhatsApp. Send a message and Claude Code runs on your machine, in your project, with your login. The reply comes back to your phone. You can start, list, resume and switch sessions from the chat.

```
WhatsApp ─► Meta Cloud API ─► /webhook (signature-checked, allowlisted)
                                   ▼
                     per-chat queue (one run at a time)
                                   ▼
        claude -p --resume <id> --output-format stream-json   ← your Claude Code login
                                   ▼
                    reply (split into chunks, or a .md attachment)
```

- **No API key needed.** It drives the `claude` CLI you're already logged into, so usage counts against your Claude plan.
- **Real sessions.** Sessions started from WhatsApp show up in `claude --resume` on your computer. Sessions started on your computer can be picked up from WhatsApp with `/switch <session-id>`.
- **Full Claude Code.** Your `CLAUDE.md`, MCP servers, skills and settings all apply.

## Chat commands

| Command | What it does |
|---|---|
| *any text* | Prompt the active session (a new one is started if needed) |
| `/new [name]` | Start a fresh session |
| `/sessions` | List recent sessions |
| `/switch <n \| session-id>` | Resume a session |
| `/project [name]` | Show or change the project folder (from `PROJECTS`) |
| `/stop` | Cancel the current run and anything queued |
| `/status` | Active session, folder, running/idle, cost of the last run |
| `/help` | Show the commands |

Any other `/command` (e.g. `/compact`, or your custom commands) is passed through to Claude Code.

## Setup

### 1. Host
On the machine where your code lives (laptop, home server, VPS):

```bash
npm i -g @anthropic-ai/claude-code   # if you don't have it yet
claude                               # log in once, then exit
cd claude-whatsapp-bridge
npm install && npm run build
cp .env.example .env
```

### 2. WhatsApp Cloud API
1. Go to <https://developers.facebook.com/apps>, **Create app** → type **Business**, then add the **WhatsApp** product.
2. Under **WhatsApp → API Setup** you get a free **test number**. Add your own phone as a recipient. Copy the **Phone number ID** into `WA_PHONE_NUMBER_ID`.
3. Token: the temporary token on that page lasts 24h, which is fine for a first try. For a permanent one: **Business settings → System users → Add** → give it the app with `whatsapp_business_messaging` permission → **Generate token**. Put it in `WA_TOKEN`.
4. **App settings → Basic → App secret** goes in `WA_APP_SECRET`.
5. Set `WA_VERIFY_TOKEN` to any random string, and `ALLOWED_NUMBERS` to your number.

### 3. Public URL
Meta needs an HTTPS URL that reaches your machine. The easiest option is a Cloudflare tunnel:

```bash
npm start                                        # bridge on :3000
cloudflared tunnel --url http://localhost:3000   # prints https://<random>.trycloudflare.com
```

Use a named Cloudflare tunnel or an ngrok reserved domain so the URL stays the same.

### 4. Register the webhook
In **WhatsApp → Configuration → Webhook**:
- Callback URL: `https://<your-tunnel>/webhook`
- Verify token: your `WA_VERIFY_TOKEN`
- Click **Verify and save**, then **subscribe** to the `messages` field.

Send "hi" to the test number from your phone. 🎉

### 5. Keep it running (optional)
```bash
npm i -g pm2 && pm2 start dist/index.js --name claude-wa && pm2 save
```

## Security
- Only numbers in `ALLOWED_NUMBERS` get a response. Everything else is ignored and logged.
- Every webhook is checked against `X-Hub-Signature-256` using your app secret. Unsigned or tampered requests get a 401.
- Duplicate deliveries are ignored, so Meta's retries never run a prompt twice.
- Claude runs with `PERMISSION_MODE` (default `acceptEdits`: it can edit files in the project, and anything else needs to be allowed in `ALLOWED_TOOLS` or your Claude Code settings). Think twice before using `bypassPermissions`: anyone holding your phone can run commands on your machine.

## Limits & notes
- WhatsApp only lets a business reply within **24 hours** of your last message. The bridge only ever replies, so that's not an issue.
- Long replies are split into ~4000-character messages. Very long ones are sent as a short preview plus `claude-reply.md`.
- Sessions are tied to their folder. `/project` starts a new session in the new folder.
- Only text for now. Images and voice notes are on the roadmap.

## Development
```bash
npm run dev        # tsx watch
npm test           # vitest (uses a fake `claude` binary, no network)
npm run typecheck
```

## Roadmap
- Approve risky tool calls from WhatsApp (✅/❌ buttons via a `PreToolUse` hook)
- Voice notes → transcription → prompt; images → Claude vision
- Multiple users with their own allowlists and projects
