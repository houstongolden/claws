# Claws.so PRD (Canonical)

## 1) Product Definition

Claws.so is a local-first, markdown-native agent OS for builders who live in Next.js and love Vercel. It is chat-first, multi-agent capable, filesystem-governed, and designed to stay usable offline with optional cloud sync.

### Core philosophy
- **Local-first by architecture, portable by design** — workspace contract and runtime model work offline, on disk, under user control first; cloud sync and hosted runtimes layer on top. In hosted environments, the same workspace contract and runtime model are preserved through explicit sync and managed storage rather than abandoning the local-first model.
- Vercel-native defaults (AI SDK, AI Gateway, Skills, Sandbox, Queues)
- Chat-first UX with CLI/TUI parity
- Filesystem governance via `FOLDER.md`
- Portable identity via `identity/you.md` bundle
- Views as overlays (not isolated silos)
- Smart approvals over constant prompts

## 2) Canonical Truth and Sync Model

### Local-first (not local-only)
- **Canonical workspace truth** = filesystem-shaped workspace contract and files.
- **Local runtime state** = local runtime DB / local process state.
- **Hosted mode** = cloud-hosted mirror or managed equivalent of that same workspace/runtime model.
- **Sync** = explicit bridge, not a hidden architecture swap.

When Claws is hosted, the product still thinks in local workspace concepts, portable files, explicit sync, and user-owned structure — even if the active runtime is remote.

> Claws is local-first by architecture and portable by design. In hosted environments, the same workspace contract and runtime model are preserved through explicit sync and managed storage rather than abandoning the local-first model.

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

Prioritize these four magic moments end-to-end before broad dashboard polish:

1. **Install + onboarding feels magical** — Zero-to-running local agent OS in minutes; CLI/onboarding is confident, clear, and usable.
2. **Working persistent session chat** — Session send/receive, persistence across reload/restart, no fake placeholder flow.
3. **Agent visibly works** — Live state, tool streaming, approvals interrupt or gate actions; user sees tools and traces updating.
4. **Proactive follow-up or scheduled brief** — Proves this is an AI OS, not a chat app (e.g. morning brief, watchdog, or scheduled job).

**Strategy:** Magic moments first, polish second. Dashboard polish only where it directly improves these moments.

### Functional definition of “working chat”

A chat is only considered working if:
- Dashboard boots
- Gateway boots
- Session can send/receive messages
- Session persists across reload/restart
- Tool events stream incrementally
- Traces update correctly
- Approvals interrupt or gate actions correctly

Anything less remains partial/prototype-grade.

## 12) v0 Sequencing and Delivery Order

1. Workspace scaffold + local gateway + in-app chat
2. CLI/TUI chat + approvals + task operations
3. **Telegram adapter** — Validates channel mapping, proactive follow-up, thread scoping, and the conversation model beyond a single dashboard session; one of the first real-world operating surfaces.
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
2. **Four magic moments** (install/onboarding, persistent session chat, agent live state/tool streaming/approvals, proactive follow-up) — implement and validate before broad dashboard polish
3. Agent Browser integration for browser automation
4. Workflow DevKit integration for durable execution
5. Hosted deployment path with multi-tenant routing
6. **Dashboard polish** — Only where it directly improves the four magic moments; demote broad beautification.

### User target (wedge)

- **Primary now:** Vercel-native builders and product-minded power users who want an AI OS that feels like a real product instead of a hacked-together side project (founders, devs, creators, operators, OpenClaw users wanting a better out-of-the-box system).
- **Secondary later:** Hosted users via Hubify — deployable AI OS workspaces, cleaner UI, cloud/local sync, opinionated templates, eventually mobile/web access.
- **Long-term platform:** Developers and teams who fork templates, deploy custom AI OS products, white-label or verticalize the runtime/workspace model.

**Wedge:** Claws is the product-grade AI OS runtime for builders; Hubify is the platform for deploying and hosting AI OS workspaces.
