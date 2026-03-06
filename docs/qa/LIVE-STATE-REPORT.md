# Live State — Implementation Report

Claws now exposes a **unified per-session “Live State”** so the agent feels like a **live working process**, not just a chat responder. The session view shows what the agent is doing, using, waiting on, and what changed — shifting from “conversation = messages” to “conversation = messages + state machine + active work graph.”

---

## 1. Session state schema

**Type:** `SessionLiveState` (in `packages/shared/src/types.ts` and dashboard `lib/api.ts`)

```ts
interface SessionLiveState {
  sessionId: string;
  currentGoal?: string;           // from intelligence summary or latest chat trace
  activeSubtask?: string;         // from latest trace summary
  recentTools: Array<{ toolName: string; ok: boolean; summary?: string; ts: number }>;
  pendingApprovals: Array<ApprovalItem>;
  activeWorkflows: Array<{ id: string; name: string; status: string }>;
  filesTouched: string[];        // from fs.read, fs.write, fs.append args.path
  extractedTasks: Array<{ title: string; priority?: string; project?: string }>;
  memoryCandidates: Array<{ text: string; source?: string }>;
  artifacts: Array<{ type: string; summary: string }>;  // draft-create, task-create from traces
  proposedNextActions: string[]; // key_insights + task events
}
```

Aggregator builds this from:

- **Traces** (by session) → currentGoal, activeSubtask, artifacts
- **Tool events** (by session) → recentTools, filesTouched
- **Conversation intelligence** (by session) → summary, extractedTasks, memoryCandidates, key_insights
- **Pending approvals** (global) → pendingApprovals
- **Workflow runs** (by chatId/threadId) → activeWorkflows (running/pending/waiting-approval)
- **Task events** (by session) → proposedNextActions

---

## 2. Gateway route

**Method/URL:** `GET /api/live-state?chatId=...&threadId=...`

- **Query:** `chatId` (required), `threadId` (optional).
- **Behavior:** Resolves session and returns aggregated live state.
  - If `chatId` is a conversation id (`conv_*`), loads conversation and uses `conv.chat_id` and `conv.thread_id` to resolve the linked session, then aggregates.
  - Otherwise uses `chatId` and `threadId` as the session key.
- **Response:** `200 { ok: true, state: SessionLiveState | null }`. `state` is `null` if the session cannot be resolved (e.g. conversation not yet linked).

---

## 3. Runtime-db changes

**New helpers:**

- `listTracesBySession(sessionIdKey, limit)` — traces for one session.
- `listToolEventsBySession(sessionIdKey, limit)` — tool_events for one session (returns `ToolEventRow[]` with tool_name, args, result, ok, created_at).
- `listWorkflowRunsByChat(chatId, threadId?)` — workflow runs for that chat/thread.
- `listTaskEventsBySession(sessionIdKey, limit)` — task_events for one session.
- `getSessionLiveState(chatId, threadId?)` — builds `SessionLiveState` from the above + intelligence + approvals.

**Constants:** `LIVE_STATE_RECENT_TOOLS = 10`, `LIVE_STATE_TRACES = 5`, `LIVE_STATE_TASK_EVENTS = 20`. Files touched are inferred from `fs.read` / `fs.write` / `fs.append` `args.path`.

---

## 4. UI: Live State Bar

**Component:** `apps/dashboard/components/live-state-bar.tsx`

- **Placement:** Directly above the composer in the session workbench (under the main content, above the input area).
- **Props:** `chatId`, `threadId`, optional `refreshTrigger` (incremented after send so the bar refetches).
- **Behavior:**
  - Fetches `GET /api/live-state?chatId=&threadId=` when `chatId` is set; refetches when `refreshTrigger` or session changes.
  - Renders a single compact strip with:
    - **Working on** — currentGoal or activeSubtask (truncated).
    - **Using** — recent tool names (deduped, up to 4).
    - **Waiting on** — pending approvals (link to `/approvals`), first tool name + count.
    - **Active workflow** — link to `/workflows`, first run name + count.
    - **Queued** — count of extracted tasks + proposed next actions.
    - **Saved** — count of memory candidates (“N notes to memory”).
    - **Files touched** — count and tooltip with paths.
  - If there is no data and no error, the bar is not rendered (no empty strip).
  - Loading shows “Updating…” with a spinner.
  - Styling: muted background, small text (11px), product-like (no debug look).

**Session workbench:**

- Imports `LiveStateBar`.
- Adds state `liveStateRefreshTrigger`; increments it in the `finally` of `sendMessage` (after every send, stream or not).
- Renders `LiveStateBar` with `chatId={currentMeta?.chatId ?? meta.chatId}`, `threadId={currentMeta?.threadId ?? meta.threadId}`, `refreshTrigger={liveStateRefreshTrigger}`.

---

## 5. Files changed

| Area | File |
|------|------|
| Shared type | `packages/shared/src/types.ts` — `SessionLiveState` |
| Runtime-DB | `packages/runtime-db/src/index.ts` — listTracesBySession, listToolEventsBySession, listWorkflowRunsByChat, listTaskEventsBySession, getSessionLiveState |
| Gateway | `apps/gateway/src/httpServer.ts` — `getSessionLiveState` on runtime, `GET /api/live-state` |
| Gateway main | `apps/gateway/src/main.ts` — getSessionLiveState with conv_ resolution, wire dbGetSessionLiveState |
| Dashboard API | `apps/dashboard/lib/api.ts` — `SessionLiveState`, `getLiveState(chatId, threadId?)` |
| Dashboard UI | `apps/dashboard/components/live-state-bar.tsx` — new component |
| Dashboard UI | `apps/dashboard/components/session-workbench.tsx` — LiveStateBar, liveStateRefreshTrigger |

---

## 6. How this makes Claws feel more like an AI OS

- **Before:** User sends a prompt → model replies → repeat. Traces, approvals, workflows, tasks, memory live on separate pages; the chat surface does not show “what the agent is doing right now.”
- **After:** The same chat surface shows a **Live State** strip that summarizes:
  - **Current goal / subtask** — from intelligence and latest trace (momentum).
  - **Tools in use** — recent tool names (visibility into actions).
  - **Blockers** — pending approvals with a direct link to resolve (supervision).
  - **Background work** — active workflows (operator feel).
  - **Queued / next** — extracted tasks and proposed actions (what’s next).
  - **Saved** — memory candidates (what was captured).
  - **Files touched** — which paths were read/written (audit and context).

So the user is **supervising an active operating process**: they see state, active work, attention (goal/subtask), background processes (workflows), pending decisions (approvals), and recent artifacts (files, memory) in one place, without leaving the session. The bar stays minimal and product-oriented, not a debug panel, which supports the “persistent coworker / operator with momentum” feel.

---

## 7. Possible next steps

- **Polling or SSE:** Refresh live state on a timer or via server-sent events so it updates during long runs without sending a new message.
- **Click-through:** Make “Working on”, “Queued”, “Files touched” open the right tab (traces, tasks, files) or a detail drawer.
- **Pause / resume:** Later, turn agent actions into resumable work items (pause, resume, reassign, promote to workflows) so the OS feeling goes beyond visibility into control.
