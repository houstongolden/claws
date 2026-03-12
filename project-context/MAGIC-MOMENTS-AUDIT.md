# Magic Moments Audit

**Date:** 2025-03-06  
**Mode:** Magic-moment execution (re-prioritize roadmap around 4 moments; no broad dashboard polish).

## Product priorities (from PRD / OpenClaw response)

1. **Install + onboarding feels magical**
2. **Working persistent session chat**
3. **Agent visibly works** (live state, tool streaming, approvals)
4. **Proactive follow-up or scheduled brief** (proves AI OS, not chat app)

**Working chat** bar (PRD): Dashboard + gateway boot, session send/receive, **session persists across reload/restart**, tool events stream incrementally, traces update, approvals interrupt/gate correctly.

---

## 1. Install + onboarding feels magical

| Status | **Partial** |
|--------|--------------|
| **Evidence** | CLI: `claws setup`, `claws onboard`, `npx @claws-so/create`. Home dir, config, workspace bootstrap, doctor, status, TUI. Onboarding wizard with steps, env detection, next steps. |
| **Working** | setup/onboard/create flow exists; doctor has 8 categories and health score; status probes gateway; TUI has 6 panes and keyboard nav; shared vocab and cross-references. |
| **Blockers** | None critical. Polish is “good enough” for magic moment; further improvements are incremental. |
| **Next** | Validate locally with “local CLI validation” pass; fix any broken paths. |

---

## 2. Working persistent session chat

| Status | **Partial** |
|--------|--------------|
| **Evidence** | Gateway: `getSessionHistory` reads from PGlite `messages`; `persistSessionHistory` writes via `replaceSessionMessages`. Non-streaming `handleChat` persists user + assistant after turn. Streaming `handleChatStream` persists only user message after stream; **assistant reply is never written to DB**. Dashboard can send `history` from client; if client doesn’t send it, server loads from DB (but streaming path never saved assistant reply). |
| **Working** | Dashboard and gateway boot. Session send/receive. Approvals interrupt. Traces update. Tool events **are** emitted incrementally in SSE (`tool_call`, `tool_result` in `writeStreamToResponse`). Non-streaming chat persists full turn. |
| **Blockers** | **Streaming path does not persist assistant reply** after stream completes. So: reload/restart loses last assistant message unless client re-sends history. Client-sent history is the current workaround. |
| **Next** | After stream completes, append assistant message (and optional tool summary) to session in DB so reload shows full transcript without client re-sending history. |

---

## 3. Agent visibly works (live state, tool streaming, approvals)

| Status | **Partial** |
|--------|--------------|
| **Evidence** | Live state: `getSessionLiveState` aggregates traces, tool events, approvals, workflows. Traces and tool_events written in gateway. Approvals: enqueue, resolve, grants. SSE: `tool_call` / `tool_result` / `approval_requested` emitted in stream. |
| **Working** | Gateway emits tool_call and tool_result incrementally. Approvals gate high-risk tools; approval_requested in stream. Traces and tool_events stored and queryable. Live state API exists. |
| **Blockers** | Dashboard may not consume incremental tool events for live UI (may only show final complete payload). Not verified in this audit. |
| **Next** | Confirm dashboard chat UI consumes streamed tool_call/tool_result for incremental display. If not, add minimal UI to show tools as they complete. |

---

## 4. Proactive follow-up or scheduled brief

| Status | **Partial** |
|--------|--------------|
| **Evidence** | Proactivity: schema, jobs, executions, notifications, decision engine. API: jobs, run now, decisions. Dashboard: Proactivity page. Slash: /morning-brief, /eod, /watchdog. **No cron/interval scheduler** — jobs run on-demand or via slash only. |
| **Working** | Run job now works. Decision engine runs when job completes. Notifications and decisions visible in API and UI. |
| **Blockers** | **No process runs due jobs on a schedule.** So “scheduled brief” doesn’t run unless user triggers slash or “run now”. |
| **Next** | Add gateway loop or worker that polls `listDueScheduledJobs(now)` and runs due jobs (with cron parsing for next-run). |

---

## Summary table

| Magic moment                     | Status   | Main blocker(s) |
|----------------------------------|----------|------------------|
| 1. Install + onboarding          | Partial  | None critical    |
| 2. Working persistent session    | Partial  | Streaming path doesn’t persist assistant reply |
| 3. Agent visibly works            | Partial  | Dashboard incremental tool UI unverified |
| 4. Proactive follow-up / brief    | Partial  | No cron/interval scheduler for due jobs |

---

## Recommended implementation order

1. **Session persistence (streaming)** — Append assistant message (and optionally tool summary) to session after stream complete. Unblocks “session persists across reload” for streaming chat.
2. **Proactivity scheduler** — Poll due jobs and run them. Unblocks “scheduled brief” magic moment.
3. **Dashboard tool streaming UI** — Verify or add incremental display of tool_call/tool_result from SSE.
4. **Local CLI validation** — Run through commands and TUI; fix any broken flows.

No broad dashboard polish in this pass; only changes that directly support the four moments.

---

## Local CLI validation (executed this pass)

| Command | Result |
|---------|--------|
| `claws --help` | Working — workflow, categories, env docs |
| `claws setup` | Working — idempotent, shows config and next steps |
| `claws doctor` | Working — 8 categories, health score, fix suggestions, cross-refs |
| `claws status` | Working — config + services; when gateway down, suggests gateway/dashboard |
| `claws tui` | Working — pre-flight check, clean exit when gateway not running |
| `claws dashboard --help` | Working — See also present |
| `claws gateway --help` | Working — See also present |
| `claws chat` (no message) | Working — usage and examples |

**Conclusion:** CLI is usable and coherent. Full TUI interaction and `claws chat "msg"` require a running gateway (and AI keys); not run in this validation.

---

## Files touched in audit

- `apps/gateway/src/main.ts` (getSessionHistory, persistSessionHistory, handleChatStream)
- `apps/gateway/src/aiHandler.ts` (writeStreamToResponse — already emits tool_call/tool_result)
- `packages/runtime-db/src/index.ts` (appendMessage, getSessionMessages, replaceSessionMessages)
- `project-context/prd.md` (strategy and magic moments already updated)
- `project-context/next-pass.md` (to be updated to reflect this order)
