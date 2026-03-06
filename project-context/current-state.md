# Current State (Post-Session-First UX Pass)

## What now exists

### Design system (production-grade)
- Geist Sans + Geist Mono fonts loaded via `geist` package in `layout.tsx`
- Tailwind CSS v4 with `@tailwindcss/postcss` plugin
- CSS custom properties for all design tokens
- `cn()` utility via `clsx` + `tailwind-merge`
- `class-variance-authority` for variant-based component styling
- Lucide React icons in navigation and across all pages
- **shadcn/ui-style component library**: Button, Input, Select, Textarea, Badge, Card, Dialog, Tabs
- Zero inline styles remaining in dashboard

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
- **Session (`/` and `/chat`)**: Shared AI-first workbench with streaming chat, typing cursor, tool result cards, session-persisted history, clear action, PRD-aligned prompt suggestions, and a live right-side context rail for current task/project/files/approvals/memory/traces/workflows
- **Tasks**: Canonical build queue parsed from `project-context/tasks.md` plus append-only activity view from `tasks.jsonl`
- **Projects**: Filesystem-backed project list from `projects/` scan; browser-verified chat project creation works
- **Approvals**: Approval cards with risk badges and grant actions
- **Traces**: Trace timeline with search, type filter, substrate-aware event rendering, and clearer runtime-ledger framing
- **Settings**: Tabbed layout with Views / Runtime / AI Config / Execution / Environment; view-state round-trip browser-verified
- **Workflows**: Full viewer with step timelines and pause/resume/cancel plus clearer durable-execution framing
- **Files**: Workspace browser backed by `fs.list`, file inspector via `fs.read`, and quick reads for canonical docs
- **Memory**: Interactive memory search, session checkpoint flush, and promote actions for store-backed entries
- **Agents**: Agent roster, routing model, tool environments, and clearer multi-agent orchestration framing
- **Shell**: Tenant-aware with tenant name in header/sidebar plus expanded-view banner on non-session routes
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

### Demo artifact system
- `packages/tools/src/demo.ts`: Saves screenshots and metadata to `assets/demos/YYYY-MM-DD/`
- Registered in tool system and AI SDK schemas

### Enriched status endpoint
- `/api/status` returns: gateway state, workspace root, registered tools, agents (with descriptions and modes), AI config (enabled, streaming, model, gateway URL), workflow stats, tenant info, approval/trace counts, and execution substrate state

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

1. **Cross-screen live updates**: Toast/live-refresh after chat-side mutations
2. **Mobile session adaptation**: Preserve the new session/context-rail model on smaller screens
3. **Full server-side session persistence**: Move beyond client-sent history to durable per-session transcripts
4. **Full Agent Browser SDK wiring**: When `@anthropic-ai/agent-browser` is installed
5. **Full Vercel Sandbox / Workflow SDK wiring**: When hosted adapters are available
6. **FOLDER.md governance**: Parse and enforce allowed roots, write behavior, safety boundaries from FOLDER.md
7. **Tasks.md write path**: Move tasks across lanes/status from UI or runtime
8. **Memory → MEMORY.md**: Approval-gated proposal to prompt/MEMORY.md from promoted entries
9. **Proactivity cron/interval scheduler**: Process that runs due jobs periodically
10. **Project drill-in**: /projects/[slug] or modal to read project.md and tasks.md

---

## System readiness score (0–100%)

**~62%** — Based on PRD completeness.

- **Delivered:** Workspace scaffold, gateway, dashboard, session workbench, chat streaming, approvals, traces, workflows, PGlite persistence, conversations/channels, intelligence, proactivity (schema + API + UI + slash + on-demand), browser (Playwright), execution substrates visibility, multi-tenant scaffold, CLI/create-claws, harness tests.
- **Partial:** Session persistence (client-sent history only), tasks (read-only tasks.md), memory (no MEMORY.md write), view lens (not applied to queries), streaming (tool events only at end), Agent Browser (adapter only), multi-tenant (in-memory).
- **Missing:** FOLDER.md governance, tasks.md write path, project drill-in, toast/live updates, proactivity scheduler, Agent Browser execution, Vercel Sandbox, mobile sidecar, create workflow from UI.

See `project-context/feature-ledger.md` and `project-context/IMPLEMENTATION_AUDIT.md` for full reconciliation.

---

## Critical missing capabilities

1. Durable session transcripts (server-side persist + load on reconnect; session list/resume)
2. FOLDER.md as source of truth for allowed roots and write behavior
3. Tasks.md write path (move lanes, update status from UI/runtime)
4. Streaming tool-call events in SSE (incremental tool UI)
5. Agent Browser real execution path
6. Project drill-in view (/projects/[slug] or modal)
7. Memory → MEMORY.md (approval-gated proposal)
8. View lens applied to task/project/file queries
9. Proactivity cron/interval scheduler
10. Toast / live updates after chat mutations
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
