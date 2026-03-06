# Slack-Style Channels — Implementation Report

Claws.so now supports **Slack-style channels**: persistent, topical communication streams with hash-style names (#general, #fitness, #sales, etc.). Channels use the existing conversation type `channel` and extend it with pinned agents, agent membership APIs, and metadata for workflows and scheduled reports.

---

## 1. Schema changes

**Package:** `packages/runtime-db`  
**Files:** `schema.ts`, `index.ts`

### Conversations (existing, used for channels)

- **Type:** `channel` (already in `CONVERSATION_TYPES`).
- **Columns:** `channel_slug` (e.g. `general` for #general), `title`, `metadata` (JSONB).
- **Uniqueness:** One row per channel per workspace via new partial unique index.

### New / updated

**`conversation_agents`**

- **New column:** `pinned` (BOOLEAN NOT NULL DEFAULT FALSE).
- Used for “pinned” agents that are primary responders for the channel.
- Existing DBs get the column via migration (see below).

**Unique channel slug per workspace**

- **Index:** `idx_conversations_channel_slug_uniq` on `(workspace_id, channel_slug)` WHERE `type = 'channel' AND channel_slug IS NOT NULL`.
- Ensures one channel per slug per workspace (e.g. one #general per workspace).

**Migration (existing DBs)**

- **`CHANNELS_SCHEMA_SQL`** (run after `INTELLIGENCE_SCHEMA_SQL` in `initRuntimeDb`):
  - `ALTER TABLE conversation_agents ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE`
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_channel_slug_uniq ON conversations(...) WHERE type = 'channel' AND channel_slug IS NOT NULL`

### Pinned agents, workflows, scheduled reports

- **Pinned agents:** Stored in `conversation_agents` with `pinned = TRUE`.
- **Automated workflows / scheduled reports:** Intended to be stored in `conversations.metadata` (e.g. `workflow_ids`, `scheduled_reports`). No new tables; UI and automation can be added later.

---

## 2. Runtime-DB API

**New / updated in `packages/runtime-db/src/index.ts`:**

- **`channelSlugFromName(name)`** — Normalizes to a slug: lowercase, strip leading #, replace non-alphanumeric with `-`, trim, max 80 chars.
- **`listChannels(workspaceId?, limit?)`** — Lists conversations with `type = 'channel'` (delegates to `listConversations({ type: 'channel', ... })`).
- **`createChannel({ channel_slug, title?, workspace_id?, metadata? })`** — Creates a conversation with `type = 'channel'`, slug from `channelSlugFromName(channel_slug)`. Fails if slug is empty or duplicate.
- **`getConversationAgents(conversationId)`** — Returns rows from `conversation_agents` (id, conversation_id, agent_id, role, pinned), ordered by pinned DESC then agent_id.
- **`addConversationAgent(conversationId, agentId, { role?, pinned? })`** — Insert or update (ON CONFLICT) one agent for the conversation.
- **`removeConversationAgent(conversationId, agentId)`** — Delete one agent from the conversation.

---

## 3. Gateway API

**New routes in `apps/gateway/src/httpServer.ts`:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/channels` | List channels (conversations with type=channel). Returns `{ ok, channels }`. |
| POST | `/api/channels` | Create channel. Body: `{ channel_slug, title? }`. Returns `{ ok, channel }`. |
| GET | `/api/conversations/:id/agents` | List agents for a conversation (channel). Returns `{ ok, agents }`. |
| POST | `/api/conversations/:id/agents` | Add agent. Body: `{ agent_id, role?, pinned? }`. Returns `{ ok }`. |
| DELETE | `/api/conversations/:id/agents/:agentId` | Remove agent. Returns `{ ok }`. |

**Runtime wiring in `main.ts`:**  
`listChannels`, `createChannel`, `getConversationAgents`, `addConversationAgent`, `removeConversationAgent` are connected to the runtime-db functions above.

---

## 4. UI changes

### Sidebar (Nav)

**File:** `apps/dashboard/components/nav.tsx`

- **Channels section** (between Projects and Chats):
  - Label “Channels” with Hash icon.
  - **Create channel:** Button “Create channel” toggles an inline form (name input + Create / Cancel).
  - **Channel list:** Each channel shown as `#<channel_slug>` (e.g. #general, #fitness). Click selects that channel and opens it in the main chat area.
- **Create flow:** User enters name (e.g. `general` or `#general`); slug is normalized; `createChannel` is called; new channel is prepended to list and selected.
- **Select flow:** On channel click, `ensureChatInList(channel.id, undefined, '#<slug>')` adds the channel to the chat list if needed, then `selectChat(channel.id)` and navigate to `/` so the session workbench loads that conversation.

### Session workbench (channel = conversation)

**File:** `apps/dashboard/components/session-workbench.tsx`

- **Current chat id:** When `currentMeta.chatId` (or `meta.chatId`) starts with `conv_`, the current “chat” is treated as a **conversation** (e.g. a channel).
- **Load history:** For `conv_*`, history is loaded via `getConversationMessages(chatId)` and mapped to `ChatEntry[]`; otherwise `loadHistoryForChat(chatId)` as before.
- **Persist history:** For `conv_*`, the “persist history” effect does nothing (server already stores messages for the conversation).
- **Send message:** For `conv_*`, the workbench calls `postConversationMessage(meta.chatId, { message, history })` instead of `/api/chat` or `/api/chat/stream`, then updates local state with the returned assistant summary.

So opening a channel in the sidebar and sending messages uses the conversation APIs end-to-end; no duplicate persistence.

### Dashboard API

**File:** `apps/dashboard/lib/api.ts`

- **Types:** `ChannelInfo`, `ConversationAgent`.
- **Functions:** `getChannels()`, `createChannel({ channel_slug, title? })`, `getConversationAgents(conversationId)`, `addConversationAgent(conversationId, { agent_id, role?, pinned? })`, `removeConversationAgent(conversationId, agentId)`, `getConversationMessages(conversationId, limit?)`, `postConversationMessage(conversationId, { message, history? })`.

---

## 5. Channel lifecycle

1. **List:** Dashboard loads channels with `GET /api/channels` and shows them in the sidebar as #slug.
2. **Create:** User clicks “Create channel”, enters a name; dashboard calls `POST /api/channels` with normalized slug; new channel appears in the list and can be selected.
3. **Open:** User clicks a channel → `ensureChatInList(conversationId, undefined, '#slug')` → `selectChat(conversationId)` → navigate to `/` → workbench loads messages via `GET /api/conversations/:id/messages` and displays them.
4. **Send:** User sends a message → workbench calls `POST /api/conversations/:id/message` with message and history → gateway runs the same chat pipeline as for sessions and persists the turn to the conversation → workbench updates UI from the response.
5. **Agents:** Agents can be added/removed and marked pinned via `GET/POST/DELETE /api/conversations/:id/agents`. No sidebar UI for this yet; any client (e.g. a channel settings view) can use these endpoints.
6. **Workflows / scheduled reports:** Reserved in `conversations.metadata` (e.g. `workflow_ids`, `scheduled_reports`). No automation or UI implemented yet; schema and API are ready for future use.

---

## 6. Summary

- **Schema:** Channel = conversation with `type = 'channel'` and unique `channel_slug` per workspace; `conversation_agents.pinned`; optional metadata for workflows/scheduled reports.
- **API:** List/create channels; list/add/remove conversation agents (with pinned flag); existing conversation message APIs used for channel chat.
- **UI:** Sidebar “Channels” section with # naming, create-channel form, and channel click-to-open; workbench uses conversation APIs when the current chat id is a conversation id (`conv_*`).
- **Lifecycle:** Create → list → open (select conversation) → send (post message to conversation); agent membership and future workflows/scheduled reports are API-ready with minimal UI so far.
