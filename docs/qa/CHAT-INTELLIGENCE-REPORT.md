# Chat Intelligence Analysis — Implementation Report

Claws.so now runs **automatic chat intelligence analysis** on each conversation. The AI extracts tasks, memory candidates, preferences, project updates, style hints, and key insights; results are stored in the runtime DB and surfaced in a **Chat intelligence** panel opened from the chat header.

---

## 1. Analysis pipeline

### Trigger

- Analysis runs **after each chat turn** when AI is enabled (`isAIEnabled()`).
- **Streaming:** After `persistSessionHistory` in `handleChatStream`, a background job runs analysis on `[history, new user message]` and upserts by `session_id`.
- **Non-streaming:** After `persistSessionHistory` in `handleChat`, a background job runs analysis on the full history including the new assistant reply and upserts by `session_id`.

Analysis is **fire-and-forget** (not awaited) so responses are not delayed.

### Extraction step

- **Module:** `apps/gateway/src/intelligenceAnalysis.ts`
- **Function:** `runChatIntelligenceAnalysis({ messages })`
- **Model:** Same as chat (`createAIModel()` from `aiHandler.ts`).
- **Input:** Last 20 messages (user/assistant) as a transcript.
- **Prompt:** System prompt instructs the model to output a **single JSON object** with:
  - `summary` — one short sentence
  - `detected_tasks` — `{ title, priority?, project? }[]`
  - `memory_candidates` — `{ text, source? }[]`
  - `preferences` — `{ key, value }[]`
  - `project_updates` — `{ project, update }[]`
  - `key_insights` — `string[]`
  - `style_hints` — `string[]`
- **Output:** Parsed JSON (with fallback to empty arrays on parse error), then passed to `upsertConversationIntelligence`.

### Storage

- **Key:** Either `session_id` (e.g. `session:chatId:threadId`) or `conversation_id`.
- **Upsert:** One row per session/conversation; updated in place on each run.
- **Tables:** See §2.

---

## 2. Storage schema

**Package:** `packages/runtime-db`  
**Schema:** `INTELLIGENCE_SCHEMA_SQL` in `schema.ts`, applied after `CONVERSATIONS_SCHEMA_SQL` in `initRuntimeDb`.

### Table: `conversation_intelligence`

| Column               | Type    | Description |
|----------------------|---------|-------------|
| `id`                 | TEXT PK | e.g. `intel_<timestamp>_<random>` |
| `session_id`         | TEXT    | Unique; key when using chatId/threadId |
| `conversation_id`    | TEXT    | Unique; key when using conversation API |
| `summary`            | TEXT    | Chat summary |
| `detected_tasks`     | JSONB   | `[{ title, priority?, project? }]` |
| `memory_candidates`  | JSONB   | `[{ text, source? }]` |
| `preferences`        | JSONB   | `[{ key, value }]` |
| `project_updates`    | JSONB   | `[{ project, update }]` |
| `key_insights`       | JSONB   | `string[]` |
| `style_hints`        | JSONB   | `string[]` |
| `analyzed_at`        | BIGINT  | Last analysis time |
| `message_count`      | INTEGER | Message count at analysis time |
| `created_at`         | BIGINT  | Row creation |
| `updated_at`         | BIGINT  | Last update |

**Constraints:** `CHECK (session_id IS NOT NULL OR conversation_id IS NOT NULL)`; `UNIQUE(session_id)`, `UNIQUE(conversation_id)`.

**Indexes:** `session_id`, `conversation_id`, `analyzed_at DESC`.

### Runtime-DB API

- **`upsertConversationIntelligence(key, payload)`** — `key` is `{ session_id? }` or `{ conversation_id? }`; `payload` is the extracted signals plus `message_count`. Inserts or updates the single row for that key.
- **`getIntelligenceBySession(sessionIdKey)`** — Returns the row for that session or `null`.
- **`getIntelligenceByConversation(conversationId)`** — Returns the row for that conversation or `null`.

**Types:** `IntelligenceSignals`, `IntelligenceRow` exported from `@claws/runtime-db`.

---

## 3. Gateway API

- **`GET /api/chat/intelligence?chatId=&threadId=`** — Returns `{ ok: true, intelligence: IntelligenceRow | null }` for the session identified by `chatId` and optional `threadId`. Used by the dashboard for the current chat.
- **`GET /api/conversations/:id/intelligence`** — Returns `{ ok: true, intelligence: IntelligenceRow | null }` for the given conversation.

Both delegate to the runtime’s `getChatIntelligence` / `getConversationIntelligence`, which call the runtime-db getters above.

---

## 4. UI integration

### Entry point

- **Location:** Chat header in `apps/dashboard/components/session-workbench.tsx` (same row as “Open context panel” and “New chat”).
- **Control:** Small **Activity** icon (pulse-style) button; tooltip “Chat intelligence”, `aria-label` “Open chat intelligence panel”.
- **Note:** The design asked for a “pulse” icon; `lucide-react` does not export `Pulse`, so **Activity** is used as the pulse/live indicator. It can be swapped for another icon if desired.

### Behavior

- **Click:** Toggles the intelligence panel and, when opening, fetches `GET /api/chat/intelligence?chatId=<meta.chatId>&threadId=<meta.threadId>` (using `meta` from chat list context).
- **Loading:** Shows “Analyzing conversation…” while the request is in flight.
- **Empty:** If there is no data, shows: “No analysis yet. Send messages and the AI will detect tasks, memories, and insights.”

### Intelligence panel (slide-over)

- **Layout:** Fixed overlay from the right; backdrop click or “×” closes it.
- **Sections (when data exists):**
  1. **Chat summary** — Single sentence.
  2. **Detected tasks** — List of task titles (and optional project).  
     - **“Create tasks now?”** — Creates one task per detected task via `createTask` (section “Active”, priority from extraction or P2). Button shows loading state while creating.
  3. **Memory candidates** — Each candidate: text, optional source, and **“Save memory?”**.  
     - **“Save memory?”** — Calls `runTool("memory.flush", { text, source })`, then if the result has `result.entry.id`, calls `createMemoryProposal({ entryId })` to promote to MEMORY.md (approval-gated).
  4. **Key insights** — Read-only list of insight strings.

Preferences, project updates, and style hints are stored and returned by the API but are not yet rendered in the panel (can be added later).

---

## 5. Files touched

| Area            | Files |
|-----------------|-------|
| Schema          | `packages/runtime-db/src/schema.ts` — `INTELLIGENCE_SCHEMA_SQL`, `conversation_intelligence` table |
| Runtime DB      | `packages/runtime-db/src/index.ts` — `initRuntimeDb` runs `INTELLIGENCE_SCHEMA_SQL`; `IntelligenceSignals`, `IntelligenceRow`, `upsertConversationIntelligence`, `getIntelligenceBySession`, `getIntelligenceByConversation` |
| Analysis        | `apps/gateway/src/intelligenceAnalysis.ts` — `runChatIntelligenceAnalysis` (AI extraction, JSON parse, return typed signals) |
| Gateway main    | `apps/gateway/src/main.ts` — Imports; after `persistSessionHistory` in stream and non-stream flows, background call to `runChatIntelligenceAnalysis` then `upsertConversationIntelligence` by `session_id`; `getChatIntelligence`, `getConversationIntelligence` on runtime |
| Gateway HTTP    | `apps/gateway/src/httpServer.ts` — `GET /api/chat/intelligence`, `GET /api/conversations/:id/intelligence`; `GatewayRuntime.getChatIntelligence`, `getConversationIntelligence` |
| Dashboard API   | `apps/dashboard/lib/api.ts` — `IntelligenceSignals`, `IntelligenceData`, `getChatIntelligence` |
| Dashboard UI    | `apps/dashboard/components/session-workbench.tsx` — Activity icon in header; state for panel open, intelligence data, loading, creating tasks, saving memory; slide-over panel with summary, detected tasks + “Create tasks now?”, memory candidates + “Save memory?”, key insights |

---

## 6. Summary

- **Pipeline:** Each message turn (stream or non-stream) triggers a background AI extraction over the last 20 messages; structured signals are written to `conversation_intelligence` keyed by `session_id` (or `conversation_id` when using the conversation API).
- **Schema:** One row per session/conversation; JSONB columns for tasks, memory candidates, preferences, project updates, insights, style hints; `analyzed_at` and `message_count` for freshness.
- **API:** `GET /api/chat/intelligence` and `GET /api/conversations/:id/intelligence` return the stored row.
- **UI:** Activity (pulse-style) icon in the chat header opens a slide-over panel with Chat summary, Detected tasks (“Create tasks now?”), Memory candidates (“Save memory?”), and Key insights; actions call existing `createTask`, `runTool("memory.flush")`, and `createMemoryProposal` APIs.
