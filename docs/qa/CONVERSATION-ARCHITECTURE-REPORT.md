# Conversation Architecture Report

Claws.so now has a **richer conversation model** supporting one-off sessions, project chats, channel-based chats, and agent conversations. This document describes the new schema, gateway APIs, and how conversations are modeled.

---

## 1. Conversation types

Four conversation types are supported:

| Type      | Description |
|-----------|-------------|
| `session` | One-off or local chat; can be linked to a legacy `chat_id`/`thread_id` session. |
| `project` | Scoped to a project (`project_slug`). |
| `channel` | Scoped to a channel (`channel_slug`). |
| `agent`   | Conversation with one or more agents (participants/agents tables). |

---

## 2. New schema (runtime-db)

All new objects live in **PGlite** under `.claws/runtime`. Applied after the existing schema via `CONVERSATIONS_SCHEMA_SQL`.

### 2.1 Tables

**`conversations`**

- `id` (TEXT PK) – e.g. `conv_<timestamp>_<random>`
- `type` – `session` | `project` | `channel` | `agent`
- `title` – display title (default `''`)
- `project_slug` – optional project scope
- `channel_slug` – optional channel scope
- `metadata` (JSONB) – arbitrary metadata
- `tags` (JSONB array) – tags for filtering/organization
- `workspace_id` – default `ws_local`
- `chat_id`, `thread_id` – optional; link to legacy session for `session` type
- `created_at`, `updated_at` (BIGINT)

Indexes: `type`, `updated_at DESC`, `project_slug`, `channel_slug`.

**`messages` (extended)**

- Existing columns unchanged.
- New: `conversation_id` (TEXT, FK to `conversations(id)` ON DELETE SET NULL), nullable for backward compatibility.
- Index: `(conversation_id, created_at ASC)`.

**`conversation_participants`**

- `id`, `conversation_id` (FK CASCADE), `participant_type` (`human` | `agent`), `participant_id`, `role`, `joined_at`.
- UNIQUE `(conversation_id, participant_type, participant_id)`.

**`conversation_agents`**

- `id`, `conversation_id` (FK CASCADE), `agent_id`, `role`.
- UNIQUE `(conversation_id, agent_id)`.

**`conversation_tasks`**

- `id`, `conversation_id` (FK CASCADE), `task_ref`, `summary`, `created_at`.
- Links to task events or external task ids.

**`conversation_memories`**

- `id`, `conversation_id` (FK CASCADE), `memory_ref`, `summary`, `created_at`.
- Links to memory store entries.

**`conversation_artifacts`**

- `id`, `conversation_id` (FK CASCADE), `artifact_ref`, `type`, `created_at`.
- Links to files, links, etc.

---

## 3. Runtime-db API (packages/runtime-db)

- **`createConversation(params)`** – Creates a conversation; `params`: `type`, optional `title`, `project_slug`, `channel_slug`, `metadata`, `tags`, `workspace_id`, `chat_id`, `thread_id`. Returns `ConversationRow`.
- **`listConversations(filter)`** – Lists conversations; filter: optional `type`, `project_slug`, `channel_slug`, `limit`, `offset`. Ordered by `updated_at DESC`.
- **`getConversation(id)`** – Returns one conversation or `null`.
- **`getConversationByChatAndThread(chatId, threadId?)`** – Finds a conversation by linked `chat_id`/`thread_id` (for session-type).
- **`conversationToSessionId(conv)`** – Resolves a conversation to a session key when `chat_id` is set.
- **`addConversationMessage(conversationId, role, content, toolResults?)`** – Appends a message with `conversation_id` set; ensures a session exists (creates/updates `chat_id`/`thread_id` on the conversation if missing). Updates `conversations.updated_at`. Returns the new `MessageRow`.
- **`getConversationMessages(conversationId, limit?)`** – Returns messages for the conversation ordered by `created_at ASC`.
- **`replaceSessionMessages(sessionIdKey, messages, conversationId?)`** – Existing behavior; when `conversationId` is passed, all inserted messages get that `conversation_id` (so session persistence keeps conversation linkage when the session is backed by a conversation).

Session/conversation linkage:

- When a conversation has no `chat_id`, the first `addConversationMessage` allocates `chat_id = chat_<conversationId>` and creates a session; later messages use that session.
- `persistSessionHistory` (gateway) looks up a conversation by `chat_id`/`thread_id` and passes its `id` into `replaceSessionMessages`, so chat flows that persist history keep messages tied to the conversation.

---

## 4. Gateway APIs

Base path: gateway origin (e.g. `http://localhost:4317`). All return JSON with `ok: true | false` and error details when `ok === false`.

### 4.1 List conversations

- **`GET /api/conversations`**
- Query: `type`, `project_slug`, `channel_slug`, `limit` (default 50), `offset` (default 0).
- Response: `{ ok: true, conversations: ConversationRow[] }`.

### 4.2 Create conversation

- **`POST /api/conversations`**
- Body: `type` (required; `session` | `project` | `channel` | `agent`), optional `title`, `project_slug`, `channel_slug`, `tags`.
- Response: `{ ok: true, conversation: ConversationRow }`.

### 4.3 Get one conversation

- **`GET /api/conversations/:id`**
- Response: `{ ok: true, conversation: ConversationRow }` or 404.

### 4.4 Get conversation messages

- **`GET /api/conversations/:id/messages`**
- Query: `limit` (default 100).
- Response: `{ ok: true, messages: MessageRow[] }`.

### 4.5 Send a message (append only)

- **`POST /api/conversations/:id/message`**
- Body: `message` or `content` (required), optional `role` (`user` | `assistant`), optional `history`.
- Behavior:
  - If **`postConversationMessage`** is implemented (gateway): appends the user message, runs the full chat pipeline (AI + tools, same as `/api/chat`), persists history with conversation linkage, and returns the chat result.
  - Otherwise: appends the message with `addConversationMessage` and returns `{ ok: true, result: { appended: true } }`.

---

## 5. How conversations are modeled

- **Identity**: Each conversation has a unique `id`. Types distinguish usage: `session` (one-off/local), `project`, `channel`, `agent`.
- **Scope**: `project_slug` and `channel_slug` provide optional scope; list/filter use these.
- **Participants**: `conversation_participants` (human + agent) and `conversation_agents` (agents that can respond) support group chats and agent conversations; minimal columns for now.
- **Message history**: Messages can belong to a session and/or a conversation (`session_id` and optional `conversation_id`). Session-backed flows (e.g. dashboard chat with `chatId`/`threadId`) persist via `replaceSessionMessages` with `conversationId` when the session is linked to a conversation.
- **Session linkage**: For `session`-type conversations, `chat_id`/`thread_id` tie to the existing session key `session:chatId:threadId`. This allows the existing chat pipeline and the new conversation API to share the same message store.
- **Metadata**: `metadata` (JSONB) and `tags` (JSONB array) on `conversations` support minimal, flexible metadata without cluttering the UI.
- **Structured extraction**: Tables `conversation_tasks`, `conversation_memories`, and `conversation_artifacts` are in place for linking tasks, memory entries, and artifacts to a conversation; population and usage can be added later.

---

## 6. UI / dashboard

The layout is already conversation-first (chat list, starring, collapsible context panel). The **conversation API is implemented** so the dashboard can:

- Call **`GET /api/conversations`** for the sidebar list (with optional filters).
- Call **`GET /api/conversations/:id`** and **`GET /api/conversations/:id/messages`** when opening a conversation.
- Send messages via **`POST /api/conversations/:id/message`** (with optional `history` for context).

Current dashboard chat still uses localStorage and session storage; switching to these APIs is a separate step and can be done without cluttering the UI.

---

## 7. Files touched

| Area           | Files |
|----------------|-------|
| Schema         | `packages/runtime-db/src/schema.ts` (CONVERSATIONS_SCHEMA_SQL, CONVERSATION_TYPES, messages.conversation_id) |
| Runtime DB     | `packages/runtime-db/src/index.ts` (init, ConversationRow, create/list/get/getByChatAndThread, addConversationMessage, getConversationMessages, replaceSessionMessages with conversationId) |
| Gateway routes | `apps/gateway/src/httpServer.ts` (GET/POST /api/conversations, GET /api/conversations/:id, GET /api/conversations/:id/messages, POST /api/conversations/:id/message; GatewayRuntime extensions) |
| Gateway main   | `apps/gateway/src/main.ts` (imports, persistSessionHistory with conversationId, listConversations, createConversation, getConversation, getConversationMessages, addConversationMessage, postConversationMessage, chatRef for handleChat) |

---

## 8. Summary

- **New schema**: `conversations`, extended `messages`, `conversation_participants`, `conversation_agents`, `conversation_tasks`, `conversation_memories`, `conversation_artifacts`.
- **Types**: `session`, `project`, `channel`, `agent`.
- **Capabilities**: participants, project/channel scope, tags, metadata, message history, and tables for tasks/memories/artifacts.
- **APIs**: GET/POST `/api/conversations`, GET `/api/conversations/:id`, GET `/api/conversations/:id/messages`, POST `/api/conversations/:id/message`.
- **Model**: Conversations are first-class; messages can be scoped by both session and conversation; session persistence keeps conversation linkage when present; full chat pipeline is used for POST conversation message when implemented.
