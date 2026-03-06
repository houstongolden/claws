# Claws.so

Local-first, Vercel-native, chat-first agent OS.

Built with Next.js, Vercel AI SDK v6, Geist design system, Tailwind CSS, shadcn/ui, and TypeScript.

**OpenClaw clarification:**
Claws is not an OpenClaw fork. It is a clean-room implementation inspired by OpenClaw concepts and rebuilt from scratch for Vercel-native workflows.

## What is running today

- Local gateway API with chat, traces, approvals, view-state, task-events, and workflow routes
- **AI SDK v6** integration with `generateText` and `streamText` for AI-powered chat with tool calling
- **SSE streaming chat** endpoint with real-time token delivery and graceful fallback
- Next.js dashboard with Geist fonts, Tailwind CSS, shadcn/ui components, and Lucide icons
- Pages: Chat (streaming), Tasks, Projects, Files, Memory, Agents, Workflows, Approvals, Traces, Settings
- Deterministic workspace template scaffold under `templates/base/workspace`
- CLI commands for `start`, `chat`, `init`, and `doctor`
- Browser tool with Playwright-backed local execution and optional Agent Browser adapter
- Persistent workflow engine with pause/resume/approval checkpoints (survives restarts) plus worker-driven tool execution
- Tenant routing middleware for future multi-tenant hosted deployment

## Architecture alignment

### Vercel AI Cloud
- AI SDK v6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/provider`) integrated for chat and tool use
- `generateText` for non-streaming, `streamText` for SSE streaming responses
- Tool calling with JSON Schema definitions for all registered tools
- Gateway-first model routing with direct-provider fallbacks:
  - `AI_GATEWAY_API_KEY` -> Vercel AI Gateway (highest priority)
  - `OPENAI_API_KEY` -> direct OpenAI fallback
  - `ANTHROPIC_API_KEY` -> direct Anthropic fallback
- Workflow engine aligned with Vercel Workflow / Workflow DevKit patterns

### Local-first + future hosted
- Workspace files on local disk are canonical (never outranked by cloud)
- Gateway/dashboard separation supports independent scaling
- Tenant routing middleware resolves from subdomain, custom domain, or `X-Tenant-ID` header
- Multi-tenant types defined for future per-user hosted instances
- Architecture does not block subdomain routing or custom domain support

### Browser & computer use
- Playwright is the default local browser provider (navigate, screenshot, click, type, extract)
- Agent Browser remains an optional adapter path that activates when its SDK is installed
- Native computer-use remains an honest future-facing surface, not a fully wired local substrate
- Execution modes: `background`, `record-on-complete`, `watch-live`, `hybrid`
- Configurable via `CLAWS_BROWSER_PROVIDER` env var

### Design system
- Geist Sans + Geist Mono fonts (via `geist` package)
- Tailwind CSS v4 with CSS custom properties
- shadcn/ui-style component library (Button, Input, Select, Textarea, Badge, Card)
- class-variance-authority for variant-based styling
- Lucide React icons
- Consistent dark theme with Vercel-style spacing and materials

## Local defaults

- Gateway port: `4317`
- Dashboard port: `4318`
- Dashboard -> gateway URL: `http://localhost:4317`

## Quick start

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open:
- Dashboard: [http://localhost:4318](http://localhost:4318)
- Gateway health: [http://localhost:4317/health](http://localhost:4317/health)

## Env vars

Strictly required for local boot:
- none (defaults are built in)

Recommended to set:
- `CLAWS_PORT=4317`
- `NEXT_PUBLIC_CLAWS_GATEWAY_URL=http://localhost:4317`

AI SDK integration:
- `AI_GATEWAY_API_KEY` — primary key (routes all models through Vercel AI Gateway)
- `AI_GATEWAY_URL` — optional custom base URL for Vercel AI Gateway
- `OPENAI_API_KEY` — direct OpenAI fallback when gateway key is not set
- `ANTHROPIC_API_KEY` — direct Anthropic fallback when gateway/openai keys are not set
- `AI_MODEL=gpt-4o-mini` — model selection (default: gpt-4o-mini)

Routing order at runtime:
1. `AI_GATEWAY_API_KEY`
2. `OPENAI_API_KEY`
3. `ANTHROPIC_API_KEY`

If none are configured, startup fails with:
`No AI provider configured. Set one of: AI_GATEWAY_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY`.

Runtime toggles:
- `CLAWS_DEFAULT_VIEW=founder` (or `agency|developer|creator|personal|fitness`)
- `CLAWS_SANDBOX_ENABLED=false`
- `CLAWS_BROWSER_PROVIDER=playwright` (or `agent-browser|native`)
- `CLAWS_GATEWAY_URL=http://localhost:4317` (used by harness tests)

Optional integrations:
- `TELEGRAM_BOT_TOKEN`
- `VERCEL_API_TOKEN`

## Developer commands

```bash
# full local runtime stack (gateway + dashboard + worker)
pnpm dev

# run single surfaces
pnpm gateway
pnpm dashboard
pnpm worker

# quality checks
pnpm typecheck
pnpm test

# CLI helpers
pnpm claws --help
pnpm claws chat "status"
pnpm create-claws --yes --name "Builder" --workspace "Life OS"
```

## Gateway API

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/api/status` | GET | Gateway runtime status |
| `/api/chat` | POST | Chat (non-streaming) |
| `/api/chat/stream` | POST | Chat (SSE streaming) |
| `/api/traces` | GET | Trace timeline |
| `/api/approvals` | GET | Pending approvals |
| `/api/approvals/:id/resolve` | POST | Resolve approval |
| `/api/view-state` | GET/POST | View state |
| `/api/tasks/events` | GET/POST | Task events |
| `/api/workflows` | GET/POST | Workflow list/create |
| `/api/workflows/:id` | GET | Workflow detail |
| `/api/workflows/:id/advance` | POST | Advance workflow step |
| `/api/workflows/:id/pause` | POST | Pause workflow |
| `/api/workflows/:id/resume` | POST | Resume workflow |
| `/api/workflows/:id/cancel` | POST | Cancel workflow |

## Repo structure

```text
apps/
  gateway/    # local runtime + HTTP API + AI SDK handlers
  dashboard/  # Next.js UI (Geist + Tailwind + shadcn/ui)
  worker/     # background worker stub
packages/
  agents/     # orchestrator/founder/developer definitions
  cli/        # claws + create-claws commands
  core/       # router, approvals, runner, workflow engine
  harness/    # smoke/golden/replay/security harness
  shared/     # shared types (workflow, browser, multi-tenant)
  tools/      # tool registry, AI SDK adapter, browser/memory/fs tools
  workspace/  # WorkspaceFS + path governance
templates/
  base/workspace/  # deterministic init scaffold
project-context/   # canonical PRD/tasks/roadmap docs
```

## Canonical planning docs

- `project-context/prd.md` — product specification
- `project-context/tasks.md` — build queue
- `project-context/tasks.jsonl` — append-only task events
- `project-context/build-roadmap.md` — phased delivery plan
- `project-context/next-pass.md` — current sprint
- `AGENT.md` — agent workflow rules

## Implementation references

- [Vercel AI Cloud](https://vercel.com/blog/the-ai-cloud-a-unified-platform-for-ai-workloads)
- [AI SDK](https://ai-sdk.dev/docs/agents/overview)
- [Vercel Workflow](https://useworkflow.dev/)
- [Agent Browser](https://agent-browser.dev/)
- [Geist Design System](https://vercel.com/geist/introduction)
- [Vercel Platforms](https://github.com/vercel/platforms)
