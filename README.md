# Claws 🦞

> **The front-end framework for OpenClaw UIs.**
> Plus an experimental agent OS for Vercelians 👽🦞

Claws is two things in one turborepo:

1. **`@claws/sdk` + Claws Studio + Template Marketplace** — the React framework, visual template builder, and AIOS template marketplace for building custom dashboards, mission-control UIs, and workflow managers on top of OpenClaw.
2. **An experimental local-first agent OS** — a Vercel-native multi-agent runtime (gateway + dashboard + CLI + worker) that serves as both a learning artifact and a second backend target for the Claws framework.

Built with Next.js 15, Vercel AI SDK v6, Geist, Tailwind CSS v4, TypeScript, Turborepo, and PGlite.

## Pillar 1 — The Framework

The main product. Everything you need to ship a production dashboard on top of OpenClaw.

- **`@claws/sdk`** — 17 React hooks + WebSocket gateway client for OpenClaw Gateway v3 (skills, tools, sessions, presence, config, channels, cron, ACP sessions). Core bundle ~2 KB, React bundle ~21 KB, typed end-to-end.
- **Claws Studio** — visual template builder. Design your AI OS dashboard, configure the agent personality, drop in skills, deploy to a persistent workspace.
- **AIOS Templates** — package `SOUL.md`, `AGENTS.md`, skills, dashboard layout, themes, and cron jobs into shareable templates. 5 built-in templates (FounderOS, DevOS, CompanyOS, MyOS, ResearchOS).
- **SmartSync versioning** — three-way merge algorithm keeps deployed workspaces in sync with template upgrades without losing customization.
- **Fly.io deployment** — persistent OpenClaw VPS on a custom subdomain, nginx reverse proxy, JWT auth, stats server, ttyd web terminal.
- **Workspace sync** — bi-directional sync between CLI and cloud for SOUL, memory, and skills.

Install the SDK:

```bash
npm install @claws/sdk
```

```tsx
import { GatewayProvider, useGateway, useSkills } from "@claws/sdk/react";

function App() {
  return (
    <GatewayProvider url="ws://localhost:3000">
      <Dashboard />
    </GatewayProvider>
  );
}
```

## Pillar 2 — Experimental Agent OS for Vercelians 👽🦞

## What is running today

- Local gateway API with chat, traces, approvals, view-state, task-events, and workflow routes
- **AI SDK v6** integration with `generateText` and `streamText` for AI-powered chat with tool calling
- **SSE streaming chat** endpoint with real-time token delivery and graceful fallback
- Next.js dashboard with Geist fonts, Tailwind CSS, shadcn/ui components, and Lucide icons
- Pages: Chat (streaming), Tasks, Projects, Files, Memory, Agents, Workflows, Approvals, Traces, Settings
- Deterministic workspace template scaffold under `templates/base/workspace`
- CLI with `setup`, `onboard`, `doctor`, `status`, `tui`, `dashboard`, `gateway`, `chat` commands
- Scoped packages: `@claws-so/cli` (full CLI) and `@claws-so/create` (bootstrap)
- Claws home directory model (`~/.claws/`) with config, workspace, runtime, logs
- Browser tool with Playwright-backed local execution and optional Agent Browser adapter
- Persistent workflow engine with pause/resume/approval checkpoints (survives restarts) plus worker-driven tool execution
- Tenant routing middleware for future multi-tenant hosted deployment

## Architecture alignment

### Vercel AI Cloud
- AI SDK v6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/provider`) integrated for chat and tool use
- `generateText` for non-streaming, `streamText` for SSE streaming responses
- Tool calling with JSON Schema definitions for all registered tools
- Gateway-first model routing with **OpenAI fallback** when gateway/OpenRouter fails:
  - `AI_GATEWAY_API_KEY` → Vercel AI Gateway (default base `https://ai-gateway.vercel.sh/v3/ai` — **not** legacy `/v1`)
  - Set **`OPENAI_API_KEY` together with gateway** so chat can recover from gateway errors automatically
  - `OPENROUTER_API_KEY` → OpenRouter; same OpenAI fallback if both keys set
  - `OPENAI_API_KEY` alone → direct OpenAI
  - `ANTHROPIC_API_KEY` → direct Anthropic when no keys above
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
- Dashboard port: `4318` (if that port is busy, dev automatically uses `4319`, `4320`, … — **read the terminal** for the real URL)
- Dashboard -> gateway URL: `http://localhost:4317`

**Blank white screen?** Often the dashboard never started (`EADDRINUSE` on 4318) while something else still listens on that port — you’re not hitting Next. Free the port (`lsof -i :4318` then kill) or use the URL printed when the dashboard picks another port.

**Chat persistence:** Threads are saved in the browser (sidebar list + per-chat history). Reload or come back later and pick the same chat to resume. See [`docs/CHAT-PERSISTENCE.md`](docs/CHAT-PERSISTENCE.md).

## Install

Two install paths:

### Path 1 — Bootstrap (recommended)

```bash
npx @claws-so/create
```

This creates `~/.claws/` with workspace, config, and runtime directories.
Then install the full CLI:

```bash
npm install -g @claws-so/cli
claws onboard
```

### Path 2 — From source (development)

```bash
git clone <repo>
cd claws
cp .env.example .env.local
pnpm install   # postinstall: Playwright Chromium for browser tools
pnpm dev       # runs bootstrap (install + browsers if needed) then gateway + dashboard + worker
```

See **[BOOTSTRAP.md](./BOOTSTRAP.md)** for skip flags (CI), stamp file, and what runs on startup.

### Claws home directory

```text
~/.claws/
  claws.json        # user config
  workspace/        # canonical workspace files
  runtime/          # PGlite + runtime state
  logs/             # log files
```

Environment overrides:
- `CLAWS_HOME` — override `~/.claws`
- `CLAWS_STATE_DIR` — override runtime directory
- `CLAWS_CONFIG_PATH` — override config file path
- `CLAWS_WORKSPACE_DIR` — override workspace directory

## CLI

```
ᐳᐸ Claws

  Usage
    claws <command> [options]

  Getting started
    setup           Initialize home directory and config
    onboard         Guided onboarding wizard

  Operate
    tui             Full-screen operator dashboard (keyboard-first)
    status          Quick runtime summary
    doctor          Comprehensive health check

  Services
    gateway         Start the gateway server
    dashboard       Open the browser dashboard

  Interact
    chat <message>  Send a message to the gateway

  Options
    --help, -h      Show help (use claws <cmd> --help for details)
    --version, -v   Print version

  Workflow
    setup → onboard → doctor → status → tui
```

Per-command help is available via `claws <command> --help`. Every subcommand includes a "See also" section pointing to related commands.

**Typical workflow:** `setup` → `onboard` → `doctor` → `status` → `tui`

**TUI** (`claws tui`) is the primary operator surface. Full-screen, keyboard-first terminal UI with six panes — Sessions, Live State, Approvals, Tasks, Traces, and Workflows — plus keyboard navigation (Tab to cycle, j/k to scroll, Enter to inspect, y/n to approve/deny). Requires a running gateway. Auto-refreshes every 10 seconds. Two-column layout on wide terminals, single-pane on narrow. Press `?` for all keyboard shortcuts.

**Doctor** (`claws doctor`) runs a comprehensive diagnostic across config, filesystem, runtime, services, ports, environment, execution, and integrations. Produces a health score with a visual bar, pass/warn/fail counts, and targeted fix suggestions.

**Status** (`claws status`) is a quick operator summary that probes the gateway for runtime counts (workflows, approvals, traces, agents, tools), proactive job status, AI provider configuration, and execution substrates.

**Onboard** (`claws onboard`) is a guided wizard covering identity, workspace, approval mode, views, AI model, channels, and optional daemon install. Detects existing setups (resume if partial, skip if already completed), and uses `--yes` for non-interactive mode.

**Gateway** and **Dashboard** commands detect port conflicts, check if services are already running, and provide clean failure messages with fix hints. Both include cross-references to `claws tui` as the terminal alternative.

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
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway (checked first if set)
- `AI_GATEWAY_URL` — optional; default **v3** base `https://ai-gateway.vercel.sh/v3/ai` (legacy `/v1` is auto-corrected). **Set `OPENAI_API_KEY` too** for automatic fallback if gateway fails.
- `OPENROUTER_API_KEY` — **OpenRouter** (OpenAI-compatible; use to avoid direct Anthropic credits)
- `OPENAI_API_KEY` — direct OpenAI
- `ANTHROPIC_API_KEY` — direct Anthropic (last resort)
- `OPENROUTER_API_KEY` + `AI_MODEL=openai/gpt-5.4` — recommended (OpenRouter is primary when set). Bare `gpt-*` still maps to `openai/gpt-*` on OpenRouter.

Routing order at runtime:
1. `AI_GATEWAY_API_KEY`
2. `OPENROUTER_API_KEY`
3. `OPENAI_API_KEY`
4. `ANTHROPIC_API_KEY`

If none are configured, startup fails with:
`No AI provider configured. Set one of: AI_GATEWAY_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY`.

**Anthropic credit errors:** The gateway used to prefer `ANTHROPIC_API_KEY` first; it now prefers OpenRouter/OpenAI/Gateway before Anthropic. Set `OPENROUTER_API_KEY` and leave `ANTHROPIC_API_KEY` empty (or unset) so requests never hit Anthropic direct.

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

# CLI (from repo root)
pnpm claws --help
pnpm claws setup
pnpm claws onboard --yes --name "Builder" --workspace "Life OS"
pnpm claws doctor
pnpm claws status
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
  cli/        # @claws-so/cli — full CLI (setup/onboard/doctor/status/tui/gateway/dashboard/chat)
  create/     # @claws-so/create — bootstrap CLI (npx @claws-so/create)
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

Planning and feature status live in `project-context/`. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run the repo and add features.

- `project-context/prd.md` — product specification
- `project-context/feature-ledger.md` — canonical feature list and implementation status
- `project-context/tasks.md` — build queue
- `project-context/tasks.jsonl` — append-only task events
- `project-context/next-pass.md` — current sprint
- `project-context/current-state.md` — snapshot and gaps
- `project-context/build-roadmap.md` — phased delivery plan
- `AGENT.md` — agent workflow rules

## Implementation references

- [Vercel AI Cloud](https://vercel.com/blog/the-ai-cloud-a-unified-platform-for-ai-workloads)
- [AI SDK](https://ai-sdk.dev/docs/agents/overview)
- [Vercel Workflow](https://useworkflow.dev/)
- [Agent Browser](https://agent-browser.dev/)
- [Geist Design System](https://vercel.com/geist/introduction)
- [Vercel Platforms](https://github.com/vercel/platforms)
