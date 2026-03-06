# Claws.so PRD (Canonical)

## 1) Product Definition

Claws.so is a local-first, markdown-native agent OS for builders who live in Next.js and love Vercel. It is chat-first, multi-agent capable, filesystem-governed, and designed to stay usable offline with optional cloud sync.

### Core philosophy
- Local-first canonical truth
- Vercel-native defaults (AI SDK, AI Gateway, Skills, Sandbox, Queues)
- Chat-first UX with CLI/TUI parity
- Filesystem governance via `FOLDER.md`
- Portable identity via `identity/you.md` bundle
- Views as overlays (not isolated silos)
- Smart approvals over constant prompts

## 2) Canonical Truth and Sync Model

### Canonical source of truth
- Workspace files on local disk are canonical.
- `FOLDER.md` defines allowed roots, write behavior, and safety boundaries.

### Optional cloud layer
- Cloud is an optional mirror/index layer (metadata, traces, approvals, task events).
- Optional providers include Convex and object storage later.
- Cloud must never outrank local workspace files.

### Why this model
- Portability and backup friendliness
- Predictable memory and traceability
- Future multi-device and multi-user support without core rewrite

## 3) System Architecture (v0)

### User surfaces
- Next.js dashboard chat UI (primary GUI)
- CLI/TUI chat surface
- External channel adapters (Telegram first; Slack/iMessage later)

### Core runtime pipeline
1. Event gateway normalizes inbound events.
2. Session router resolves view stack + lead agent.
3. Orchestrator plans/delegates work orders.
4. Execution router chooses substrate in order:
   - API/tool
   - Browser automation (Agent Browser preferred, Playwright fallback)
   - Sandbox execution (Vercel Sandbox adapter)
   - Persistent computer/VPS (later, only when required)
5. Workspace updates, traces, approvals, and memory updates are emitted.

### Engines
- Workspace engine: filesystem operations under `FOLDER.md` rules
- Memory engine: curated memory + daily/topic/project context
- Job engine: heartbeat and background jobs (queues / Vercel Workflow)
- Trace engine: replay/audit/debug
- Sync engine: optional append-only sync

## 4) Vercel-First Stack Defaults

### Runtime and model layer
- Vercel AI SDK for model abstraction, tool use, streaming UI, agent loops
- Vercel AI Gateway as default model router

### Execution layer
- Vercel Sandbox for untrusted/generated code execution
- Vercel Queues for durable jobs, retries, delayed tasks
- Vercel Workflow / Workflow DevKit for resumable multi-step execution

### Browser and computer use
- Agent Browser as preferred near-term browser automation provider
- Playwright as local compatibility/fallback layer
- AI SDK Computer Use patterns for longer-term computer-use support
- Execution modes: `background`, `record-on-complete`, `watch-live`, `hybrid`
- Browser provider configurable via `CLAWS_BROWSER_PROVIDER`

### Frontend
- Geist design system (fonts, colors, spacing)
- Tailwind CSS + shadcn/ui components
- Lucide icons
- AI SDK UI patterns for streaming chat, tool result rendering, human-in-the-loop

### Extensibility
- Vercel Skills ecosystem as preferred packaging format
- Optional compatibility adapters for OpenClaw-like patterns (`packages/openclaw-compat/` later)

## 5) UX and Interaction Model

### First-class surfaces (equal priority)
1. In-app chat
2. CLI/TUI
3. External adapters

### Navigation model
- Left nav includes: Chat, Tasks, Projects, Files, Memory, Approvals, Traces, Agents, Settings
- Header includes view stack controls, command palette, runtime status

### Visibility modes
- `quiet`: final summary only
- `compact` (default): milestones + tool badges
- `verbose`: inline tool calls + progress
- `live`: streaming progress + optional live viewer

### Browser/computer execution visibility
- `background`
- `record-on-complete`
- `watch-live`
- `hybrid`

### Demo video artifact requirement
- For suitable browser/UI tasks, produce completion artifacts under:
  - `assets/demos/YYYY-MM-DD/<job-id>.mp4`
- Completion messages should link demo plus notes and next steps.

## 6) Workspace Contract and Identity Layer

### Workspace root contract
Expected root shape:
- `FOLDER.md`
- `PROJECT.md`
- `tasks.md`
- `prompt/`
- `identity/`
- `notes/`
- `areas/`
- `projects/`
- `clients/`
- `content/`
- `fitness/`
- `drafts/`
- `final/`
- `assets/`
- `skills/`
- `agents/`

### Identity bundle (`identity/`)
Portable user layer compatible with `you.md` conventions:
- Required v0:
  - `identity/you.md`
  - `identity/manifest.json`
- Optional:
  - `identity/profile/*`
  - `identity/preferences/*`
  - `identity/private/*`

### Context load order
1. `prompt/*` core files
2. `identity/you.md`
3. `identity/profile/*` (optional)
4. `identity/preferences/*` (optional)
5. `prompt/USER.md` and `prompt/MEMORY.md`
6. Recent workspace notes/project context as needed

### Governance rules
- `identity/private/` excluded from prompts by default unless explicitly enabled
- Identity edits should be append-first and approval-gated
- No secrets in markdown workspace files

## 7) Views as Overlays

Views are composable overlays over one shared workspace.

Each view defines:
- Lens (folders/tags/tasks to prioritize)
- Lead agent
- Tool policy preferences
- UI emphasis
- Scaffold defaults

Stack behavior:
- One primary view + optional overlays
- Lens is union
- Restrictive policy wins on conflicts

Default view family:
- founder
- agency
- developer
- creator
- personal
- fitness

## 8) Tasks, Memory, and Approvals

### Task system
- Human-readable canonical file: `project-context/tasks.md`
- Append-only machine event log: `project-context/tasks.jsonl`
- Stable task IDs, no duplicate recreation, move tasks across lanes/statuses

### Memory model
Layers:
- `prompt/USER.md` (workspace runtime context)
- `prompt/MEMORY.md` (curated durable memory)
- `notes/daily/*` (timeline)
- `notes/topics/*` and `projects/*` (reference/work context)

Flush-before-compaction behavior:
- update tasks
- append daily note
- propose curated memory diffs (approval-gated)

### Approval model
Goal: low-friction safety with scoped grants.

Supported grants:
- approve once
- allow session
- allow 24h
- always allow scoped tool

High-risk actions remain explicit by default.

## 9) Customization and Patch Safety

Any changes to prompts, views, templates, skills, or UI should be represented as patch operations with:
- diff
- rationale
- rollback plan
- scope classification

Actions requiring approval:
- prompt edits
- skill install/update
- writes outside allowlisted paths
- finalization writes to `final/`

Rollback behaviors:
- revert patch
- restore file to base
- reset view/panel/template

## 10) create-claws Onboarding Spec (v0)

### Entry points
- `npx create-claws`
- `claws init`

### UX goals
- Zero-to-running local agent OS in minutes
- Playful and concise onboarding personality
- Deterministic scaffolding over ad-hoc generation for reliability

### Required onboarding questions
1. User name
2. Workspace name
3. Enabled views
4. Visibility default (`quiet|compact|verbose|live`)
5. Approval mode (`off|smart|strict`)
6. Preferred integrations/tools
7. Optional avatar/selfie
8. Starter demo project yes/no

### Minimum scaffold output
- Root workspace structure
- `prompt/*`
- `identity/*`
- `agents/*`
- `PROJECT.md`
- `tasks.md`
- `notes/daily/YYYY-MM-DD.md`
- Optional starter project under `projects/`

### `claws start` expected behavior
- Start gateway daemon
- Start/connect dashboard
- Validate config/channels
- Print local status and URL

### Personality/tone requirements
- Friendly, clever coworker tone
- One-liners over paragraphs
- Action-oriented, minimal fluff
- Rotating wake/loading phrases rather than repetitive status text

## 11) v0 Magic Moments

1. Delightful first-run onboarding with immediate usable workspace.
2. Chat request lands as organized real files/tasks in workspace.
3. Watch/record/background execution with demo artifact links.
4. Durable "what did we decide?" answers with source-linked markdown context.

## 12) v0 Sequencing and Delivery Order

1. Workspace scaffold + local gateway + in-app chat
2. CLI/TUI chat + approvals + task operations
3. Telegram adapter
4. Browser tool + heartbeat
5. Skills v0 + safe installs
6. Queues + Sandbox integration
7. Optional metadata sync layer

## 13) Engineering Harness Requirements

- Golden conversation fixtures
- Deterministic trace replay
- Tool contract tests (schema, permissions, idempotency, path enforcement)
- Workspace mutation tests (`notes/` append, `final/` safeguards, prompt edit approvals)
- Security fixtures for prompt injection/exfiltration attempts
- Performance checks (TTFT, tool latency, queue latency, index latency)
- CI gates: lint, typecheck, tests, harness suite, E2E smoke, dependency audit

## 14) Durable Execution and Workflow

### Local workflow engine
- In-memory workflow engine aligned with Vercel Workflow / Workflow DevKit patterns
- Supports: create, advance, pause, resume, cancel workflow runs
- Step-level execution tracking with status, timing, and results
- Human approval checkpoints integrated with existing approval system
- Workflow state types exported from `@claws/shared` for cross-package use

### Future hosted workflow
- Designed for migration to Vercel Workflow when deploying to hosted environments
- Persistent storage backend to be added for durability across restarts
- Queue integration for background step execution

## 15) Multi-Tenant Hosted Path

### Local-first, hosted-ready
- Current architecture is single-tenant local-first
- Shared types (`TenantConfig`) defined in `@claws/shared` for future use
- Workspace isolation model compatible with per-tenant hosted instances

### Future hosted deployment
- Per-user hosted instances with secure subdomains
- Shared dashboard shell with tenant routing
- Custom domains support
- Reference: Vercel Platforms starter kit pattern

### Architecture constraints
- Current code must not block multi-tenant deployment
- Gateway/dashboard separation already supports independent scaling
- Workspace root is configurable per-tenant

## 16) Latest Implementation Priorities

Most recent implementation priorities:
1. AI SDK integration for streaming chat and tool use
2. Agent Browser integration for browser automation
3. Workflow DevKit integration for durable execution
4. Hosted deployment path with multi-tenant routing
5. Dashboard polish with Geist design system consistency
