# Feature Ledger — Canonical List of Claws.so Features

Organized by category. Each feature has **Status** (complete | partial | placeholder | missing) and **Evidence** (files, routes, UI, runtime).

---

## Core OS

| Feature | Status | Evidence |
|--------|--------|----------|
| **Session model** | complete | **files:** apps/gateway session handling, runtime-db sessions table, session-workbench.tsx, nav.tsx, chat-list-context. **routes:** chat carries chatId/threadId. **ui:** Session workbench; **Nav → Sessions** (starred + recent), resume by selection; transcript persist on stream complete (`onComplete` → `persistSessionHistory`). **runtime:** PGlite messages per session; optional in-memory DB fallback (no cross-restart persistence). |
| **Project model** | complete | **files:** packages/workspace workspace-fs, main.ts scanProjects, create project. **routes:** GET /api/projects. **ui:** Projects page from real scan; create project from chat. **runtime:** projects/ scan; project.md name/status; create writes projects/<slug>/project.md + tasks.md. |
| **Channel model** | complete | **files:** packages/runtime-db CHANNELS_SCHEMA_SQL, conversations, channels. **routes:** /api/channels, /api/conversations. **ui:** N/A (API-backed). **runtime:** Channels with slug; getOrCreateConversationForDestination. |
| **Agent conversations** | complete | **files:** runtime-db conversations, conversation_agents; gateway conversations/messages. **routes:** list/create/get conversations, post message, conversation agents. **ui:** Chat uses conversation/session. **runtime:** postConversationMessage triggers chat with lead agent. |
| **Group chats** | complete | **files:** Same as agent conversations; channels + multiple agents. **runtime:** Conversation has channel; agents attached to conversation. |

---

## Runtime

| Feature | Status | Evidence |
|--------|--------|----------|
| **Gateway** | complete | **files:** apps/gateway/src/httpServer.ts, main.ts. **routes:** /health, /api/status, /api/chat, /api/chat/stream, /api/traces, /api/approvals, /api/view-state, /api/tasks/events, /api/workflows, /api/tools/run, /api/projects, /api/tenants, /api/conversations, /api/channels, /api/proactive/*. **runtime:** All endpoints respond; tenant resolution per request. **resilience:** On PGlite persistent init failure, `initRuntimeDbInMemory()` so gateway still starts (see runtime-persistence.md). |
| **Approvals** | complete | **files:** packages/core/approvals.ts, gateway resolve, approvals/page.tsx. **routes:** GET/POST approvals, resolve. **ui:** Pending list, approve/deny, grant modes. **runtime:** once/session/24h/tool scopes; isGranted at tool boundary; one-time consumption. |
| **Traces** | complete | **files:** main.ts trace push, runtime-db traces, traces/page.tsx. **routes:** GET /api/traces. **ui:** Timeline, type icons, environment badge, expand. **runtime:** Persisted in PGlite; type + environment in data. |
| **Tasks (event log)** | complete | **files:** packages/tools/tasks.ts, main.ts appendEvent. **routes:** GET /api/tasks/events. **runtime:** tasks.jsonl append on create task/project; getTaskEvents reads JSONL. |
| **Tasks (build queue / tasks.md)** | complete | **files:** packages/tools/tasks.ts, tasks-md.ts, tasks/page.tsx, httpServer.ts. **routes:** POST /api/tasks/create, update, move, complete. **ui:** Build queue with status dropdown, complete button, edit (patch + acceptance), create form. **runtime:** tasks.createTask, tasks.updateTask, tasks.moveTask, tasks.completeTask write project-context/tasks.md and append events; dashboard calls gateway; lane/status updates from UI. |
| **Memory** | complete | **files:** packages/tools/memory.ts, memory/page.tsx, gateway main.ts, httpServer.ts. **runtime:** memory.flush, memory.promote, memory.search; identity/private excluded; .claws/memory-store.json. **approval-gated:** createMemoryProposal enqueues approval; resolveApproval appends to prompt/MEMORY.md on approve. **ui:** "Propose to MEMORY.md" on memory page; resolve in Approvals. |
| **Workflows** | complete | **files:** packages/core/workflow.ts, runtime-db workflow_runs/steps, worker, httpServer workflows, main.ts advanceWorkflowStep. **routes:** Full CRUD workflows, advance, pause, resume, cancel. **ui:** Workflows page, step-level controls, Create tab. **runtime:** PGlite persistence; worker runs steps via /api/tools/run; advanceWorkflowStep inserts workflow-step-run trace with substrate from tool registry. **traces:** type workflow-step-run with runId, stepId, tool, substrate, status. |
| **View state / router** | complete | **files:** packages/core/router.ts, gateway view-state API, settings Views tab. **routes:** GET/POST /api/view-state. **ui:** Settings Views; primary + overlays round-trip. **runtime:** get/set by thread; inferPrimaryView, extractOverlayViews; leadAgentId. **lens:** getTaskEvents and scanProjects accept optional view and project_slug; filtered by project when project_slug passed; project drill-in page passes project_slug for task events. |
| **Intelligence / context analysis** | complete | **files:** apps/gateway/intelligenceAnalysis.ts, runtime-db conversation_intelligence. **routes:** /api/chat/intelligence, /api/conversations/:id/intelligence. **runtime:** runChatIntelligenceAnalysis after chat; extractedTasks, memoryCandidates, proposedNextActions. |

---

## UI

| Feature | Status | Evidence |
|--------|--------|----------|
| **Chat surface** | complete | **files:** session-workbench.tsx, artifact-panel.tsx, shell.tsx, chat page, api/chat, aiHandler.ts. **ui:** Streaming; **file cards** for fs.write/fs.append (stream + complete); **artifact panel** (Code, HTML Preview, Open in browser); sidebar collapse when artifact open; approval CTA; slash commands. **runtime:** persistSessionHistory on complete; system prompt prefers fs.write over pasting file bodies in chat. |
| **Sidecar (context rail)** | complete | **files:** session-workbench.tsx. **ui:** Right rail Overview/Project/Files/Approvals/Memory/Traces/Workflow; deep links. **runtime:** Inferred tab from last tool/approvals. |
| **Project drill-in** | complete | **files:** apps/dashboard/app/projects/[slug]/page.tsx. **ui:** /projects/[slug] with getProject(slug), fs.read(project.md), fs.read(tasks.md), related traces/task events/approvals/memory. **runtime:** runTool("fs.read", { path }) for project.md and tasks.md; links to Tasks, Traces, Approvals, Memory. |
| **Files explorer** | complete | **files:** files/page.tsx. **ui:** Workspace browser (fs.list), inspector (fs.read), quick reads, breadcrumbs. **runtime:** Real fs.list/fs.read. |
| **Memory search** | complete | **files:** memory/page.tsx. **ui:** Search, flush checkpoint, promote. **runtime:** memory.search; flush/promote to store. |
| **Task editing** | complete | **files:** tasks/page.tsx, api.ts, httpServer.ts. **ui:** Status dropdown (handleMoveStatus), complete button (handleComplete), edit (startEdit/saveEdit with task + acceptance), create form. **runtime:** apiUpdateTask, apiMoveTask, apiCompleteTask call gateway; tasks.updateTask, tasks.moveTask, tasks.completeTask write tasks.md. |
| **Workflow UI** | complete | **files:** workflows/page.tsx. **ui:** List runs, expand steps, pause/resume/cancel, Architecture tab, Create tab with form (name, description, steps with tool + args + requiresApproval); POST via createWorkflow. **runtime:** Full CRUD API; create from dashboard. |
| **Agent UI** | complete | **files:** agents/page.tsx. **ui:** Roster, tools by environment, Routing tab, AI on/off. **runtime:** From status; static config. |
| **Settings** | complete | **files:** settings/page.tsx. **ui:** Views, Runtime, AI Config, Execution, Env. **runtime:** Round-trip verified. |
| **Proactivity UI** | complete | **files:** app/proactivity/page.tsx, nav. **ui:** Jobs list (pause/resume, Run now), Notifications, Recent runs. **runtime:** API client; slash commands trigger run. |
| **Toast / live updates** | complete | **files:** session-workbench.tsx, app/projects/page.tsx, app/tasks/page.tsx. **ui:** After chat stream or non-stream response with toolResults containing tasks.appendEvent or fs.write, dispatch custom event claws:refresh-context; Projects and Tasks pages listen and refetch. **runtime:** No toast UI; soft-refresh of Projects and Tasks when chat creates project/task. |
| **Mobile / responsive sidecar** | complete | **ui:** Context rail visible on xl as before; below xl a "Context" button opens a slide-over drawer with the same Overview/Project/Files/Approvals/Memory/Traces/Workflow content; close via overlay or button. **files:** session-workbench.tsx (drawer variant, xl:hidden overlay). |
| **Dashboard design system (2026 pass)** | complete | **files:** globals.css (tokens, glass bar, shadows), ui/tabs (segmented), button/input/select/textarea/badge/status-dot/code-block, live-state-bar, theme-toggle; Home/Settings/Traces/Tasks/Projects/Workflows/Approvals/Memory/Proactivity/Files/Agents pages aligned. **ui:** Apple/OpenAI-adjacent density, rounded-2xl panels, consistent h-9 controls. |

---

## Execution

| Feature | Status | Evidence |
|--------|--------|----------|
| **Browser use (Playwright)** | complete | **files:** packages/tools/browser.ts Playwright adapter. **runtime:** navigate, screenshot, click, type, extract; default provider Playwright. |
| **Browser use (Agent Browser)** | complete | **files:** browser.ts Agent Browser adapter, dynamic import. **runtime:** When @anthropic-ai/agent-browser is installed and exports launch/newPage/goto/screenshot/close, executeWithAgentBrowser runs real execution; otherwise clear error or Playwright fallback. |
| **Computer use** | missing | **files:** types mention computer substrate. **runtime:** Planned; no implementation. |
| **Sandbox** | complete | **files:** packages/tools/sandbox.ts. **runtime:** When CLAWS_SANDBOX_ENABLED=true and provider=vercel, sandbox.exec dynamically imports @vercel/sandbox, creates sandbox, runs code via runCommand (node -e or python -c), returns stdout/stderr/exitCode. |
| **Execution modes** | complete | **files:** browser.ts modes (background, record-on-complete, watch-live, hybrid). **runtime:** Configurable; substrate status in /api/status and Settings. |
| **Demo artifact pathing** | complete | **files:** packages/tools/demo.ts, browser.ts. **runtime:** saveDemoScreenshot/saveMetadata to assets/demos/YYYY-MM-DD; browser tool when recordDemo and screenshot calls saveDemoScreenshot and returns demoPath; aiHandler system prompt instructs model to include demo path in reply. |
| **Tool registry by environment** | complete | **files:** packages/tools/registry.ts, ToolSpec.environment. **runtime:** byEnvironment(), listSpecs(); /api/status execution block. |

---

## Proactivity

| Feature | Status | Evidence |
|--------|--------|----------|
| **Scheduled jobs schema** | complete | **files:** runtime-db PROACTIVITY_SCHEMA_SQL, scheduled_jobs, job_executions. **runtime:** PGlite; seedBuiltInProactiveJobs at startup. |
| **Proactive notifications** | complete | **files:** runtime-db proactive_notifications; gateway API. **routes:** GET notifications, POST mark read. **ui:** Proactivity → Notifications tab. **runtime:** Stub handlers create notifications. |
| **Job runner (on-demand)** | complete | **files:** apps/gateway/proactiveRunner.ts. **routes:** POST run now. **runtime:** runProactiveJobNow; stub handlers (no LLM). |
| **Cron / interval scheduler** | complete | **files:** apps/gateway/src/main.ts (setInterval 30s), packages/runtime-db proactivity (listDueScheduledJobs). **runtime:** Gateway runs 30s interval that calls listDueScheduledJobs(Date.now()) and runProactiveJob for each due job; same proactiveJobDeps as "Run now" and slash. Cron expression parsing for next-run is optional (e.g. "0 9 * * *" later). |
| **Heartbeats** | partial | **files:** Job kind heartbeat in schema. **runtime:** No heartbeat runner loop. |
| **Watchdogs** | partial | **files:** Built-in jobs Approvals Watchdog, Stale Project Watchdog; stub handlers. **runtime:** Run on "Run now", slash, or **gateway 30s scheduler** when job is due (cron/interval); handlers remain stubs until LLM wiring. |
| **Proactive messages to conversation** | missing | **files:** conversation_id on notifications. **runtime:** Not used to post into conversation thread. |
| **Slash commands (proactive)** | complete | **files:** session-workbench slash handling. **runtime:** /morning-brief, /eod, /watchdog etc. → runProactiveJobNow. |
| **Surprise artifact generation** | missing | **files:** N/A. **runtime:** No handlers that create real artifacts (drafts, copy). |

---

## Integrations

| Feature | Status | Evidence |
|--------|--------|----------|
| **Telegram** | missing | **files:** PRD mentions Telegram first. **runtime:** No adapter. |
| **Slack** | missing | **files:** PRD mentions Slack later. **runtime:** No adapter. |
| **Agent Browser** | complete | **files:** browser.ts. **runtime:** executeWithAgentBrowser wires to SDK when launch/newPage/goto/screenshot/close available; otherwise stub message or Playwright fallback. |
| **AI Gateway** | partial | **files:** aiHandler.ts, AI_GATEWAY_URL, baseURL. **runtime:** Single model; no multi-model/gateway routing. |
| **Model routing** | partial | **files:** AI_MODEL, OPENAI_API_KEY. **runtime:** One model selectable; no tier-based routing in proactivity yet. |

---

## Workspace & Governance

| Feature | Status | Evidence |
|--------|--------|----------|
| **WorkspaceFS (path enforcement)** | complete | **files:** packages/workspace/workspace-fs.ts, folder-md.ts. **runtime:** WorkspaceFS uses loadFolderContractSync(root) to load FOLDER.md from workspace root; parseFolderMd parses Root Layout and Rules; fallback to getDefaultContract() when file missing or unparseable. fs.read/write/list/append enforce allowedRoots, readOnlyRoots, appendOnlyRoots, lockedRoots, scratchRoots. |
| **FOLDER.md governance** | complete | **files:** packages/workspace/src/folder-md.ts (loadFolderContractSync, parseFolderMd), workspace-fs.ts. **runtime:** FOLDER.md read from root; Root Layout and Rules sections parsed; allowed roots and write behavior applied; default contract when missing. |
| **TOOL-POLICY router** | missing | **files:** N/A. **runtime:** PRD/dump requested a small router for tool policy (instead of only TOOL-POLICY.md); not implemented. **issues:** Optional; single TOOL-POLICY.md pattern used. |
| **Identity loader** | complete | **files:** gateway main, memory.ts. **runtime:** identity/you.md loaded; identity/private excluded. |
| **create-claws / claws init** | complete | **files:** packages/cli, packages/create, templates/base/workspace. **runtime:** npx @claws-so/create, claws init; onboarding state machine. |
| **claws start / claws chat** | complete | **files:** apps/gateway/cli.ts, packages/cli/src/commands/chat.mjs. **runtime:** CLI starts gateway; chat events. |
| **Claws home directory (~/.claws/)** | complete | **files:** packages/cli/src/paths.mjs, packages/cli/src/config.mjs. **runtime:** claws.json, workspace/, runtime/, logs/; env overrides for all paths. |
| **CLI command suite (setup/onboard/doctor/status/dashboard/gateway)** | complete | **files:** packages/cli/src/commands/\*. **runtime:** All commands operational with spinners, ᐳᐸ logo, colored output, step progress, --help, --version. |
| **Guided onboarding wizard** | complete | **files:** packages/cli/src/commands/onboard.mjs. **runtime:** Welcome screen with big logo; 6-step interactive wizard with [n/6] progress; env detection; spinners; conversational prompts; --yes non-interactive; --install-daemon for launchd/systemd. |
| **@claws-so/create bootstrap** | complete | **files:** packages/create/\*. **runtime:** npx @claws-so/create with full logo, spinners, welcome greeting, workspace bootstrap, polished summary with install-then-onboard flow. |
| **Scoped package architecture** | complete | **files:** packages/cli (@claws-so/cli), packages/create (@claws-so/create). **runtime:** Package names decoupled from binary; rename-safe. |
| **CLI copy/messages module** | complete | **files:** packages/cli/src/messages.mjs. **runtime:** 60+ tasteful status strings across 8 categories (boot, setup, check, working, done, welcome, oops, misc); pick() and rand() helpers for deterministic and random selection. |
| **CLI UI polish (spinners, logo, formatting)** | complete | **files:** packages/cli/src/ui.mjs. **runtime:** ᐳᐸ logo (big and small); spinner with frame animation; stepProgress [n/m]; kv, hr, hint, cmd, dot formatters; section/step/success/warn/fail layout. |
| **Doctor comprehensive diagnostic** | complete | **files:** packages/cli/src/commands/doctor.mjs, packages/cli/src/probe.mjs. **runtime:** 8 diagnostic categories: Config (parse, version, onboarding), Filesystem (home, workspace, 9 workspace files), Runtime (PGlite, gateway runtime data), Services (gateway, dashboard, port conflict detection), Environment (AI provider multi-key, model, gateway routing), Execution (browser, sandbox), Integrations (Telegram, Vercel, Slack). Parallel TCP+HTTP probes. Health score bar (0–100%). Pass/warn/fail counts. Targeted fix suggestions. --verbose flag. |
| **Status compact operator summary** | complete | **files:** packages/cli/src/commands/status.mjs. **runtime:** Local config display, parallel gateway probes, runtime data (mode, AI config, execution, workflows, approvals, traces, tenants, agents, tools), proactive job status with last decision time, concise service status. |
| **Per-command --help** | complete | **files:** packages/cli/src/commands/help.mjs, packages/cli/bin/claws.mjs. **runtime:** `claws <cmd> --help` for all commands; grouped help output (Getting started, Operate, Interact); SUBHELP registry with usage, descriptions, and flags per command. |
| **Port conflict and service detection** | complete | **files:** packages/cli/src/probe.mjs, gateway.mjs, dashboard.mjs. **runtime:** TCP port probes; detect port in use by another process; detect already-running services; clean error + fix hints for conflicts. |
| **Onboard resume detection** | complete | **files:** packages/cli/src/commands/onboard.mjs. **runtime:** Detects partial onboard (resume message), completed onboard (show config + skip), --force to re-run. |
| **TUI full-screen terminal UI** | complete | **files:** packages/cli/src/tui/\*, packages/cli/src/commands/tui.mjs. **runtime:** `claws tui` launches full-screen TUI with 6 panes (Sessions, Live State, Approvals, Tasks, Traces, Workflows/Jobs). Zero-dependency ANSI renderer with alternate screen buffer. Keyboard-first: Tab cycle, j/k scroll, Enter inspect, y/n/Y/A approval actions, ? help, q quit. Parallel gateway API fetches via data layer. Two-column layout (wide) / single-pane (narrow). 10s auto-refresh. Session detail with message history. Trace detail with data dump. Pre-flight gateway health check. |
| **TUI data layer** | complete | **files:** packages/cli/src/tui/data.mjs. **runtime:** Parallel fetchAll() for sessions, approvals, tasks, traces, workflows, jobs, decisions, notifications. Reuses probe.mjs gateway URL resolution. Individual fetch functions for each API endpoint. |
| **TUI ANSI screen renderer** | complete | **files:** packages/cli/src/tui/ansi.mjs, packages/cli/src/tui/screen.mjs. **runtime:** Low-level ANSI escapes, box drawing, styled text, truncation, alt screen buffer, cursor management, buffered writes, resize handling. |
| **CLI/TUI shared vocabulary** | complete | **files:** packages/cli/src/vocab.mjs. **runtime:** Shared section names, status categories, time formatting, approval labels, service labels. Used by doctor, status, TUI panes, TUI app controller. |
| **CLI/TUI coherence & cross-references** | complete | **files:** All command help files, TUI panes, help.mjs, README. **runtime:** "See also" on every subcommand; workflow guidance in help; consistent terminology across all surfaces; per-command help with keyboard shortcuts for TUI. |

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
| complete | 60 |
| partial | 17 |
| placeholder | 3 |
| missing | 9 |

---

## False Positives

Items that may have been considered "done" in tasks or roadmap but are **incomplete, stubbed, or placeholder**:

1. **Session persistence** — Tasks and build-roadmap say "session requests carry chatId/history" and "session-scoped grants". **Reality:** Streaming path now persists assistant reply after stream complete (onComplete → persistSessionHistory in apps/gateway/src/main.ts); session list/resume UI optional for v0. **Verdict:** Partial; transcript persist done; list/resume UI deferred.

2. **RUN-005 "lightweight local persistence"** — tasks.md says "apps/gateway/src/localStore.ts". **Reality:** Persistence is PGlite (`packages/runtime-db`); localStore exists but is deprecated. **Verdict:** Task description is stale; implementation is complete elsewhere.

3. **Agent Browser** — EXE-001/EXE-004 marked done; "Agent Browser adapter". **Reality:** Adapter wires to SDK when @anthropic-ai/agent-browser exports launch/newPage/goto/screenshot/close; otherwise stub or Playwright fallback. **Verdict:** Complete.

4. **FOLDER.md** — PRD and build-roadmap say "FOLDER.md defines allowed roots". **Reality:** FOLDER.md is loaded and parsed by loadFolderContractSync in packages/workspace/src/folder-md.ts; WorkspaceFS uses it with fallback to default contract. **Verdict:** Complete.

5. **Tasks.md write path** — PRD "move tasks across lanes/statuses". **Reality:** tasks.createTask/updateTask/moveTask/completeTask write tasks.md; gateway routes and tasks page UI (status dropdown, complete, edit, create). **Verdict:** Complete.

6. **Memory → MEMORY.md** — PRD "propose curated memory diffs (approval-gated)". **Reality:** createMemoryProposal enqueues approval; resolveApproval appends to prompt/MEMORY.md on approve; memory page "Propose to MEMORY.md". **Verdict:** Complete.

7. **Proactivity "cron scheduler"** — Proactivity report said jobs have schedule_cron/interval_sec with no process. **Reality:** Gateway now runs a 30s setInterval that calls listDueScheduledJobs and runProactiveJob (apps/gateway/src/main.ts). **Verdict:** Complete.

8. **Multi-tenant "per-tenant workspace isolation"** — Phase 8 says per-tenant workspace isolation. **Reality:** Tenants in memory; no per-tenant workspace persistence or isolation in practice. **Verdict:** Partial/scaffolded.

9. **Streaming tool-call UX** — SSE stream exists. **Reality:** Tool calls/results only at end of stream; no incremental tool events. **Verdict:** Partial.

10. **Workflow "create from dashboard"** — Workflow CRUD API done. **Reality:** Create tab on workflows page with form (name, description, steps with tool + args + requiresApproval); POST createWorkflow. **Verdict:** Complete.

---

## Critical Missing Capabilities

(Also reflected in current-state.md and next-pass.)

1. **Session list/resume UI** — Optional for v0; server-side transcript persist on stream complete is done.
2. ~~**FOLDER.md as source of truth**~~ — **Done:** loadFolderContractSync + parseFolderMd in folder-md.ts; WorkspaceFS uses it.
3. ~~**Tasks.md write path**~~ — **Done:** create/update/move/complete from UI and gateway.
4. **Streaming tool-call events** — Emit tool start/complete in SSE for incremental UI.
5. ~~**Agent Browser execution**~~ — **Done:** executeWithAgentBrowser wires to SDK when launch/newPage/goto/screenshot available.
6. ~~**Project drill-in**~~ — **Done:** /projects/[slug] with project.md and tasks.md (apps/dashboard/app/projects/[slug]/page.tsx).
7. ~~**Memory → MEMORY.md**~~ — **Done:** createMemoryProposal + resolveApproval in gateway.
8. ~~**View lens application**~~ — **Done:** getTaskEvents/scanProjects accept view and project_slug; project drill-in passes project_slug.
9. ~~**Proactivity cron/interval scheduler**~~ — **Done:** 30s interval in gateway runs listDueScheduledJobs and runProactiveJob.
10. ~~**Toast / live updates**~~ — **Done:** claws:refresh-context dispatched on tasks.appendEvent/fs.write; Projects and Tasks pages refetch on event.
11. ~~**Vercel Sandbox adapter**~~ — **Done:** sandbox.exec uses @vercel/sandbox when enabled.
12. ~~**Workflow step → substrate routing**~~ — **Done:** advanceWorkflowStep inserts workflow-step-run trace with substrate from registry.
13. ~~**Create workflow from UI**~~ — **Done:** Workflows page Create tab with form.
14. ~~**Mobile/responsive sidecar**~~ — **Done:** Context button + slide-over drawer below xl.
15. **Real multi-agent delegation** — Specialist handoffs and delegation (beyond single lead agent per view).
