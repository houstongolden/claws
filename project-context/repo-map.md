# Claws.so Repo Map (Consolidated)

This map reflects the current implementation state of the repository.

## Current Real State

All listed paths exist and are implemented:
- Root monorepo files (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.env.example`, `README.md`)
- `apps/gateway`, `apps/dashboard`, `apps/worker`
- `packages/shared`, `packages/core`, `packages/workspace`, `packages/tools`, `packages/agents`, `packages/cli`, `packages/harness`
- `templates/base/workspace` deterministic scaffold
- `project-context/*` canonical planning artifacts

## Repository Shape

```text
/
├── apps/
│   ├── gateway/          # Local gateway + runtime + HTTP API + AI SDK handlers
│   ├── dashboard/        # Next.js chat-first UI (Geist + Tailwind + shadcn/ui)
│   └── worker/           # Background jobs / schedulers / queue workers
├── packages/
│   ├── shared/           # Shared types, schemas, validators
│   ├── core/             # Router, runner, approvals, workflow engine
│   ├── workspace/        # Filesystem contract + path enforcement (`FOLDER.md`)
│   ├── tools/            # Tool registry + AI SDK adapter + browser/memory/fs/demo tools
│   ├── agents/           # Orchestrator + lead agents (founder, developer)
│   ├── cli/              # `claws` + `create-claws` entrypoints
│   └── harness/          # Smoke/golden/replay/security/UI harness
├── templates/
│   └── base/
│       └── workspace/    # Deterministic workspace scaffold used by `create-claws`
├── project-context/      # Canonical planning and execution artifacts
└── scripts/              # Dev scripts/utilities
```

## Directory-Level Purpose and Status

| Path | Purpose | Implemented |
|---|---|---|
| `apps/gateway` | Runtime daemon, gateway API, AI SDK handlers, tenant routing | yes |
| `apps/dashboard` | Chat-first dashboard UI with 11 pages, all using shadcn/ui | yes |
| `apps/worker` | Background job runner stub | yes |
| `packages/shared` | Core shared contracts/types (workflow, browser, multi-tenant) | yes |
| `packages/core` | Router, runner, approvals, workflow engine (local + Vercel adapter) | yes |
| `packages/workspace` | `FOLDER.md` path governance and workspace fs | yes |
| `packages/tools` | Registry + AI SDK adapter + browser/fs/memory/tasks/demo/sandbox | yes |
| `packages/agents` | Orchestrator, founder, developer agents | yes |
| `packages/cli` | `claws`/`create-claws` entrypoints | yes |
| `packages/harness` | API smoke, security, UI smoke harness | yes |
| `templates/base/workspace` | `create-claws` scaffold source of truth | yes |
| `project-context` | Canonical product, tasks, roadmap, current state | yes |

## Key Implementation Files

### Gateway
- `apps/gateway/src/main.ts` — runtime orchestration, tool registration, state management
- `apps/gateway/src/httpServer.ts` — HTTP API with all routes (chat, streaming, workflows, tenants)
- `apps/gateway/src/aiHandler.ts` — AI SDK `generateText` + `streamText` handlers with tool calling
- `apps/gateway/src/tenantRouter.ts` — multi-tenant request routing middleware
- `apps/gateway/src/cli.ts` — CLI command handlers
- `apps/gateway/src/localStore.ts` — disk-backed persistence for traces/approvals/state

### Dashboard
- `apps/dashboard/app/chat/page.tsx` — streaming-capable chat with SSE + fallback
- `apps/dashboard/app/workflows/page.tsx` — workflow viewer with step-level controls
- `apps/dashboard/app/agents/page.tsx` — agent roster with AI status
- `apps/dashboard/app/memory/page.tsx` — interactive memory search
- `apps/dashboard/app/files/page.tsx` — workspace info and fs tools
- `apps/dashboard/app/api/chat/route.ts` — proxy with streaming support
- `apps/dashboard/components/ui/*` — shadcn/ui component library (Button, Input, Select, Textarea, Badge, Card)
- `apps/dashboard/lib/api.ts` — typed API client for all gateway endpoints

### Packages
- `packages/shared/src/types.ts` — all shared types (workflow, browser, tenant, etc.)
- `packages/core/src/router.ts` — per-thread view-state routing
- `packages/core/src/approvals.ts` — approval store with trust grants
- `packages/core/src/workflow.ts` — disk-backed workflow engine
- `packages/core/src/workflow-vercel.ts` — Vercel Workflow adapter skeleton
- `packages/tools/src/browser.ts` — Agent Browser + Playwright adapters
- `packages/tools/src/demo.ts` — demo artifact pathing and persistence
- `packages/tools/src/ai-sdk-adapter.ts` — Claws tools → AI SDK tool conversion
- `packages/tools/src/index.ts` — tool registration with risk mapping

### Harness
- `packages/harness/src/smoke.js` — API smoke tests
- `packages/harness/src/security.js` — path governance and approval tests
- `packages/harness/src/ui-smoke.js` — dashboard page-level checks
- `packages/harness/src/golden.js` — golden fixture tests
- `packages/harness/src/replay.js` — replay harness

### Template
- `templates/base/workspace/FOLDER.md`
- `templates/base/workspace/PROJECT.md`
- `templates/base/workspace/tasks.md`
- `templates/base/workspace/prompt/*`
- `templates/base/workspace/identity/*`
- `templates/base/workspace/agents/*`

## API Surface

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/api/status` | GET | Gateway runtime status |
| `/api/chat` | POST | Chat (non-streaming, JSON response) |
| `/api/chat/stream` | POST | Chat (SSE streaming) |
| `/api/traces` | GET | Trace timeline (paginated) |
| `/api/approvals` | GET | Pending approvals |
| `/api/approvals/:id/resolve` | POST | Resolve approval with grant |
| `/api/view-state` | GET/POST | View state get/set |
| `/api/tasks/events` | GET/POST | Task events (paginated) |
| `/api/workflows` | GET/POST | Workflow list/create |
| `/api/workflows/:id` | GET | Workflow detail |
| `/api/workflows/:id/advance` | POST | Advance workflow step |
| `/api/workflows/:id/pause` | POST | Pause workflow |
| `/api/workflows/:id/resume` | POST | Resume workflow |
| `/api/workflows/:id/cancel` | POST | Cancel workflow |
| `/api/tenants` | GET/POST | Tenant list/create |
| `/api/tenants/:id` | GET | Tenant detail |
| `/api/test/reset` | POST | Reset runtime state (test only) |
