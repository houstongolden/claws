# Telegram & Slack Integration — Mapping System and Routing Logic

First-class Telegram and Slack integration routes incoming messages to Claws conversations via configurable channel mapping files. Agents respond in the mapped conversation (channel or project).

---

## 1. Configuration files

**Location:** `config/telegram.md` and `config/slack.md` (under workspace root).

### Format

Each file defines **mappings** from an external identifier to a Claws **destination**:

- **Telegram** (`config/telegram.md`):
  - `telegram_topic:` — Telegram chat ID (number) or, for forum topics, `chatId_threadId`.
  - `maps_to:` — Claws destination: `#channel-slug` or `project:project-slug`.

- **Slack** (`config/slack.md`):
  - `slack_channel:` — Slack channel ID (e.g. `C01234ABCD`) or channel name.
  - `maps_to:` — Same as Telegram: `#channel-slug` or `project:project-slug`.

### Example

```text
telegram_topic: 12345
maps_to: #sales

telegram_topic: 55555
maps_to: project:claws-so
```

```text
slack_channel: C01234ABCD
maps_to: #sales

slack_channel: C99999XYZ
maps_to: project:claws-so
```

- `#sales` → Claws **channel** with slug `sales` (creates channel if missing).
- `project:claws-so` → Claws **project** conversation with slug `claws-so` (creates project conversation if missing).

---

## 2. Mapping system

### Parser

**Module:** `apps/gateway/src/channelMapping.ts`

- **`parseMappingFile(content, keyPrefix)`**  
  - `keyPrefix`: `"telegram_topic"` or `"slack_channel"`.
  - Scans lines for `keyPrefix: value` and the next `maps_to: value`.
  - Returns `Map<string, string>`: external id → destination string (e.g. `"12345"` → `"#sales"`).
  - Blank lines separate entries; same-block pairing is supported.

- **`parseMappingEntries(content, keyPrefix)`**  
  - Returns `MappingEntry[]` for inspection/testing.

- **`parseDestination(destination)`**  
  - Normalizes a destination string:
    - `#something` → `{ type: "channel", slug }` (slug normalized to lowercase, alphanumeric + hyphens).
    - `project:something` → `{ type: "project", slug }`.
  - Returns `null` for invalid or empty destinations.

### Loading

- **When:** At gateway startup, after `initRuntimeDb`, before building the runtime.
- **Where:** `apps/gateway/src/main.ts`.
- **Paths:** `config/telegram.md` and `config/slack.md` under `workspaceRoot`.
- **Behavior:** If a file is missing, that integration’s map is empty. Parse errors are logged and maps stay empty.

### Runtime

- **`GatewayRuntime.inboundMappings`**  
  - `{ telegram: Map<string, string>, slack: Map<string, string> }`  
  - Populated from the parsed config files.

- **`GatewayRuntime.getOrCreateConversationForDestination(params)`**  
  - `params`: `{ type: "channel" | "project", slug: string }`.
  - Implemented via **runtime-db** `getOrCreateConversationForDestination`:
    - **Channel:** `listConversations({ type: "channel", channel_slug })`; if none, `createChannel({ channel_slug })`.
    - **Project:** `listConversations({ type: "project", project_slug })`; if none, `createConversation({ type: "project", project_slug, title })`.
  - Returns `{ id: conversationId }` so the gateway can post the inbound message to that conversation.

---

## 3. Routing logic

### Inbound endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/inbound/telegram` | Telegram webhook: route by chat/topic → mapped conversation, post message, return agent result. |
| POST | `/api/inbound/slack` | Slack Events API: route by channel → mapped conversation, post message, return agent result. |

### Telegram flow

1. **Parse body**  
   - Expects Telegram webhook payload with `message.chat.id`, `message.text`, and optionally `message.message_thread_id` (forum topic).

2. **Resolve mapping key**  
   - If `message_thread_id` is present: key = `"${chat.id}_${message_thread_id}"`, else key = `String(chat.id)`.
   - Lookup: `inboundMappings.telegram.get(key)` then fallback to `inboundMappings.telegram.get(String(chat.id))`.

3. **Resolve destination**  
   - `parseDestination(mapsTo)` → `{ type, slug }` or 400 if invalid.

4. **Get or create conversation**  
   - `getOrCreateConversationForDestination({ type, slug })` → `conv.id`.

5. **Post and respond**  
   - `postConversationMessage(conv.id, { message: text })` (adds user message, runs chat pipeline, persists assistant reply in that conversation).
   - Response: `200 { ok: true, conversationId, result }` (result = agent reply from pipeline).  
   - Errors: 400 (missing/invalid body or destination), 404 (no mapping), 503 (conversation resolution unavailable), 500 (post failed).

### Slack flow

1. **Parse body**  
   - Expects Slack event with `event.channel` and `event.text`.
   - **URL verification:** If `body.type === "url_verification"` and `body.challenge` is present, respond with `200 { challenge }` and stop.

2. **Resolve mapping**  
   - Key = `event.channel`.  
   - `inboundMappings.slack.get(channelId)` → `mapsTo` or 404.

3. **Resolve destination**  
   - Same as Telegram: `parseDestination(mapsTo)` → `{ type, slug }` or 400.

4. **Get or create conversation**  
   - Same as Telegram.

5. **Post and respond**  
   - Same as Telegram: `postConversationMessage(conv.id, { message: text })`, return `200 { ok: true, conversationId, result }`.

### Agent response in mapped conversations

- **`postConversationMessage`** (in `main.ts`) adds the user message to the conversation, links the conversation to a session if needed, and calls the same chat handler used for the dashboard (`handleChat` with the conversation’s `chat_id`/`thread_id`).
- The agent reply is stored as the next message in that conversation and returned in the HTTP response.
- So **all agent responses for that Telegram chat or Slack channel occur in the same mapped Claws conversation** (channel or project), and the reply is available both in the dashboard and in the API response (for the caller to send back to Telegram/Slack if desired).

---

## 4. Summary

- **Mapping system:** Config files `config/telegram.md` and `config/slack.md` define external id → `#channel-slug` or `project:project-slug`. Parser in `channelMapping.ts`; maps loaded at gateway startup and exposed as `runtime.inboundMappings`.
- **Routing logic:** POST `/api/inbound/telegram` and `/api/inbound/slack` resolve external id → destination → conversation (get-or-create), then `postConversationMessage` so agents respond in the mapped conversation; response includes `conversationId` and agent `result`.
