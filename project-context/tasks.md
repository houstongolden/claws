# Claws.so Build Queue

Canonical statuses:
- `todo`
- `in-progress`
- `blocked`
- `done`

Priority:
- `P0` (critical path)
- `P1` (high)
- `P2` (important, not critical for first runnable)

Owners:
- `agent`
- `human`

## Audit Snapshot (Current Repo State)

- Planning docs and `AGENT.md` exist and are coherent.
- Root monorepo files, apps, packages, and templates now exist.
- Gateway and dashboard run locally on ports `4317` and `4318`.
- Core chat/approvals/view-state/traces flow is working end-to-end.
- Root `pnpm dev` is now scoped to runtime apps only (`gateway`, `dashboard`, `worker`) for stable local boot.
- Dashboard upgraded to Geist font + Tailwind CSS + Lucide icons + shadcn/ui components design system (zero inline styles).
- shadcn/ui base components: Button, Input, Select, Textarea, Badge, Card with full variant support.
- AI SDK v6 integrated with `generateText` + `streamText`, tool calling, JSON Schema tool definitions, and auto-fallback.
- SSE streaming endpoint (`POST /api/chat/stream`) with streaming-capable dashboard chat UI.
- Browser tool fully wired: Agent Browser adapter (dynamic import), Playwright adapter (full navigate/screenshot), extended actions (click, type, extract).
- Workflow engine implemented with create/advance/pause/resume/cancel, approval checkpoints, and disk-backed persistence.
- Workflow API routes (CRUD) and workflow viewer dashboard page with step-level controls.
- Tenant routing middleware skeleton with subdomain/header/custom-domain resolution.
- All dashboard pages upgraded from placeholders: Files (workspace info), Memory (interactive search), Agents (roster with AI status).
- Shared types include workflow, browser/computer-use, and multi-tenant interfaces.
- Canonical sources: `project-context/prd.md`, `project-context/tasks.md`, `project-context/tasks.jsonl`, `project-context/human-tasks.md`, `project-context/feature-ledger.md`, `project-context/prompts/prompt-ledger.md`.
- Proactivity Engine: scheduled jobs, executions, notifications, model policies (runtime-db); gateway API and job runner; dashboard Proactivity page; slash commands /morning-brief, /eod, /watchdog. Cron/interval scheduler not yet implemented (on-demand and slash only).
- CLI: Full operator-grade command suite via `@claws-so/cli`. Doctor with 8 diagnostic categories, health score, fix suggestions. Status with compact runtime summary. Per-command --help. Port conflict detection. Onboard resume detection.
- TUI: Full-screen terminal UI (`claws tui`) with 6 panes: Sessions, Live State, Approvals, Tasks, Traces, Workflows. Zero-dependency ANSI renderer, alternate screen buffer, raw mode input. Keyboard-first (Tab, j/k, Enter, y/n/Y/A approvals, ? help, q quit). Parallel gateway API fetches. Two-column layout on wide terminals, single-pane on narrow. 10s auto-refresh. Session detail view with message history. Trace detail view with data dump.
- CLI/TUI Coherence: Shared vocabulary module (`vocab.mjs`) for section names, approval labels, status categories, time formatting. Consistent terminology across all commands and TUI panes. "See also" cross-references on every subcommand help. Workflow guidance (`setup → onboard → doctor → status → tui`) in help output. All commands cross-reference related commands.

## Foundation

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| FND-001 | done | P0 | agent | Bootstrap root monorepo files | - | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `README.md` | `pnpm install` and `pnpm -w typecheck` can execute without missing workspace config errors |
| FND-002 | done | P0 | agent | Create app/package directory skeleton from repo-map | FND-001 | `apps/*`, `packages/*`, `templates/base/workspace`, `scripts/` | All expected directories and entry files exist with valid imports/exports |
| FND-003 | done | P0 | agent | Add `.env.example` and config schema skeleton | FND-001 | `.env.example`, `packages/shared/src/config-schema.ts` | Env variables are documented and config schema is available for runtime validation |
| FND-004 | done | P1 | agent | Consolidate planning docs and agent rules | - | `project-context/*`, `AGENT.md` | Canonical planning files are present and deduped |

## Runtime

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| RUN-001 | done | P0 | agent | Implement shared kernel types used by router/runtime/UI | FND-002 | `packages/shared/src/types.ts`, `packages/shared/src/index.ts` | Build passes with no missing core type imports |
| RUN-002 | done | P0 | agent | Implement router with per-thread view-state get/set | RUN-001 | `packages/core/src/router.ts` | Router resolves lead agent + returns persisted view state by thread |
| RUN-003 | done | P0 | agent | Implement approvals core with pending list and resolve flow | RUN-001 | `packages/core/src/approvals.ts` | Approval requests can be listed and resolved with trust grants |
| RUN-004 | done | P0 | agent | Implement gateway HTTP server and runtime glue | RUN-002, RUN-003 | `apps/gateway/src/httpServer.ts`, `apps/gateway/src/main.ts` | Endpoints respond: `/health`, `/api/status`, `/api/chat`, `/api/traces`, `/api/approvals`, `/api/approvals/:id/resolve`, `/api/view-state` |
| RUN-005 | done | P1 | agent | Add lightweight local persistence (traces/approvals/view-state) | RUN-004 | `packages/runtime-db`, `apps/gateway` (PGlite init) | Restarts preserve minimal runtime state; PGlite in `.claws/runtime/`; localStore deprecated |
| RUN-006 | done | P1 | agent | Add workflow engine with pause/resume/approval checkpoints | RUN-001 | `packages/core/src/workflow.ts` | Workflow runs can be created, advanced step-by-step, paused, resumed, and cancelled; approval steps integrate with existing approval system |

## Dashboard

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| WEB-001 | done | P0 | agent | Scaffold Next.js dashboard app and base layout | FND-002 | `apps/dashboard/*` | Dashboard starts locally and renders base shell |
| WEB-002 | done | P0 | agent | Implement API client wiring for gateway | RUN-004, WEB-001 | `apps/dashboard/lib/api.ts` | Client supports status/chat/traces/approvals/view-state calls with typed responses |
| WEB-003 | done | P0 | agent | Implement chat page with structured tool result cards | WEB-002 | `apps/dashboard/app/chat/page.tsx` | User can send message, view response, and inspect tool result cards |
| WEB-004 | done | P0 | agent | Implement approvals page with resolve actions + grant modes | WEB-002 | `apps/dashboard/app/approvals/page.tsx` | Approvals queue loads and approve/deny actions update runtime |
| WEB-005 | done | P1 | agent | Implement settings page for view-state controls | WEB-002, RUN-002 | `apps/dashboard/app/settings/page.tsx` | View primary/overlay updates persist and round-trip via API |
| WEB-006 | done | P1 | agent | Implement traces page and runtime status surface | WEB-002 | `apps/dashboard/app/traces/page.tsx`, `apps/dashboard/app/page.tsx` | Trace timeline supports filtering and paged loading for higher-volume histories |
| WEB-007 | done | P0 | agent | Upgrade design system to Geist + Tailwind + Lucide | WEB-001 | `apps/dashboard/*` | All pages use Tailwind utility classes, Geist fonts loaded, Lucide icons in nav, zero inline styles |
| WEB-008 | done | P1 | agent | Add shadcn/ui component library (Button, Input, Select, Badge, Card, Textarea) | WEB-007 | `apps/dashboard/components/ui/*` | Reusable components with variant support via class-variance-authority |
| WEB-009 | done | P2 | agent | Add workflow viewer dashboard page | RUN-006, WRK-003 | `apps/dashboard/app/workflows/page.tsx` | Workflow runs visible with step-level status, expand/collapse, pause/resume/cancel controls |
| WEB-010 | done | P1 | agent | Upgrade chat/approvals/settings/home pages with shadcn/ui | WEB-008 | `apps/dashboard/app/*` | All interactive pages use Button, Card, Badge, Input, Select components |
| WEB-011 | done | P1 | agent | Upgrade files/memory/agents pages from placeholders to functional UI | WEB-008 | `apps/dashboard/app/files/page.tsx`, `apps/dashboard/app/memory/page.tsx`, `apps/dashboard/app/agents/page.tsx` | Files shows workspace info + fs tools; Memory has interactive search; Agents shows roster with modes and AI status |
| WEB-012 | done | P0 | agent | Screen completion pass: all 11 screens fully wired and usable | WEB-011 | `apps/dashboard/app/**/*.tsx` | Home=command center w/ live stats; Chat=streaming+commands+approval rendering; Tasks=parsed tasks w/ lanes+filters; Projects=real project cards from events; Files=workspace browser+file reader; Memory=search+activity+explainer tabs; Approvals=grant mode explanations; Traces=timeline w/ type icons+expand; Workflows=runs+architecture tabs; Agents=roster+tools+routing tabs; Settings=views+runtime+AI+env tabs |
| WEB-013 | done | P0 | agent | Runtime semantics pass: replace fake data with real pipelines | WEB-012 | `apps/dashboard/**`, `apps/gateway/src/*`, `apps/dashboard/lib/api.ts` | Tasks=canonical JSONL (no synthetic parser); Projects=filesystem scan via /api/projects; Files=direct fs.read tool; Memory=direct memory.search tool; Workflows=no demo filler; Agents=runtime-only; Chat=no test chip; Gateway has /api/tools/run + /api/projects |
| WEB-014 | done | P0 | agent | Full browser QA + polish pass against live dashboard | WEB-013, EXE-012 | `apps/dashboard/app/chat/page.tsx`, `apps/dashboard/app/files/page.tsx`, `apps/dashboard/app/projects/page.tsx`, `apps/dashboard/app/traces/page.tsx`, `apps/gateway/src/main.ts` | Browser-tested all 11 screens; fixed chat history persistence, added create-task command path, made create-project natural-language path work in live browser, cleaned Files quick reads to accessible docs, and verified settings round-trip + task/project creation in browser |
| WEB-015 | done | P0 | agent | Product quality elevation pass for PRD alignment | WEB-014 | `apps/dashboard/app/page.tsx`, `apps/dashboard/components/nav.tsx`, `apps/dashboard/app/chat/page.tsx`, `apps/dashboard/app/agents/page.tsx`, `apps/dashboard/app/workflows/page.tsx`, `apps/dashboard/app/traces/page.tsx`, `apps/dashboard/app/settings/page.tsx`, `apps/dashboard/app/tasks/page.tsx` | Home reads like a command center; nav and page copy reflect local-first agent OS concepts; Chat, Agents, Workflows, Traces, Settings, and Tasks use clearer PRD-aligned hierarchy/microcopy; empty states feel honest and productized rather than placeholder |
| WEB-016 | done | P0 | agent | Session-first IA pass: make Chat the primary surface and all other screens feel like contextual deep links | WEB-015 | `apps/dashboard/app/page.tsx`, `apps/dashboard/app/chat/page.tsx`, `apps/dashboard/components/session-workbench.tsx`, `apps/dashboard/components/nav.tsx`, `apps/dashboard/components/shell.tsx`, `apps/dashboard/app/projects/page.tsx` | Root route becomes the shared Session workbench; chat is center-stage with a live right-side context rail for task/project/files/approvals/memory/traces/workflows; left rail emphasizes Session + active view + recent projects; non-session routes explicitly read as expanded views of the active agent session |
| WEB-017 | done | P0 | agent | Master verification + completion pass | WEB-016 | `apps/dashboard/components/session-workbench.tsx`, `apps/dashboard/app/approvals/page.tsx`, `apps/dashboard/app/tasks/page.tsx`, `apps/dashboard/app/files/page.tsx`, `apps/dashboard/app/memory/page.tsx`, `apps/gateway/src/aiHandler.ts`, `apps/gateway/src/httpServer.ts`, `apps/gateway/src/main.ts`, `apps/worker/src/main.ts`, `packages/tools/src/fs.ts`, `packages/tools/src/browser.ts`, `packages/workspace/src/workspace-fs.ts`, `packages/core/src/workflow.ts`, `packages/shared/src/types.ts`, `README.md`, `.env.example` | Session requests carry real `chatId`/history, approval “allow session” uses actual session grants, Tasks reads canonical `project-context/tasks.md`, Files supports real `fs.list` browsing, Memory flushes session checkpoints/promotes entries, AI tool cards show executed results, worker executes workflow steps through `/api/tools/run`, Playwright is the honest default browser provider, and README/env/docs align better with verified behavior |

## CLI / create-claws

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| CLI-001 | done | P0 | agent | Implement `claws start` and `claws chat` entrypoints | RUN-004 | `apps/gateway/src/cli.ts`, root/bin wiring | CLI starts gateway and sends chat events successfully |
| CLI-002 | done | P1 | agent | Implement deterministic `create-claws` scaffolder | FND-002 | `packages/cli/*`, `templates/base/workspace/*` | `npx create-claws` creates valid workspace skeleton from templates |
| CLI-003 | done | P1 | agent | Implement onboarding state machine and copy rotation | CLI-002 | `packages/cli/bin/claws.mjs`, onboarding config files | `claws init` collects deterministic onboarding choices and writes configured scaffold defaults |
| CLI-004 | done | P2 | agent | Add `claws doctor` checks for env/config/service health | CLI-001, FND-003 | CLI command modules | Command reports actionable failures for local setup |
| CLI-005 | done | P0 | agent | Implement Claws home directory model (~/.claws/) with config resolver | CLI-004 | `packages/cli/src/paths.mjs`, `packages/cli/src/config.mjs` | `~/.claws/` with claws.json, workspace/, runtime/, logs/; env overrides CLAWS_HOME, CLAWS_STATE_DIR, CLAWS_CONFIG_PATH, CLAWS_WORKSPACE_DIR |
| CLI-006 | done | P0 | agent | Implement full CLI command router (setup/onboard/doctor/status/dashboard/gateway/chat/help) | CLI-005 | `packages/cli/bin/claws.mjs`, `packages/cli/src/commands/*` | All commands operational; `claws --help` prints usage; `claws --version` prints version |
| CLI-007 | done | P0 | agent | Implement guided onboarding wizard | CLI-006, CLI-005 | `packages/cli/src/commands/onboard.mjs` | Interactive wizard: identity, workspace, approval mode, views, AI model, channels, daemon install; `--yes` for non-interactive; `--install-daemon` for launchd/systemd |
| CLI-008 | done | P0 | agent | Implement `@claws-so/create` bootstrap package | CLI-005 | `packages/create/*` | `npx @claws-so/create` bootstraps home + workspace + config; delegates to onboard for full setup |
| CLI-009 | done | P1 | agent | Restructure CLI into scoped packages (@claws-so/cli, @claws-so/create) | CLI-006, CLI-008 | `packages/cli/package.json`, `packages/create/package.json`, root `package.json` | Both packages have proper bin entries; package names can be changed later without architecture rewrite |
| CLI-010 | done | P0 | agent | Polish CLI UX: spinners, progress, messages module, logo, formatted output | CLI-009 | `packages/cli/src/ui.mjs`, `packages/cli/src/messages.mjs`, all command files | Spinners for async ops; ᐳᐸ logo; 60+ copy pool messages; colored output; step progress; kv formatting; hr/hint helpers |
| CLI-011 | done | P0 | agent | Polish onboarding wizard: welcome screen, step progress, env detection, summary | CLI-010 | `packages/cli/src/commands/onboard.mjs` | Big logo welcome; [1/6] step progress; conversational prompts with hints; env detection; animated spinners; polished summary with next steps |
| CLI-012 | done | P1 | agent | Polish doctor: categorized checks (filesystem, services, environment) | CLI-010 | `packages/cli/src/commands/doctor.mjs` | Grouped checks by category; browser provider check; gateway/dashboard connectivity; AI provider detection; fix suggestions |
| CLI-013 | done | P1 | agent | Polish create-claws bootstrap: logo, spinners, guided flow | CLI-010 | `packages/create/bin/create-claws.mjs` | Full logo; spinner animations; welcome greeting; polished summary with install-then-onboard flow |
| CLI-014 | done | P0 | agent | Rebuild doctor as real diagnostic tool with 8 check categories | CLI-012 | `packages/cli/src/commands/doctor.mjs`, `packages/cli/src/probe.mjs` | Config, Filesystem, Runtime, Services, Environment, Execution, Integrations sections; parallel probes; health score bar; pass/warn/fail counts; targeted fixes |
| CLI-015 | done | P0 | agent | Rebuild status as compact operator summary with gateway probe | CLI-012 | `packages/cli/src/commands/status.mjs`, `packages/cli/src/probe.mjs` | Parallel probes; runtime counts (workflows, approvals, traces, tenants, agents, tools); proactive job status; AI config; execution substrates |
| CLI-016 | done | P1 | agent | Add per-command --help and categorized help output | CLI-006 | `packages/cli/src/commands/help.mjs`, `packages/cli/bin/claws.mjs` | `claws <cmd> --help` for all commands; grouped help (Getting started, Operate, Interact); SUBHELP definitions with usage, desc, flags |
| CLI-017 | done | P1 | agent | Add port conflict detection and already-running checks | CLI-014 | `packages/cli/src/commands/gateway.mjs`, `packages/cli/src/commands/dashboard.mjs`, `packages/cli/src/probe.mjs` | Detect port conflicts via TCP probe; detect running services; provide clear error + fix hints |
| CLI-018 | done | P1 | agent | Add onboard resume/already-completed detection | CLI-011 | `packages/cli/src/commands/onboard.mjs` | Detect partial onboard (resume message); detect completed onboard (skip + show config); --force to re-run |
| CLI-019 | done | P2 | agent | Polish setup idempotency and partial-state handling | CLI-010 | `packages/cli/src/commands/setup.mjs` | Detect existing config with targeted advice; preserve config on --force; detect partial onboard state |
| CLI-020 | done | P1 | agent | Polish chat command with usage examples and timeout | CLI-006 | `packages/cli/src/commands/chat.mjs` | Usage examples on empty input; 30s timeout; formatted response output; clean error messages |
| TUI-001 | done | P0 | agent | Build TUI core: ANSI renderer, screen manager, alternate buffer, raw input | CLI-014 | `packages/cli/src/tui/ansi.mjs`, `packages/cli/src/tui/screen.mjs` | Zero-dependency ANSI renderer; alternate screen buffer; raw mode input; box drawing; styled text; buffered writes |
| TUI-002 | done | P0 | agent | Build TUI data layer with parallel gateway API fetches | CLI-014 | `packages/cli/src/tui/data.mjs` | Fetches sessions, approvals, tasks, traces, workflows, jobs, decisions, notifications, live state, status in parallel; reuses probe.mjs |
| TUI-003 | done | P0 | agent | Build TUI app controller with layout engine, keyboard handler, state management | TUI-001, TUI-002 | `packages/cli/src/tui/app.mjs` | 6 panes; Tab/Shift+Tab cycling; j/k/arrow navigation; Enter inspect; y/n/Y/A approval actions; r refresh; ? help; q quit; 10s auto-refresh; 2-column (wide) / single-pane (narrow) layout |
| TUI-004 | done | P0 | agent | Build 6 TUI panes: Sessions, Live State, Approvals, Tasks, Traces, Workflows | TUI-003 | `packages/cli/src/tui/panes.mjs` | Sessions list with message count and age; Live State with AI config and counts; Approvals with action hints; Tasks grouped by taskId; Traces with kind coloring; Workflows + Proactive Jobs + Decisions |
| TUI-005 | done | P0 | agent | Wire `claws tui` command with pre-flight gateway check | TUI-003 | `packages/cli/src/commands/tui.mjs`, `packages/cli/bin/claws.mjs`, help.mjs | Command routed; per-command --help; pre-flight gateway health check; clean error if gateway not running |
| CLI-021 | done | P1 | agent | Unify CLI/TUI coherence: shared vocab, terminology, cross-references, output style | TUI-005, CLI-020 | `packages/cli/src/vocab.mjs`, all command files, all TUI files, help.mjs, README | Shared vocabulary module; consistent section names, approval labels, status icons, time formatting; "See also" on all subcommand help; workflow guidance in help; TUI keyboard shortcuts in `claws tui --help` |

## Memory / Identity

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| MEM-001 | done | P1 | agent | Implement memory flush/promote skeleton and source linking | RUN-001 | `packages/tools/src/memory.ts`, `packages/core/src/runner.ts` | Runtime supports `memory.flush` + `memory.promote` and includes promoted/store-backed results in memory search |
| MEM-002 | done | P1 | agent | Implement identity loader and private-file exclusion | RUN-001 | `apps/gateway/src/main.ts`, `packages/tools/src/memory.ts` | Public identity files are loaded into runtime context and `identity/private/*` is excluded from memory search scope |
| MEM-003 | done | P1 | agent | Add task file + task-event append glue | RUN-005 | `packages/tools/src/tasks.ts`, runtime glue | Task updates write to `tasks.md` and append valid JSONL events |

## Approvals / View State

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| APP-001 | done | P0 | agent | Wire approval resolution end-to-end (API + runtime + UI) | RUN-003, RUN-004, WEB-004 | runtime + dashboard approvals files | A pending request can be resolved and removed from queue |
| APP-002 | done | P0 | agent | Wire per-thread view-state end-to-end | RUN-002, RUN-004, WEB-005 | router, gateway API, settings/chat | Changing view state affects subsequent routing for that thread |
| APP-003 | done | P1 | agent | Add scoped trust grants behavior and policy checks | APP-001 | `packages/core/src/approvals.ts`, `apps/gateway/src/main.ts` | once/session/24h/tool grants are checked at tool boundary and one-time grants are consumed correctly |

## Browser / Sandbox / Computer Use

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| EXE-001 | done | P1 | agent | Implement browser tool with Agent Browser-first architecture | RUN-001 | `packages/tools/src/browser.ts` | Tool accepts mode: `background|record-on-complete|watch-live|hybrid`, provider: `agent-browser|playwright|native`, configurable via `CLAWS_BROWSER_PROVIDER` |
| EXE-002 | done | P2 | agent | Implement sandbox adapter skeleton with policy gate | RUN-001, FND-003 | `packages/tools/src/sandbox.ts` | Sandbox calls are policy checked and fail safely when disabled |
| EXE-003 | done | P2 | agent | Demo artifact pathing and link posting flow | EXE-001, WEB-003 | `packages/tools/src/demo.ts`, `packages/tools/src/index.ts` | Demo artifacts saved to `assets/demos/YYYY-MM-DD/{id}.{ext}`; tools: demo.saveScreenshot, demo.saveMetadata |
| EXE-004 | done | P1 | agent | Wire Agent Browser adapter for real browser automation | EXE-001 | `packages/tools/src/browser.ts` | Agent Browser adapter with dynamic import, detection, and structured execution path |
| EXE-005 | done | P2 | agent | Add Playwright fallback adapter for local compatibility | EXE-001 | `packages/tools/src/browser.ts` | Playwright adapter with dynamic import, full navigate/screenshot/close flow |
| EXE-006 | done | P1 | agent | Add execution substrate metadata to ToolSpec + registry | EXE-001 | `packages/tools/src/registry.ts`, `packages/tools/src/index.ts` | ToolSpec carries `environment` field; registry exposes `byEnvironment()` and `listSpecs()` |
| EXE-007 | done | P1 | agent | Enrich gateway /api/status with execution substrate state | EXE-006 | `apps/gateway/src/main.ts` | Status includes `execution.browser`, `execution.sandbox`, `execution.computer`, `execution.routerOrder`, `toolsByEnvironment` |
| EXE-008 | done | P1 | agent | Add execution substrate types to shared types | EXE-006 | `packages/shared/src/types.ts` | `ExecutionSubstrateStatus`, `BrowserSubstrateStatus`, `SandboxSubstrateStatus`, `ComputerSubstrateStatus` exported |
| EXE-009 | done | P1 | agent | Add Execution tab to Settings page | EXE-007 | `apps/dashboard/app/settings/page.tsx` | Settings shows execution router, browser config, sandbox status, computer availability, durable execution state |
| EXE-010 | done | P1 | agent | Rewrite Workflows architecture with substrate model | EXE-006 | `apps/dashboard/app/workflows/page.tsx` | Architecture tab shows substrates, visibility modes, storage/adapters, substrate status indicators |
| EXE-011 | done | P2 | agent | Tighten sandbox tool with config reporting | EXE-002 | `packages/tools/src/sandbox.ts` | Sandbox returns config state in responses; `resolveSandboxConfig()` exported for status |
| EXE-012 | done | P2 | agent | Add substrate-aware traces | EXE-006 | `apps/gateway/src/main.ts`, `apps/dashboard/app/traces/page.tsx` | Tool call traces include `environment` in data; trace configs for browser/sandbox/workflow events |

## AI SDK Integration

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| SDK-001 | done | P0 | agent | Add AI SDK core dependency and streaming chat handler | RUN-004 | `apps/gateway/src/aiHandler.ts` | Gateway handles chat via AI SDK `generateText` with tool calling; auto-fallback to keyword dispatch |
| SDK-002 | done | P0 | agent | Add AI SDK tool definitions for registered tools | SDK-001 | `packages/tools/src/ai-sdk-adapter.ts` | Registered Claws tools exposed as AI SDK tool definitions via `toAISDKToolInputs()` |
| SDK-003 | done | P1 | agent | Wire chat UI with AI SDK architecture | SDK-001, WEB-007 | `apps/dashboard/app/chat/page.tsx`, `apps/dashboard/app/api/chat/route.ts` | Chat page uses gateway AI handler with shadcn/ui components; Next.js API route proxies to gateway |
| SDK-004 | done | P1 | agent | Configure AI Gateway model routing | SDK-001 | `apps/gateway/src/aiHandler.ts`, `.env.example` | Model provider selectable via `AI_MODEL`, `AI_GATEWAY_URL`, `OPENAI_API_KEY` env vars |
| SDK-005 | done | P1 | agent | Add SSE streaming chat endpoint and streaming-capable dashboard UI | SDK-001 | `apps/gateway/src/aiHandler.ts`, `apps/gateway/src/httpServer.ts`, `apps/dashboard/app/chat/page.tsx` | Gateway exposes `POST /api/chat/stream` with SSE text deltas; dashboard attempts streaming first with graceful fallback |

## Workflow / Durable Execution

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| WRK-001 | done | P1 | agent | Implement in-memory workflow engine | RUN-001 | `packages/core/src/workflow.ts` | Workflows can be created, stepped, paused, resumed, cancelled with step-level tracking |
| WRK-002 | done | P1 | agent | Add persistent workflow storage (disk-backed) | WRK-001 | `packages/core/src/workflow.ts` | Workflow runs persist to `.claws/workflow-store.json` and survive gateway restarts |
| WRK-003 | done | P2 | agent | Wire gateway API routes for workflow operations | WRK-001, RUN-004 | `apps/gateway/src/httpServer.ts` | Full CRUD: list/get/create/advance/pause/resume/cancel workflow runs via REST API |
| WRK-004 | done | P2 | agent | Add Vercel Workflow adapter for hosted deployment | WRK-001 | `packages/core/src/workflow-vercel.ts` | VercelWorkflowAdapter class with create/advance/pause/resume/cancel/list/get methods; factory function with auto-detection |

## Multi-Tenant (Future)

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| MT-001 | done | P2 | agent | Add multi-tenant types and interfaces | RUN-001 | `packages/shared/src/types.ts` | `TenantConfig` type exported with slug, subdomain, custom domain, workspace root fields |
| MT-002 | done | P2 | agent | Add tenant routing middleware skeleton | MT-001 | `apps/gateway/src/tenantRouter.ts` | Middleware resolves tenant from subdomain/X-Tenant-ID header; default local tenant; per-tenant workspace root isolation |
| MT-003 | done | P2 | agent | Add tenant creation and management API | MT-001, MT-002 | `apps/gateway/src/httpServer.ts`, `apps/gateway/src/main.ts` | API supports create/list/get tenant operations via `/api/tenants` routes |

## Testing / Harness

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| TST-001 | done | P1 | agent | Add typecheck/lint/test scripts across workspaces | FND-001, FND-002 | root scripts + package scripts | Root commands run without missing script/package errors |
| TST-002 | done | P1 | agent | Add golden + replay harness skeleton | RUN-004 | `packages/harness/src/golden.js`, `packages/harness/src/replay.js` | Harness can execute one deterministic fixture |
| TST-003 | done | P1 | agent | Add path-governance and approval tests | RUN-003, RUN-004 | `packages/harness/src/security.js`, `packages/workspace/dist/*` | Harness enforces path-governance negatives and deterministic approval regressions (deny, once-consumption, expiry, reset isolation) |
| TST-004 | done | P2 | agent | Add dashboard API smoke tests | WEB-003, WEB-004 | `packages/harness/src/smoke.js` | Automated smoke covers chat/approvals/view-state/tasks/traces/project-create flows via gateway API with deterministic reset isolation |
| TST-005 | done | P1 | agent | Add browser-driven dashboard E2E tests | WEB-007 | `packages/harness/src/ui-smoke.js` | Page-level dashboard interaction checks covering all 11 pages, streaming endpoint, and workflow API |

## Human-Required Tasks

| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| HUM-001 | blocked | P0 | human | Decide metadata index default (`sqlite-only` vs `sqlite+convex optional`) | - | config defaults in runtime/docs | Decision documented in `project-context/human-tasks.md` |
| HUM-002 | blocked | P1 | human | Choose default approval mode (`off|smart|strict`) | - | onboarding defaults + config docs | Decision set in template/config defaults |
| HUM-003 | todo | P1 | human | Provide required env vars and bot tokens | FND-003 | local env + deployment settings | `.env` values available for enabled integrations |
| HUM-004 | todo | P1 | human | Confirm Vercel project ownership and AI Gateway usage model | - | deployment config | Project and routing strategy selected |
| HUM-005 | blocked | P2 | human | Confirm iMessage scope (defer or not) | - | channel roadmap | Scope documented and non-v0 work deferred if needed |
| HUM-006 | todo | P1 | human | Provide OpenAI/Anthropic API key for AI SDK integration | SDK-001 | `.env.local` | API key available for streaming chat to work |
