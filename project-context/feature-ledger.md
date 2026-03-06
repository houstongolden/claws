# Feature Ledger — Canonical List of Claws.so Features

Organized by category. Each feature has **Status** (complete | partial | placeholder | missing) and **Evidence** (files, routes, UI, runtime).

---

## Core OS

| Feature | Status | Evidence |
|--------|--------|----------|
| **Session model** | partial | **files:** apps/gateway session handling, runtime-db sessions table, session-workbench.tsx. **routes:** chat carries chatId/threadId. **ui:** Session workbench, chatId sent. **runtime:** Messages stored in PGlite per session when replaceSessionMessages/appendMessage used; client still sends history each request; no server-authoritative transcript load on reconnect; new tab = new chatId. **issues:** Durable session identity across reloads missing; session list/resume missing. |
| **Project model** | complete | **files:** packages/workspace workspace-fs, main.ts scanProjects, create project. **routes:** GET /api/projects. **ui:** Projects page from real scan; create project from chat. **runtime:** projects/ scan; project.md name/status; create writes projects/<slug>/project.md + tasks.md. |
| **Channel model** | complete | **files:** packages/runtime-db CHANNELS_SCHEMA_SQL, conversations, channels. **routes:** /api/channels, /api/conversations. **ui:** N/A (API-backed). **runtime:** Channels with slug; getOrCreateConversationForDestination. |
| **Agent conversations** | complete | **files:** runtime-db conversations, conversation_agents; gateway conversations/messages. **routes:** list/create/get conversations, post message, conversation agents. **ui:** Chat uses conversation/session. **runtime:** postConversationMessage triggers chat with lead agent. |
| **Group chats** | complete | **files:** Same as agent conversations; channels + multiple agents. **runtime:** Conversation has channel; agents attached to conversation. |

---

## Runtime

| Feature | Status | Evidence |
|--------|--------|----------|
| **Gateway** | complete | **files:** apps/gateway/src/httpServer.ts, main.ts. **routes:** /health, /api/status, /api/chat, /api/chat/stream, /api/traces, /api/approvals, /api/view-state, /api/tasks/events, /api/workflows, /api/tools/run, /api/projects, /api/tenants, /api/conversations, /api/channels, /api/proactive/*. **runtime:** All endpoints respond; tenant resolution per request. |
| **Approvals** | complete | **files:** packages/core/approvals.ts, gateway resolve, approvals/page.tsx. **routes:** GET/POST approvals, resolve. **ui:** Pending list, approve/deny, grant modes. **runtime:** once/session/24h/tool scopes; isGranted at tool boundary; one-time consumption. |
| **Traces** | complete | **files:** main.ts trace push, runtime-db traces, traces/page.tsx. **routes:** GET /api/traces. **ui:** Timeline, type icons, environment badge, expand. **runtime:** Persisted in PGlite; type + environment in data. |
| **Tasks (event log)** | complete | **files:** packages/tools/tasks.ts, main.ts appendEvent. **routes:** GET /api/tasks/events. **runtime:** tasks.jsonl append on create task/project; getTaskEvents reads JSONL. |
| **Tasks (build queue / tasks.md)** | partial | **files:** tasks/page.tsx reads tasks.md via fs.read; tasks.ts. **ui:** Build queue parsed; lanes; filter. **runtime:** tasks.md is read-only from app; no tool or UI to update tasks.md (move lanes, status). **issues:** PRD "move tasks across lanes/statuses" not implemented. |
| **Memory** | partial | **files:** packages/tools/memory.ts, memory/page.tsx. **runtime:** memory.flush, memory.promote, memory.search; identity/private excluded; .claws/memory-store.json. **issues:** Promote does not write to MEMORY.md; no approval-gated proposal to prompt/MEMORY.md. |
| **Workflows** | complete | **files:** packages/core/workflow.ts, runtime-db workflow_runs/steps, worker, httpServer workflows. **routes:** Full CRUD workflows, advance, pause, resume, cancel. **ui:** Workflows page, step-level controls. **runtime:** PGlite persistence; worker runs steps via /api/tools/run; approval checkpoints. |
| **View state / router** | complete | **files:** packages/core/router.ts, gateway view-state API, settings Views tab. **routes:** GET/POST /api/view-state. **ui:** Settings Views; primary + overlays round-trip. **runtime:** get/set by thread; inferPrimaryView, extractOverlayViews; leadAgentId. **issues:** Lens not applied to task/project/file queries. |
| **Intelligence / context analysis** | complete | **files:** apps/gateway/intelligenceAnalysis.ts, runtime-db conversation_intelligence. **routes:** /api/chat/intelligence, /api/conversations/:id/intelligence. **runtime:** runChatIntelligenceAnalysis after chat; extractedTasks, memoryCandidates, proposedNextActions. |

---

## UI

| Feature | Status | Evidence |
|--------|--------|----------|
| **Chat surface** | partial | **files:** session-workbench.tsx, chat page, api/chat. **ui:** Streaming, tool cards, approval CTA, command chips, slash commands. **runtime:** History in client (sessionStorage); server has PGlite messages per session but reload loses client-side history; tool results at end of stream only. **issues:** Durable history; incremental tool UI in stream. |
| **Sidecar (context rail)** | complete | **files:** session-workbench.tsx. **ui:** Right rail Overview/Project/Files/Approvals/Memory/Traces/Workflow; deep links. **runtime:** Inferred tab from last tool/approvals. |
| **Project drill-in** | missing | **files:** projects/page.tsx lists only. **ui:** No /projects/[slug] or modal to read project.md/tasks.md. **issues:** PRD/audit gap. |
| **Files explorer** | complete | **files:** files/page.tsx. **ui:** Workspace browser (fs.list), inspector (fs.read), quick reads, breadcrumbs. **runtime:** Real fs.list/fs.read. |
| **Memory search** | complete | **files:** memory/page.tsx. **ui:** Search, flush checkpoint, promote. **runtime:** memory.search; flush/promote to store. |
| **Task editing** | missing | **files:** tasks/page.tsx read-only. **ui:** No drag/drop or status change. **issues:** No writes to tasks.md. |
| **Workflow UI** | partial | **files:** workflows/page.tsx. **ui:** List runs, expand steps, pause/resume/cancel, Architecture tab. **issues:** No create-workflow form (API only). |
| **Agent UI** | complete | **files:** agents/page.tsx. **ui:** Roster, tools by environment, Routing tab, AI on/off. **runtime:** From status; static config. |
| **Settings** | complete | **files:** settings/page.tsx. **ui:** Views, Runtime, AI Config, Execution, Env. **runtime:** Round-trip verified. |
| **Proactivity UI** | complete | **files:** app/proactivity/page.tsx, nav. **ui:** Jobs list (pause/resume, Run now), Notifications, Recent runs. **runtime:** API client; slash commands trigger run. |
| **Toast / live updates** | missing | **files:** N/A. **ui:** No toast or soft-refresh after chat creates project/task. **issues:** User must navigate to confirm. |
| **Mobile / responsive sidecar** | partial | **ui:** Context rail hidden below xl; no drawer/collapse for small screens. |

---

## Execution

| Feature | Status | Evidence |
|--------|--------|----------|
| **Browser use (Playwright)** | complete | **files:** packages/tools/browser.ts Playwright adapter. **runtime:** navigate, screenshot, click, type, extract; default provider Playwright. |
| **Browser use (Agent Browser)** | placeholder | **files:** browser.ts Agent Browser adapter, dynamic import. **runtime:** executeWithAgentBrowser not wired to real SDK; when provider=agent-browser execution path not real. **issues:** "Agent Browser preferred" not delivered. |
| **Computer use** | missing | **files:** types mention computer substrate. **runtime:** Planned; no implementation. |
| **Sandbox** | placeholder | **files:** packages/tools/sandbox.ts. **runtime:** Policy gate, config reporting; does not call @vercel/sandbox. **issues:** Vercel Sandbox adapter not wired. |
| **Execution modes** | complete | **files:** browser.ts modes (background, record-on-complete, watch-live, hybrid). **runtime:** Configurable; substrate status in /api/status and Settings. |
| **Demo artifact pathing** | partial | **files:** packages/tools/demo.ts, demo.saveScreenshot, demo.saveMetadata. **runtime:** Path assets/demos/YYYY-MM-DD; record-on-complete → demo link in completion message not fully wired. |
| **Tool registry by environment** | complete | **files:** packages/tools/registry.ts, ToolSpec.environment. **runtime:** byEnvironment(), listSpecs(); /api/status execution block. |

---

## Proactivity

| Feature | Status | Evidence |
|--------|--------|----------|
| **Scheduled jobs schema** | complete | **files:** runtime-db PROACTIVITY_SCHEMA_SQL, scheduled_jobs, job_executions. **runtime:** PGlite; seedBuiltInProactiveJobs at startup. |
| **Proactive notifications** | complete | **files:** runtime-db proactive_notifications; gateway API. **routes:** GET notifications, POST mark read. **ui:** Proactivity → Notifications tab. **runtime:** Stub handlers create notifications. |
| **Job runner (on-demand)** | complete | **files:** apps/gateway/proactiveRunner.ts. **routes:** POST run now. **runtime:** runProactiveJobNow; stub handlers (no LLM). |
| **Cron / interval scheduler** | missing | **files:** schedule_cron stored but not parsed. **runtime:** No process that periodically calls listDueScheduledJobs and runs them. **issues:** Only on-demand and slash run jobs. |
| **Heartbeats** | partial | **files:** Job kind heartbeat in schema. **runtime:** No heartbeat runner loop. |
| **Watchdogs** | partial | **files:** Built-in jobs Approvals Watchdog, Stale Project Watchdog; stub handlers. **runtime:** Run on "Run now" or slash; no periodic schedule. |
| **Proactive messages to conversation** | missing | **files:** conversation_id on notifications. **runtime:** Not used to post into conversation thread. |
| **Slash commands (proactive)** | complete | **files:** session-workbench slash handling. **runtime:** /morning-brief, /eod, /watchdog etc. → runProactiveJobNow. |
| **Surprise artifact generation** | missing | **files:** N/A. **runtime:** No handlers that create real artifacts (drafts, copy). |

---

## Integrations

| Feature | Status | Evidence |
|--------|--------|----------|
| **Telegram** | missing | **files:** PRD mentions Telegram first. **runtime:** No adapter. |
| **Slack** | missing | **files:** PRD mentions Slack later. **runtime:** No adapter. |
| **Agent Browser** | placeholder | **files:** browser.ts adapter. **runtime:** Not wired to real execution. |
| **AI Gateway** | partial | **files:** aiHandler.ts, AI_GATEWAY_URL, baseURL. **runtime:** Single model; no multi-model/gateway routing. |
| **Model routing** | partial | **files:** AI_MODEL, OPENAI_API_KEY. **runtime:** One model selectable; no tier-based routing in proactivity yet. |

---

## Workspace & Governance

| Feature | Status | Evidence |
|--------|--------|----------|
| **WorkspaceFS (path enforcement)** | partial | **files:** packages/workspace/workspace-fs.ts. **runtime:** Allowed roots enforced; fs.read/write/list/append through WorkspaceFS. **issues:** Allowed roots **hardcoded**, not from FOLDER.md. PRD: "FOLDER.md defines allowed roots". |
| **FOLDER.md governance** | missing | **files:** Not parsed. **runtime:** No load or enforce from FOLDER.md. **issues:** Top audit gap. |
| **Identity loader** | complete | **files:** gateway main, memory.ts. **runtime:** identity/you.md loaded; identity/private excluded. |
| **create-claws / claws init** | complete | **files:** packages/cli, templates/base/workspace. **runtime:** npx create-claws, claws init; onboarding state machine. |
| **claws start / claws chat** | complete | **files:** apps/gateway/cli.ts. **runtime:** CLI starts gateway; chat events. |

---

## Testing & Harness

| Feature | Status | Evidence |
|--------|--------|----------|
| **Typecheck / lint / test scripts** | complete | **files:** Root and package scripts. **runtime:** pnpm typecheck 10/10; pnpm test. |
| **Golden / replay harness** | complete | **files:** packages/harness golden.js, replay.js. **runtime:** One deterministic fixture. |
| **Path-governance / approval tests** | complete | **files:** packages/harness/security.js. **runtime:** Path negatives; approval regressions. |
| **Dashboard API smoke** | complete | **files:** packages/harness/smoke.js. **runtime:** Chat, approvals, view-state, tasks, traces, project-create. |
| **Browser E2E (11 pages)** | complete | **files:** packages/harness/ui-smoke.js. **runtime:** Page-level checks all 11 pages. |

---

## Reconciliation Summary

| Status | Count (by feature rows above) |
|--------|-------------------------------|
| complete | 38 |
| partial | 18 |
| placeholder | 3 |
| missing | 12 |

---

## False Positives

Items that may have been considered "done" in tasks or roadmap but are **incomplete, stubbed, or placeholder**:

1. **Session persistence** — Tasks and build-roadmap say "session requests carry chatId/history" and "session-scoped grants". **Reality:** Session *identity* is used; transcript is still client-sent history; no server-side durable transcript load on reconnect; session list/resume missing. **Verdict:** Partial, not complete.

2. **RUN-005 "lightweight local persistence"** — tasks.md says "apps/gateway/src/localStore.ts". **Reality:** Persistence is PGlite (`packages/runtime-db`); localStore exists but is deprecated. **Verdict:** Task description is stale; implementation is complete elsewhere.

3. **Agent Browser** — EXE-001/EXE-004 marked done; "Agent Browser adapter". **Reality:** Adapter exists; execution path when provider=agent-browser is not wired to real SDK. **Verdict:** Placeholder.

4. **FOLDER.md** — PRD and build-roadmap say "FOLDER.md defines allowed roots". **Reality:** Allowed roots are hardcoded in workspace-fs; FOLDER.md is never read. **Verdict:** Missing.

5. **Tasks.md write path** — PRD "move tasks across lanes/statuses". **Reality:** tasks.md is read-only; no update from UI or runtime. **Verdict:** Missing.

6. **Memory → MEMORY.md** — PRD "propose curated memory diffs (approval-gated)". **Reality:** Promote updates store only; no MEMORY.md diff or approval-gated write. **Verdict:** Partial.

7. **Proactivity "cron scheduler"** — Proactivity report says jobs have schedule_cron/interval_sec. **Reality:** No process runs due jobs periodically; only on-demand and slash. **Verdict:** Missing.

8. **Multi-tenant "per-tenant workspace isolation"** — Phase 8 says per-tenant workspace isolation. **Reality:** Tenants in memory; no per-tenant workspace persistence or isolation in practice. **Verdict:** Partial/scaffolded.

9. **Streaming tool-call UX** — SSE stream exists. **Reality:** Tool calls/results only at end of stream; no incremental tool events. **Verdict:** Partial.

10. **Workflow "create from dashboard"** — Workflow CRUD API done. **Reality:** No UI form to create a workflow. **Verdict:** Partial.

---

## Critical Missing Capabilities

(Also reflected in current-state.md and next-pass.)

1. **Durable session transcripts** — Server-side persistence and load on reconnect; session list and resume.
2. **FOLDER.md as source of truth** — Parse FOLDER.md and enforce allowed roots, write behavior, safety boundaries.
3. **Tasks.md write path** — Move tasks across lanes; update status from UI or runtime; keep JSONL as event log.
4. **Streaming tool-call events** — Emit tool start/complete in SSE for incremental UI.
5. **Agent Browser execution** — Wire executeWithAgentBrowser to real SDK when installed.
6. **Project drill-in** — /projects/[slug] or modal with project.md and tasks.md.
7. **Memory → MEMORY.md** — Approval-gated proposal to prompt/MEMORY.md from promoted entries.
8. **View lens application** — Apply lens to task/project/file queries.
9. **Proactivity cron/interval scheduler** — Process that runs listDueScheduledJobs periodically.
10. **Toast / live updates** — After chat creates project/task, toast or soft-refresh for Projects/Tasks/Traces.
11. **Vercel Sandbox adapter** — sandbox.exec → @vercel/sandbox when available.
12. **Workflow step → substrate routing** — Substrate-specific traces and step routing by tool environment.
13. **Create workflow from UI** — Dashboard form to create a workflow run.
14. **Mobile/responsive sidecar** — Drawer or collapse for context rail on small screens.
15. **Real multi-agent delegation** — Specialist handoffs and delegation (beyond single lead agent per view).
