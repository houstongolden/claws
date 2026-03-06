# Claws.so Implementation Audit

**Canonical sources:** `project-context/prd.md`, `project-context/tasks.md`, `project-context/build-roadmap.md`, `project-context/next-pass.md`, `AGENT.md`

**Classification rule:** Do not assume done based on route/page/placeholder. Classify as: **fully implemented** | **partially implemented** | **placeholder only** | **broken** | **missing**.

---

## 1. Product Architecture

| Pillar | Status | What's actually working | Weak / fake / placeholder | Missing | Files |
|--------|--------|--------------------------|---------------------------|---------|-------|
| **Chat-first AI OS feel** | Partially implemented | Session workbench is home (`/`), chat is center-stage with sidecar; copy says "Talk to your AI OS". Nav frames Session + active view. | Session is client-only (sessionStorage + in-memory gateway); no server-side transcript persistence. "Session" is one tab's state, not durable. | Durable session identity across reloads; session-scoped traces/approvals explicitly tied to durable session IDs. | `session-workbench.tsx`, `main.ts` (sessionHistory Map), `session.ts` |
| **Session-centric UX** | Partially implemented | chatId/threadId sent to gateway; view-state and approvals keyed by thread; sidecar shows task/project/files/approvals/memory/traces/workflows. | Session is ephemeral: new tab = new chatId; gateway restarts wipe session history. No "session list" or resume. | Server-persisted sessions; session list; explicit "current session" in nav. | `main.ts`, `session-workbench.tsx`, `session.ts`, `localStore.ts` (no session in store) |
| **Contextual sidecar pattern** | Fully implemented | Right rail with Overview / Project / Files / Approvals / Memory / Traces / Workflow tabs; inferred tab from last tool/approvals; deep links to expanded views. | — | — | `session-workbench.tsx` |
| **Local-first filesystem truth** | Partially implemented | WorkspaceFS enforces allowed roots; fs.read/write/list/append go through it. Projects from `projects/`, tasks from `project-context/tasks.md` + `tasks.jsonl`. | Allowed roots are **hardcoded** in `workspace-fs.ts`, not read from `FOLDER.md`. PRD says "FOLDER.md defines allowed roots". | Parse and enforce `FOLDER.md` on disk; write behavior and safety boundaries from file. | `packages/workspace/src/workspace-fs.ts` |
| **Views as overlays** | Fully implemented | Router has primary + overlays; view stack persisted and round-trips; Settings Views tab; lead agent from primary view; lens union described in copy. | Lens is not actually used to filter tasks/files (no lens-based filtering). | Lens applied to task/project/file queries. | `router.ts`, `settings/page.tsx`, `nav.tsx`, `main.ts` |
| **Multi-agent orchestration** | Partially implemented | Router returns leadAgentId; VIEW_AGENT_MAP; agents from `@claws/agents`; Agents page shows roster, tools, routing. | Single orchestrator in practice; no delegation to specialist agents or handoffs. Multi-agent is "one lead per view," not true orchestration. | Delegation, specialist agents, handoff flows. | `router.ts`, `agents/page.tsx`, `packages/agents`, `main.ts` (single handleAIChat path) |

---

## 2. Runtime

| Area | Status | What's actually working | Weak / fake / placeholder | Missing | Files |
|------|--------|--------------------------|---------------------------|---------|-------|
| **Gateway** | Fully implemented | HTTP server; /health, /api/status, chat, chat/stream, traces, approvals, view-state, tasks/events, workflows CRUD, tools/run, projects, tenants. Tenant resolution. | — | — | `httpServer.ts`, `main.ts` |
| **Chat execution** | Partially implemented | AI SDK generateText + streamText; tool calling with JSON Schema; system prompt + identity; streaming SSE; fallback to keyword dispatch when AI disabled. | Streaming sends only text deltas; tool results sent in one "finish" event—no incremental tool-call events in stream. stopWhen: stepCountIs(5). Session history not persisted. | Incremental tool-call events in stream; configurable max steps; server-side transcript persistence. | `aiHandler.ts`, `main.ts` |
| **Routing** | Fully implemented | StaticRouter; thread key; get/set view state; inferPrimaryView + extractOverlayViews from text; leadAgentId; sessionKey. | — | — | `router.ts`, `main.ts` |
| **Approvals** | Fully implemented | Pending list; resolve with decision + grant; once/session/24h/tool/view/agent scopes; isGranted checks at tool boundary; one-time consumption. | — | — | `approvals.ts`, `main.ts`, `approvals/page.tsx` |
| **Traces** | Fully implemented | In-memory list; unshift on chat/tool/approval/project-create/task-create/draft-create; persisted in runtime-store; type + environment in data. | — | — | `main.ts`, `localStore.ts`, `traces/page.tsx` |
| **Tasks** | Partially implemented | tasks.appendEvent → project-context/tasks.jsonl; getTaskEvents reads JSONL. Tasks page reads tasks.md via fs.read and parses table. | tasks.md is **read-only** from app; no tool or UI to update tasks.md (move lanes, status). PRD: "move tasks across lanes/statuses". | Write/update tasks.md from runtime or UI; lane/status transitions. | `main.ts`, `tasks.ts`, `tasks/page.tsx` |
| **Memory** | Fully implemented | memory.flush, memory.promote, memory.search; identity/private excluded; .claws/memory-store.json; search over prompt/notes/projects/identity + store. | Promote does not write to MEMORY.md (PRD: "propose curated memory diffs (approval-gated)"). | Approval-gated promotion to prompt/MEMORY.md. | `memory.ts`, `memory/page.tsx`, `aiHandler.ts` |
| **Workflows** | Fully implemented | create/advance/pause/resume/cancel; disk-backed .claws/workflow-store.json; approval steps; worker polls and runs steps via /api/tools/run. | Step→substrate routing and substrate-specific trace emission not wired. | Substrate-aware step execution and trace types. | `workflow.ts`, `httpServer.ts`, `worker/main.ts`, `workflows/page.tsx` |
| **Browser / computer / sandbox** | Partially implemented | Browser: navigate, screenshot, click, type, extract; config provider/mode; Playwright default; Agent Browser adapter skeleton (dynamic import). Sandbox: policy gate, config. Execution status in /api/status and Settings. | Agent Browser not wired to real execution when installed. Sandbox does not call Vercel Sandbox SDK. Computer-use is "planned". Demo artifact path exists but record-on-complete → demo.saveScreenshot not fully wired. | Real Agent Browser execution path; Vercel Sandbox adapter; demo artifact link in completion message. | `browser.ts`, `sandbox.ts`, `main.ts`, `aiHandler.ts` (TOOL_JSON_SCHEMAS) |

---

## 3. UI / UX

| Screen | Status | What's actually working | Weak / fake / placeholder | Missing | Files |
|--------|--------|--------------------------|---------------------------|---------|-------|
| **Home** | Fully implemented | Session workbench (same as /chat); live context rail; gateway/view/execution badges; suggested prompts and command chips. | — | — | `app/page.tsx`, `session-workbench.tsx` |
| **Session / Chat** | Partially implemented | Streaming; history in sessionStorage; tool result cards; approval CTA; command chips; session meta sent (chatId, threadId, history). | History lost on reload/tab close; no server-side persistence. Tool results only after full response in stream. | Durable history; incremental tool UI in stream. | `session-workbench.tsx`, `app/chat/page.tsx` |
| **Tasks** | Partially implemented | Build queue parsed from tasks.md (table); Activity from tasks.jsonl; filter/search; lanes by status. | No edit/move of tasks; no sync from JSONL events into tasks.md table. | Task drag/drop or status change; writes to tasks.md. | `tasks/page.tsx` |
| **Projects** | Partially implemented | List from /api/projects (scan projects/); name, slug, path, hasProjectMd, hasTasksMd, status from project.md. | No drill-in: can't open a project to read project.md/tasks.md in UI. | Project detail view (e.g. /projects/[slug] with fs.read). | `projects/page.tsx`, `main.ts` (scanProjects) |
| **Files** | Fully implemented | Workspace browser (fs.list); inspector (fs.read); quick reads; canonical dirs; breadcrumbs. | — | — | `files/page.tsx` |
| **Memory** | Fully implemented | Search (memory.search); flush session checkpoint; promote entry; Activity tab (traces); How it works. | No edit/reject for promoted entries; no source-linked review flow. | Rich curation UI; MEMORY.md diff proposals. | `memory/page.tsx` |
| **Approvals** | Fully implemented | Pending list; approve/deny; grant modes (once, session, 24h, tool) with descriptions; session key from readSessionMeta(). | — | — | `approvals/page.tsx` |
| **Traces** | Fully implemented | Timeline; type icons; environment badge; expand for data; filter by type; pagination. | — | — | `traces/page.tsx` |
| **Workflows** | Fully implemented | List runs; expand steps; pause/resume/cancel; Architecture tab (substrates, visibility, storage). | No create-workflow UI (API only). | Create workflow from dashboard. | `workflows/page.tsx` |
| **Agents** | Fully implemented | Roster from status; tools by environment; Routing tab; AI on/off. | Agents are static config, not dynamic. | — | `agents/page.tsx` |
| **Settings** | Fully implemented | Views (primary + overlays), Runtime, AI Config, Execution (router, browser, sandbox, computer, workflow), Env vars. | — | — | `settings/page.tsx` |

---

## 4. Design System

| Item | Status | What's actually working | Weak / fake / placeholder | Missing | Files |
|------|--------|--------------------------|---------------------------|---------|-------|
| **Geist** | Fully implemented | GeistSans + GeistMono in layout; CSS vars --font-geist-sans, --font-geist-mono used. | — | — | `app/layout.tsx`, `globals.css` |
| **Tailwind** | Fully implemented | Utility classes throughout; no inline styles. | — | — | All dashboard components |
| **shadcn/ui** | Fully implemented | Button, Input, Select, Textarea, Badge, Card, Tabs, CodeBlock, etc.; variants. | — | — | `components/ui/*` |
| **Reusable components** | Fully implemented | Shell, PageHeader, PageContent, EmptyState, Toolbar, StatusDot, etc. | — | — | `shell.tsx`, `ui/*` |
| **Overall quality** | Partially implemented | Consistent spacing, typography, and structure; product copy aligned with PRD. | Some pages still dense; mobile/small-screen not optimized (e.g. sidecar hidden below xl). | Responsive sidecar; toast/notification system. | — |

---

## 5. Data Realism

| Area | Status | What's actually working | Weak / fake / placeholder | Missing | Files |
|------|--------|--------------------------|---------------------------|---------|-------|
| **Canonical projects** | Fully implemented | projects/ scan; project.md name/status; tasks.md presence. Create project from chat writes real files. | — | — | `main.ts` (scanProjects, create project), `projects/page.tsx` |
| **Task semantics** | Partially implemented | tasks.jsonl append on create task/project; tasks.md read and parsed for build queue. | tasks.md not updated by system; no bidirectional sync; no stable task ID semantics in UI. | tasks.md updates from events or UI; stable IDs. | `tasks.ts`, `main.ts`, `tasks/page.tsx` |
| **Memory semantics** | Partially implemented | Flush to store; promote flag; search over files + store; identity/private excluded. | Promotion only in-memory/store; no MEMORY.md diff or approval-gated write. | PRD: "propose curated memory diffs (approval-gated)". | `memory.ts` |
| **Approval semantics** | Fully implemented | Real pending list; resolve with grant; session key from client; isGranted at tool call. | — | — | `approvals.ts`, `main.ts`, `approvals/page.tsx` |
| **Trace semantics** | Fully implemented | Real trace push on chat/tool/approval/project/task/draft; environment in data; persisted. | — | — | `main.ts`, `localStore.ts` |
| **Fake/placeholder data** | N/A | Tasks: real tasks.md + JSONL. Projects: real scan. Memory: real store + files. Approvals/traces: runtime. | Session history is client-only. Build queue is human-authored tasks.md. | — | — |

---

## 6. Vercel Alignment

| Area | Status | What's actually working | Weak / fake / placeholder | Missing | Files |
|------|--------|--------------------------|---------------------------|---------|-------|
| **AI SDK** | Partially implemented | ai package; generateText + streamText; tool() with jsonSchema; createOpenAI; baseURL for gateway. | Tool results in stream only at end; no use of experimental_telemetry or other SDK features. | Full streaming tool UX; telemetry if needed. | `aiHandler.ts` |
| **AI Gateway** | Partially implemented | AI_GATEWAY_URL, AI_GATEWAY_API_KEY; baseURL passed to createOpenAI. | Single model; no gateway-specific routing or fallbacks. | Multi-model / gateway routing. | `aiHandler.ts`, `.env.example` |
| **Agent Browser** | Placeholder only | Adapter exists; dynamic import; resolveBrowserConfig. | executeWithAgentBrowser not wired to real SDK; default provider is Playwright. | Real Agent Browser execution when package present. | `browser.ts` |
| **Workflow / WDK** | Partially implemented | Local workflow engine; disk persistence; VercelWorkflowAdapter in workflow-vercel.ts; createVercelWorkflowAdapter(). | Hosted path scaffolded; not required for local. Worker is custom poll, not Vercel Queues. | Vercel Workflow for hosted; Queues for worker. | `workflow.ts`, `workflow-vercel.ts`, `worker/main.ts` |
| **Hosted multi-tenant readiness** | Partially implemented | TenantConfig; tenantRouter (subdomain/header/custom-domain); /api/tenants; tenant in status. | Tenants in memory only; no per-tenant workspace persistence or isolation in practice. | Per-tenant workspace roots and persistence. | `tenantRouter.ts`, `httpServer.ts`, `main.ts` |

---

## Top 15 Gaps (ordered by importance)

1. **Session persistence** — Chat history and session identity are client-only and in-memory on gateway; restart or new tab loses context. Blocks "session-centric" and "what did we decide?" magic moment.
2. **FOLDER.md as source of truth** — Allowed roots are hardcoded in workspace-fs; PRD requires FOLDER.md to define roots, write behavior, and safety boundaries.
3. **Tasks.md write path** — No way to move tasks across lanes or update tasks.md from UI/runtime; task events only append to JSONL.
4. **Streaming tool-call UX** — Tool calls and results only sent in final "finish" event; no incremental tool visibility during stream.
5. **Agent Browser execution** — Adapter present but not wired to real execution; default is Playwright; "Agent Browser preferred" not delivered.
6. **Project drill-in** — No page or flow to open a project and read project.md / tasks.md.
7. **Memory → MEMORY.md** — Promote only updates store; no approval-gated proposal to prompt/MEMORY.md.
8. **View lens application** — Lens (folders/tags/tasks) is not applied to task/project/file queries; views are routing/agent only.
9. **Demo artifact link in completion** — record-on-complete and demo path exist but completion messages don't reliably link demo + notes.
10. **Real multi-agent delegation** — Single orchestrator; no specialist handoffs or delegation.
11. **Vercel Sandbox adapter** — sandbox.exec is gated but does not call @vercel/sandbox.
12. **Workflow step → substrate routing** — Steps don't emit substrate-specific traces or route by tool environment.
13. **Toast / live updates** — No toast or soft-refresh after chat creates project/task; user must navigate to confirm.
14. **Mobile / responsive sidecar** — Context rail hidden below xl; no drawer/collapse for small screens.
15. **Create workflow from UI** — Workflows only created via API; no dashboard form to create a run.

---

## Top 10 Next Implementation Moves (ordered by dependency)

1. **Persist session transcripts server-side** — Store transcripts keyed by chatId in `.claws` or runtime-store; load on reconnect. Unblocks session-centric UX and trace/session linkage.
2. **Load FOLDER.md and enforce from file** — Parse FOLDER.md (or fallback to current ALLOWED_ROOTS); apply to WorkspaceFS; document write behavior/safety.
3. **Stream tool-call events in SSE** — Emit tool start/complete events in the stream so the UI can show tools incrementally.
4. **Task update path** — Add tool or UI to update tasks.md (e.g. move line between sections or set status); keep JSONL as event log.
5. **Project detail view** — Add /projects/[slug] (or modal) with fs.read(project.md) and fs.read(tasks.md); optional edit later.
6. **Wire Agent Browser when present** — In browser.ts, when provider is agent-browser and package is installed, run real execution and surface result; else keep Playwright.
7. **Memory promotion to MEMORY.md** — Propose diff for promoted entry → prompt/MEMORY.md; gate with approval; apply on approve.
8. **Apply view lens to queries** — Pass view stack (or lens) to getTaskEvents/scanProjects/fs or filter results by lens (e.g. project tags).
9. **Toast or soft-refresh on chat mutation** — After create project/task/draft in chat, show toast or trigger refresh for Tasks/Projects/Traces.
10. **Workflow create from dashboard** — Simple form: name + steps (tool + args); POST to /api/workflows.

---

## One-Sentence Verdict

**Does this currently feel like the intended Claws.so product yet? Why or why not?**

**No.** The shell is there (chat-first session workbench, sidecar, local-first filesystem, approvals, traces, workflows, Geist UI), but the product is still a **high-fidelity prototype**: session and chat history don’t persist, FOLDER.md isn’t the governance source, tasks can’t be moved or updated from the app, memory doesn’t write to MEMORY.md, Agent Browser isn’t the real execution path, and there’s no project drill-in or durable “what did we decide?”—so it doesn’t yet deliver the promised local-first, session-centric, builder-oriented agent OS feel.
