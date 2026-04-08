# Current State (Session-First + Vibe Coding + Operator UI)

**Last updated:** 2026-03 — project-context sync with repo.

## What now exists

### Design system (production-grade)
- Geist Sans + Geist Mono fonts loaded via `geist` package in `layout.tsx`
- Tailwind CSS v4 with `@tailwindcss/postcss` plugin
- CSS custom properties for all design tokens
- `cn()` utility via `clsx` + `tailwind-merge`
- `class-variance-authority` for variant-based component styling
- Lucide React icons in navigation and across all pages
- **shadcn/ui-style component library**: Button, Input, Select, Textarea, Badge, Card, Dialog, Tabs
- **Design passes (2026):** Apple/OpenAI-adjacent UI — glass headers, rounded-2xl panels, shared shadow tokens (`--shadow-sm/md/composer`), segmented **Tabs**, refined **Badge** / **StatusDot**, **Input/Select/Textarea** h-9 + rounded-xl, Home/Settings/Traces/Tasks/Projects/Workflows/Approvals/Memory/Files/Agents/Proactivity aligned; **Context panel** + **Approvals** grant buttons polished.

### AI SDK integration (streaming-capable)
- `ai` v6 + `@ai-sdk/openai` + `@ai-sdk/provider` installed in gateway
- `@ai-sdk/react` installed in dashboard
- `apps/gateway/src/aiHandler.ts`: `generateText` and `streamText` handlers with tool calling
- SSE streaming endpoint: `POST /api/chat/stream` with real-time text deltas
- JSON Schema-based tool definitions for all registered tools
- Auto-fallback: streaming -> non-streaming -> keyword dispatch
- Dashboard requests now carry `chatId` and prior turns so session routing and approvals are more meaningfully scoped
- Tool result cards now reflect executed outputs/errors rather than echoed tool-call args
- Configurable model, gateway URL, and API keys via env vars

### Dashboard (session-first, all using shadcn/ui)
- **Session (`/` and `/chat`)**: Shared AI-first workbench with streaming chat, typing cursor, **compact file cards** for `fs.write` / `fs.append` (filename only; opens artifact panel), **right artifact panel** (Code + HTML Preview + Open in browser), **sidebar auto-collapse** when artifact opens (vibe-coding layout), session-persisted history, clear action, suggested prompts, and a live **Context** rail (Overview / Project / Files / Approvals / Memory / Traces / Workflow). **Nav → Sessions**: starred + recent chats with select/resume; new chat from primary CTA.
- **Tasks**: Canonical build queue parsed from `project-context/tasks.md` plus append-only activity view from `tasks.jsonl`
- **Projects**: Filesystem-backed project list from `projects/` scan; browser-verified chat project creation works
- **Approvals**: Approval cards with risk badges and grant actions
- **Traces**: Trace timeline with search, type filter, substrate-aware event rendering, and clearer runtime-ledger framing
- **Settings**: Tabbed layout with Views / Runtime / AI Config / Execution / Environment; view-state round-trip browser-verified
- **Workflows**: Full viewer with step timelines and pause/resume/cancel plus clearer durable-execution framing
- **Files**: Workspace browser backed by `fs.list`, file inspector via `fs.read`, and quick reads for canonical docs
- **Memory**: Interactive memory search, session checkpoint flush, and promote actions for store-backed entries
- **Agents**: Agent roster, routing model, tool environments, and clearer multi-agent orchestration framing
- **Shell**: Top bar on expanded routes: **Open CLI** (TUI / CLI chat / status), gateway status pill, **cloud sync** indicator, **update available** badge, **custom dashboard** badge when applicable; glass-bar styling. **SidebarContext**: collapsed state persisted (localStorage); artifact open can collapse nav for width.
- **Nav**: Session-first rail with active view state, recent projects, context views, and runtime surfaces

### Workflow system (persistent + API + Vercel adapter)
- `packages/core/src/workflow.ts`: Disk-backed local workflow engine
- `packages/core/src/workflow-vercel.ts`: Vercel Workflow adapter with auto-detection
- Gateway auto-selects local or Vercel adapter based on env config
- Full CRUD API routes for workflow management
- Dashboard workflow viewer with real-time polling

### Browser / computer-use
- Agent Browser adapter (dynamic import, activates when SDK installed)
- Playwright adapter (full navigate/screenshot flow) and now the honest default local provider
- Playwright-backed actions for `browser.click`, `browser.type`, `browser.extract` when a URL is supplied
- Configurable via `CLAWS_BROWSER_PROVIDER` env var
- Browser QA completed against live local app at `http://localhost:4318`

### Multi-tenant architecture (wired end-to-end)
- `apps/gateway/src/tenantRouter.ts`: Tenant resolution per-request
- Every gateway request resolves tenant via subdomain/custom-domain/X-Tenant-ID
- Tenant context injected into status endpoint responses
- Dashboard shell and nav display tenant info
- Tenant CRUD API: `GET/POST /api/tenants`, `GET /api/tenants/:id`
- Per-tenant workspace root isolation

### Worker (background execution)
- `apps/worker/src/main.ts`: Polls gateway for active workflows
- Finds next pending step and executes tools through `/api/tools/run`
- Reports step completion/failure back to workflow engine
- Waits for gateway health on startup
- Configurable poll interval via `CLAWS_WORKER_POLL_MS`

### CLI / local install architecture (operator-grade)
- `@claws-so/cli` (`packages/cli`): Operator-grade CLI with `setup`, `onboard`, `doctor`, `status`, `dashboard`, `gateway`, `chat` commands
- `@claws-so/create` (`packages/create`): Bootstrap CLI with logo, spinners, guided flow (`npx @claws-so/create`)
- Claws home directory model: `~/.claws/claws.json`, `~/.claws/workspace/`, `~/.claws/runtime/`, `~/.claws/logs/`
- Config resolver with env overrides: `CLAWS_HOME`, `CLAWS_STATE_DIR`, `CLAWS_CONFIG_PATH`, `CLAWS_WORKSPACE_DIR`
- **Doctor** (8 diagnostic categories): Config (parse, version, onboarding), Filesystem (home + 9 workspace files), Runtime (PGlite, gateway runtime data), Services (gateway, dashboard, port conflicts), Environment (AI provider multi-key detection, model, gateway routing), Execution (browser, sandbox from gateway), Integrations (Telegram, Vercel, Slack). Health score bar (0–100%), pass/warn/fail counts, targeted fix suggestions. `--verbose` for extra detail.
- **Status** (compact operator summary): Local config, parallel gateway probes, runtime data (mode, AI, execution, workflows, approvals, traces, tenants, agents, tools), proactive jobs + last decision, concise service status.
- **Per-command --help**: `claws <cmd> --help` for all commands; categorized help output; SUBHELP registry with usage, descriptions, and flags.
- **Port conflict detection**: TCP probes for gateway/dashboard ports; detect already-running services; clean error + fix hints.
- **Onboard resume detection**: Detect partial onboard (resume message), completed onboard (skip + show config), `--force` to re-run.
- **Probe module** (`probe.mjs`): Reusable TCP port check, HTTP fetch with timeout, gateway/dashboard URL resolution.
- Polished onboarding wizard: 6-step interactive flow with welcome screen, step progress, conversational prompts, env detection, spinners, animated bootstrap, polished summary
- Reusable messages module (`messages.mjs`): 60+ tasteful crustacean-personality status strings across 8 categories
- UI module (`ui.mjs`): ᐳᐸ logo (big/small), spinner animation, stepProgress, section/step/success/warn/fail/kv/hr/hint formatters
- Optional daemon install for macOS (launchd) and Linux (systemd)
- Scoped package architecture: package names decoupled from binary names for future rename flexibility

### TUI — Full-screen terminal UI
- **`claws tui`**: First-class operator surface for terminal-native users
- **6 panes**: Sessions, Live State, Approvals, Tasks, Traces, Workflows
- **Architecture**: Zero-dependency ANSI renderer (`tui/ansi.mjs`), screen manager with alternate buffer (`tui/screen.mjs`), data layer with parallel API fetches (`tui/data.mjs`), pane renderers (`tui/panes.mjs`), app controller (`tui/app.mjs`)
- **Layout**: Two-column on wide terminals (≥100 cols), single-pane with Tab switching on narrow
- **Keyboard shortcuts**: Tab/Shift+Tab (cycle panes), j/k/↑/↓ (scroll), Enter (inspect detail), s/l/a/t/c/w (jump to pane), y/n/Y/A (approval actions), r (refresh), ? (help overlay), q/Ctrl+C (quit)
- **Data**: Parallel batch fetch of all gateway API endpoints (sessions, approvals, tasks, traces, workflows, proactive jobs, decisions, notifications, status). 10-second auto-refresh.
- **Detail views**: Session detail shows message history; Trace detail shows kind, metadata, and JSON data dump
- **Pre-flight check**: Verifies gateway is reachable before entering alt screen
- **Coherence**: Shared vocabulary module (`vocab.mjs`) ensures consistent section names, status categories, time formatting, and approval labels across CLI commands and TUI panes. All subcommand help includes "See also" cross-references. Help includes workflow guidance (`setup → onboard → doctor → status → tui`).

### Demo artifact system
- `packages/tools/src/demo.ts`: Saves screenshots and metadata to `assets/demos/YYYY-MM-DD/`
- Registered in tool system and AI SDK schemas

### Enriched status endpoint
- `/api/status` returns: gateway state, workspace root, registered tools, agents (with descriptions and modes), AI config (enabled, streaming, model, gateway URL), workflow stats, tenant info, approval/trace counts, and execution substrate state

### Gateway runtime DB resilience
- **PGlite persistent path:** `.claws/runtime/` (dataDir) — preferred; full durability across restarts.
- **In-memory fallback:** If `initRuntimeDb({ dataDir })` fails (e.g. WASM `Aborted()` on some Node/OS combos), gateway calls **`initRuntimeDbInMemory()`** and continues; logs a warning. **Data does not persist** across restarts in that mode. Redeploy/fix: clear `.claws/runtime`, try another Node version, or upgrade `@electric-sql/pglite` when available.

### AI file-creation discipline
- **System prompt** (`apps/gateway/src/aiHandler.ts`): model instructed to use **`fs.write`** for files, **not** paste full file bodies into chat; short confirmation only after write.

### Testing
- `packages/harness/src/smoke.js`: API smoke tests
- `packages/harness/src/security.js`: Path governance and approval tests
- `packages/harness/src/ui-smoke.js`: Dashboard page-level checks (all 11 pages)

## What runs

```bash
pnpm install    # installs all workspace deps
pnpm typecheck  # 10/10 packages pass
pnpm test       # smoke + security harness passes (when gateway is running)
pnpm dev        # starts gateway (4317), dashboard (4318), worker
```

## What still needs implementation

1. **Cross-screen live updates**: ~~Toast/live-refresh~~ — **Done:** claws:refresh-context event on chat mutation; Projects and Tasks refetch.
2. **Mobile session adaptation**: Context drawer exists; further polish for artifact panel + composer on small screens
3. ~~**Session list/resume UI**~~ — **Done:** Nav **Sessions** section (starred + list), select chat resumes session; `chat-list-context` + `ensureChatInList`.
4. **Full Agent Browser SDK wiring**: When `@anthropic-ai/agent-browser` is installed
5. **Full Vercel Sandbox / Workflow SDK wiring**: When hosted adapters are available
6. ~~**FOLDER.md governance**~~: **Done** — loadFolderContractSync + parseFolderMd in packages/workspace/src/folder-md.ts; WorkspaceFS uses it.
7. ~~**Tasks.md write path**~~: **Done** — create/update/move/complete in tasks.ts, gateway routes, tasks page UI.
8. ~~**Memory → MEMORY.md**~~: **Done** — createMemoryProposal + resolveApproval appends to prompt/MEMORY.md; memory page "Propose to MEMORY.md".
9. ~~**Proactivity cron/interval scheduler**~~: **Done** — Gateway runs 30s setInterval calling listDueScheduledJobs and runProactiveJob (apps/gateway/src/main.ts)
10. ~~**Project drill-in**~~: **Done** — /projects/[slug] with project.md and tasks.md (apps/dashboard/app/projects/[slug]/page.tsx)

---

## System readiness score (0–100%)

**~85%** — Based on PRD completeness.

- **Delivered:** Everything previously at ~78%, plus **session list + resume** (nav), **vibe coding UI** (file cards, artifact panel, preview, open in browser, sidebar collapse), **streaming tool UI** (file cards during stream + on complete), **PGlite in-memory fallback** (gateway still starts), **design system alignment** across dashboard, **AI prompt** for fs.write-only file creation in chat.
- **Partial:** PGlite persistent mode on all hosts (fallback used when WASM/dataDir fails); multi-tenant still in-memory scaffold; Agent Browser optional SDK.
- **Remaining polish / roadmap:** Real multi-agent delegation UX, proactive messages into conversation thread, heartbeat runners, optional full cron parsing for jobs.

See `project-context/feature-ledger.md` and `project-context/IMPLEMENTATION_AUDIT.md` for full reconciliation.

---

## Critical missing capabilities

1. ~~Session list/resume UI~~ — **Done** (nav Sessions).
2. ~~FOLDER.md as source of truth~~ — **Done:** loadFolderContractSync + parseFolderMd in folder-md.ts; WorkspaceFS uses it.
3. ~~Tasks.md write path~~ — **Done:** create/update/move/complete from UI and gateway.
4. ~~Streaming tool-call events / incremental tool UI~~ — **Done** (file cards + artifact panel; stream + complete).
5. Agent Browser real execution path
6. ~~Project drill-in~~ — **Done:** /projects/[slug] with project.md and tasks.md.
7. ~~Memory → MEMORY.md (approval-gated proposal)~~ — **Done:** createMemoryProposal + resolveApproval in gateway.
8. View lens applied to task/project/file queries
9. ~~Proactivity cron/interval scheduler~~ — **Done:** 30s interval in gateway runs listDueScheduledJobs and runProactiveJob.
10. ~~Toast / live updates~~ — **Done:** claws:refresh-context dispatched on chat mutation; Projects and Tasks refetch.
11. Vercel Sandbox adapter
12. Workflow step → substrate routing and substrate-specific traces
13. Create workflow from dashboard UI
14. Mobile/responsive context rail
15. Real multi-agent delegation

## Human input needed

- `HUM-006`: OpenAI or Anthropic API key for AI SDK integration
- `HUM-004`: Confirm Vercel project ownership and AI Gateway usage model
- `HUM-001`: Decide metadata index default
- `HUM-002`: Choose default approval mode

## Exact commands to resume work

```bash
cd /Users/houstongolden/Desktop/CODE_2025/claws
pnpm install
pnpm typecheck
pnpm dev

# Open dashboard
open http://localhost:4318

# Enable AI-powered streaming chat
echo "OPENAI_API_KEY=sk-..." >> .env

# Check enriched status
curl http://localhost:4317/api/status | jq

# Test streaming endpoint
curl -X POST http://localhost:4317/api/chat/stream \
  -H 'content-type: application/json' \
  -d '{"message": "status"}'

# Create a tenant
curl -X POST http://localhost:4317/api/tenants \
  -H 'content-type: application/json' \
  -d '{"slug": "acme", "name": "Acme Corp"}'
```
