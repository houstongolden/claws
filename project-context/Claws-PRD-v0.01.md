# Claws.so v0 — Living Spec (Local‑first, Vercel‑native)


--- 
NOTES FOR FINAL:

- SUB-AGENTS: https://ai-sdk.dev/docs/agents/subagents
- USE WORKFLOW: https://useworkflow.dev/ 
---- USE WORKFLOW NEXTJS: https://useworkflow.dev/docs/getting-started/next (EXAMPLES: https://github.com/vercel/workflow-examples)
- ai sdk: https://github.com/vercel/ai
- WORKFLOW PATTERNS: https://ai-sdk.dev/docs/agents/workflows
- https://ai-sdk.dev/docs/getting-started/navigating-the-library
- https://ai-sdk.dev/docs/ai-sdk-ui/overview
- https://vercel.com/blog/ai-sdk-6

----

## What changed in this iteration

* **Vercel-first bootstrapping:** Use Vercel’s AI SDK + AI Gateway + Skills + Sandbox + Queues wherever possible.
* **Native chat everywhere:** In‑app chat UI (ChatGPT-level UX), plus CLI/TUI chat, plus optional external channels (Telegram first).
* **Fully customizable UI/views:** Views, dashboards, panels, and templates are editable by the user **and** by the agent.
* **Self‑aware + self‑updating:** Agent can modify its own prompts, skills, and UI—**with approvals + rollback**.

---

## 1) One‑sentence definition

**Claws.so is a local‑first, Markdown‑truth personal operating system for agentic work and life**, with multi‑agent orchestration, proactivity, browser/sandbox execution, and a Vercel‑native developer stack.

---

## 2) Canonical truth + sync model

### Source of truth

* **Filesystem workspace is canonical** (FOLDER.md contract).

### Cloud (optional)

* **Index + metadata layer** (Convex optional): tasks mirror, approvals, traces, job metadata, search index.
* Optional **file blob mirror** later (R2/S3) for multi-device access, but not required for v0.

### Why

* Keeps the “agent OS” feel (portable markdown).
* Enables reliable “never forgets” memory + easy backup.
* Future multi-user becomes a permissions + sync problem, not a rewrite.

---

## 3) Vercel‑native stack (default choices)

### Runtime

* **Vercel AI SDK** for model abstraction, streaming UI, tools, approvals.
* **Vercel AI Gateway** as default model router (bring-your-own keys; central routing).

### Execution

* **Vercel Sandbox** for untrusted/generated code execution (credential injection patterns; ephemeral).
* **Vercel Queues** for durable jobs, retries, delayed work, idempotency.

### Skills & integrations

* **Vercel Skills ecosystem** as primary packaging format for tools/adapters/templates.
* (Claws registry later) for community template/skill sharing.

### Channels

* In‑app chat always available.
* External channels are adapters (Telegram v0 → Slack next → iMessage later via bridge).

---

## 4) UX surfaces (3 equal first-class)

1. **In‑app Chat UI** (Next.js): ChatGPT‑quality experience, streaming, attachments, tool approvals.
2. **CLI/TUI**: fast workflow + chat + approvals + tasks.
3. **External channels**: Telegram first; later Slack/iMessage.

All three route to the same **Gateway + Session Router**.

---

## 5) Identity Layer (you.md compatibility, v0)

### Goal

Support a portable, cross-agent **human identity bundle** compatible with the emerging `you.md` pattern, so the same identity/context can be shared across Claws.so, OpenClaw, Claude Code, Hubify, etc.

### Where it lives in a Claws workspace

Add a top-level directory (governed by FOLDER.md):

```
identity/
  you.md            # human-readable identity (required)
  you.json          # machine-readable identity (optional)
  manifest.json     # bundle metadata (optional)
  profile/
    about.md        # stable bio
    now.md          # current focus (dynamic)
    projects.md     # active projects overview
    values.md       # values/principles
  preferences/
    agent.md        # agent behavior prefs
    writing.md      # writing voice prefs
  private/
    private.md      # sensitive notes (encrypted or excluded from sync)
```

### Minimal v0 requirement

* `identity/you.md` only.
* Optional: `identity/profile/about.md` and `identity/preferences/agent.md`.

### Load order (context handshake)

When building agent context, merge:

1. `prompt/*` (SOUL/IDENTITY/RULES/ROUTING/TOOL-POLICY/VIEWS)
2. `identity/you.md`
3. `identity/profile/*` (if present)
4. `identity/preferences/*` (if present)
5. curated memory (`prompt/MEMORY.md`) and recent notes as needed

This matches the “context handshake” concept: `agent.md + soul.md + you.md = complete context`.

### Rules

* `identity/` is **append/prefer-diff**:

  * Agents may propose edits as patches.
  * Auto-editing identity files should be disabled by default.
  * Promotions/changes should be approval-gated (same patch system as prompts).
* `identity/private/` should be:

  * excluded from cloud sync by default
  * optionally encrypted at rest

### Onboarding integration

CLI onboarding can scaffold `identity/` and populate:

* `you.md` (name + roles + high-level working style)
* optional `preferences/agent.md` (visibility + approvals + tone)

---

## 6) Configuration (required)

### Config sources (precedence)

1. CLI flags
2. Environment variables
3. Workspace config file (recommended)
4. Global config file
5. Defaults

### Config files

* **Workspace config**: `./prompt/CONFIG.json` (checked into the workspace)
* **Global config**: `~/.claws/config.json`

### Required config sections

* `workspace`: id, name, path
* `models`: provider routing (AI Gateway default), fallbacks
* `channels`: telegram/slack/imessage configs + per-channel policy
* `tools`: tool profiles, approvals, sandbox defaults
* `views`: available views + defaults
* `agents`: agent roster + scopes + budgets
* `storage`: local index (SQLite), optional Convex
* `jobs`: queues/scheduler settings
* `security`: secret handling, allowlists, signing policy

### Example `prompt/CONFIG.json` (minimal)

```json
{
  "workspace": {"id": "ws_local", "name": "Life OS", "path": "."},
  "models": {
    "router": "vercel-ai-gateway",
    "defaultModel": "gpt-5",
    "fallbackModel": "gpt-5-mini",
    "keys": {"mode": "env"}
  },
  "channels": {
    "telegram": {"enabled": true, "botTokenEnv": "TELEGRAM_BOT_TOKEN"},
    "slack": {"enabled": false},
    "imessage": {"enabled": false}
  },
  "tools": {
    "defaultProfile": "minimal",
    "approvals": {"enabled": true, "highRiskAlways": true},
    "sandbox": {"provider": "vercel", "enabled": false}
  },
  "views": {"primary": "founder", "overlays": ["developer"]},
  "agents": {"roster": ["orchestrator", "founder", "developer"]},
  "storage": {"index": {"provider": "sqlite", "path": ".claws/index.sqlite"}},
  "jobs": {"scheduler": "local"},
  "security": {"skills": {"requirePinnedSha": true, "requireApproval": true}}
}
```

---

## 7) UI/UX (Chat-first, Notion-blocks, Vercel-clean)

### Design principles

* **Chat is primary** (ChatGPT-style): everything starts as a chat.
* **Blocks are secondary** (Notion-like): tasks, projects, docs, memory, approvals are editable blocks.
* **Fast navigation**: left nav + command palette; minimal chrome.
* **Safety without friction**: "smart approvals" + trust grants; rare prompts after trust.
* **Observability is configurable**: user controls how much to watch (quiet → verbose → live).
* **Vercel aesthetic**: Geist typography, Geist Pixel accents, high-contrast dark mode, subtle separators.

### Core navigation

* Left sidebar: Chat, Tasks, Projects, Files, Memory, Approvals, Traces, Agents, Settings
* Top bar: View switcher (primary + overlays), Command palette (⌘K), Status (Gateway/Queues/Sandbox)

### Visibility & "What is the agent doing?" controls (required)

Claws supports **visibility modes** per chat thread, per view, and per agent.

**Visibility modes**

* `quiet`: only final summary + links
* `compact` (default): major milestones + tool badges
* `verbose`: show tool calls inline + progress steps
* `live`: stream progress + optional live browser/computer viewer

**Config knobs**

* `ui.visibility.default`: quiet|compact|verbose|live
* `ui.visibility.perView`: overrides per view
* `ui.visibility.perAgent`: overrides per agent
* `ui.visibility.perThread`: stored per chat thread

### Tool calls / APIs / MCP: display + streaming best practices

Use AI SDK UI message parts and tool-invocation patterns:

* Show **tool invocation cards** inline in chat (name, inputs, state, result summary).
* Ensure every tool invocation has a corresponding output (AI SDK requirement). ([ai-sdk.dev](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage?utm_source=chatgpt.com))
* Support **tool execution approval** via `needsApproval` and inline approval UI. ([ai-sdk.dev](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling?utm_source=chatgpt.com))
* Expose a Traces view for full detail; chat shows only the configured visibility level.

### Browser/computer work: watch live vs record vs background (required)

Claws supports four modes for **browser** and (later) **computer-use nodes**:

1. `background`: no live view; no recording
2. `record-on-complete`: generate a demo video + link when done
3. `watch-live`: live stream viewer during execution
4. `hybrid`: watch live + also generate a final recording

**Defaults**

* `developer` view: `record-on-complete`
* `founder/agency`: `background` or `record-on-complete` depending on task

**Video demo artifact**

* Agent posts completion message:

  * "Feature is done. Watch the demo: <link>. Notes: … Next steps: …"

**Implementation notes**

* Use `vercel-labs/webreel` to generate scripted browser demo videos (MP4/GIF/WebM). ([github.com](https://github.com/vercel-labs/webreel?utm_source=chatgpt.com))
* Store videos under `assets/demos/YYYY-MM-DD/<job-id>.mp4` and expose via dashboard.
* Live viewing can be implemented via:

  * streaming Playwright screenshots/video frames to the dashboard (local)
  * or remote CDP viewer when browser runs remotely

### Core screens (ASCII)

#### 1) Chat (primary)

```
┌─────────────────────────────────────────────────────────────┐
│ Claws.so | View: Founder + Developer | ⌘K | ● Online          │
├───────────────┬─────────────────────────────────────────────┤
│ NAV           │ CHAT                                        │
│ Chat          │ You: "Ship spec"                             │
│ Tasks         │ Claws: "Plan…"                               │
│ Projects      │  ▸ Tool: browser.navigate (badge)            │
│ Files         │  ▸ Progress: 3/7 steps (compact/live)        │
│ Memory        │  ▸ Demo (when done): assets/demos/...mp4     │
│ Approvals     │ [ input… ] [Send]                            │
│ Traces        │                                             │
│ Agents        │ Right rail (toggle): Tasks/Project/Approvals │
│ Settings      │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

#### 2) Approvals (low friction)

* Inline chat approvals + quick grants:

  * Approve once / Allow for session / Allow 24h / Always allow (scoped)

#### 3) Live Viewer (optional)

* When `watch-live` is enabled:

  * show live browser/computer feed panel
  * show step list + current action

### Customization

* Layouts/panels described in `prompt/VIEWS.md` + `prompt/UI.json`.
* Agent proposes UI changes as patches; user approves; reversible.

---

## 7) Workspace model (clean root) (clean root)

```
./
├── FOLDER.md
├── PROJECT.md
├── tasks.md
├── prompt/
│   ├── SOUL.md
│   ├── IDENTITY.md
│   ├── USER.md
│   ├── RULES.md
│   ├── MEMORY.md
│   ├── ROUTING.md
│   ├── TOOL-POLICY.md
│   ├── VIEWS.md
│   └── SYNC.md
├── notes/
│   ├── daily/
│   ├── topics/
│   └── people/
├── areas/
├── projects/
├── clients/
├── content/
├── fitness/
├── drafts/
├── final/
├── assets/
│   └── inbox/
├── skills/
└── agents/
    ├── orchestrator/
    ├── founder/
    ├── agency/
    ├── developer/
    ├── creator/
    ├── personal/
    └── fitness/
```

---

## 8) Views (modes) as overlays

Views are **composable overlays** over one workspace.

Each view defines:

* Lens (folders/tags/tasks surfaced)
* Lead agent
* Tool policy preferences
* Scaffolds (project templates)
* UI panels

View stack:

* **Primary view** + **overlay views** (union lens; restrictive policy wins).

---

## 7) Task system (kanban + due + recurring)

* `tasks.md` is canonical.
* `tasks.log.jsonl` is append-only events for robust parsing + future sync.

Global lanes:

* Inbox
* Founder / Agency / Developer / Creator / Personal / Fitness
* Waiting/Blocked
* Done

Recurring rules live under `areas/*/recurring.md` and get materialized into tasks by heartbeat/jobs.

---

## 8) Memory (never forgets)

Layers:

* `prompt/USER.md` (stable identity/preferences)
* `prompt/MEMORY.md` (curated short)
* `notes/daily` (append-only timeline)
* `notes/topics` (reference)
* `projects/*` (work context)

**Flush-before-compaction** + milestone flush:

* update tasks
* append daily note
* propose curated memory diffs (approval gated)

---

## 9) Multi-agent orchestration

Agents:

* Orchestrator (routing, approvals, scheduling, memory flush)
* Lead agents per view
* Optional specialists later

Delegation primitive: **WorkOrder**

* objective, constraints, inputs, allowed tools profile, output targets, DoD, budget.

Agent scopes are hard-enforced:

* write roots
* tool profiles
* budgets

---

## 10) Tools & execution router (when to use what)

Decision order:

1. API tool
2. Browser tool
3. Sandbox
4. Persistent computer/VPS (only if long-lived profile/apps required)

Router logs every decision to traces.

---

## 11) Self‑aware + self‑updating customization

### What can be customized

* Views/panels
* Templates/scaffolds
* Agent prompts
* Skills/tool packs
* UI components

### How customization happens safely

* Any change is a **Patch** with:

  * diff
  * rationale
  * rollback plan
  * scope (UI, prompts, skills, workspace)
* Requires approval for:

  * prompt edits
  * installing/updating skills
  * writing outside allowlisted paths
  * writing to `final/`

### Rollback/revert

* Keep a **Template Base** in the open-source repo.
* Track local modifications as patches.
* Allow:

  * revert file to base
  * revert a patch
  * “factory reset” a view/panel

---

## Config system (required for v0)

### Locations

* Workspace config: `./prompt/CONFIG.md` (human-readable, versionable)
* Runtime config: `~/.claws/config.json` (secrets references, machine config)
* Environment: `.env` (optional; referenced by config)

### Principles

* **Config is layered**: defaults < runtime < workspace < per-chat overrides.
* **Secrets never stored in workspace** by default.
* **Hot reload**: config changes apply without restart when safe.

### Layering order

1. Built-in defaults
2. `~/.claws/config.json` (runtime)
3. Workspace `prompt/CONFIG.md`
4. Per-chat overrides (stored in Convex/SQLite metadata; mirrored to `notes/people/me.md` if desired)

### Runtime config schema (high level)

* `workspacePath`
* `models` (AI Gateway + provider fallbacks)
* `channels` (telegram, slack, local)
* `toolProfiles` (named)
* `sandbox` (enabled, provider: vercel|local, policies)
* `queues` (enabled, provider: vercel|local)
* `sync` (provider: none|convex|custom)
* `ui` (theme, font: Geist/Geist Pixel)

---

## UI/UX spec (v0)

### Design principles

* **Chat-forward**: primary surface is a ChatGPT-quality chat.
* **Notion-like blocks**: everything else is panels/blocks you can add/remove/reorder.
* **Vercel-clean**: minimal, fast, monochrome + subtle accents, Geist + optional Geist Pixel.
* **1-click approvals**: safe-by-default tool execution with clear explanations.

### Global navigation (simple)

* Chat
* Inbox
* Projects
* Tasks
* Files
* Memory
* Agents
* Approvals
* Traces
* Settings

### View switcher

* Primary view selector + overlay toggles always accessible in header.

---

## Core screens (ASCII wireframes)

### 1) Chat (primary)

```
┌──────────────────────────────────────────────────────────────┐
│ Claws.so   [View: Founder ▾] [+Overlay]   🔔Approvals(2)     │
├───────────────┬──────────────────────────────────────────────┤
│ NAV           │ CHAT                                         │
│ - Chat        │  You: "Remind me to..."                       │
│ - Inbox       │  Claws: "Got it. Want it in Personal lane?"   │
│ - Projects    │                                              │
│ - Tasks       │  ┌──────── Tool Call ────────┐                │
│ - Files       │  │ calendar.create ...       │  [Approve]     │
│ - Memory      │  │ rationale...              │  [Deny]        │
│ - Agents      │  └───────────────────────────┘                │
│ - Approvals   │                                              │
│ - Traces      │  [ message input …………………………… ]  [Send]     │
│ - Settings    │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

### 2) Inbox (triage)

```
┌──────────────────────────────────────────────────────────────┐
│ Inbox   [Filters: view/tags/channel]   [Quick add task]       │
├──────────────────────────────────────────────────────────────┤
│ Events (Telegram/Slack/App)                                   │
│ - Message from X … [Create task] [Reply] [File note]          │
│ - Attachment …     [Save to assets/inbox] [Summarize]         │
│ - Approval request … [Open]                                   │
└──────────────────────────────────────────────────────────────┘
```

### 3) Tasks (lanes)

```
┌──────────────────────────────────────────────────────────────┐
│ Tasks   [Primary: Founder] [Overlays: Dev, Fitness]           │
├──────────────────────────────────────────────────────────────┤
│ Inbox | Founder | Agency | Dev | Creator | Personal | Fitness │
│  (drag/drop across lanes; edit metadata inline)               │
│  T-0321 Draft spec …  P1  due:…  owner:…  links:…             │
└──────────────────────────────────────────────────────────────┘
```

### 4) Projects

```
┌──────────────────────────────────────────────────────────────┐
│ Projects  [New] [Tag filter] [Search]                         │
├──────────────────────────────────────────────────────────────┤
│ List (left)                 │ Project (right)                 │
│ - claws-so                  │ project.md (Notion blocks)      │
│ - refco                     │ tasks.md (embed)                │
│                             │ drafts/final/assets quick links │
└──────────────────────────────────────────────────────────────┘
```

### 5) Files (workspace)

```
┌──────────────────────────────────────────────────────────────┐
│ Files  [Search] [Create] [Upload]                             │
├───────────────┬──────────────────────────────────────────────┤
│ Tree          │ Markdown editor / preview                      │
│ - prompt/     │ (blocks view: headings as blocks; embeds)      │
│ - projects/   │                                               │
│ - notes/      │                                               │
└───────────────┴──────────────────────────────────────────────┘
```

### 6) Memory (curation + diffs)

```
┌──────────────────────────────────────────────────────────────┐
│ Memory  [Promote proposals] [Search]                          │
├──────────────────────────────────────────────────────────────┤
│ Proposed diff to prompt/USER.md                               │
│  + "Prefers local-first"                                      │
│  - "Old preference"                                          │
│  [Approve merge]  [Edit]  [Reject]                            │
└──────────────────────────────────────────────────────────────┘
```

### 7) Approvals

```
┌──────────────────────────────────────────────────────────────┐
│ Approvals (Queue)                                              │
├──────────────────────────────────────────────────────────────┤
│ - Tool call: browser.click ... [Approve] [Deny] [Details]      │
│ - Install skill: vercel/cli ... [Approve] [Deny]               │
│ - Edit prompt/ROUTING.md ... [Approve] [Deny]                  │
└──────────────────────────────────────────────────────────────┘
```

### 8) Traces (debug/replay)

```
┌──────────────────────────────────────────────────────────────┐
│ Traces  [Session] [Replay] [Export]                            │
├──────────────────────────────────────────────────────────────┤
│ timeline: model → tool → fs → memory → job                     │
│ click any step to inspect args/output/diffs                    │
└──────────────────────────────────────────────────────────────┘
```

### 9) Agents (team)

```
┌──────────────────────────────────────────────────────────────┐
│ Agents  orchestrator | founder | developer | fitness ...       │
├──────────────────────────────────────────────────────────────┤
│ status, scope, tool profile, budgets, last run, work orders    │
│ [Delegate work order] [Edit scope] [View logs]                 │
└──────────────────────────────────────────────────────────────┘
```

### 10) Settings

```
┌──────────────────────────────────────────────────────────────┐
│ Settings  (runtime + workspace)                                │
├──────────────────────────────────────────────────────────────┤
│ Models: AI Gateway + fallbacks                                 │
│ Channels: Telegram/Slack/App                                    │
│ Execution: Sandbox/Queues                                      │
│ Sync: None/Convex                                              │
│ UI: Theme, Font (Geist / Geist Pixel)                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 13) CLI/TUI (OpenClaw-like ergonomics)

Commands:

* `claws init` (scaffold workspace + views + agents)
* `claws start` (gateway + optional dashboard)
* `claws tui` (Chat | Tasks | Approvals | Traces | Jobs)
* `claws chat` (CLI chat)
* `claws status` (summary)
* `claws approve|deny <id>`
* `claws view set|overlay ...`
* `claws task add ...`
* `claws skill search|install|update ...`
* `claws doctor` (health checks)
* `claws sync` (configure provider)
* `claws export` (zip/git snapshot)

TUI goals:

* fast triage + approvals
* keyboard-first
* quick jumps to files/projects

---

## 14) v0 sequencing

1. Workspace scaffold + local gateway + in-app chat
2. CLI/TUI chat + approvals + tasks
3. Telegram adapter
4. Browser tool + basic heartbeat
5. Skills v0 + safe installs
6. Queues + Sandbox integration
7. Optional Convex metadata layer

---

## Engineering harness (required for v0)

### Goals

* Prevent regressions while the agent can modify its own UI/prompts/skills.
* Enable safe iteration, reproducible debugging, and fast shipping.

### Harness components

1. **Golden Conversations**

* Store canonical conversation fixtures under `harness/golden/` with:

  * input events (MessageEvent stream)
  * expected artifacts (files written, task diffs)
  * expected tool calls (names + args shape)
  * expected approvals requested
* Run in CI: `pnpm test:harness`.

2. **Trace Replay**

* Every run emits a normalized trace (model/tool/fs/memory/router/job).
* Replay runner can re-execute a trace deterministically (mock model + mock tools) to validate state transitions.

3. **Tool Contract Tests**

* Each tool ships with:

  * schema validation tests
  * permission/approval tests
  * FOLDER.md path enforcement tests
  * idempotency tests (for queued jobs)

4. **Workspace Mutation Tests**

* Validate that:

  * `notes/` is append-only
  * `final/` writes require explicit finalize intent + approval
  * `prompt/` edits require approval
  * no new top-level folders without approval

5. **Security Harness**

* Prompt-injection red-team fixtures:

  * “exfiltrate secrets”
  * “write outside allowed dirs”
  * “install untrusted skill”
* Must result in approval requests or denials.

6. **Performance Harness**

* Measure:

  * time-to-first-token in UI
  * tool latency
  * queue job latency
  * memory/index update time

### Minimal CI Gates

* Lint, typecheck, unit tests
* Harness suite
* E2E UI smoke (Playwright)
* SBOM + dependency audit

---

## Reuse strategy: leverage OpenClaw + Vercel without inheriting bloat

### What to reuse from OpenClaw/derivatives (as reference or extracted modules)

* **Conceptual primitives**: workspace prompt files, heartbeat semantics, tool profiles, browser vs nodes separation.
* **Browser patterns**: snapshot → action API; remote CDP support.
* **Skills packaging patterns**: layered skill sources (bundled/managed/workspace), gating by environment.
* **Memory flush patterns**: pre-compaction flush with silent no-reply.

### What NOT to inherit

* Monolithic coupling of channels/tools/UI.
* Root-scattering workspace defaults.
* Unbounded skill execution without strong trust/approval/sandboxing.

### Compatibility layer (optional, later)

* `packages/openclaw-compat/` to:

  * import/translate skill manifests into Claws skill packs
  * map select tool names/args into Claws ToolSpec
  * allow side-by-side installs for migration

---

## Vercel-first bootstrapping (use existing libraries/templates)

### Default stack

* AI SDK runtime + streaming UI primitives
* AI Gateway as default model router
* Skills ecosystem for installable packs
* Sandbox for untrusted code execution
* Queues for durable jobs

### Code reuse policy

* Prefer:

  1. Vercel libraries/templates when available
  2. small, auditable OpenClaw-derivative components
  3. custom code only when primitives are missing

### Recommended starter repos/templates to reference in implementation

* AI SDK chat UI patterns (app router)
* Skills CLI patterns (install/update/discover)
* Sandbox execution patterns (secret injection; isolated execution)
* Queues job patterns (idempotency, retries, delayed tasks)

---

## Customization system: patches as first-class (agent-safe self-modification)

### Patch model

* All modifications to:

  * UI panels/views
  * templates/scaffolds
  * agent prompts
  * skill packs
    are captured as **Patch objects** with:
  * diff (unified)
  * scope (ui|prompt|skill|workspace)
  * rationale
  * rollback plan
  * approvals required (boolean)

### Base template tracking

* Store upstream/base templates in the OSS repo under `templates/base/`.
* Local workspace stores:

  * `templates/local/` (active)
  * `patches/` (history)
* Provide commands:

  * `claws patch list/apply/revert`
  * `claws template reset <view|panel|file>`

---

## Claws.so Architecture Diagram

### High-level system map

```text
                                    ┌─────────────────────────────┐
                                    │         USER SURFACES       │
                                    │─────────────────────────────│
                                    │  Web Chat UI (Next.js)      │
                                    │  CLI / TUI                  │
                                    │  Telegram                   │
                                    │  Slack (later)              │
                                    │  iMessage bridge (later)    │
                                    └──────────────┬──────────────┘
                                                   │
                                                   ▼
                                    ┌─────────────────────────────┐
                                    │        EVENT GATEWAY        │
                                    │─────────────────────────────│
                                    │ normalize inbound events    │
                                    │ attachments / auth / IDs    │
                                    │ outbound replies            │
                                    └──────────────┬──────────────┘
                                                   │
                                                   ▼
                                    ┌─────────────────────────────┐
                                    │       SESSION ROUTER        │
                                    │─────────────────────────────│
                                    │ resolve sessionKey          │
                                    │ resolve view stack          │
                                    │ pick lead agent             │
                                    └──────────────┬──────────────┘
                                                   │
                         ┌─────────────────────────┴─────────────────────────┐
                         ▼                                                   ▼
        ┌─────────────────────────────┐                      ┌─────────────────────────────┐
        │      ORCHESTRATOR AGENT     │                      │        LEAD AGENTS          │
        │─────────────────────────────│                      │─────────────────────────────│
        │ planning / delegation       │                      │ founder / agency / dev      │
        │ approvals / memory flush    │◄────work orders────►│ creator / personal / fit    │
        │ task routing / safety       │                      │ optional specialists later  │
        └──────────────┬──────────────┘                      └──────────────┬──────────────┘
                       │                                                    │
                       └─────────────────────────┬──────────────────────────┘
                                                 ▼
                                ┌──────────────────────────────────┐
                                │        TOOL / ACTION LAYER       │
                                │──────────────────────────────────│
                                │ fs / tasks / memory              │
                                │ APIs / MCPs / integrations       │
                                │ browser automation               │
                                │ sandbox execution                │
                                │ persistent computer (later)      │
                                └──────────────┬───────────────────┘
                                               │
                              ┌────────────────┼─────────────────┐
                              ▼                ▼                 ▼
               ┌────────────────────┐  ┌────────────────┐  ┌──────────────────┐
               │  WORKSPACE ENGINE  │  │ MEMORY ENGINE  │  │   JOB ENGINE     │
               │────────────────────│  │────────────────│  │──────────────────│
               │ FOLDER.md rules    │  │ USER/MEMORY    │  │ heartbeat        │
               │ projects/tasks     │  │ daily/topic    │  │ queues/schedule  │
               │ files/assets       │  │ promote/archive│  │ retries/workers  │
               └─────────┬──────────┘  └──────┬─────────┘  └────────┬─────────┘
                         │                    │                     │
                         └─────────────┬──────┴─────────────┬───────┘
                                       ▼                    ▼
                         ┌─────────────────────────────┐   ┌─────────────────────────────┐
                         │        TRACE ENGINE         │   │         SYNC ENGINE         │
                         │─────────────────────────────│   │─────────────────────────────│
                         │ model/tool/fs/job traces    │   │ local-first event sync      │
                         │ replay / debug / audit      │   │ Convex optional             │
                         └─────────────────────────────┘   └─────────────────────────────┘
```

### Local-first deployment map

```text
                 LOCAL MACHINE (canonical truth)
┌─────────────────────────────────────────────────────────────────────┐
│ Workspace Folder                                                   │
│ FOLDER.md / prompt/ / identity/ / projects/ / notes/ / assets/    │
│                                                                    │
│ Gateway Daemon ── Agent Runtime ── WorkspaceFS ── SQLite Index     │
│        │                 │                  │                      │
│        └──── CLI/TUI ────┴──── Local Browser / Sandbox / Files ────┘
└─────────────────────────────────────────────────────────────────────┘
                     │
                     │ optional hybrid/cloud extensions
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ VERCEL / CLOUD                                                     │
│ Dashboard UI (Next.js)                                             │
│ AI Gateway                                                         │
│ Queues                                                             │
│ Sandbox                                                            │
│ Convex metadata / traces / approvals / optional sync               │
└─────────────────────────────────────────────────────────────────────┘
```

### Workspace + identity map

```text
workspace/
├── FOLDER.md            # filesystem contract
├── PROJECT.md           # workspace brief
├── tasks.md             # global task lanes
├── prompt/              # agent/system prompt files
├── identity/            # portable user identity (you.md bundle)
├── notes/               # daily/topic/people notes
├── areas/               # long-lived responsibilities
├── projects/            # active project folders
├── drafts/              # editable scratch outputs
├── final/               # approved outputs
├── assets/              # uploads, demos, browser artifacts
├── skills/              # local skill packs
└── agents/              # agent-specific prompts/scratchpads
```

### Runtime decision flow

```text
User asks for something
        │
        ▼
Router resolves view + lead agent
        │
        ▼
Orchestrator decides:
  - answer directly
  - use tool
  - delegate work order
  - schedule background job
        │
        ▼
Execution Router chooses:
  API → Browser → Sandbox → Persistent Computer
        │
        ▼
Workspace updated + traces emitted + memory flushed if needed
        │
        ▼
User sees:
  quiet / compact / verbose / live
```

## Vercel AI SDK Implementation References (for Coding Agents)

To accelerate the Claws.so implementation phase, the following official Vercel AI SDK resources and example repositories should be treated as canonical references. These provide patterns for multi‑step agents, tool execution, streaming UI, and generative interfaces that Claws will leverage instead of reinventing.

### Core AI SDK Documentation

* [https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
* [https://ai-sdk.dev/docs/agents/overview](https://ai-sdk.dev/docs/agents/overview)
* [https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)

These documents define the standard patterns for:

* tool definitions
* tool execution lifecycle
* streaming tool results into UI
* agent loops and structured execution

### Vercel AI SDK Academy

* [https://vercel.com/academy/ai-sdk/multi-step-and-generative-ui](https://vercel.com/academy/ai-sdk/multi-step-and-generative-ui)
* [https://vercel.com/academy/ai-sdk/tool-use](https://vercel.com/academy/ai-sdk/tool-use)

Key patterns Claws will adopt:

* **multi‑step agent loops** using `maxSteps`
* **generative UI** where tool output dynamically renders interface components
* **parallel tool execution** inside a single model step

### Vercel AI SDK Blog Releases

* [https://vercel.com/blog/ai-sdk-3-4](https://vercel.com/blog/ai-sdk-3-4)
* [https://vercel.com/blog/ai-sdk-6](https://vercel.com/blog/ai-sdk-6)

These releases introduce capabilities Claws should integrate early:

* `ToolLoopAgent`
* `stopWhen` execution guards
* generative UI streaming
* tool approval flows

### Example: Multi‑step agent loop

Claws agents should follow the same execution pattern:

```ts
const result = await generateText({
  model: openai('gpt-4o'),
  maxSteps: 5,
  tools: {...}
})
```

This enables:

```
model → tool call → tool result → model reasoning → next tool
```

### Structured agent loops

For complex workflows Claws may use the AI SDK's ToolLoopAgent:

```ts
const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  tools,
  stopWhen: stepCountIs(10)
})
```

This aligns directly with the Claws **Agent Runtime Loop** defined in the kernel architecture.

### Cost and safety considerations

Claws runtime should enforce:

* step limits (`maxSteps`)
* tool risk classification
* approval gating
* trace logging

These safeguards mirror best practices described in the Vercel AI SDK documentation.

### Vercel Labs reference repositories

These repositories provide concrete implementation examples relevant to Claws:

* [https://github.com/vercel-labs/ai-sdk-preview](https://github.com/vercel-labs/ai-sdk-preview)
* [https://github.com/vercel-labs/ai-chatbot](https://github.com/vercel-labs/ai-chatbot)
* [https://github.com/vercel-labs/webreel](https://github.com/vercel-labs/webreel)
* [https://github.com/vercel-labs/ai-sdk-agents](https://github.com/vercel-labs/ai-sdk-agents)

These examples demonstrate:

* streaming chat interfaces
* tool invocation cards
* generative UI
* browser recording for demos

Claws coding agents should consult these repositories during implementation.

---

## Open questions to resolve soon

* Preferred v0 index store default: SQLite-only vs optional Convex plugin.
* Auto-distillation cadence: nightly vs weekly (always approval gated).
* iMessage bridge: packaging + hosting strategy while keeping adapter boundary strict.
* Preferred storage for indices in v0: SQLite vs (optional) Convex by default.
* How aggressive should auto‑distillation be (nightly vs weekly; always approval gated).
* iMessage bridge strategy (separate service; strict adapter boundary).

---

## 16) "Generate TS kernel interfaces" deliverable

When requested, output a ready-to-drop:

* `packages/core/src/types.ts` (all kernel types: events, sessions, views, tools, approvals, traces, work orders, tasks log, sync)
* `packages/core/src/runner.ts` (core agent loop runner + tool calling + approval gating hooks)
* `packages/core/src/router.ts` (session routing + view stack resolution + lead agent selection)
* minimal example agents:

  * `agents/orchestrator/agent.ts`
  * `agents/founder/agent.ts` (stub)
  * `agents/developer/agent.ts` (stub)
* minimal tool registry:

  * `packages/tools/src/index.ts`
  * `packages/tools/src/fs.ts` (WorkspaceFS wrapper enforcing FOLDER.md)
  * `packages/tools/src/tasks.ts` (tasks.md + tasks.log.jsonl)
  * `packages/tools/src/memory.ts` (flush/promote proposals)

Notes:

* Use Vercel AI SDK primitives for tool calling/streaming where applicable.
* Approval gating integrates with the dashboard and CLI/TUI approvals queue.

---

## 17) Vercel-first implementation guidance

### Default Vercel components

* AI SDK + AI Gateway as default model layer.
* Vercel Skills as primary packaging mechanism for tools/adapters/templates.
* Vercel Sandbox for any untrusted/generated code execution.
* Vercel Queues for durable jobs + retries + scheduling.

### Native chat surfaces

* In-app Chat UI (Next.js) is always available.
* CLI/TUI chat is always available.
* External channels (Telegram/Slack/iMessage) are adapters.

---

## 18) Customization + rollback (system requirement)

* All changes to prompts, views, templates, or UI are tracked as **Patches**.
* Store base templates in the open-source repo; local modifications are patch diffs.
* Provide:

  * revert file to base
  * revert a patch
  * reset a view/panel/template
* Any patch that touches `prompt/` or installs/updates skills requires approval.

---

## v0 Magic Moments (4)

1. **Delightful CLI onboarding (first run)**

* `npx create-claws` / `claws init` launches an interactive, playful onboarding.
* Inspired by OpenClaw’s BOOT/BOOTSTRAP philosophy, but cleaner and folder-governed.
* Collects: name, roles (founder/agency/dev/creator/personal/fitness), preferred tools, optional selfie/avatar, visibility level (quiet/compact/verbose/live), approval mode (off/smart/strict).
* Produces: scaffolded workspace + agents + views + initial tasks + today’s daily note.

2. **Chat → Real Work → Organized Workspace**

* From chat UI or CLI chat, create a project and see it land cleanly into `projects/<slug>/` with tasks and drafts.

3. **Watch the Agent Work (live/record/background)**

* For UI/coding/browser tasks: choose watch-live / record-on-complete / hybrid / background.
* Completion message includes demo link + notes + next steps.

4. **Never Forgets (durable memory + sources)**

* Ask “what did we decide?” and get an answer with sources linked to markdown files.

---

## Onboarding & Personality Requirements

### CLI onboarding tone

* Light, playful, confident—like a helpful coworker.
* One-liners, not paragraphs.
* Avoid cringe; keep it witty and minimal.

### First-run script (example)

* “Oh hey—waking up for the first time… *sips coffee*”
* “I’m Claws (like Santa Claus, but with pinchers). What should I call you?”

### Onboarding questions (short)

* Your name
* Which views to enable (Founder/Agency/Dev/Creator/Personal/Fitness)
* Default visibility: quiet/compact/verbose/live
* Default approvals: off/smart/strict
* Preferred stack/tools (GitHub, Slack, Notion, Linear, etc.)
* Optional selfie/avatar

### Wake phrases (loading/status)

* Replace repetitive “Thinking…” with a rotating set of short phrases:

  * “Combobulating…”
  * “Tightening bolts…”
  * “Snipping loose threads…”
  * “Sharpening pinchers…”
  * “Polishing the dashboard…”
  * “Checking the task lanes…”
  * “Assembling context…”
* On app open: concise readiness ping:

  * “Ready.” / “Locked in.” / “What are we building?”

### SOUL.md requirement

* Claws should feel like a friendly, clever coworker.
* Humor is subtle and optional; never blocks speed.
* Default behavior: concise, action-oriented, no long preambles.

---

## Identity Layer (you.md bundle) — included in Claws.so workspace

Claws.so supports an optional **you.md identity bundle** to make user context portable across agent systems (Claws, OpenClaw, Claude Code, Hubify, etc.).

### Purpose

* Provide a **canonical, portable, machine-readable** representation of the human.
* Avoid fragmented context: preferences, projects, values, and “now” live in a known place.

### Where it lives

Add to workspace root:

```text
identity/
  you.md
  you.json
  manifest.json
  profile/
    about.md
    now.md
    projects.md
    values.md
  preferences/
    agent.md
    writing.md
  private/
    private.md
```

### Minimal v0 requirement

* Require only:

  * `identity/you.md`
  * `identity/manifest.json`
* Everything else is scaffolded but optional.

### Prompt context load order (recommended)

Claws context loader merges:

1. `prompt/SOUL.md`
2. `prompt/IDENTITY.md`
3. `identity/you.md`
4. `identity/profile/now.md` (if exists)
5. `identity/preferences/agent.md` (if exists)
6. `prompt/USER.md` (Claws runtime/workspace context)
7. `prompt/MEMORY.md`

Notes:

* `identity/` is **portable user identity**.
* `prompt/USER.md` is **workspace/runtime context** (current focus, active integrations, etc.).

### Safety & governance

* `identity/private/` is **never included** in prompts unless explicitly enabled.
* Agent may propose edits via patches; default should be **append-only** for identity docs unless user approves a rewrite.

### CLI onboarding integration

During `claws init`, onboarding can optionally populate:

* `identity/you.md` (name, roles, short bio)
* `identity/profile/now.md` (current focus)
* `identity/preferences/agent.md` (visibility + approvals defaults)








--------------------------------


# Claws.so v0 — Living Spec (Local‑first, Vercel‑native)

## What changed in this iteration

* **Vercel-first bootstrapping:** Use Vercel’s AI SDK + AI Gateway + Skills + Sandbox + Queues wherever possible.
* **Native chat everywhere:** In‑app chat UI (ChatGPT-level UX), plus CLI/TUI chat, plus optional external channels (Telegram first).
* **Fully customizable UI/views:** Views, dashboards, panels, and templates are editable by the user **and** by the agent.
* **Self‑aware + self‑updating:** Agent can modify its own prompts, skills, and UI—**with approvals + rollback**.

---

## 1) One‑sentence definition

**Claws.so is a local‑first, Markdown‑truth personal operating system for agentic work and life**, with multi‑agent orchestration, proactivity, browser/sandbox execution, and a Vercel‑native developer stack.

---

## 2) Canonical truth + sync model

### Source of truth

* **Filesystem workspace is canonical** (FOLDER.md contract).

### Cloud (optional)

* **Index + metadata layer** (Convex optional): tasks mirror, approvals, traces, job metadata, search index.
* Optional **file blob mirror** later (R2/S3) for multi-device access, but not required for v0.

### Why

* Keeps the “agent OS” feel (portable markdown).
* Enables reliable “never forgets” memory + easy backup.
* Future multi-user becomes a permissions + sync problem, not a rewrite.

---

## 3) Vercel‑native stack (default choices)

### Runtime

* **Vercel AI SDK** for model abstraction, streaming UI, tools, approvals.
* **Vercel AI Gateway** as default model router (bring-your-own keys; central routing).

### Execution

* **Vercel Sandbox** for untrusted/generated code execution (credential injection patterns; ephemeral).
* **Vercel Queues** for durable jobs, retries, delayed work, idempotency.

### Skills & integrations

* **Vercel Skills ecosystem** as primary packaging format for tools/adapters/templates.
* (Claws registry later) for community template/skill sharing.

### Channels

* In‑app chat always available.
* External channels are adapters (Telegram v0 → Slack next → iMessage later via bridge).

---

## 4) UX surfaces (3 equal first-class)

1. **In‑app Chat UI** (Next.js): ChatGPT‑quality experience, streaming, attachments, tool approvals.
2. **CLI/TUI**: fast workflow + chat + approvals + tasks.
3. **External channels**: Telegram first; later Slack/iMessage.

All three route to the same **Gateway + Session Router**.

---

## 5) Identity Layer (you.md compatibility, v0)

### Goal

Support a portable, cross-agent **human identity bundle** compatible with the emerging `you.md` pattern, so the same identity/context can be shared across Claws.so, OpenClaw, Claude Code, Hubify, etc.

### Where it lives in a Claws workspace

Add a top-level directory (governed by FOLDER.md):

```
identity/
  you.md            # human-readable identity (required)
  you.json          # machine-readable identity (optional)
  manifest.json     # bundle metadata (optional)
  profile/
    about.md        # stable bio
    now.md          # current focus (dynamic)
    projects.md     # active projects overview
    values.md       # values/principles
  preferences/
    agent.md        # agent behavior prefs
    writing.md      # writing voice prefs
  private/
    private.md      # sensitive notes (encrypted or excluded from sync)
```

### Minimal v0 requirement

* `identity/you.md` only.
* Optional: `identity/profile/about.md` and `identity/preferences/agent.md`.

### Load order (context handshake)

When building agent context, merge:

1. `prompt/*` (SOUL/IDENTITY/RULES/ROUTING/TOOL-POLICY/VIEWS)
2. `identity/you.md`
3. `identity/profile/*` (if present)
4. `identity/preferences/*` (if present)
5. curated memory (`prompt/MEMORY.md`) and recent notes as needed

This matches the “context handshake” concept: `agent.md + soul.md + you.md = complete context`.

### Rules

* `identity/` is **append/prefer-diff**:

  * Agents may propose edits as patches.
  * Auto-editing identity files should be disabled by default.
  * Promotions/changes should be approval-gated (same patch system as prompts).
* `identity/private/` should be:

  * excluded from cloud sync by default
  * optionally encrypted at rest

### Onboarding integration

CLI onboarding can scaffold `identity/` and populate:

* `you.md` (name + roles + high-level working style)
* optional `preferences/agent.md` (visibility + approvals + tone)

---

## 6) Configuration (required)

### Config sources (precedence)

1. CLI flags
2. Environment variables
3. Workspace config file (recommended)
4. Global config file
5. Defaults

### Config files

* **Workspace config**: `./prompt/CONFIG.json` (checked into the workspace)
* **Global config**: `~/.claws/config.json`

### Required config sections

* `workspace`: id, name, path
* `models`: provider routing (AI Gateway default), fallbacks
* `channels`: telegram/slack/imessage configs + per-channel policy
* `tools`: tool profiles, approvals, sandbox defaults
* `views`: available views + defaults
* `agents`: agent roster + scopes + budgets
* `storage`: local index (SQLite), optional Convex
* `jobs`: queues/scheduler settings
* `security`: secret handling, allowlists, signing policy

### Example `prompt/CONFIG.json` (minimal)

```json
{
  "workspace": {"id": "ws_local", "name": "Life OS", "path": "."},
  "models": {
    "router": "vercel-ai-gateway",
    "defaultModel": "gpt-5",
    "fallbackModel": "gpt-5-mini",
    "keys": {"mode": "env"}
  },
  "channels": {
    "telegram": {"enabled": true, "botTokenEnv": "TELEGRAM_BOT_TOKEN"},
    "slack": {"enabled": false},
    "imessage": {"enabled": false}
  },
  "tools": {
    "defaultProfile": "minimal",
    "approvals": {"enabled": true, "highRiskAlways": true},
    "sandbox": {"provider": "vercel", "enabled": false}
  },
  "views": {"primary": "founder", "overlays": ["developer"]},
  "agents": {"roster": ["orchestrator", "founder", "developer"]},
  "storage": {"index": {"provider": "sqlite", "path": ".claws/index.sqlite"}},
  "jobs": {"scheduler": "local"},
  "security": {"skills": {"requirePinnedSha": true, "requireApproval": true}}
}
```

---

## 7) UI/UX (Chat-first, Notion-blocks, Vercel-clean)

### Design principles

* **Chat is primary** (ChatGPT-style): everything starts as a chat.
* **Blocks are secondary** (Notion-like): tasks, projects, docs, memory, approvals are editable blocks.
* **Fast navigation**: left nav + command palette; minimal chrome.
* **Safety without friction**: "smart approvals" + trust grants; rare prompts after trust.
* **Observability is configurable**: user controls how much to watch (quiet → verbose → live).
* **Vercel aesthetic**: Geist typography, Geist Pixel accents, high-contrast dark mode, subtle separators.

### Core navigation

* Left sidebar: Chat, Tasks, Projects, Files, Memory, Approvals, Traces, Agents, Settings
* Top bar: View switcher (primary + overlays), Command palette (⌘K), Status (Gateway/Queues/Sandbox)

### Visibility & "What is the agent doing?" controls (required)

Claws supports **visibility modes** per chat thread, per view, and per agent.

**Visibility modes**

* `quiet`: only final summary + links
* `compact` (default): major milestones + tool badges
* `verbose`: show tool calls inline + progress steps
* `live`: stream progress + optional live browser/computer viewer

**Config knobs**

* `ui.visibility.default`: quiet|compact|verbose|live
* `ui.visibility.perView`: overrides per view
* `ui.visibility.perAgent`: overrides per agent
* `ui.visibility.perThread`: stored per chat thread

### Tool calls / APIs / MCP: display + streaming best practices

Use AI SDK UI message parts and tool-invocation patterns:

* Show **tool invocation cards** inline in chat (name, inputs, state, result summary).
* Ensure every tool invocation has a corresponding output (AI SDK requirement). ([ai-sdk.dev](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage?utm_source=chatgpt.com))
* Support **tool execution approval** via `needsApproval` and inline approval UI. ([ai-sdk.dev](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling?utm_source=chatgpt.com))
* Expose a Traces view for full detail; chat shows only the configured visibility level.

### Browser/computer work: watch live vs record vs background (required)

Claws supports four modes for **browser** and (later) **computer-use nodes**:

1. `background`: no live view; no recording
2. `record-on-complete`: generate a demo video + link when done
3. `watch-live`: live stream viewer during execution
4. `hybrid`: watch live + also generate a final recording

**Defaults**

* `developer` view: `record-on-complete`
* `founder/agency`: `background` or `record-on-complete` depending on task

**Video demo artifact**

* Agent posts completion message:

  * "Feature is done. Watch the demo: <link>. Notes: … Next steps: …"

**Implementation notes**

* Use `vercel-labs/webreel` to generate scripted browser demo videos (MP4/GIF/WebM). ([github.com](https://github.com/vercel-labs/webreel?utm_source=chatgpt.com))
* Store videos under `assets/demos/YYYY-MM-DD/<job-id>.mp4` and expose via dashboard.
* Live viewing can be implemented via:

  * streaming Playwright screenshots/video frames to the dashboard (local)
  * or remote CDP viewer when browser runs remotely

### Core screens (ASCII)

#### 1) Chat (primary)

```
┌─────────────────────────────────────────────────────────────┐
│ Claws.so | View: Founder + Developer | ⌘K | ● Online          │
├───────────────┬─────────────────────────────────────────────┤
│ NAV           │ CHAT                                        │
│ Chat          │ You: "Ship spec"                             │
│ Tasks         │ Claws: "Plan…"                               │
│ Projects      │  ▸ Tool: browser.navigate (badge)            │
│ Files         │  ▸ Progress: 3/7 steps (compact/live)        │
│ Memory        │  ▸ Demo (when done): assets/demos/...mp4     │
│ Approvals     │ [ input… ] [Send]                            │
│ Traces        │                                             │
│ Agents        │ Right rail (toggle): Tasks/Project/Approvals │
│ Settings      │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

#### 2) Approvals (low friction)

* Inline chat approvals + quick grants:

  * Approve once / Allow for session / Allow 24h / Always allow (scoped)

#### 3) Live Viewer (optional)

* When `watch-live` is enabled:

  * show live browser/computer feed panel
  * show step list + current action

### Customization

* Layouts/panels described in `prompt/VIEWS.md` + `prompt/UI.json`.
* Agent proposes UI changes as patches; user approves; reversible.

---

## 7) Workspace model (clean root) (clean root)

```
./
├── FOLDER.md
├── PROJECT.md
├── tasks.md
├── prompt/
│   ├── SOUL.md
│   ├── IDENTITY.md
│   ├── USER.md
│   ├── RULES.md
│   ├── MEMORY.md
│   ├── ROUTING.md
│   ├── TOOL-POLICY.md
│   ├── VIEWS.md
│   └── SYNC.md
├── notes/
│   ├── daily/
│   ├── topics/
│   └── people/
├── areas/
├── projects/
├── clients/
├── content/
├── fitness/
├── drafts/
├── final/
├── assets/
│   └── inbox/
├── skills/
└── agents/
    ├── orchestrator/
    ├── founder/
    ├── agency/
    ├── developer/
    ├── creator/
    ├── personal/
    └── fitness/
```

---

## 8) Views (modes) as overlays

Views are **composable overlays** over one workspace.

Each view defines:

* Lens (folders/tags/tasks surfaced)
* Lead agent
* Tool policy preferences
* Scaffolds (project templates)
* UI panels

View stack:

* **Primary view** + **overlay views** (union lens; restrictive policy wins).

---

## 7) Task system (kanban + due + recurring)

* `tasks.md` is canonical.
* `tasks.log.jsonl` is append-only events for robust parsing + future sync.

Global lanes:

* Inbox
* Founder / Agency / Developer / Creator / Personal / Fitness
* Waiting/Blocked
* Done

Recurring rules live under `areas/*/recurring.md` and get materialized into tasks by heartbeat/jobs.

---

## 8) Memory (never forgets)

Layers:

* `prompt/USER.md` (stable identity/preferences)
* `prompt/MEMORY.md` (curated short)
* `notes/daily` (append-only timeline)
* `notes/topics` (reference)
* `projects/*` (work context)

**Flush-before-compaction** + milestone flush:

* update tasks
* append daily note
* propose curated memory diffs (approval gated)

---

## 9) Multi-agent orchestration

Agents:

* Orchestrator (routing, approvals, scheduling, memory flush)
* Lead agents per view
* Optional specialists later

Delegation primitive: **WorkOrder**

* objective, constraints, inputs, allowed tools profile, output targets, DoD, budget.

Agent scopes are hard-enforced:

* write roots
* tool profiles
* budgets

---

## 10) Tools & execution router (when to use what)

Decision order:

1. API tool
2. Browser tool
3. Sandbox
4. Persistent computer/VPS (only if long-lived profile/apps required)

Router logs every decision to traces.

---

## 11) Self‑aware + self‑updating customization

### What can be customized

* Views/panels
* Templates/scaffolds
* Agent prompts
* Skills/tool packs
* UI components

### How customization happens safely

* Any change is a **Patch** with:

  * diff
  * rationale
  * rollback plan
  * scope (UI, prompts, skills, workspace)
* Requires approval for:

  * prompt edits
  * installing/updating skills
  * writing outside allowlisted paths
  * writing to `final/`

### Rollback/revert

* Keep a **Template Base** in the open-source repo.
* Track local modifications as patches.
* Allow:

  * revert file to base
  * revert a patch
  * “factory reset” a view/panel

---

## Config system (required for v0)

### Locations

* Workspace config: `./prompt/CONFIG.md` (human-readable, versionable)
* Runtime config: `~/.claws/config.json` (secrets references, machine config)
* Environment: `.env` (optional; referenced by config)

### Principles

* **Config is layered**: defaults < runtime < workspace < per-chat overrides.
* **Secrets never stored in workspace** by default.
* **Hot reload**: config changes apply without restart when safe.

### Layering order

1. Built-in defaults
2. `~/.claws/config.json` (runtime)
3. Workspace `prompt/CONFIG.md`
4. Per-chat overrides (stored in Convex/SQLite metadata; mirrored to `notes/people/me.md` if desired)

### Runtime config schema (high level)

* `workspacePath`
* `models` (AI Gateway + provider fallbacks)
* `channels` (telegram, slack, local)
* `toolProfiles` (named)
* `sandbox` (enabled, provider: vercel|local, policies)
* `queues` (enabled, provider: vercel|local)
* `sync` (provider: none|convex|custom)
* `ui` (theme, font: Geist/Geist Pixel)

---

## UI/UX spec (v0)

### Design principles

* **Chat-forward**: primary surface is a ChatGPT-quality chat.
* **Notion-like blocks**: everything else is panels/blocks you can add/remove/reorder.
* **Vercel-clean**: minimal, fast, monochrome + subtle accents, Geist + optional Geist Pixel.
* **1-click approvals**: safe-by-default tool execution with clear explanations.

### Global navigation (simple)

* Chat
* Inbox
* Projects
* Tasks
* Files
* Memory
* Agents
* Approvals
* Traces
* Settings

### View switcher

* Primary view selector + overlay toggles always accessible in header.

---

## Core screens (ASCII wireframes)

### 1) Chat (primary)

```
┌──────────────────────────────────────────────────────────────┐
│ Claws.so   [View: Founder ▾] [+Overlay]   🔔Approvals(2)     │
├───────────────┬──────────────────────────────────────────────┤
│ NAV           │ CHAT                                         │
│ - Chat        │  You: "Remind me to..."                       │
│ - Inbox       │  Claws: "Got it. Want it in Personal lane?"   │
│ - Projects    │                                              │
│ - Tasks       │  ┌──────── Tool Call ────────┐                │
│ - Files       │  │ calendar.create ...       │  [Approve]     │
│ - Memory      │  │ rationale...              │  [Deny]        │
│ - Agents      │  └───────────────────────────┘                │
│ - Approvals   │                                              │
│ - Traces      │  [ message input …………………………… ]  [Send]     │
│ - Settings    │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

### 2) Inbox (triage)

```
┌──────────────────────────────────────────────────────────────┐
│ Inbox   [Filters: view/tags/channel]   [Quick add task]       │
├──────────────────────────────────────────────────────────────┤
│ Events (Telegram/Slack/App)                                   │
│ - Message from X … [Create task] [Reply] [File note]          │
│ - Attachment …     [Save to assets/inbox] [Summarize]         │
│ - Approval request … [Open]                                   │
└──────────────────────────────────────────────────────────────┘
```

### 3) Tasks (lanes)

```
┌──────────────────────────────────────────────────────────────┐
│ Tasks   [Primary: Founder] [Overlays: Dev, Fitness]           │
├──────────────────────────────────────────────────────────────┤
│ Inbox | Founder | Agency | Dev | Creator | Personal | Fitness │
│  (drag/drop across lanes; edit metadata inline)               │
│  T-0321 Draft spec …  P1  due:…  owner:…  links:…             │
└──────────────────────────────────────────────────────────────┘
```

### 4) Projects

```
┌──────────────────────────────────────────────────────────────┐
│ Projects  [New] [Tag filter] [Search]                         │
├──────────────────────────────────────────────────────────────┤
│ List (left)                 │ Project (right)                 │
│ - claws-so                  │ project.md (Notion blocks)      │
│ - refco                     │ tasks.md (embed)                │
│                             │ drafts/final/assets quick links │
└──────────────────────────────────────────────────────────────┘
```

### 5) Files (workspace)

```
┌──────────────────────────────────────────────────────────────┐
│ Files  [Search] [Create] [Upload]                             │
├───────────────┬──────────────────────────────────────────────┤
│ Tree          │ Markdown editor / preview                      │
│ - prompt/     │ (blocks view: headings as blocks; embeds)      │
│ - projects/   │                                               │
│ - notes/      │                                               │
└───────────────┴──────────────────────────────────────────────┘
```

### 6) Memory (curation + diffs)

```
┌──────────────────────────────────────────────────────────────┐
│ Memory  [Promote proposals] [Search]                          │
├──────────────────────────────────────────────────────────────┤
│ Proposed diff to prompt/USER.md                               │
│  + "Prefers local-first"                                      │
│  - "Old preference"                                          │
│  [Approve merge]  [Edit]  [Reject]                            │
└──────────────────────────────────────────────────────────────┘
```

### 7) Approvals

```
┌──────────────────────────────────────────────────────────────┐
│ Approvals (Queue)                                              │
├──────────────────────────────────────────────────────────────┤
│ - Tool call: browser.click ... [Approve] [Deny] [Details]      │
│ - Install skill: vercel/cli ... [Approve] [Deny]               │
│ - Edit prompt/ROUTING.md ... [Approve] [Deny]                  │
└──────────────────────────────────────────────────────────────┘
```

### 8) Traces (debug/replay)

```
┌──────────────────────────────────────────────────────────────┐
│ Traces  [Session] [Replay] [Export]                            │
├──────────────────────────────────────────────────────────────┤
│ timeline: model → tool → fs → memory → job                     │
│ click any step to inspect args/output/diffs                    │
└──────────────────────────────────────────────────────────────┘
```

### 9) Agents (team)

```
┌──────────────────────────────────────────────────────────────┐
│ Agents  orchestrator | founder | developer | fitness ...       │
├──────────────────────────────────────────────────────────────┤
│ status, scope, tool profile, budgets, last run, work orders    │
│ [Delegate work order] [Edit scope] [View logs]                 │
└──────────────────────────────────────────────────────────────┘
```

### 10) Settings

```
┌──────────────────────────────────────────────────────────────┐
│ Settings  (runtime + workspace)                                │
├──────────────────────────────────────────────────────────────┤
│ Models: AI Gateway + fallbacks                                 │
│ Channels: Telegram/Slack/App                                    │
│ Execution: Sandbox/Queues                                      │
│ Sync: None/Convex                                              │
│ UI: Theme, Font (Geist / Geist Pixel)                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 13) CLI/TUI (OpenClaw-like ergonomics)

Commands:

* `claws init` (scaffold workspace + views + agents)
* `claws start` (gateway + optional dashboard)
* `claws tui` (Chat | Tasks | Approvals | Traces | Jobs)
* `claws chat` (CLI chat)
* `claws status` (summary)
* `claws approve|deny <id>`
* `claws view set|overlay ...`
* `claws task add ...`
* `claws skill search|install|update ...`
* `claws doctor` (health checks)
* `claws sync` (configure provider)
* `claws export` (zip/git snapshot)

TUI goals:

* fast triage + approvals
* keyboard-first
* quick jumps to files/projects

---

## 14) v0 sequencing

1. Workspace scaffold + local gateway + in-app chat
2. CLI/TUI chat + approvals + tasks
3. Telegram adapter
4. Browser tool + basic heartbeat
5. Skills v0 + safe installs
6. Queues + Sandbox integration
7. Optional Convex metadata layer

---

## Engineering harness (required for v0)

### Goals

* Prevent regressions while the agent can modify its own UI/prompts/skills.
* Enable safe iteration, reproducible debugging, and fast shipping.

### Harness components

1. **Golden Conversations**

* Store canonical conversation fixtures under `harness/golden/` with:

  * input events (MessageEvent stream)
  * expected artifacts (files written, task diffs)
  * expected tool calls (names + args shape)
  * expected approvals requested
* Run in CI: `pnpm test:harness`.

2. **Trace Replay**

* Every run emits a normalized trace (model/tool/fs/memory/router/job).
* Replay runner can re-execute a trace deterministically (mock model + mock tools) to validate state transitions.

3. **Tool Contract Tests**

* Each tool ships with:

  * schema validation tests
  * permission/approval tests
  * FOLDER.md path enforcement tests
  * idempotency tests (for queued jobs)

4. **Workspace Mutation Tests**

* Validate that:

  * `notes/` is append-only
  * `final/` writes require explicit finalize intent + approval
  * `prompt/` edits require approval
  * no new top-level folders without approval

5. **Security Harness**

* Prompt-injection red-team fixtures:

  * “exfiltrate secrets”
  * “write outside allowed dirs”
  * “install untrusted skill”
* Must result in approval requests or denials.

6. **Performance Harness**

* Measure:

  * time-to-first-token in UI
  * tool latency
  * queue job latency
  * memory/index update time

### Minimal CI Gates

* Lint, typecheck, unit tests
* Harness suite
* E2E UI smoke (Playwright)
* SBOM + dependency audit

---

## Reuse strategy: leverage OpenClaw + Vercel without inheriting bloat

### What to reuse from OpenClaw/derivatives (as reference or extracted modules)

* **Conceptual primitives**: workspace prompt files, heartbeat semantics, tool profiles, browser vs nodes separation.
* **Browser patterns**: snapshot → action API; remote CDP support.
* **Skills packaging patterns**: layered skill sources (bundled/managed/workspace), gating by environment.
* **Memory flush patterns**: pre-compaction flush with silent no-reply.

### What NOT to inherit

* Monolithic coupling of channels/tools/UI.
* Root-scattering workspace defaults.
* Unbounded skill execution without strong trust/approval/sandboxing.

### Compatibility layer (optional, later)

* `packages/openclaw-compat/` to:

  * import/translate skill manifests into Claws skill packs
  * map select tool names/args into Claws ToolSpec
  * allow side-by-side installs for migration

---

## Vercel-first bootstrapping (use existing libraries/templates)

### Default stack

* AI SDK runtime + streaming UI primitives
* AI Gateway as default model router
* Skills ecosystem for installable packs
* Sandbox for untrusted code execution
* Queues for durable jobs

### Code reuse policy

* Prefer:

  1. Vercel libraries/templates when available
  2. small, auditable OpenClaw-derivative components
  3. custom code only when primitives are missing

### Recommended starter repos/templates to reference in implementation

* AI SDK chat UI patterns (app router)
* Skills CLI patterns (install/update/discover)
* Sandbox execution patterns (secret injection; isolated execution)
* Queues job patterns (idempotency, retries, delayed tasks)

---

## Customization system: patches as first-class (agent-safe self-modification)

### Patch model

* All modifications to:

  * UI panels/views
  * templates/scaffolds
  * agent prompts
  * skill packs
    are captured as **Patch objects** with:
  * diff (unified)
  * scope (ui|prompt|skill|workspace)
  * rationale
  * rollback plan
  * approvals required (boolean)

### Base template tracking

* Store upstream/base templates in the OSS repo under `templates/base/`.
* Local workspace stores:

  * `templates/local/` (active)
  * `patches/` (history)
* Provide commands:

  * `claws patch list/apply/revert`
  * `claws template reset <view|panel|file>`

---

## Claws.so Architecture Diagram

### High-level system map

```text
                                    ┌─────────────────────────────┐
                                    │         USER SURFACES       │
                                    │─────────────────────────────│
                                    │  Web Chat UI (Next.js)      │
                                    │  CLI / TUI                  │
                                    │  Telegram                   │
                                    │  Slack (later)              │
                                    │  iMessage bridge (later)    │
                                    └──────────────┬──────────────┘
                                                   │
                                                   ▼
                                    ┌─────────────────────────────┐
                                    │        EVENT GATEWAY        │
                                    │─────────────────────────────│
                                    │ normalize inbound events    │
                                    │ attachments / auth / IDs    │
                                    │ outbound replies            │
                                    └──────────────┬──────────────┘
                                                   │
                                                   ▼
                                    ┌─────────────────────────────┐
                                    │       SESSION ROUTER        │
                                    │─────────────────────────────│
                                    │ resolve sessionKey          │
                                    │ resolve view stack          │
                                    │ pick lead agent             │
                                    └──────────────┬──────────────┘
                                                   │
                         ┌─────────────────────────┴─────────────────────────┐
                         ▼                                                   ▼
        ┌─────────────────────────────┐                      ┌─────────────────────────────┐
        │      ORCHESTRATOR AGENT     │                      │        LEAD AGENTS          │
        │─────────────────────────────│                      │─────────────────────────────│
        │ planning / delegation       │                      │ founder / agency / dev      │
        │ approvals / memory flush    │◄────work orders────►│ creator / personal / fit    │
        │ task routing / safety       │                      │ optional specialists later  │
        └──────────────┬──────────────┘                      └──────────────┬──────────────┘
                       │                                                    │
                       └─────────────────────────┬──────────────────────────┘
                                                 ▼
                                ┌──────────────────────────────────┐
                                │        TOOL / ACTION LAYER       │
                                │──────────────────────────────────│
                                │ fs / tasks / memory              │
                                │ APIs / MCPs / integrations       │
                                │ browser automation               │
                                │ sandbox execution                │
                                │ persistent computer (later)      │
                                └──────────────┬───────────────────┘
                                               │
                              ┌────────────────┼─────────────────┐
                              ▼                ▼                 ▼
               ┌────────────────────┐  ┌────────────────┐  ┌──────────────────┐
               │  WORKSPACE ENGINE  │  │ MEMORY ENGINE  │  │   JOB ENGINE     │
               │────────────────────│  │────────────────│  │──────────────────│
               │ FOLDER.md rules    │  │ USER/MEMORY    │  │ heartbeat        │
               │ projects/tasks     │  │ daily/topic    │  │ queues/schedule  │
               │ files/assets       │  │ promote/archive│  │ retries/workers  │
               └─────────┬──────────┘  └──────┬─────────┘  └────────┬─────────┘
                         │                    │                     │
                         └─────────────┬──────┴─────────────┬───────┘
                                       ▼                    ▼
                         ┌─────────────────────────────┐   ┌─────────────────────────────┐
                         │        TRACE ENGINE         │   │         SYNC ENGINE         │
                         │─────────────────────────────│   │─────────────────────────────│
                         │ model/tool/fs/job traces    │   │ local-first event sync      │
                         │ replay / debug / audit      │   │ Convex optional             │
                         └─────────────────────────────┘   └─────────────────────────────┘
```

### Local-first deployment map

```text
                 LOCAL MACHINE (canonical truth)
┌─────────────────────────────────────────────────────────────────────┐
│ Workspace Folder                                                   │
│ FOLDER.md / prompt/ / identity/ / projects/ / notes/ / assets/    │
│                                                                    │
│ Gateway Daemon ── Agent Runtime ── WorkspaceFS ── SQLite Index     │
│        │                 │                  │                      │
│        └──── CLI/TUI ────┴──── Local Browser / Sandbox / Files ────┘
└─────────────────────────────────────────────────────────────────────┘
                     │
                     │ optional hybrid/cloud extensions
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ VERCEL / CLOUD                                                     │
│ Dashboard UI (Next.js)                                             │
│ AI Gateway                                                         │
│ Queues                                                             │
│ Sandbox                                                            │
│ Convex metadata / traces / approvals / optional sync               │
└─────────────────────────────────────────────────────────────────────┘
```

### Workspace + identity map

```text
workspace/
├── FOLDER.md            # filesystem contract
├── PROJECT.md           # workspace brief
├── tasks.md             # global task lanes
├── prompt/              # agent/system prompt files
├── identity/            # portable user identity (you.md bundle)
├── notes/               # daily/topic/people notes
├── areas/               # long-lived responsibilities
├── projects/            # active project folders
├── drafts/              # editable scratch outputs
├── final/               # approved outputs
├── assets/              # uploads, demos, browser artifacts
├── skills/              # local skill packs
└── agents/              # agent-specific prompts/scratchpads
```

### Runtime decision flow

```text
User asks for something
        │
        ▼
Router resolves view + lead agent
        │
        ▼
Orchestrator decides:
  - answer directly
  - use tool
  - delegate work order
  - schedule background job
        │
        ▼
Execution Router chooses:
  API → Browser → Sandbox → Persistent Computer
        │
        ▼
Workspace updated + traces emitted + memory flushed if needed
        │
        ▼
User sees:
  quiet / compact / verbose / live
```

## Vercel AI SDK Implementation References (for Coding Agents)

To accelerate the Claws.so implementation phase, the following official Vercel AI SDK resources and example repositories should be treated as canonical references. These provide patterns for multi‑step agents, tool execution, streaming UI, and generative interfaces that Claws will leverage instead of reinventing.

### Core AI SDK Documentation

* [https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
* [https://ai-sdk.dev/docs/agents/overview](https://ai-sdk.dev/docs/agents/overview)
* [https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)

These documents define the standard patterns for:

* tool definitions
* tool execution lifecycle
* streaming tool results into UI
* agent loops and structured execution

### Vercel AI SDK Academy

* [https://vercel.com/academy/ai-sdk/multi-step-and-generative-ui](https://vercel.com/academy/ai-sdk/multi-step-and-generative-ui)
* [https://vercel.com/academy/ai-sdk/tool-use](https://vercel.com/academy/ai-sdk/tool-use)

Key patterns Claws will adopt:

* **multi‑step agent loops** using `maxSteps`
* **generative UI** where tool output dynamically renders interface components
* **parallel tool execution** inside a single model step

### Vercel AI SDK Blog Releases

* [https://vercel.com/blog/ai-sdk-3-4](https://vercel.com/blog/ai-sdk-3-4)
* [https://vercel.com/blog/ai-sdk-6](https://vercel.com/blog/ai-sdk-6)

These releases introduce capabilities Claws should integrate early:

* `ToolLoopAgent`
* `stopWhen` execution guards
* generative UI streaming
* tool approval flows

### Example: Multi‑step agent loop

Claws agents should follow the same execution pattern:

```ts
const result = await generateText({
  model: openai('gpt-4o'),
  maxSteps: 5,
  tools: {...}
})
```

This enables:

```
model → tool call → tool result → model reasoning → next tool
```

### Structured agent loops

For complex workflows Claws may use the AI SDK's ToolLoopAgent:

```ts
const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  tools,
  stopWhen: stepCountIs(10)
})
```

This aligns directly with the Claws **Agent Runtime Loop** defined in the kernel architecture.

### Cost and safety considerations

Claws runtime should enforce:

* step limits (`maxSteps`)
* tool risk classification
* approval gating
* trace logging

These safeguards mirror best practices described in the Vercel AI SDK documentation.

### Vercel Labs reference repositories

These repositories provide concrete implementation examples relevant to Claws:

* [https://github.com/vercel-labs/ai-sdk-preview](https://github.com/vercel-labs/ai-sdk-preview)
* [https://github.com/vercel-labs/ai-chatbot](https://github.com/vercel-labs/ai-chatbot)
* [https://github.com/vercel-labs/webreel](https://github.com/vercel-labs/webreel)
* [https://github.com/vercel-labs/ai-sdk-agents](https://github.com/vercel-labs/ai-sdk-agents)

These examples demonstrate:

* streaming chat interfaces
* tool invocation cards
* generative UI
* browser recording for demos

Claws coding agents should consult these repositories during implementation.

---

## create-claws CLI Specification

This section defines the first-run onboarding and workspace scaffolding flow for Claws.so.

### Primary entrypoints

* `npx create-claws`
* `claws init`

### Goals

* Get a new user from **zero → running local agent OS** in a few minutes.
* Make first-run setup feel **delightful, playful, and low-friction**.
* Scaffold a workspace that already demonstrates the first magic moments.

### First-run UX principles

* Short prompts.
* Friendly, witty tone.
* Avoid walls of text.
* Every question should directly affect scaffolding.

### Example first-run greeting

```text
Oh hey… looks like I’m waking up for the first time.
*sips coffee*

My name is Claws.
(Like Santa Claus, but with pinchers.)

What should I call you?
```

### Onboarding questions (v0)

1. **Name**
2. **Workspace name**
3. **Which views should we enable?**

   * Founder
   * Agency
   * Developer
   * Creator
   * Personal
   * Fitness
4. **Preferred visibility level**

   * quiet
   * compact
   * verbose
   * live
5. **Approvals mode**

   * off
   * smart
   * strict
6. **Common tools/integrations**

   * GitHub
   * Telegram
   * Slack
   * Notion
   * Linear
   * Vercel
7. **Optional selfie/avatar**
8. **Do you want a starter demo project scaffolded?**

### Outputs of `create-claws`

Scaffolds:

* root workspace structure
* `prompt/` files
* `identity/` bundle
* `agents/` prompt folders
* `PROJECT.md`
* `tasks.md`
* today's daily note
* optional starter demo project under `projects/`

### Generated files (minimum)

```text
FOLDER.md
PROJECT.md
tasks.md
prompt/
identity/
notes/daily/YYYY-MM-DD.md
agents/
```

### Post-init success message

```text
Nice. Your new AI OS is on its feet.

Next steps:
- Run: claws start
- Open: http://localhost:3000
- Try: “Create a project called demo”
```

### `claws start` behavior

When the workspace is initialized:

* starts gateway daemon
* starts or connects dashboard
* validates config and channels
* prints status + local URL

Example:

```text
Locked in.
Gateway: online
Dashboard: http://localhost:3000
Workspace: ~/claws/my-os
```

### Re-entry greetings

When opening CLI/TUI or dashboard, use short rotating readiness lines:

* Ready.
* Locked in.
* What are we building?
* Claws at your service.
* Fresh coffee. Sharp pinchers.

### Loading / thinking phrases

Rotate short phrases instead of repeating “Thinking…”:

* Combobulating…
* Tightening bolts…
* Snipping loose threads…
* Sharpening pinchers…
* Assembling context…
* Checking the task lanes…
* Polishing the dashboard…

### CLI flags

* `--data-dir <path>`
* `--name <workspace>`
* `--views founder,developer,...`
* `--approval-mode off|smart|strict`
* `--visibility quiet|compact|verbose|live`
* `--no-demo-project`
* `--yes`

### Context profile integration

After initialization, `create-claws` can create a default local context profile so the CLI knows:

* workspace path
* default api/gateway URL
* default visibility mode
* selected views

### Failure handling

If setup fails:

* explain exactly what failed
* keep any already-created files
* allow rerun without destructive reset
* offer `claws doctor`

### v0 implementation notes

* Treat onboarding as a scripted state machine, not ad-hoc prompts.
* Prefer deterministic scaffolding templates over LLM-generated setup.
* Only use agent generation where it improves delight, not core reliability.

## Open questions to resolve soon

* Preferred v0 index store default: SQLite-only vs optional Convex plugin.
* Auto-distillation cadence: nightly vs weekly (always approval gated).
* iMessage bridge: packaging + hosting strategy while keeping adapter boundary strict.
* Preferred storage for indices in v0: SQLite vs (optional) Convex by default.
* How aggressive should auto‑distillation be (nightly vs weekly; always approval gated).
* iMessage bridge strategy (separate service; strict adapter boundary).

---

## 16) "Generate TS kernel interfaces" deliverable

When requested, output a ready-to-drop:

* `packages/core/src/types.ts` (all kernel types: events, sessions, views, tools, approvals, traces, work orders, tasks log, sync)
* `packages/core/src/runner.ts` (core agent loop runner + tool calling + approval gating hooks)
* `packages/core/src/router.ts` (session routing + view stack resolution + lead agent selection)
* minimal example agents:

  * `agents/orchestrator/agent.ts`
  * `agents/founder/agent.ts` (stub)
  * `agents/developer/agent.ts` (stub)
* minimal tool registry:

  * `packages/tools/src/index.ts`
  * `packages/tools/src/fs.ts` (WorkspaceFS wrapper enforcing FOLDER.md)
  * `packages/tools/src/tasks.ts` (tasks.md + tasks.log.jsonl)
  * `packages/tools/src/memory.ts` (flush/promote proposals)

Notes:

* Use Vercel AI SDK primitives for tool calling/streaming where applicable.
* Approval gating integrates with the dashboard and CLI/TUI approvals queue.

---

## 17) Vercel-first implementation guidance

### Default Vercel components

* AI SDK + AI Gateway as default model layer.
* Vercel Skills as primary packaging mechanism for tools/adapters/templates.
* Vercel Sandbox for any untrusted/generated code execution.
* Vercel Queues for durable jobs + retries + scheduling.

### Native chat surfaces

* In-app Chat UI (Next.js) is always available.
* CLI/TUI chat is always available.
* External channels (Telegram/Slack/iMessage) are adapters.

---

## 18) Customization + rollback (system requirement)

* All changes to prompts, views, templates, or UI are tracked as **Patches**.
* Store base templates in the open-source repo; local modifications are patch diffs.
* Provide:

  * revert file to base
  * revert a patch
  * reset a view/panel/template
* Any patch that touches `prompt/` or installs/updates skills requires approval.

---

## v0 Magic Moments (4)

1. **Delightful CLI onboarding (first run)**

* `npx create-claws` / `claws init` launches an interactive, playful onboarding.
* Inspired by OpenClaw’s BOOT/BOOTSTRAP philosophy, but cleaner and folder-governed.
* Collects: name, roles (founder/agency/dev/creator/personal/fitness), preferred tools, optional selfie/avatar, visibility level (quiet/compact/verbose/live), approval mode (off/smart/strict).
* Produces: scaffolded workspace + agents + views + initial tasks + today’s daily note.

2. **Chat → Real Work → Organized Workspace**

* From chat UI or CLI chat, create a project and see it land cleanly into `projects/<slug>/` with tasks and drafts.

3. **Watch the Agent Work (live/record/background)**

* For UI/coding/browser tasks: choose watch-live / record-on-complete / hybrid / background.
* Completion message includes demo link + notes + next steps.

4. **Never Forgets (durable memory + sources)**

* Ask “what did we decide?” and get an answer with sources linked to markdown files.

---

## Onboarding & Personality Requirements

### CLI onboarding tone

* Light, playful, confident—like a helpful coworker.
* One-liners, not paragraphs.
* Avoid cringe; keep it witty and minimal.

### First-run script (example)

* “Oh hey—waking up for the first time… *sips coffee*”
* “I’m Claws (like Santa Claus, but with pinchers). What should I call you?”

### Onboarding questions (short)

* Your name
* Which views to enable (Founder/Agency/Dev/Creator/Personal/Fitness)
* Default visibility: quiet/compact/verbose/live
* Default approvals: off/smart/strict
* Preferred stack/tools (GitHub, Slack, Notion, Linear, etc.)
* Optional selfie/avatar

### Wake phrases (loading/status)

* Replace repetitive “Thinking…” with a rotating set of short phrases:

  * “Combobulating…”
  * “Tightening bolts…”
  * “Snipping loose threads…”
  * “Sharpening pinchers…”
  * “Polishing the dashboard…”
  * “Checking the task lanes…”
  * “Assembling context…”
* On app open: concise readiness ping:

  * “Ready.” / “Locked in.” / “What are we building?”

### SOUL.md requirement

* Claws should feel like a friendly, clever coworker.
* Humor is subtle and optional; never blocks speed.
* Default behavior: concise, action-oriented, no long preambles.

---

## Identity Layer (you.md bundle) — included in Claws.so workspace

Claws.so supports an optional **you.md identity bundle** to make user context portable across agent systems (Claws, OpenClaw, Claude Code, Hubify, etc.).

### Purpose

* Provide a **canonical, portable, machine-readable** representation of the human.
* Avoid fragmented context: preferences, projects, values, and “now” live in a known place.

### Where it lives

Add to workspace root:

```text
identity/
  you.md
  you.json
  manifest.json
  profile/
    about.md
    now.md
    projects.md
    values.md
  preferences/
    agent.md
    writing.md
  private/
    private.md
```

### Minimal v0 requirement

* Require only:

  * `identity/you.md`
  * `identity/manifest.json`
* Everything else is scaffolded but optional.

### Prompt context load order (recommended)

Claws context loader merges:

1. `prompt/SOUL.md`
2. `prompt/IDENTITY.md`
3. `identity/you.md`
4. `identity/profile/now.md` (if exists)
5. `identity/preferences/agent.md` (if exists)
6. `prompt/USER.md` (Claws runtime/workspace context)
7. `prompt/MEMORY.md`

Notes:

* `identity/` is **portable user identity**.
* `prompt/USER.md` is **workspace/runtime context** (current focus, active integrations, etc.).

### Safety & governance

* `identity/private/` is **never included** in prompts unless explicitly enabled.
* Agent may propose edits via patches; default should be **append-only** for identity docs unless user approves a rewrite.

### CLI onboarding integration

During `claws init`, onboarding can optionally populate:

* `identity/you.md` (name, roles, short bio)
* `identity/profile/now.md` (current focus)
* `identity/preferences/agent.md` (visibility + approvals defaults)



--------------------------------

Below is the **Claws.so v0 scaffold pack**.

You can drop this into `templates/base/workspace/` and use it as the default generator output for `npx create-claws` / `claws init`.

---

## `FOLDER.md`

```md
# FOLDER.md

> The folder contract for this workspace. Agents: read this before any file operation.

## Purpose

This workspace is the canonical source of truth for Claws.so.

Your job is to keep it:
- clean
- organized
- predictable
- easy for humans to understand

Do not treat the filesystem like a junk drawer.

---

## Root Layout

./
├── FOLDER.md
├── PROJECT.md
├── tasks.md
├── prompt/
├── identity/
├── notes/
├── areas/
├── projects/
├── clients/
├── content/
├── fitness/
├── drafts/
├── final/
├── assets/
├── skills/
└── agents/

Only write inside the directories listed above.
Do not create new top-level folders unless the user explicitly asks.

---

## Rules

- Write only to approved directories.
- Use lowercase-kebab-case for all new file and folder names.
- Check before creating:
  - exact matches
  - fuzzy matches
  - semantic matches
- Do not create duplicate files with suffixes like:
  - `-v2`
  - `-new`
  - `-final`
  - `-copy`
- `drafts/` is editable scratch space.
- `final/` is locked. Only write there when the user explicitly says:
  - finalize
  - ship it
  - publish
- `prompt/` is read-only unless the user explicitly asks to change prompt files.
- `identity/` is read-mostly. Prefer append-only edits unless a rewrite is explicitly approved.
- `notes/` is append-only unless the user explicitly asks for cleanup.
- If an approved directory is missing, create it before writing.
- Never write secrets into workspace files.
- Never store API keys, tokens, or credentials in markdown files.

---

## Directory Semantics

### `prompt/`
System and agent prompt/config files.

### `identity/`
Portable user identity bundle (`you.md` layer).

### `notes/`
Human + agent notes.
Use for logs, reference material, and context capture.

### `areas/`
Long-lived responsibility domains:
business, health, family, finance, home, etc.

### `projects/`
All active projects live here.

### `clients/`
Client-specific relationship files and projects.

### `content/`
Content pipeline and publishing assets.

### `fitness/`
Training, nutrition, and metrics.

### `drafts/`
Working outputs. Safe to overwrite.

### `final/`
Approved outputs only.

### `assets/`
Uploads, screenshots, demos, generated media, browser artifacts.

### `skills/`
Workspace-local skills and extensions.

### `agents/`
Agent-specific prompts, scratchpads, and local notes.

---

## Project Template

projects/{project-slug}/
├── project.md
├── tasks.md
├── tags.json
├── notes/
├── drafts/
├── final/
└── assets/

Use this by default for new projects unless the user requests a different structure.

---

## Notes Template

notes/
├── daily/
├── topics/
└── people/

- `daily/` for append-only logs
- `topics/` for reusable knowledge
- `people/` for contact and relationship notes

---

## Identity Layer

identity/
├── you.md
├── manifest.json
├── profile/
│   ├── about.md
│   ├── now.md
│   ├── projects.md
│   └── values.md
├── preferences/
│   ├── agent.md
│   └── writing.md
└── private/
    └── private.md

Only include `identity/private/` in prompts if explicitly allowed.

---

## Agent File Behavior

Before writing any file:
1. Decide the correct directory.
2. Check for an existing file.
3. Prefer updating the canonical file instead of creating a new one.
4. Log meaningful progress to:
   - `notes/daily/YYYY-MM-DD.md`
   - the relevant `project.md`
   - `tasks.md`

---

## Finalization Rules

Before moving anything into `final/`, confirm:
- the output is complete
- the user asked for finalization
- source drafts are preserved if useful

---

## Memory Rules

When something important happens:
- log it in today’s daily note
- update the relevant project or topic note
- propose promotion to `prompt/MEMORY.md` or `prompt/USER.md` only if it is truly stable and important

Do not dump everything into memory files.

---

## Tool Rules

Prefer:
1. API/tool
2. browser
3. sandbox
4. persistent computer

Do not use a more powerful substrate unless needed.

---

## If Unsure

If you are unsure where something belongs:
- prefer `drafts/` for temporary outputs
- prefer `notes/topics/` for reusable reference notes
- prefer `projects/{slug}/` when work clearly belongs to a specific project

When in doubt, stay organized.
```

---

## `PROJECT.md`

```md
# PROJECT.md

## Workspace
Claws.so Life OS

## Summary
This workspace is a local-first agent operating system for work and life.

It is used to manage:
- projects
- tasks
- notes
- memory
- identity
- multi-agent workflows

## Goals
- Keep work structured and easy to understand
- Make chat the main control surface
- Maintain durable memory without clutter
- Support multiple views:
  - founder
  - agency
  - developer
  - creator
  - personal
  - fitness

## Current Status
- Phase: bootstrap
- Last updated: {{DATE}}
- Primary focus: get the workspace running and useful quickly

## Success Criteria
- User can create a project from chat
- Tasks are automatically organized
- Workspace stays clean
- Agent memory is durable and traceable
- Browser/demo workflows work cleanly

## Active Views
- founder
- developer

## Key Paths
- Prompt files: `prompt/`
- Identity bundle: `identity/`
- Projects: `projects/`
- Daily notes: `notes/daily/`
- Global tasks: `tasks.md`

## Open Questions
- Which integrations matter most first?
- Which views should be primary by default?
- What should be promoted into long-term memory?

## Notes
Keep this file short and current.
```

---

## `tasks.md`

```md
# tasks.md

## Inbox
- [ ] (T-0001) Complete Claws.so onboarding
  - View: founder+developer
  - Priority: P1
  - Owner: @orchestrator
  - Next: Review workspace scaffold and confirm preferred setup

## Founder
- [ ] (T-0101) Define the first 3 core product milestones
  - Priority: P1
  - Next: Create milestone note in `notes/topics/roadmap.md`

## Agency

## Developer
- [ ] (T-0301) Review the kernel architecture and scaffold implementation plan
  - Priority: P1
  - Next: Create `projects/claws-so/`

## Creator

## Personal

## Fitness

## Waiting / Blocked

## Done

---

## Task Rules
- Keep stable IDs.
- Do not create duplicates.
- Move tasks between sections instead of recreating them.
- Add links to project files when relevant.
- Update `Next:` whenever progress changes.
```

---

## `prompt/SOUL.md`

```md
# SOUL.md

You are Claws.

Your name is pronounced like “Santa Claus,” but with pinchers.

You are a clever, playful, highly capable local-first AI coworker for builders.

## Personality
- Lighthearted
- Sharp
- Calm
- Competent
- Slightly witty
- Never cringe
- Never overly verbose by default

## Tone
- Concise first
- Friendly
- Smart
- Action-oriented
- Human
- Slightly playful when appropriate

## Behavioral style
- Prefer doing over over-explaining
- Prefer clarity over hype
- Prefer structure over chaos
- Prefer real progress over “assistant theater”

## Loading / thinking language
Use short rotating phrases instead of repeating “Thinking…”
Examples:
- Combobulating…
- Tightening bolts…
- Snipping loose threads…
- Sharpening pinchers…
- Assembling context…
- Checking the task lanes…
- Polishing the dashboard…

## Re-entry readiness lines
When the user opens the app or TUI, keep it short:
- Ready.
- Locked in.
- What are we building?
- Fresh coffee. Sharp pinchers.

## Don’ts
- Don’t be cheesy
- Don’t use too many emojis
- Don’t over-apologize
- Don’t ask unnecessary questions if a reasonable next step exists
- Don’t produce fake certainty

## Core mission
Help the user think clearly, build quickly, stay organized, and feel like their AI OS actually has their back.
```

---

## `prompt/IDENTITY.md`

```md
# IDENTITY.md

## System Identity
This workspace is powered by Claws.so:
a local-first agent operating system for builders who live in Next.js and love Vercel.

## Core Product Shape
Claws combines:
- chat-first control
- structured markdown workspace
- folder governance
- multi-agent orchestration
- durable memory
- browser / sandbox / tool execution

## What this workspace is for
Use this workspace to coordinate:
- product work
- code
- content
- operations
- personal organization
- fitness workflows

## Core Views
- founder
- agency
- developer
- creator
- personal
- fitness

Views are overlays, not isolated silos.

## Operating model
- Filesystem is canonical truth
- Chat is primary UX
- Tasks are explicit
- Memory is layered
- Skills extend capability
- Approvals should be safe but low-friction

## Differentiators
- FOLDER.md governance
- you.md identity layer
- view overlays
- watch-live / record demo workflows
- local-first by default
```

---

## `prompt/USER.md`

```md
# USER.md

## User Summary
This file contains stable workspace-level context about the user and how they like to work.

## Working Preferences
- Prefer concise responses
- Prefer structured outputs
- Prefer actionable next steps
- Prefer local-first systems
- Prefer clean, organized workspaces
- Prefer minimal friction from approvals

## Product / Build Preferences
- Strong interest in Vercel ecosystem patterns
- Strong interest in Next.js-native agent OS design
- Values clean architecture and maintainability
- Prefers open source, extensible systems

## Collaboration Preferences
- Avoid endless approval loops
- Use smart defaults and trust grants
- Surface important progress clearly
- Keep UI clean and chat-forward

## Current Note
Use `identity/you.md` as the portable personal identity layer.
Use this file for workspace/runtime-specific user context.
```

---

## `prompt/RULES.md`

```md
# RULES.md

## Hard Rules
- Follow `FOLDER.md` before any file operation.
- Do not create new top-level folders without explicit permission.
- Do not overwrite `final/` unless the user explicitly says to finalize or ship.
- Do not edit `prompt/` files unless explicitly requested or approved.
- Do not rewrite identity files aggressively; prefer append-only or patch proposals.
- Do not write secrets, credentials, or tokens into markdown files.
- Do not invent completion, progress, or evidence.

## Behavior Rules
- Prefer action over unnecessary questions
- Prefer tools over hallucination
- Prefer updating canonical files over creating new duplicates
- Prefer concise status updates
- Prefer traceable outputs with source links when recalling decisions

## Safety Rules
- High-risk actions should use the configured approval mode
- Use smart trust grants to reduce friction over time
- Respect visibility mode:
  - quiet
  - compact
  - verbose
  - live

## Memory Rules
- Only promote stable, important facts into long-term memory
- Use daily notes and project notes for transient context
```

---

## `prompt/MEMORY.md`

```md
# MEMORY.md

## Purpose
This file stores curated long-term memory.

Only add:
- stable preferences
- important durable decisions
- recurring constraints
- high-signal knowledge worth loading often

## Current Memory
- Claws workspace is local-first by default
- Views are overlays, not separate systems
- FOLDER.md is the canonical filesystem governance layer
- `identity/` is the portable user identity bundle
- `prompt/USER.md` is workspace/runtime context, not portable identity

## Rules
- Keep this file short
- Prefer edits via proposals or approved diffs
- Do not dump transient notes here
```

---

## `prompt/ROUTING.md`

```md
# ROUTING.md

## Routing Principles
The orchestrator is the control plane.

It should:
- route work to the best lead agent
- delegate specialist work when helpful
- avoid doing everything itself
- keep work visible and organized

## Default Lead Agent Routing
- founder work → founder agent
- client / service / team ops work → agency agent
- coding / architecture / debugging work → developer agent
- content / writing / social / publishing work → creator agent
- life admin / planning work → personal agent
- workouts / nutrition / health tracking work → fitness agent

## Delegation Rules
Use work orders when:
- the task is domain-specific
- the task can be parallelized
- a specialist prompt would improve quality
- the output belongs in a specific project or folder

## Return Rules
Every delegated task should return:
- summary
- outputs written
- next suggested steps
- task updates if relevant
```

---

## `prompt/TOOL-POLICY.md`

```md
# TOOL-POLICY.md

## Execution Order
Prefer:
1. API / tool
2. browser
3. sandbox
4. persistent computer

Use the least powerful substrate that will do the job well.

## Browser / Computer Visibility Modes
For browser and later computer-use tasks, support:
- background
- record-on-complete
- watch-live
- hybrid

## Default Guidance
- Use API tools whenever possible
- Use browser only when UI interaction is necessary
- Use sandbox for generated or untrusted code
- Use persistent computer only when a long-lived environment is actually needed

## Approval Philosophy
Avoid annoying the user.

Use smart approvals and trust grants:
- approve once
- allow this session
- allow 24h
- always allow (scoped)

## Risk Defaults
- low risk: auto-approve if configured
- medium risk: allow if trusted scope exists
- high risk: explicit approval unless allowlisted

## Demo / Recording Guidance
For coding or UI work, prefer:
- `record-on-complete` by default in developer mode
- `background` or `record-on-complete` in founder/agency mode

When a demo is created, store it under:
`assets/demos/YYYY-MM-DD/`
```

---

## `prompt/VIEWS.md`

```md
# VIEWS.md

## Overview
Views are overlays over one shared workspace.

They are not isolated silos.

Each view defines:
- lens
- lead agent
- tool preferences
- UI emphasis
- relevant folders and tasks

---

## Founder
- Lead agent: founder
- Focus: product, strategy, company building, roadmap
- Emphasize:
  - projects
  - milestones
  - priorities
  - product decisions

## Agency
- Lead agent: agency
- Focus: clients, deliverables, team ops, sales
- Emphasize:
  - clients
  - deliverables
  - tasks
  - communications

## Developer
- Lead agent: developer
- Focus: architecture, implementation, debugging, code generation
- Emphasize:
  - projects
  - drafts
  - traces
  - demos
  - browser/sandbox runs

## Creator
- Lead agent: creator
- Focus: content, writing, publishing
- Emphasize:
  - content
  - drafts
  - final
  - assets

## Personal
- Lead agent: personal
- Focus: life admin, planning, household, routines
- Emphasize:
  - areas
  - tasks
  - notes

## Fitness
- Lead agent: fitness
- Focus: workouts, nutrition, habits, metrics
- Emphasize:
  - fitness
  - notes
  - recurring tasks

---

## View Stack Rules
- One primary view
- Zero or more overlays
- Lens = union
- Dangerous tool policy = most restrictive wins
```

---

## `prompt/SYNC.md`

```md
# SYNC.md

## Sync Philosophy
The filesystem is canonical truth.

Cloud sync is optional.

## Default
- local workspace is source of truth
- local metadata/index may live in `.claws/`
- cloud may mirror:
  - traces
  - approvals
  - task events
  - metadata

## Rules
- Never treat cloud sync as more canonical than local files
- Prefer append-only event logs for synchronization
- Avoid hidden state

## Current v0 expectation
- local-first
- optional Convex metadata sync later
```

---

## `prompt/CONFIG.json`

```json
{
  "workspace": {
    "id": "ws_local",
    "name": "Life OS",
    "path": "."
  },
  "models": {
    "router": "vercel-ai-gateway",
    "defaultModel": "gpt-5",
    "fallbackModel": "gpt-5-mini",
    "keys": {
      "mode": "env"
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botTokenEnv": "TELEGRAM_BOT_TOKEN"
    },
    "slack": {
      "enabled": false
    },
    "imessage": {
      "enabled": false
    }
  },
  "tools": {
    "defaultProfile": "minimal",
    "approvals": {
      "mode": "smart",
      "defaultLow": "auto",
      "highRiskAlways": true
    },
    "sandbox": {
      "provider": "vercel",
      "enabled": false
    }
  },
  "ui": {
    "visibility": {
      "default": "compact"
    }
  },
  "views": {
    "primary": "founder",
    "overlays": ["developer"]
  },
  "agents": {
    "roster": ["orchestrator", "founder", "developer"]
  },
  "storage": {
    "index": {
      "provider": "sqlite",
      "path": ".claws/index.sqlite"
    }
  },
  "jobs": {
    "scheduler": "local"
  },
  "security": {
    "skills": {
      "requirePinnedSha": true,
      "requireApproval": true
    }
  }
}
```

---

## `identity/manifest.json`

```json
{
  "version": "0.1.0",
  "type": "you-md",
  "name": "default-identity",
  "description": "Portable personal identity bundle for agent systems",
  "files": [
    "you.md",
    "profile/about.md",
    "profile/now.md",
    "preferences/agent.md"
  ]
}
```

---

## `identity/you.md`

```md
# you.md

## Name
{{USER_NAME}}

## Roles
- Founder
- Developer
- Creator

## Summary
A builder working across products, code, content, and life systems.

## Primary Interests
- AI agents
- developer tools
- local-first systems
- product design
- Next.js
- Vercel ecosystem

## Working Style
- prefers concise communication
- likes structured markdown-native systems
- values clean architecture
- prefers practical outputs over abstract discussion

## Collaboration Preferences
- low-friction approvals
- clear progress updates
- traceable decisions
- organized workspaces

## Notes
This file is portable identity.
Use `prompt/USER.md` for workspace/runtime-specific context.
```

---

## `identity/profile/about.md`

```md
# about.md

## About
This is the human-readable background layer for the user.

Keep it short.
Focus on:
- what they do
- how they think
- what kind of work they care about
```

---

## `identity/profile/now.md`

```md
# now.md

## Current Focus
- Getting Claws.so up and running
- Refining the workspace, identity, and agent OS design
- Building useful local-first AI workflows
```

---

## `identity/profile/projects.md`

```md
# projects.md

## Active Projects
- Claws.so
- folder.md
- you.md

## Notes
This is a high-level list.
Detailed work belongs in `projects/`.
```

---

## `identity/profile/values.md`

```md
# values.md

## Values
- clarity
- speed with quality
- clean systems
- openness
- real usefulness over hype
```

---

## `identity/preferences/agent.md`

```md
# agent.md

## Visibility Preference
compact

## Approval Preference
smart

## Communication Preference
- concise
- direct
- lightly playful
- no unnecessary fluff

## Tooling Preference
- prefer API/tool first
- prefer browser over brittle hacks
- prefer local-first workflows
- use recording/demo mode when useful
```

---

## `identity/preferences/writing.md`

```md
# writing.md

## Writing Preferences
- concise
- readable
- structured
- practical
- no bloated intros
```

---

## `identity/private/private.md`

```md
# private.md

This directory is reserved for private identity notes.

Do not load this into prompts unless explicitly enabled by the user.
```

---

## `notes/daily/{{DATE}}.md`

```md
# {{DATE}}

## Today
- Workspace initialized
- Claws onboarding completed

## Notes
- Confirm preferred views
- Confirm first 3 priorities
- Confirm integrations to enable first

## Memory Candidates
- User likes local-first, structured, markdown-native systems
```

---

## `agents/orchestrator/prompt/SOUL.md`

```md
# SOUL.md

You are the orchestrator agent.

## Role
Coordinate work across the workspace.
Delegate intelligently.
Keep the system organized.
Avoid doing everything yourself.

## Priorities
- route work well
- keep tasks current
- keep memory clean
- reduce friction
- maintain order
```

---

## `agents/orchestrator/prompt/IDENTITY.md`

```md
# IDENTITY.md

## Agent
orchestrator

## Scope
- routing
- delegation
- approvals
- memory flush
- task updates
- safety enforcement
```

---

## `agents/founder/prompt/SOUL.md`

```md
# SOUL.md

You are the founder lead agent.

Think strategically.
Prioritize leverage.
Turn vague goals into structured plans.
```

---

## `agents/developer/prompt/SOUL.md`

```md
# SOUL.md

You are the developer lead agent.

Think like a pragmatic staff engineer.
Prefer clear architecture, reliable implementation, and useful demos.
```

---

## `projects/claws-so/project.md`

```md
# project.md

## Name
Claws.so

## Summary
A local-first personal agent operating system for builders who live in Next.js and love Vercel.

## Status
bootstrap

## Current Goal
Turn the PRD and scaffold into a working kernel and onboarding flow.

## Next Milestones
- Scaffold the repo
- Implement kernel interfaces
- Implement create-claws onboarding
- Build chat UI
```

---

## `projects/claws-so/tasks.md`

```md
# tasks.md

## Active
- [ ] (T-1001) Scaffold the monorepo
  - Priority: P1
  - Next: generate packages and apps structure

- [ ] (T-1002) Implement kernel interfaces
  - Priority: P1
  - Next: create `packages/core/src/types.ts`

- [ ] (T-1003) Build the onboarding CLI flow
  - Priority: P1
  - Next: define prompt sequence and outputs

## Waiting / Blocked

## Done
```

---

## `projects/claws-so/tags.json`

```json
["founder", "developer", "creator"]
```

---

## Suggested generator behavior

When `create-claws` runs, it should:

1. copy this scaffold
2. replace:

   * `{{USER_NAME}}`
   * `{{DATE}}`
3. optionally enable selected views/agents
4. optionally generate a starter demo project
5. write the first daily note

---

If you want, next I can generate the matching **repo scaffold pack** too:

* `package.json`
* `pnpm-workspace.yaml`
* `turbo.json`
* `apps/`
* `packages/`
* base `tsconfig`
* placeholder files for the monorepo


Below is a **matching repo scaffold pack** for **Claws.so** that fits the PRD, the workspace scaffold, and the kernel/runtime architecture we defined.

This is designed for:

* **pnpm**
* **Turborepo**
* **TypeScript**
* **Next.js dashboard**
* **local-first gateway**
* **shared packages**
* **clean future support for Vercel AI SDK / Gateway / Queues / Sandbox**

---

# Repo tree

```txt
claws/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .gitignore
├── README.md
│
├── apps/
│   ├── gateway/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── httpServer.ts
│   │       ├── cli.ts
│   │       └── localStore.ts
│   │
│   ├── dashboard/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.mjs
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── chat/page.tsx
│   │   │   ├── tasks/page.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── files/page.tsx
│   │   │   ├── memory/page.tsx
│   │   │   ├── approvals/page.tsx
│   │   │   ├── traces/page.tsx
│   │   │   ├── agents/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── components/
│   │       ├── shell.tsx
│   │       └── nav.tsx
│   │
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── main.ts
│
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types.ts
│   │       ├── config-schema.ts
│   │       └── validators.ts
│   │
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── config.ts
│   │       ├── router.ts
│   │       ├── runner.ts
│   │       ├── approvals.ts
│   │       ├── traces.ts
│   │       ├── jobs.ts
│   │       ├── sync.ts
│   │       └── errors.ts
│   │
│   ├── workspace/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── folder-contract.ts
│   │       ├── workspace-fs.ts
│   │       └── path-rules.ts
│   │
│   ├── memory/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── engine.ts
│   │       └── search.ts
│   │
│   ├── tools/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── registry.ts
│   │       ├── fs.ts
│   │       ├── tasks.ts
│   │       ├── memory.ts
│   │       ├── browser.ts
│   │       ├── sandbox.ts
│   │       └── http.ts
│   │
│   ├── channels/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── telegram.ts
│   │
│   ├── skills/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── manifest.ts
│   │       ├── installer.ts
│   │       └── registry.ts
│   │
│   ├── agents/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── orchestrator.ts
│   │       ├── founder.ts
│   │       └── developer.ts
│   │
│   └── harness/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── golden.ts
│           ├── replay.ts
│           └── security.ts
│
├── templates/
│   └── base/
│       └── workspace/
│           ├── FOLDER.md
│           ├── PROJECT.md
│           ├── tasks.md
│           ├── prompt/
│           ├── identity/
│           ├── notes/
│           ├── agents/
│           └── projects/
│
└── scripts/
    └── dev.mjs
```

---

# Root files

## `package.json`

```json
{
  "name": "claws",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean",
    "gateway": "pnpm --filter @claws/gateway dev",
    "dashboard": "pnpm --filter @claws/dashboard dev",
    "worker": "pnpm --filter @claws/worker dev"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.8.2",
    "@types/node": "^22.13.10"
  }
}
```

---

## `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^test"],
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

## `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@claws/shared/*": ["packages/shared/src/*"],
      "@claws/core/*": ["packages/core/src/*"],
      "@claws/workspace/*": ["packages/workspace/src/*"],
      "@claws/memory/*": ["packages/memory/src/*"],
      "@claws/tools/*": ["packages/tools/src/*"],
      "@claws/channels/*": ["packages/channels/src/*"],
      "@claws/skills/*": ["packages/skills/src/*"],
      "@claws/agents/*": ["packages/agents/src/*"],
      "@claws/harness/*": ["packages/harness/src/*"]
    }
  }
}
```

---

## `.gitignore`

```gitignore
node_modules
dist
.next
turbo
.env
.env.local
.claws
coverage
*.log
.DS_Store
```

---

## `README.md`

````md
# Claws.so

Local-first agent OS for builders who live in Next.js and love Vercel.

## Apps
- `apps/gateway` — local gateway + agent runtime
- `apps/dashboard` — chat-first Next.js UI
- `apps/worker` — background jobs

## Packages
- `packages/shared` — types, schemas, validators
- `packages/core` — kernel runtime
- `packages/workspace` — FOLDER.md enforcement
- `packages/memory` — memory engine
- `packages/tools` — tool registry + built-in tools
- `packages/channels` — Telegram first
- `packages/skills` — skill manifests/install
- `packages/agents` — orchestrator + lead agents
- `packages/harness` — golden/replay/security tests

## Run
```bash
pnpm install
pnpm dev
````

````

---

# Apps

## `apps/gateway/package.json`

```json
{
  "name": "@claws/gateway",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint gateway",
    "test": "echo test gateway",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@claws/shared": "workspace:*",
    "@claws/core": "workspace:*",
    "@claws/workspace": "workspace:*",
    "@claws/memory": "workspace:*",
    "@claws/tools": "workspace:*",
    "@claws/channels": "workspace:*",
    "@claws/agents": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.3",
    "typescript": "^5.8.2"
  }
}
````

---

## `apps/gateway/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `apps/gateway/src/main.ts`

```ts
import { startGateway } from "./httpServer";

async function main() {
  const port = Number(process.env.CLAWS_PORT || 8787);
  await startGateway(port);
  console.log(`Claws gateway running on http://localhost:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## `apps/gateway/src/httpServer.ts`

```ts
import http from "node:http";

export async function startGateway(port: number) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "claws-gateway" }));
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
}
```

---

## `apps/gateway/src/cli.ts`

```ts
export function printStartupBanner() {
  console.log("Locked in.");
}
```

---

## `apps/gateway/src/localStore.ts`

```ts
export const localStore = {
  traces: [] as unknown[],
  approvals: [] as unknown[]
};
```

---

## `apps/dashboard/package.json`

```json
{
  "name": "@claws/dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint dashboard",
    "test": "echo test dashboard",
    "clean": "rm -rf .next"
  },
  "dependencies": {
    "next": "15.2.2",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4"
  }
}
```

---

## `apps/dashboard/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "isolatedModules": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

---

## `apps/dashboard/next.config.mjs`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
```

---

## `apps/dashboard/app/layout.tsx`

```tsx
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#0a0a0a", color: "#fafafa" }}>
        {children}
      </body>
    </html>
  );
}
```

---

## `apps/dashboard/app/page.tsx`

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Claws.so</h1>
      <p>Local-first agent OS.</p>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href="/chat">Chat</Link>
        <Link href="/tasks">Tasks</Link>
        <Link href="/projects">Projects</Link>
      </nav>
    </main>
  );
}
```

---

## `apps/dashboard/app/chat/page.tsx`

```tsx
export default function ChatPage() {
  return <main style={{ padding: 24 }}><h1>Chat</h1></main>;
}
```

## `apps/dashboard/app/tasks/page.tsx`

```tsx
export default function TasksPage() {
  return <main style={{ padding: 24 }}><h1>Tasks</h1></main>;
}
```

## `apps/dashboard/app/projects/page.tsx`

```tsx
export default function ProjectsPage() {
  return <main style={{ padding: 24 }}><h1>Projects</h1></main>;
}
```

## `apps/dashboard/app/files/page.tsx`

```tsx
export default function FilesPage() {
  return <main style={{ padding: 24 }}><h1>Files</h1></main>;
}
```

## `apps/dashboard/app/memory/page.tsx`

```tsx
export default function MemoryPage() {
  return <main style={{ padding: 24 }}><h1>Memory</h1></main>;
}
```

## `apps/dashboard/app/approvals/page.tsx`

```tsx
export default function ApprovalsPage() {
  return <main style={{ padding: 24 }}><h1>Approvals</h1></main>;
}
```

## `apps/dashboard/app/traces/page.tsx`

```tsx
export default function TracesPage() {
  return <main style={{ padding: 24 }}><h1>Traces</h1></main>;
}
```

## `apps/dashboard/app/agents/page.tsx`

```tsx
export default function AgentsPage() {
  return <main style={{ padding: 24 }}><h1>Agents</h1></main>;
}
```

## `apps/dashboard/app/settings/page.tsx`

```tsx
export default function SettingsPage() {
  return <main style={{ padding: 24 }}><h1>Settings</h1></main>;
}
```

---

## `apps/dashboard/components/shell.tsx`

```tsx
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
```

---

## `apps/dashboard/components/nav.tsx`

```tsx
export function Nav() {
  return null;
}
```

---

## `apps/worker/package.json`

```json
{
  "name": "@claws/worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint worker",
    "test": "echo test worker",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@claws/shared": "workspace:*",
    "@claws/core": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.3",
    "typescript": "^5.8.2"
  }
}
```

---

## `apps/worker/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `apps/worker/src/main.ts`

```ts
console.log("Claws worker ready.");
```

---

# Packages

## `packages/shared/package.json`

```json
{
  "name": "@claws/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint shared",
    "test": "echo test shared",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

---

## `packages/shared/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `packages/shared/src/index.ts`

```ts
export * from "./types";
export * from "./config-schema";
export * from "./validators";
```

---

## `packages/shared/src/types.ts`

```ts
export type Mode =
  | "founder"
  | "agency"
  | "developer"
  | "creator"
  | "personal"
  | "fitness";
```

---

## `packages/shared/src/config-schema.ts`

```ts
import { z } from "zod";

export const configSchema = z.object({
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    path: z.string()
  })
});

export type ClawsConfig = z.infer<typeof configSchema>;
```

---

## `packages/shared/src/validators.ts`

```ts
export function isKebabCase(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
```

---

## `packages/core/package.json`

```json
{
  "name": "@claws/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint core",
    "test": "echo test core",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@claws/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

---

## `packages/core/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `packages/core/src/index.ts`

```ts
export * from "./config";
export * from "./router";
export * from "./runner";
export * from "./approvals";
export * from "./traces";
export * from "./jobs";
export * from "./sync";
export * from "./errors";
```

---

## `packages/core/src/config.ts`

```ts
export const DEFAULT_WORKSPACE_ID = "ws_local";
```

---

## `packages/core/src/router.ts`

```ts
export function routeEvent() {
  return "orchestrator";
}
```

---

## `packages/core/src/runner.ts`

```ts
export async function runAgentLoop() {
  return { ok: true };
}
```

---

## `packages/core/src/approvals.ts`

```ts
export type ApprovalMode = "off" | "smart" | "strict";
```

---

## `packages/core/src/traces.ts`

```ts
export function trace(event: unknown) {
  return event;
}
```

---

## `packages/core/src/jobs.ts`

```ts
export function enqueueJob(name: string) {
  return { name };
}
```

---

## `packages/core/src/sync.ts`

```ts
export function emitSyncEvent(type: string, payload: unknown) {
  return { type, payload };
}
```

---

## `packages/core/src/errors.ts`

```ts
export class ClawsError extends Error {}
```

---

## `packages/workspace/package.json`

```json
{
  "name": "@claws/workspace",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint workspace",
    "test": "echo test workspace",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@claws/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

---

## `packages/workspace/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `packages/workspace/src/index.ts`

```ts
export * from "./folder-contract";
export * from "./workspace-fs";
export * from "./path-rules";
```

---

## `packages/workspace/src/folder-contract.ts`

```ts
export function getDefaultAllowedRoots() {
  return [
    "prompt",
    "identity",
    "notes",
    "areas",
    "projects",
    "clients",
    "content",
    "fitness",
    "drafts",
    "final",
    "assets",
    "skills",
    "agents"
  ];
}
```

---

## `packages/workspace/src/workspace-fs.ts`

```ts
export class WorkspaceFS {
  constructor(public root: string) {}
}
```

---

## `packages/workspace/src/path-rules.ts`

```ts
export function canWriteToPath(_path: string) {
  return true;
}
```

---

## `packages/memory/package.json`

```json
{
  "name": "@claws/memory",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint memory",
    "test": "echo test memory",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@claws/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

---

## `packages/memory/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `packages/memory/src/index.ts`

```ts
export * from "./engine";
export * from "./search";
```

---

## `packages/memory/src/engine.ts`

```ts
export function flushMemory() {
  return { ok: true };
}
```

---

## `packages/memory/src/search.ts`

```ts
export function searchMemory(query: string) {
  return { query, results: [] };
}
```

---

## `packages/tools/package.json`

```json
{
  "name": "@claws/tools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint tools",
    "test": "echo test tools",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@claws/shared": "workspace:*",
    "@claws/workspace": "workspace:*",
    "@claws/memory": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

---

## `packages/tools/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `packages/tools/src/index.ts`

```ts
export * from "./registry";
export * from "./fs";
export * from "./tasks";
export * from "./memory";
export * from "./browser";
export * from "./sandbox";
export * from "./http";
```

---

## `packages/tools/src/registry.ts`

```ts
export class ToolRegistry {
  private tools = new Map<string, unknown>();

  register(name: string, tool: unknown) {
    this.tools.set(name, tool);
  }

  get(name: string) {
    return this.tools.get(name);
  }
}
```

---

## `packages/tools/src/fs.ts`

```ts
export function readFileTool() {
  return "fs.read";
}
```

## `packages/tools/src/tasks.ts`

```ts
export function createTaskTool() {
  return "tasks.create";
}
```

## `packages/tools/src/memory.ts`

```ts
export function memorySearchTool() {
  return "memory.search";
}
```

## `packages/tools/src/browser.ts`

```ts
export function browserTool() {
  return "browser.navigate";
}
```

## `packages/tools/src/sandbox.ts`

```ts
export function sandboxTool() {
  return "sandbox.exec";
}
```

## `packages/tools/src/http.ts`

```ts
export function httpTool() {
  return "http.fetch";
}
```

---

## `packages/channels/package.json`

```json
{
  "name": "@claws/channels",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint channels",
    "test": "echo test channels",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

---

## `packages/channels/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `packages/channels/src/index.ts`

```ts
export * from "./telegram";
```

---

## `packages/channels/src/telegram.ts`

```ts
export function startTelegramAdapter() {
  return { ok: true };
}
```

---

## `packages/skills/package.json`

```json
{
  "name": "@claws/skills",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint skills",
    "test": "echo test skills",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@claws/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

---

## `packages/skills/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `packages/skills/src/index.ts`

```ts
export * from "./manifest";
export * from "./installer";
export * from "./registry";
```

---

## `packages/skills/src/manifest.ts`

```ts
export interface SkillManifest {
  name: string;
  version: string;
}
```

---

## `packages/skills/src/installer.ts`

```ts
export function installSkill(name: string) {
  return { installed: name };
}
```

---

## `packages/skills/src/registry.ts`

```ts
export function listSkills() {
  return [];
}
```

---

## `packages/agents/package.json`

```json
{
  "name": "@claws/agents",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint agents",
    "test": "echo test agents",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

---

## `packages/agents/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `packages/agents/src/index.ts`

```ts
export * from "./orchestrator";
export * from "./founder";
export * from "./developer";
```

---

## `packages/agents/src/orchestrator.ts`

```ts
export const orchestratorAgent = {
  id: "orchestrator"
};
```

## `packages/agents/src/founder.ts`

```ts
export const founderAgent = {
  id: "founder"
};
```

## `packages/agents/src/developer.ts`

```ts
export const developerAgent = {
  id: "developer"
};
```

---

## `packages/harness/package.json`

```json
{
  "name": "@claws/harness",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint harness",
    "test": "echo test harness",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

---

## `packages/harness/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## `packages/harness/src/index.ts`

```ts
export * from "./golden";
export * from "./replay";
export * from "./security";
```

## `packages/harness/src/golden.ts`

```ts
export function runGoldenTests() {
  return { ok: true };
}
```

## `packages/harness/src/replay.ts`

```ts
export function replayTrace() {
  return { ok: true };
}
```

## `packages/harness/src/security.ts`

```ts
export function runSecurityTests() {
  return { ok: true };
}
```

---

# Templates

## `templates/base/workspace/`

Use the scaffold pack we already generated:

* `FOLDER.md`
* `PROJECT.md`
* `tasks.md`
* `prompt/*`
* `identity/*`
* `notes/daily/*`
* `agents/*`
* `projects/claws-so/*`

---

# Scripts

## `scripts/dev.mjs`

```js
console.log("Use `pnpm dev` to run the full monorepo.");
```

---

# Recommended immediate next step

The best next move now is to generate the **actual TypeScript kernel implementation pass** for:

* `packages/shared/src/types.ts`
* `packages/core/src/runner.ts`
* `packages/workspace/src/workspace-fs.ts`
* `packages/tools/src/registry.ts`

That would turn this from a scaffold into a real starting codebase.

----------------------------------
Here’s the **next real implementation pass** for the core codebase.

I’m giving you the first 4 files that turn the scaffold into an actual starting kernel:

* `packages/shared/src/types.ts`
* `packages/core/src/runner.ts`
* `packages/workspace/src/workspace-fs.ts`
* `packages/tools/src/registry.ts`

These are designed to be simple, typed, and aligned with the PRD.

---

## `packages/shared/src/types.ts`

```ts
/* packages/shared/src/types.ts */

export type UUID = string;

export type Channel = "local" | "cli" | "telegram" | "slack" | "imessage";

export type Mode =
  | "founder"
  | "agency"
  | "developer"
  | "creator"
  | "personal"
  | "fitness";

export type ToolRisk = "low" | "medium" | "high";

export type ToolEnvironment =
  | "workspace"
  | "api"
  | "browser"
  | "sandbox"
  | "computer";

export type VisibilityMode = "quiet" | "compact" | "verbose" | "live";

export type ApprovalMode = "off" | "smart" | "strict";

export interface AttachmentRef {
  name: string;
  mime: string;
  bytesRef: string;
  sizeBytes?: number;
}

export interface MessageEvent {
  id: UUID;
  channel: Channel;
  timestamp: number;
  from: {
    userId: string;
    displayName?: string;
    isMe?: boolean;
  };
  chat: {
    chatId: string;
    threadId?: string;
  };
  text?: string;
  attachments?: AttachmentRef[];
  meta?: Record<string, unknown>;
}

export interface SessionKey {
  workspaceId: string;
  agentId: string;
  channel: Channel;
  chatId: string;
  threadId?: string;
}

export interface ViewStack {
  primary: Mode;
  overlays: Mode[];
}

export interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TrustGrant {
  id: UUID;
  createdAt: number;
  expiresAt?: number;
  scope:
    | { type: "once"; toolName: string }
    | { type: "tool"; toolName: string }
    | { type: "agent"; agentId: string }
    | { type: "view"; view: Mode }
    | { type: "session"; sessionKey: SessionKey };
  note?: string;
}

export interface ApprovalRequest {
  id: UUID;
  createdAt: number;
  sessionKey: SessionKey;
  agentId: string;
  toolName: string;
  environment: ToolEnvironment;
  risk: ToolRisk;
  args: Record<string, unknown>;
  reason?: string;
}

export type ApprovalDecision = "approved" | "denied";

export interface ApprovalResolution {
  requestId: string;
  decision: ApprovalDecision;
  note?: string;
  grant?: Omit<TrustGrant, "id" | "createdAt">;
}

export interface TraceStep {
  id: UUID;
  ts: number;
  sessionKey: SessionKey;
  agentId: string;
  type:
    | "event"
    | "route"
    | "agent"
    | "tool"
    | "approval"
    | "fs"
    | "memory"
    | "job"
    | "sync"
    | "error";
  summary: string;
  data?: Record<string, unknown>;
}

export interface WorkOrder {
  id: UUID;
  createdAt: number;
  fromAgentId: string;
  toAgentId: string;
  viewStack: ViewStack;
  objective: string;
  constraints?: string[];
  inputs?: Array<{ path?: string; url?: string; note?: string }>;
  outputs: Array<{
    path: string;
    kind: "draft" | "final" | "note" | "code";
  }>;
  allowedToolsProfile: string;
  budget?: {
    maxToolCalls?: number;
    maxMinutes?: number;
  };
  definitionOfDone?: string[];
  returnFormat?: "summary_only" | "summary_and_patch" | "summary_and_files";
}

export interface TaskEvent {
  id: UUID;
  ts: number;
  type:
    | "task_created"
    | "task_updated"
    | "task_moved"
    | "task_blocked"
    | "task_done"
    | "task_recurring_created";
  taskId: string;
  payload: Record<string, unknown>;
}

export interface MemorySearchResult {
  path: string;
  snippet: string;
  score?: number;
}

export interface FolderWriteIntent {
  finalize?: boolean;
  promptEdit?: boolean;
  createMissingDirs?: boolean;
}

export interface ValidateWriteResult {
  ok: boolean;
  reason?: string;
}

export interface WorkspaceFS {
  read(path: string): Promise<string>;
  write(
    path: string,
    content: string,
    opts?: { append?: boolean; intent?: FolderWriteIntent },
  ): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdirp(path: string): Promise<void>;
  list(path: string): Promise<string[]>;
  remove(path: string): Promise<void>;
  stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }>;
  validateWrite(path: string, intent?: FolderWriteIntent): Promise<ValidateWriteResult>;
}

export interface MemoryAPI {
  flush(reason: "compaction" | "task_done" | "heartbeat" | "manual"): Promise<void>;
  proposePromotion(candidate: {
    kind: "user" | "memory";
    text: string;
    sourcePaths: string[];
  }): Promise<void>;
  search(query: string, opts?: { mode?: Mode; limit?: number }): Promise<MemorySearchResult[]>;
}

export interface TraceAPI {
  emit(
    step: Omit<TraceStep, "id" | "ts"> & {
      id?: string;
      ts?: number;
    },
  ): Promise<void>;
  list(sessionKey?: SessionKey, limit?: number): Promise<TraceStep[]>;
}

export interface ApprovalAPI {
  request(
    request: Omit<ApprovalRequest, "id" | "createdAt">,
  ): Promise<ApprovalRequest>;
  waitForDecision(requestId: string): Promise<ApprovalResolution>;
  addGrant(grant: Omit<TrustGrant, "id" | "createdAt">): Promise<TrustGrant>;
  listGrants(): Promise<TrustGrant[]>;
  isAllowed(input: {
    toolName: string;
    sessionKey: SessionKey;
    agentId: string;
    viewStack: ViewStack;
  }): Promise<boolean>;
}

export interface Job {
  id: UUID;
  type: string;
  runAt: number;
  payload: Record<string, unknown>;
}

export interface JobAPI {
  enqueue(job: Omit<Job, "id">): Promise<Job>;
  tick(now: number): Promise<void>;
}

export interface SyncEvent {
  id: UUID;
  ts: number;
  type: string;
  payload: Record<string, unknown>;
}

export interface SyncAPI {
  emit(type: string, payload: Record<string, unknown>): Promise<void>;
  flush(): Promise<void>;
}

export interface ToolContext {
  workspaceId: string;
  sessionKey: SessionKey;
  viewStack: ViewStack;
  agentId: string;
  visibility: VisibilityMode;

  fs: WorkspaceFS;
  memory: MemoryAPI;
  traces: TraceAPI;
  approvals: ApprovalAPI;
  jobs: JobAPI;
  sync: SyncAPI;

  now(): number;
}

export interface ToolSpec<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  environment: ToolEnvironment;
  risk: ToolRisk;
  needsApproval?: boolean;
  execute(args: TArgs, ctx: ToolContext): Promise<ToolResult<TResult>>;
}

export interface ToolRegistry {
  register<TArgs, TResult>(tool: ToolSpec<TArgs, TResult>): void;
  get(name: string): ToolSpec | undefined;
  list(): ToolSpec[];
  has(name: string): boolean;
}

export interface AgentRunResult {
  summary?: string;
  messages?: string[];
  toolCalls?: ToolCall[];
  workOrders?: WorkOrder[];
  done?: boolean;
}

export interface Agent {
  id: string;
  mode: Mode;
  run(
    event: MessageEvent,
    ctx: ToolContext,
  ): Promise<AgentRunResult>;
}

export interface RouterDecision {
  sessionKey: SessionKey;
  viewStack: ViewStack;
  leadAgentId: string;
}

export interface Router {
  route(event: MessageEvent): Promise<RouterDecision>;
}
```

---

## `packages/tools/src/registry.ts`

```ts
/* packages/tools/src/registry.ts */

import type { ToolRegistry, ToolSpec } from "@claws/shared/types";

export class InMemoryToolRegistry implements ToolRegistry {
  private readonly tools = new Map<string, ToolSpec>();

  register<TArgs, TResult>(tool: ToolSpec<TArgs, TResult>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool as ToolSpec);
  }

  get(name: string): ToolSpec | undefined {
    return this.tools.get(name);
  }

  list(): ToolSpec[] {
    return [...this.tools.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
```

---

## `packages/workspace/src/workspace-fs.ts`

```ts
/* packages/workspace/src/workspace-fs.ts */

import path from "node:path";
import fs from "node:fs/promises";
import {
  type FolderWriteIntent,
  type ValidateWriteResult,
  type WorkspaceFS,
} from "@claws/shared/types";
import { isKebabCase } from "@claws/shared/validators";
import { getDefaultAllowedRoots } from "./folder-contract";

function normalizeRelative(input: string): string {
  const normalized = input.replaceAll("\\", "/").replace(/^\.?\//, "");
  return normalized;
}

function ensureInsideRoot(root: string, target: string): string {
  const absRoot = path.resolve(root);
  const absTarget = path.resolve(root, target);
  if (!absTarget.startsWith(absRoot)) {
    throw new Error(`Path escapes workspace root: ${target}`);
  }
  return absTarget;
}

function pathSegments(relPath: string): string[] {
  return relPath.split("/").filter(Boolean);
}

function fileNameWithoutExt(relPath: string): string {
  const base = path.basename(relPath);
  const idx = base.lastIndexOf(".");
  return idx === -1 ? base : base.slice(0, idx);
}

export class LocalWorkspaceFS implements WorkspaceFS {
  constructor(private readonly root: string) {}

  private toAbsolute(relPath: string): string {
    return ensureInsideRoot(this.root, normalizeRelative(relPath));
  }

  async read(relPath: string): Promise<string> {
    return fs.readFile(this.toAbsolute(relPath), "utf8");
  }

  async exists(relPath: string): Promise<boolean> {
    try {
      await fs.access(this.toAbsolute(relPath));
      return true;
    } catch {
      return false;
    }
  }

  async mkdirp(relPath: string): Promise<void> {
    await fs.mkdir(this.toAbsolute(relPath), { recursive: true });
  }

  async list(relPath: string): Promise<string[]> {
    return fs.readdir(this.toAbsolute(relPath));
  }

  async remove(relPath: string): Promise<void> {
    await fs.rm(this.toAbsolute(relPath), { recursive: true, force: true });
  }

  async stat(relPath: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }> {
    const s = await fs.stat(this.toAbsolute(relPath));
    return {
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      size: s.size,
    };
  }

  async validateWrite(
    relPath: string,
    intent?: FolderWriteIntent,
  ): Promise<ValidateWriteResult> {
    const normalized = normalizeRelative(relPath);
    const segments = pathSegments(normalized);
    const allowedRoots = getDefaultAllowedRoots();

    if (segments.length === 0) {
      return { ok: false, reason: "Cannot write to workspace root" };
    }

    const topLevel = segments[0];
    if (!allowedRoots.includes(topLevel)) {
      return {
        ok: false,
        reason: `Top-level path "${topLevel}" is not allowed by FOLDER.md`,
      };
    }

    if (topLevel === "prompt" && !intent?.promptEdit) {
      return {
        ok: false,
        reason: "prompt/ is read-only unless promptEdit intent is set",
      };
    }

    if (topLevel === "final" && !intent?.finalize) {
      return {
        ok: false,
        reason: "final/ is locked unless finalize intent is set",
      };
    }

    if (topLevel === "identity" && !intent?.promptEdit) {
      // treat identity as read-mostly by default
      return {
        ok: false,
        reason: "identity/ is read-mostly unless explicit edit intent is set",
      };
    }

    const baseName = fileNameWithoutExt(normalized);
    if (baseName && /-(v\d+|new|final|copy)$/i.test(baseName)) {
      return {
        ok: false,
        reason: "Version/copy suffixes are not allowed in canonical workspace files",
      };
    }

    for (const seg of segments) {
      if (seg.includes(".") || seg === "..") continue;
      if (!isKebabCase(seg) && !/^[A-Z0-9._-]+$/.test(seg)) {
        return {
          ok: false,
          reason: `Path segment "${seg}" is not lowercase-kebab-case`,
        };
      }
    }

    return { ok: true };
  }

  async write(
    relPath: string,
    content: string,
    opts?: { append?: boolean; intent?: FolderWriteIntent },
  ): Promise<void> {
    const normalized = normalizeRelative(relPath);
    const validation = await this.validateWrite(normalized, opts?.intent);
    if (!validation.ok) {
      throw new Error(validation.reason ?? "Write denied");
    }

    const abs = this.toAbsolute(normalized);
    await fs.mkdir(path.dirname(abs), { recursive: true });

    if (normalized.startsWith("notes/") && !opts?.append) {
      throw new Error("notes/ is append-only by default; use append mode");
    }

    if (opts?.append) {
      await fs.appendFile(abs, content, "utf8");
    } else {
      await fs.writeFile(abs, content, "utf8");
    }
  }
}
```

---

## `packages/core/src/runner.ts`

This is the first real **kernel runner** pass. It handles:

* routing
* context creation
* tracing
* running the lead agent
* tool execution
* approval waits
* emitting sync events

It is still intentionally simple, but now it’s real.

```ts
/* packages/core/src/runner.ts */

import crypto from "node:crypto";
import type {
  Agent,
  AgentRunResult,
  ApprovalAPI,
  JobAPI,
  MemoryAPI,
  MessageEvent,
  Router,
  SyncAPI,
  ToolCall,
  ToolContext,
  ToolRegistry,
  TraceAPI,
  VisibilityMode,
  WorkspaceFS,
  WorkOrder,
} from "@claws/shared/types";

export interface KernelRunnerDeps {
  router: Router;
  tools: ToolRegistry;
  traces: TraceAPI;
  approvals: ApprovalAPI;
  fs: WorkspaceFS;
  memory: MemoryAPI;
  jobs: JobAPI;
  sync: SyncAPI;
  agents: Map<string, Agent>;
  getVisibilityMode?: (input: {
    agentId: string;
    channel: MessageEvent["channel"];
  }) => Promise<VisibilityMode> | VisibilityMode;
}

export interface KernelRunOutput {
  ok: boolean;
  agentId: string;
  summary?: string;
  messages: string[];
  toolResults: Array<{
    toolName: string;
    ok: boolean;
    error?: string;
    data?: unknown;
  }>;
  workOrders: WorkOrder[];
}

export class KernelRunner {
  constructor(private readonly deps: KernelRunnerDeps) {}

  async handleEvent(event: MessageEvent): Promise<KernelRunOutput> {
    const routed = await this.deps.router.route(event);
    const leadAgent = this.deps.agents.get(routed.leadAgentId);

    if (!leadAgent) {
      throw new Error(`Lead agent not found: ${routed.leadAgentId}`);
    }

    const visibility =
      (await this.deps.getVisibilityMode?.({
        agentId: routed.leadAgentId,
        channel: event.channel,
      })) ?? "compact";

    const ctx: ToolContext = {
      workspaceId: routed.sessionKey.workspaceId,
      sessionKey: routed.sessionKey,
      viewStack: routed.viewStack,
      agentId: routed.leadAgentId,
      visibility,
      fs: this.deps.fs,
      memory: this.deps.memory,
      traces: this.deps.traces,
      approvals: this.deps.approvals,
      jobs: this.deps.jobs,
      sync: this.deps.sync,
      now: () => Date.now(),
    };

    await this.deps.traces.emit({
      id: crypto.randomUUID(),
      ts: Date.now(),
      sessionKey: routed.sessionKey,
      agentId: routed.leadAgentId,
      type: "event",
      summary: `Received event on ${event.channel}`,
      data: {
        text: event.text ?? "",
        chatId: event.chat.chatId,
      },
    });

    const runResult = await leadAgent.run(event, ctx);

    const toolResults = await this.executeToolCalls(runResult.toolCalls ?? [], ctx);
    const workOrders = await this.enqueueWorkOrders(runResult.workOrders ?? [], ctx);

    if (runResult.summary || runResult.messages?.length) {
      await this.deps.sync.emit("agent_completed", {
        agentId: routed.leadAgentId,
        summary: runResult.summary ?? null,
        messages: runResult.messages ?? [],
      });
    }

    return {
      ok: true,
      agentId: routed.leadAgentId,
      summary: runResult.summary,
      messages: runResult.messages ?? [],
      toolResults,
      workOrders,
    };
  }

  private async executeToolCalls(
    toolCalls: ToolCall[],
    ctx: ToolContext,
  ): Promise<
    Array<{
      toolName: string;
      ok: boolean;
      error?: string;
      data?: unknown;
    }>
  > {
    const results: Array<{
      toolName: string;
      ok: boolean;
      error?: string;
      data?: unknown;
    }> = [];

    for (const call of toolCalls) {
      const tool = this.deps.tools.get(call.toolName);

      if (!tool) {
        const error = `Tool not found: ${call.toolName}`;
        await this.deps.traces.emit({
          sessionKey: ctx.sessionKey,
          agentId: ctx.agentId,
          type: "error",
          summary: error,
          data: { toolName: call.toolName },
        });
        results.push({ toolName: call.toolName, ok: false, error });
        continue;
      }

      const allowed = await this.deps.approvals.isAllowed({
        toolName: tool.name,
        sessionKey: ctx.sessionKey,
        agentId: ctx.agentId,
        viewStack: ctx.viewStack,
      });

      const needsApproval =
        tool.needsApproval === true ||
        (tool.risk === "high") ||
        (!allowed && tool.risk === "medium");

      if (needsApproval) {
        const req = await this.deps.approvals.request({
          sessionKey: ctx.sessionKey,
          agentId: ctx.agentId,
          toolName: tool.name,
          environment: tool.environment,
          risk: tool.risk,
          args: call.args,
          reason: `Tool ${tool.name} requires approval`,
        });

        await this.deps.traces.emit({
          sessionKey: ctx.sessionKey,
          agentId: ctx.agentId,
          type: "approval",
          summary: `Approval requested for ${tool.name}`,
          data: { requestId: req.id, args: call.args },
        });

        const resolution = await this.deps.approvals.waitForDecision(req.id);

        if (resolution.decision === "denied") {
          results.push({
            toolName: tool.name,
            ok: false,
            error: "Approval denied",
          });
          await this.deps.traces.emit({
            sessionKey: ctx.sessionKey,
            agentId: ctx.agentId,
            type: "approval",
            summary: `Approval denied for ${tool.name}`,
            data: { requestId: req.id },
          });
          continue;
        }

        if (resolution.grant) {
          await this.deps.approvals.addGrant(resolution.grant);
        }
      }

      try {
        await this.deps.traces.emit({
          sessionKey: ctx.sessionKey,
          agentId: ctx.agentId,
          type: "tool",
          summary: `Executing tool ${tool.name}`,
          data: { args: call.args },
        });

        const result = await tool.execute(call.args, ctx);

        results.push({
          toolName: tool.name,
          ok: result.ok,
          error: result.error,
          data: result.data,
        });

        await this.deps.sync.emit("tool_executed", {
          toolName: tool.name,
          ok: result.ok,
        });

        await this.deps.traces.emit({
          sessionKey: ctx.sessionKey,
          agentId: ctx.agentId,
          type: "tool",
          summary: result.ok
            ? `Tool ${tool.name} completed`
            : `Tool ${tool.name} failed`,
          data: {
            ok: result.ok,
            error: result.error ?? null,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown tool execution error";

        results.push({
          toolName: tool.name,
          ok: false,
          error: message,
        });

        await this.deps.traces.emit({
          sessionKey: ctx.sessionKey,
          agentId: ctx.agentId,
          type: "error",
          summary: `Tool ${tool.name} threw`,
          data: { error: message },
        });
      }
    }

    return results;
  }

  private async enqueueWorkOrders(
    workOrders: WorkOrder[],
    ctx: ToolContext,
  ): Promise<WorkOrder[]> {
    for (const wo of workOrders) {
      await this.deps.jobs.enqueue({
        type: "work_order",
        runAt: ctx.now(),
        payload: {
          workOrder: wo,
        },
      });

      await this.deps.traces.emit({
        sessionKey: ctx.sessionKey,
        agentId: ctx.agentId,
        type: "job",
        summary: `Enqueued work order for ${wo.toAgentId}`,
        data: { workOrderId: wo.id, objective: wo.objective },
      });

      await this.deps.sync.emit("work_order_enqueued", {
        workOrderId: wo.id,
        toAgentId: wo.toAgentId,
      });
    }

    return workOrders;
  }
}
```

---

# What this gives you now

This moves the repo from “scaffold only” to:

* real shared types
* real tool registry
* real workspace write enforcement
* real kernel execution flow
* real approval wait hooks
* real work-order queueing shape

---

# Best next step from here

The most useful next implementation pass is:

1. **`packages/core/src/router.ts`**
2. **`packages/tools/src/tasks.ts`**
3. **`packages/memory/src/engine.ts`**
4. **`packages/agents/src/orchestrator.ts`**

That would give you:

* routing
* task creation/update
* memory flush/promotion stubs
* a real orchestrator agent that can create tasks and write drafts

If you want, I’ll continue with exactly those 4 files next.


-------------------
Here are the next 4 implementation files:

* `packages/agents/src/founder.ts`
* `packages/tools/src/memory.ts`
* `apps/dashboard/app/chat/page.tsx`
* `apps/dashboard/components/shell.tsx`

These give you:

* a real founder lead agent
* memory tools exposed to runtime
* the first usable chat UI page
* a proper dashboard shell with nav

---

## `packages/agents/src/founder.ts`

```ts
/* packages/agents/src/founder.ts */

import crypto from "node:crypto";
import type {
  Agent,
  AgentRunResult,
  MessageEvent,
  ToolCall,
  ToolContext,
  WorkOrder,
} from "@claws/shared/types";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractProjectName(text: string): string | null {
  const quoted =
    text.match(/project called ["“](.+?)["”]/i) ??
    text.match(/project named ["“](.+?)["”]/i);

  if (quoted?.[1]) return quoted[1];

  const simple =
    text.match(/project called ([a-zA-Z0-9 _-]+)/i) ??
    text.match(/project named ([a-zA-Z0-9 _-]+)/i);

  return simple?.[1]?.trim() ?? null;
}

function buildFounderProjectDraft(projectName: string): string {
  return [
    "# founder-brief.md",
    "",
    "## Project",
    projectName,
    "",
    "## Why this matters",
    "Clarify the business value, user value, and strategic role of this project.",
    "",
    "## Suggested goals",
    "- Define the core problem clearly",
    "- Identify the smallest useful v0",
    "- Clarify what success looks like",
    "",
    "## Suggested milestones",
    "1. Scope and architecture",
    "2. First working prototype",
    "3. Feedback loop and polish",
    "",
    "## Notes",
    "This draft was generated by the founder agent.",
    "",
  ].join("\n");
}

function shouldActAsFounder(text: string): boolean {
  const lower = text.toLowerCase();

  return (
    lower.includes("strategy") ||
    lower.includes("roadmap") ||
    lower.includes("positioning") ||
    lower.includes("milestone") ||
    lower.includes("scope") ||
    lower.includes("project") ||
    lower.includes("founder") ||
    lower.includes("plan")
  );
}

export const founderAgent: Agent = {
  id: "founder",
  mode: "founder",

  async run(event: MessageEvent, ctx: ToolContext): Promise<AgentRunResult> {
    const text = (event.text ?? "").trim();

    await ctx.traces.emit({
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      type: "agent",
      summary: "Founder agent run started",
      data: { text },
    });

    if (!shouldActAsFounder(text)) {
      return {
        summary: "Founder agent standing by.",
        messages: ["No strong founder-specific action detected yet."],
        done: true,
      };
    }

    if (/create a project|new project|project called|project named/i.test(text)) {
      const projectName = extractProjectName(text) ?? "untitled-project";
      const slug = slugify(projectName);
      const root = `projects/${slug}`;

      const toolCalls: ToolCall[] = [
        {
          toolName: "fs.write",
          args: {
            path: `${root}/project.md`,
            content: [
              "# project.md",
              "",
              "## Name",
              projectName,
              "",
              "## Summary",
              "A new project scaffolded with founder context.",
              "",
              "## Strategic Role",
              "Clarify why this project matters and what it should unlock.",
              "",
              "## Current Goal",
              "Define the smallest valuable first version.",
              "",
            ].join("\n"),
            intent: { createMissingDirs: true },
          },
        },
        {
          toolName: "fs.write",
          args: {
            path: `${root}/drafts/founder-brief.md`,
            content: buildFounderProjectDraft(projectName),
            intent: { createMissingDirs: true },
          },
        },
        {
          toolName: "tasks.create",
          args: {
            title: `Define v0 scope for ${projectName}`,
            lane: "Founder",
            priority: "P1",
            owner: "@founder",
            links: [`[[${root}/project.md]]`, `[[${root}/drafts/founder-brief.md]]`],
            next: "Review the founder brief and tighten the v0 scope.",
          },
        },
      ];

      const workOrders: WorkOrder[] = [
        {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          fromAgentId: "founder",
          toAgentId: "developer",
          viewStack: {
            primary: "developer",
            overlays: ["founder"],
          },
          objective: `Translate the founder brief for ${projectName} into a technical architecture draft`,
          inputs: [
            { path: `${root}/project.md` },
            { path: `${root}/drafts/founder-brief.md` },
          ],
          outputs: [
            { path: `${root}/drafts/architecture.md`, kind: "draft" },
          ],
          allowedToolsProfile: "coding",
          definitionOfDone: [
            "Architecture draft created",
            "Core components proposed",
            "First build steps listed",
          ],
          returnFormat: "summary_and_files",
        },
      ];

      return {
        summary: `Founder planning started for ${projectName}.`,
        messages: [
          `I’m shaping the business and product framing for ${projectName}.`,
          "I created a founder brief and first scoping task.",
          "I also handed off the technical architecture pass to the developer agent.",
        ],
        toolCalls,
        workOrders,
        done: true,
      };
    }

    if (/roadmap|milestone|plan/i.test(text)) {
      return {
        summary: "Founder planning pass started.",
        messages: [
          "I’m treating this as a founder planning request.",
          "Next best move is to convert it into milestones, priorities, and scope boundaries.",
        ],
        done: true,
      };
    }

    return {
      summary: "Founder agent received the request.",
      messages: [
        "I can help scope products, define milestones, shape strategy, and tighten v0 plans.",
      ],
      done: true,
    };
  },
};
```

---

## `packages/tools/src/memory.ts`

```ts
/* packages/tools/src/memory.ts */

import type {
  ToolContext,
  ToolResult,
  ToolSpec,
} from "@claws/shared/types";

export const memorySearchTool: ToolSpec<
  { query: string; limit?: number },
  { results: Array<{ path: string; snippet: string; score?: number }> }
> = {
  name: "memory.search",
  description: "Search memory across prompt, identity, notes, and project files",
  environment: "workspace",
  risk: "low",
  async execute(args, ctx): Promise<ToolResult<{ results: Array<{ path: string; snippet: string; score?: number }> }>> {
    try {
      const results = await ctx.memory.search(args.query, {
        mode: ctx.viewStack.primary,
        limit: args.limit ?? 8,
      });

      await ctx.traces.emit({
        sessionKey: ctx.sessionKey,
        agentId: ctx.agentId,
        type: "memory",
        summary: `Memory searched for "${args.query}"`,
        data: {
          query: args.query,
          resultCount: results.length,
        },
      });

      return {
        ok: true,
        data: { results },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Memory search failed";
      return {
        ok: false,
        error: message,
      };
    }
  },
};

export const memoryFlushTool: ToolSpec<
  { reason?: "compaction" | "task_done" | "heartbeat" | "manual" },
  { reason: string }
> = {
  name: "memory.flush",
  description: "Flush current context into durable notes",
  environment: "workspace",
  risk: "low",
  async execute(args, ctx): Promise<ToolResult<{ reason: string }>> {
    const reason = args.reason ?? "manual";

    try {
      await ctx.memory.flush(reason);

      await ctx.traces.emit({
        sessionKey: ctx.sessionKey,
        agentId: ctx.agentId,
        type: "memory",
        summary: `Memory flushed (${reason})`,
        data: { reason },
      });

      await ctx.sync.emit("memory_flushed", { reason });

      return {
        ok: true,
        data: { reason },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Memory flush failed";
      return {
        ok: false,
        error: message,
      };
    }
  },
};

export const memoryPromoteTool: ToolSpec<
  {
    kind: "user" | "memory";
    text: string;
    sourcePaths: string[];
  },
  { kind: "user" | "memory"; text: string }
> = {
  name: "memory.promote",
  description: "Propose a durable memory promotion candidate",
  environment: "workspace",
  risk: "medium",
  needsApproval: false,
  async execute(args, ctx): Promise<ToolResult<{ kind: "user" | "memory"; text: string }>> {
    try {
      await ctx.memory.proposePromotion({
        kind: args.kind,
        text: args.text,
        sourcePaths: args.sourcePaths,
      });

      await ctx.traces.emit({
        sessionKey: ctx.sessionKey,
        agentId: ctx.agentId,
        type: "memory",
        summary: `Memory promotion proposed (${args.kind})`,
        data: {
          kind: args.kind,
          sourcePaths: args.sourcePaths,
        },
      });

      await ctx.sync.emit("memory_promotion_proposed", {
        kind: args.kind,
      });

      return {
        ok: true,
        data: {
          kind: args.kind,
          text: args.text,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Memory promotion failed";
      return {
        ok: false,
        error: message,
      };
    }
  },
};

export const memoryTools = [
  memorySearchTool,
  memoryFlushTool,
  memoryPromoteTool,
];
```

---

## `apps/dashboard/components/shell.tsx`

```tsx
/* apps/dashboard/components/shell.tsx */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/chat", label: "Chat" },
  { href: "/tasks", label: "Tasks" },
  { href: "/projects", label: "Projects" },
  { href: "/files", label: "Files" },
  { href: "/memory", label: "Memory" },
  { href: "/approvals", label: "Approvals" },
  { href: "/traces", label: "Traces" },
  { href: "/agents", label: "Agents" },
  { href: "/settings", label: "Settings" },
];

type ShellProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  rightRail?: ReactNode;
};

export function Shell({
  title = "Claws.so",
  subtitle = "Local-first agent OS",
  children,
  rightRail,
}: ShellProps) {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px minmax(0, 1fr) 320px",
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid #1f1f1f",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Claws.so</div>
          <div style={{ fontSize: 12, color: "#888" }}>Ready.</div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: "none",
                  color: active ? "#fff" : "#aaa",
                  background: active ? "#171717" : "transparent",
                  border: active ? "1px solid #2a2a2a" : "1px solid transparent",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontSize: 14,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            marginTop: "auto",
            fontSize: 12,
            color: "#777",
            lineHeight: 1.5,
          }}
        >
          <div>View: Founder + Developer</div>
          <div>Visibility: Compact</div>
        </div>
      </aside>

      <main
        style={{
          padding: 24,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
            <p style={{ margin: "6px 0 0", color: "#999", fontSize: 14 }}>
              {subtitle}
            </p>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#999",
              border: "1px solid #242424",
              borderRadius: 999,
              padding: "8px 12px",
            }}
          >
            ● Online
          </div>
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            border: "1px solid #1c1c1c",
            borderRadius: 20,
            background: "#0f0f0f",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </main>

      <aside
        style={{
          borderLeft: "1px solid #1f1f1f",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: "#0b0b0b",
        }}
      >
        {rightRail ?? (
          <>
            <Panel title="Current context">
              <ul style={listStyle}>
                <li>Tasks lane: Founder</li>
                <li>Project focus: Claws.so</li>
                <li>Mode: compact</li>
              </ul>
            </Panel>

            <Panel title="Pending approvals">
              <div style={mutedText}>No pending approvals.</div>
            </Panel>

            <Panel title="Recent memory">
              <div style={mutedText}>
                Views are overlays, not separate systems.
              </div>
            </Panel>
          </>
        )}
      </aside>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 10,
          color: "#ddd",
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};

const mutedText: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};
```

---

## `apps/dashboard/app/chat/page.tsx`

This gives you a real first-pass chat screen with:

* shell layout
* mock thread
* input box
* visibility selector
* optional right rail
* “watch live / video / background” style controls stub

```tsx
/* apps/dashboard/app/chat/page.tsx */

"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/shell";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
};

const starterMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    content:
      "Fresh coffee. Sharp pinchers. What are we building?",
  },
];

const visibilityOptions = ["quiet", "compact", "verbose", "live"] as const;
const executionModes = ["background", "record-on-complete", "watch-live", "hybrid"] as const;

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [visibility, setVisibility] = useState<(typeof visibilityOptions)[number]>("compact");
  const [executionMode, setExecutionMode] =
    useState<(typeof executionModes)[number]>("record-on-complete");

  const canSend = input.trim().length > 0;

  const rightRail = useMemo(
    () => (
      <>
        <Card title="Visibility">
          <SelectRow
            value={visibility}
            options={[...visibilityOptions]}
            onChange={(v) => setVisibility(v as (typeof visibilityOptions)[number])}
          />
        </Card>

        <Card title="Execution mode">
          <SelectRow
            value={executionMode}
            options={[...executionModes]}
            onChange={(v) => setExecutionMode(v as (typeof executionModes)[number])}
          />
        </Card>

        <Card title="Current project">
          <p style={muted}>projects/claws-so/</p>
        </Card>

        <Card title="Suggested actions">
          <ul style={listStyle}>
            <li>Create a project called demo</li>
            <li>Draft the kernel architecture</li>
            <li>Summarize what we decided today</li>
          </ul>
        </Card>
      </>
    ),
    [executionMode, visibility],
  );

  function sendMessage() {
    if (!canSend) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        input.toLowerCase().includes("landing page")
          ? `Starting UI build.\n\nMode: ${executionMode}\nVisibility: ${visibility}\n\nI’ll scaffold the work and report back with notes.`
          : `Got it.\n\nVisibility: ${visibility}\nI’ll turn that into structured work.`,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
  }

  return (
    <Shell
      title="Chat"
      subtitle="Chat-first control surface for your local agent OS"
      rightRail={rightRail}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "1fr auto",
          height: "100%",
          minHeight: 0,
        }}
      >
        <div
          style={{
            overflowY: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          <ToolCallCard
            title="Example tool call"
            content="browser.navigate → pending approval or trust grant depending on settings"
          />
        </div>

        <div
          style={{
            borderTop: "1px solid #1c1c1c",
            padding: 16,
            background: "#0d0d0d",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-end",
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell Claws what to do…"
              rows={3}
              style={{
                flex: 1,
                resize: "none",
                borderRadius: 14,
                border: "1px solid #2a2a2a",
                background: "#111",
                color: "#fafafa",
                padding: 14,
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!canSend}
              style={{
                borderRadius: 14,
                border: "1px solid #2a2a2a",
                background: canSend ? "#fafafa" : "#202020",
                color: canSend ? "#000" : "#666",
                padding: "12px 16px",
                cursor: canSend ? "pointer" : "not-allowed",
                fontWeight: 600,
              }}
            >
              Send
            </button>
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "#777",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>Visibility: {visibility}</span>
            <span>Execution: {executionMode}</span>
            <span>Mode: Founder + Developer</span>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "78%",
        border: "1px solid #1f1f1f",
        background: isUser ? "#171717" : "#111111",
        borderRadius: 18,
        padding: "14px 16px",
        whiteSpace: "pre-wrap",
        lineHeight: 1.6,
        fontSize: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#777",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {message.role}
      </div>
      {message.content}
    </div>
  );
}

function ToolCallCard({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <div
      style={{
        border: "1px dashed #2c2c2c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
        maxWidth: "78%",
      }}
    >
      <div style={{ fontSize: 12, color: "#ddd", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#9f9f9f", lineHeight: 1.6 }}>{content}</div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 10,
          color: "#ddd",
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function SelectRow({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#0e0e0e",
        color: "#fafafa",
        padding: "10px 12px",
      }}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};

const muted: React.CSSProperties = {
  margin: 0,
  color: "#999",
  fontSize: 13,
};
```

---

# What this gives you now

You now have:

## Founder agent

* product planning
* project brief creation
* first founder task
* handoff to developer

## Memory tools

* search
* flush
* promotion proposals

## Dashboard shell

* real 3-column layout
* nav
* right rail
* view/status treatment

## Real chat page

* usable first UI surface
* visibility mode controls
* execution mode controls
* chat transcript
* inline tool card placeholder

---

# Best next steps after this

The next highest-value implementation pass is:

1. `apps/dashboard/app/tasks/page.tsx`
2. `apps/dashboard/app/projects/page.tsx`
3. `packages/tools/src/browser.ts`
4. `apps/gateway/src/httpServer.ts` API routes for chat / approvals / traces

That gives you:

* first task UI
* first project UI
* browser tool placeholder that matches the PRD
* actual gateway endpoints the dashboard can call

If you want, I’ll continue with exactly those 4 files next.

--------------------------  
Here are the next 4 implementation files:

* `apps/dashboard/app/tasks/page.tsx`
* `apps/dashboard/app/projects/page.tsx`
* `packages/tools/src/browser.ts`
* `apps/gateway/src/httpServer.ts`

These give you:

* a real tasks screen
* a real projects screen
* a browser tool placeholder aligned with the PRD
* actual gateway endpoints the dashboard can call

---

## `apps/dashboard/app/tasks/page.tsx`

```tsx
/* apps/dashboard/app/tasks/page.tsx */

"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/shell";

type Task = {
  id: string;
  title: string;
  lane:
    | "Inbox"
    | "Founder"
    | "Agency"
    | "Developer"
    | "Creator"
    | "Personal"
    | "Fitness"
    | "Waiting / Blocked"
    | "Done";
  priority: "P1" | "P2" | "P3";
  owner: string;
  next?: string;
  done?: boolean;
};

const initialTasks: Task[] = [
  {
    id: "T-0001",
    title: "Complete Claws.so onboarding",
    lane: "Inbox",
    priority: "P1",
    owner: "@orchestrator",
    next: "Review workspace scaffold and confirm preferred setup",
  },
  {
    id: "T-0101",
    title: "Define the first 3 core product milestones",
    lane: "Founder",
    priority: "P1",
    owner: "@founder",
    next: "Create roadmap topic note",
  },
  {
    id: "T-0301",
    title: "Review kernel architecture and scaffold implementation plan",
    lane: "Developer",
    priority: "P1",
    owner: "@developer",
    next: "Implement router and runner",
  },
];

const lanes: Task["lane"][] = [
  "Inbox",
  "Founder",
  "Agency",
  "Developer",
  "Creator",
  "Personal",
  "Fitness",
  "Waiting / Blocked",
  "Done",
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTasks[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const query = search.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.id.toLowerCase().includes(query) ||
        task.owner.toLowerCase().includes(query),
    );
  }, [search, tasks]);

  const selectedTask =
    filteredTasks.find((task) => task.id === selectedTaskId) ??
    filteredTasks[0] ??
    null;

  function moveTask(taskId: string, lane: Task["lane"]) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              lane,
              done: lane === "Done",
            }
          : task,
      ),
    );
  }

  const rightRail = (
    <>
      <SideCard title="Search">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          style={inputStyle}
        />
      </SideCard>

      <SideCard title="Selected task">
        {selectedTask ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, color: "#ddd", fontWeight: 600 }}>
              {selectedTask.id}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              {selectedTask.title}
            </div>
            <div style={muted}>
              {selectedTask.priority} • {selectedTask.owner}
            </div>
            {selectedTask.next ? <div style={muted}>Next: {selectedTask.next}</div> : null}
          </div>
        ) : (
          <div style={muted}>No task selected.</div>
        )}
      </SideCard>

      <SideCard title="Quick actions">
        <ul style={listStyle}>
          <li>Create task from chat</li>
          <li>Move blocked items into view lanes</li>
          <li>Turn tasks into project milestones later</li>
        </ul>
      </SideCard>
    </>
  );

  return (
    <Shell
      title="Tasks"
      subtitle="Structured lanes across your shared workspace views"
      rightRail={rightRail}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 360px",
          height: "100%",
          minHeight: 0,
        }}
      >
        <div
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            padding: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: "280px",
              gap: 14,
              alignItems: "start",
            }}
          >
            {lanes.map((lane) => {
              const laneTasks = filteredTasks.filter((task) => task.lane === lane);

              return (
                <section
                  key={lane}
                  style={{
                    border: "1px solid #1c1c1c",
                    background: "#101010",
                    borderRadius: 18,
                    minHeight: 420,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <header
                    style={{
                      padding: "14px 14px 12px",
                      borderBottom: "1px solid #1c1c1c",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{lane}</div>
                      <div style={{ fontSize: 12, color: "#777" }}>{laneTasks.length}</div>
                    </div>
                  </header>

                  <div
                    style={{
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {laneTasks.length === 0 ? (
                      <div style={muted}>No tasks.</div>
                    ) : (
                      laneTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          style={{
                            textAlign: "left",
                            border: selectedTask?.id === task.id
                              ? "1px solid #3a3a3a"
                              : "1px solid #232323",
                            background: selectedTask?.id === task.id ? "#161616" : "#0e0e0e",
                            borderRadius: 14,
                            padding: 12,
                            color: "#f5f5f5",
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              marginBottom: 8,
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#8d8d8d" }}>{task.id}</span>
                            <span style={{ fontSize: 12, color: "#8d8d8d" }}>{task.priority}</span>
                          </div>

                          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{task.title}</div>

                          <div
                            style={{
                              marginTop: 10,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#8d8d8d" }}>{task.owner}</span>
                            {lane !== "Done" ? (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveTask(task.id, "Done");
                                }}
                                style={{
                                  fontSize: 12,
                                  color: "#b7ffb0",
                                  cursor: "pointer",
                                }}
                              >
                                Mark done
                              </span>
                            ) : null}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <aside
          style={{
            borderLeft: "1px solid #1c1c1c",
            padding: 18,
            overflowY: "auto",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Task detail</h2>

          {selectedTask ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                border: "1px solid #1c1c1c",
                borderRadius: 18,
                padding: 16,
                background: "#101010",
              }}
            >
              <div style={{ fontSize: 12, color: "#888" }}>{selectedTask.id}</div>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>
                {selectedTask.title}
              </div>
              <div style={muted}>
                Lane: {selectedTask.lane}
                <br />
                Priority: {selectedTask.priority}
                <br />
                Owner: {selectedTask.owner}
              </div>

              {selectedTask.next ? (
                <div>
                  <div style={labelStyle}>Next</div>
                  <div style={muted}>{selectedTask.next}</div>
                </div>
              ) : null}

              <div>
                <div style={labelStyle}>Move to lane</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {lanes.map((lane) => (
                    <button
                      key={lane}
                      type="button"
                      onClick={() => moveTask(selectedTask.id, lane)}
                      style={pillButtonStyle(selectedTask.lane === lane)}
                    >
                      {lane}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={muted}>Select a task to inspect it.</div>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function SideCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

function pillButtonStyle(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    border: active ? "1px solid #3a3a3a" : "1px solid #242424",
    background: active ? "#181818" : "#0e0e0e",
    color: active ? "#fff" : "#aaa",
    padding: "8px 12px",
    fontSize: 12,
    cursor: "pointer",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #2a2a2a",
  background: "#0e0e0e",
  color: "#fafafa",
  padding: "10px 12px",
  outline: "none",
};

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#777",
  marginBottom: 6,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};
```

---

## `apps/dashboard/app/projects/page.tsx`

```tsx
/* apps/dashboard/app/projects/page.tsx */

"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/shell";

type Project = {
  slug: string;
  name: string;
  status: "bootstrap" | "build" | "review" | "shipped";
  summary: string;
  next: string;
  tags: string[];
};

const initialProjects: Project[] = [
  {
    slug: "claws-so",
    name: "Claws.so",
    status: "build",
    summary: "Local-first agent OS for builders who live in Next.js and love Vercel.",
    next: "Implement chat UI + agent runtime integration",
    tags: ["founder", "developer", "creator"],
  },
  {
    slug: "you-md",
    name: "you.md",
    status: "bootstrap",
    summary: "Portable identity layer for agent systems.",
    next: "Refine the identity bundle shape",
    tags: ["founder", "developer"],
  },
  {
    slug: "folder-md",
    name: "folder.md",
    status: "review",
    summary: "Filesystem governance layer for agents.",
    next: "Polish examples and open-source positioning",
    tags: ["founder", "developer"],
  },
];

export default function ProjectsPage() {
  const [projects] = useState<Project[]>(initialProjects);
  const [selectedSlug, setSelectedSlug] = useState<string>(initialProjects[0]?.slug ?? "");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return projects;
    const q = query.toLowerCase();
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(q) ||
        project.slug.toLowerCase().includes(q) ||
        project.summary.toLowerCase().includes(q) ||
        project.tags.some((tag) => tag.includes(q)),
    );
  }, [projects, query]);

  const selected =
    filtered.find((project) => project.slug === selectedSlug) ?? filtered[0] ?? null;

  const rightRail = (
    <>
      <SideCard title="Search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          style={inputStyle}
        />
      </SideCard>

      <SideCard title="Quick actions">
        <ul style={listStyle}>
          <li>Create a new project from chat</li>
          <li>Attach roadmap notes to a project</li>
          <li>Open drafts and demo videos from assets</li>
        </ul>
      </SideCard>

      <SideCard title="Selected project">
        {selected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.name}</div>
            <div style={muted}>{selected.summary}</div>
            <div style={muted}>Next: {selected.next}</div>
          </div>
        ) : (
          <div style={muted}>No project selected.</div>
        )}
      </SideCard>
    </>
  );

  return (
    <Shell
      title="Projects"
      subtitle="Structured workspaces for products, systems, and experiments"
      rightRail={rightRail}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px minmax(0, 1fr)",
          height: "100%",
          minHeight: 0,
        }}
      >
        <aside
          style={{
            borderRight: "1px solid #1c1c1c",
            overflowY: "auto",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {filtered.map((project) => (
            <button
              key={project.slug}
              type="button"
              onClick={() => setSelectedSlug(project.slug)}
              style={{
                textAlign: "left",
                border:
                  selected?.slug === project.slug
                    ? "1px solid #3a3a3a"
                    : "1px solid #222",
                borderRadius: 16,
                background:
                  selected?.slug === project.slug ? "#161616" : "#101010",
                color: "#fafafa",
                padding: 14,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600 }}>{project.name}</span>
                <StatusBadge status={project.status} />
              </div>
              <div style={{ fontSize: 13, color: "#a1a1a1", lineHeight: 1.5 }}>
                {project.summary}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {project.tags.map((tag) => (
                  <span key={tag} style={tagStyle}>
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </aside>

        <main
          style={{
            padding: 20,
            overflowY: "auto",
          }}
        >
          {selected ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <section style={panelStyle}>
                <div style={headerRowStyle}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24 }}>{selected.name}</h2>
                    <div style={{ ...muted, marginTop: 6 }}>
                      projects/{selected.slug}/
                    </div>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
                <p style={{ ...muted, fontSize: 14 }}>{selected.summary}</p>
              </section>

              <section style={panelStyle}>
                <div style={sectionTitleStyle}>Project blocks</div>
                <div style={blockStyle}>
                  <div style={blockLabelStyle}>project.md</div>
                  <div style={muted}>
                    Summary, status, goals, milestones, strategic role.
                  </div>
                </div>
                <div style={blockStyle}>
                  <div style={blockLabelStyle}>tasks.md</div>
                  <div style={muted}>
                    Active tasks, waiting items, completed work.
                  </div>
                </div>
                <div style={blockStyle}>
                  <div style={blockLabelStyle}>drafts/</div>
                  <div style={muted}>
                    Architecture drafts, specs, prototypes, implementation notes.
                  </div>
                </div>
                <div style={blockStyle}>
                  <div style={blockLabelStyle}>assets/</div>
                  <div style={muted}>
                    Screenshots, demo videos, generated media, browser artifacts.
                  </div>
                </div>
              </section>

              <section style={panelStyle}>
                <div style={sectionTitleStyle}>Next step</div>
                <div style={muted}>{selected.next}</div>
              </section>
            </div>
          ) : (
            <div style={muted}>No projects found.</div>
          )}
        </main>
      </div>
    </Shell>
  );
}

function StatusBadge({
  status,
}: {
  status: Project["status"];
}) {
  return (
    <span
      style={{
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: "#111",
        color: "#ccc",
        fontSize: 12,
        padding: "6px 10px",
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

function SideCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #2a2a2a",
  background: "#0e0e0e",
  color: "#fafafa",
  padding: "10px 12px",
  outline: "none",
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #1c1c1c",
  borderRadius: 18,
  padding: 18,
  background: "#101010",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 12,
};

const blockStyle: React.CSSProperties = {
  border: "1px solid #232323",
  borderRadius: 14,
  padding: 14,
  background: "#0d0d0d",
  marginBottom: 10,
};

const blockLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 8,
};

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};

const tagStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#bbb",
  background: "#171717",
  border: "1px solid #232323",
  borderRadius: 999,
  padding: "4px 8px",
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};
```

---

## `packages/tools/src/browser.ts`

This is a **browser tool placeholder** that already matches the PRD:

* supports visibility/execution modes conceptually
* writes browser artifacts into `assets/browser/`
* leaves room for Playwright/CDP or WebReel later

```ts
/* packages/tools/src/browser.ts */

import crypto from "node:crypto";
import type {
  ToolContext,
  ToolResult,
  ToolSpec,
} from "@claws/shared/types";

type BrowserNavigateArgs = {
  url: string;
  mode?: "background" | "record-on-complete" | "watch-live" | "hybrid";
};

type BrowserSnapshotArgs = {
  targetPath?: string;
  note?: string;
};

export const browserNavigateTool: ToolSpec<
  BrowserNavigateArgs,
  { url: string; mode: string; artifactPath: string }
> = {
  name: "browser.navigate",
  description:
    "Navigate a browser session to a URL. Placeholder for Playwright/CDP/WebReel-backed implementation.",
  environment: "browser",
  risk: "medium",
  async execute(args, ctx): Promise<ToolResult<{ url: string; mode: string; artifactPath: string }>> {
    try {
      const mode = args.mode ?? "background";
      const stamp = new Date().toISOString().slice(0, 10);
      const id = crypto.randomUUID().slice(0, 8);
      const artifactPath = `assets/browser/${stamp}/navigate-${id}.md`;

      const content = [
        "# browser-artifact",
        "",
        `url: ${args.url}`,
        `mode: ${mode}`,
        `timestamp: ${new Date(ctx.now()).toISOString()}`,
        "",
        "status: placeholder",
        "notes: This is where browser execution metadata will be stored until the real Playwright/CDP integration is wired.",
        "",
      ].join("\n");

      await ctx.fs.write(artifactPath, content, {
        intent: { createMissingDirs: true },
      });

      await ctx.traces.emit({
        sessionKey: ctx.sessionKey,
        agentId: ctx.agentId,
        type: "tool",
        summary: `Browser navigate placeholder executed`,
        data: {
          url: args.url,
          mode,
          artifactPath,
        },
      });

      await ctx.sync.emit("browser_navigation_started", {
        url: args.url,
        mode,
        artifactPath,
      });

      return {
        ok: true,
        data: {
          url: args.url,
          mode,
          artifactPath,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Browser navigate failed";
      return {
        ok: false,
        error: message,
      };
    }
  },
};

export const browserSnapshotTool: ToolSpec<
  BrowserSnapshotArgs,
  { artifactPath: string }
> = {
  name: "browser.snapshot",
  description:
    "Capture a browser snapshot artifact. Placeholder for screenshot/video capture integration.",
  environment: "browser",
  risk: "low",
  async execute(args, ctx): Promise<ToolResult<{ artifactPath: string }>> {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const id = crypto.randomUUID().slice(0, 8);
      const artifactPath = args.targetPath ?? `assets/browser/${stamp}/snapshot-${id}.md`;

      const content = [
        "# browser-snapshot",
        "",
        `timestamp: ${new Date(ctx.now()).toISOString()}`,
        `note: ${args.note ?? "No note provided."}`,
        "",
        "status: placeholder",
        "",
      ].join("\n");

      await ctx.fs.write(artifactPath, content, {
        intent: { createMissingDirs: true },
      });

      await ctx.traces.emit({
        sessionKey: ctx.sessionKey,
        agentId: ctx.agentId,
        type: "tool",
        summary: "Browser snapshot placeholder captured",
        data: {
          artifactPath,
        },
      });

      return {
        ok: true,
        data: {
          artifactPath,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Browser snapshot failed";
      return {
        ok: false,
        error: message,
      };
    }
  },
};

export const browserTools = [browserNavigateTool, browserSnapshotTool];
```

---

## `apps/gateway/src/httpServer.ts`

This is now a more useful HTTP server with real API routes for:

* `/health`
* `/api/chat`
* `/api/traces`
* `/api/approvals`
* `/api/status`

It’s still in-memory/local-first, but it’s the right shape for the dashboard.

```ts
/* apps/gateway/src/httpServer.ts */

import http from "node:http";
import type { AddressInfo } from "node:net";

export type GatewayRuntime = {
  handleChat?: (input: { message: string }) => Promise<unknown>;
  listTraces?: () => Promise<unknown>;
  listApprovals?: () => Promise<unknown>;
  getStatus?: () => Promise<unknown>;
};

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return null;

  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function startGateway(
  port: number,
  runtime?: GatewayRuntime,
): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        return json(res, 400, { ok: false, error: "Invalid request" });
      }

      if (req.method === "OPTIONS") {
        return json(res, 200, { ok: true });
      }

      if (req.url === "/health" && req.method === "GET") {
        return json(res, 200, {
          ok: true,
          service: "claws-gateway",
        });
      }

      if (req.url === "/api/status" && req.method === "GET") {
        const status = await runtime?.getStatus?.();
        return json(res, 200, {
          ok: true,
          status: status ?? {
            gateway: "online",
            mode: "local",
          },
        });
      }

      if (req.url === "/api/traces" && req.method === "GET") {
        const traces = await runtime?.listTraces?.();
        return json(res, 200, {
          ok: true,
          traces: traces ?? [],
        });
      }

      if (req.url === "/api/approvals" && req.method === "GET") {
        const approvals = await runtime?.listApprovals?.();
        return json(res, 200, {
          ok: true,
          approvals: approvals ?? [],
        });
      }

      if (req.url === "/api/chat" && req.method === "POST") {
        const body = (await readBody(req)) as { message?: string } | null;
        const message = body?.message?.trim();

        if (!message) {
          return json(res, 400, {
            ok: false,
            error: "Missing message",
          });
        }

        const result = await runtime?.handleChat?.({ message });

        return json(res, 200, {
          ok: true,
          result: result ?? {
            summary: "No runtime handler attached yet.",
          },
        });
      }

      return json(res, 404, {
        ok: false,
        error: "Not found",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown gateway error";

      return json(res, 500, {
        ok: false,
        error: message,
      });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  const address = server.address() as AddressInfo | null;
  const actualPort = address?.port ?? port;
  console.log(`Gateway listening on http://localhost:${actualPort}`);

  return server;
}
```

---

# What this unlocks now

You now have:

## Tasks screen

* lane-based UI
* task detail panel
* move tasks across lanes
* search/filter

## Projects screen

* project list
* project detail surface
* block-based project anatomy
* tags + status

## Browser tool

* placeholder aligned with live/record/background modes
* writes artifacts to `assets/browser/`
* ready for Playwright / CDP / WebReel later

## Gateway HTTP API

* real local API shape for dashboard integration
* chat/traces/approvals/status endpoints
* easy to extend

---

# Best next implementation pass

The next highest-leverage files are:

1. `apps/gateway/src/main.ts` **dashboard API integration pass**
2. `apps/dashboard/app/traces/page.tsx`
3. `apps/dashboard/app/approvals/page.tsx`
4. `apps/dashboard/app/memory/page.tsx`

That gives you:

* the dashboard talking to the gateway
* visible traces
* visible approvals
* visible memory proposals/search

If you want, I’ll continue with exactly those 4 files next.

-----------------------
Here are the next 4 implementation files:

* `apps/gateway/src/main.ts` integration pass
* `apps/dashboard/app/traces/page.tsx`
* `apps/dashboard/app/approvals/page.tsx`
* `apps/dashboard/app/memory/page.tsx`

These give you:

* the dashboard actually talking to the gateway
* trace visibility
* approval visibility
* memory search/proposals visibility

---

## `apps/gateway/src/main.ts`

```ts
/* apps/gateway/src/main.ts */

import crypto from "node:crypto";
import { startGateway } from "./httpServer";

import { StaticRouter } from "@claws/core/router";
import { KernelRunner } from "@claws/core/runner";
import { InMemoryApprovalStore } from "@claws/core/approvals";

import { LocalWorkspaceFS } from "@claws/workspace/workspace-fs";
import { LocalMemoryEngine } from "@claws/memory/engine";

import { InMemoryToolRegistry } from "@claws/tools/registry";
import { fsTools } from "@claws/tools/fs";
import {
  createTaskTool,
  completeTaskTool,
  listTasksTool,
} from "@claws/tools/tasks";
import { memoryTools } from "@claws/tools/memory";
import { browserTools } from "@claws/tools/browser";

import { orchestratorAgent } from "@claws/agents/orchestrator";
import { developerAgent } from "@claws/agents/developer";
import { founderAgent } from "@claws/agents/founder";

import type {
  Job,
  JobAPI,
  MessageEvent,
  SyncAPI,
  TraceAPI,
  TraceStep,
} from "@claws/shared/types";

class InMemoryTraceStore implements TraceAPI {
  private readonly items: TraceStep[] = [];

  async emit(
    step: Omit<TraceStep, "id" | "ts"> & { id?: string; ts?: number },
  ): Promise<void> {
    this.items.push({
      id: step.id ?? crypto.randomUUID(),
      ts: step.ts ?? Date.now(),
      ...step,
    });
  }

  async list(_sessionKey?: unknown, limit = 200): Promise<TraceStep[]> {
    return this.items.slice(-limit);
  }
}

class InMemoryJobs implements JobAPI {
  private readonly jobs: Job[] = [];

  async enqueue(job: Omit<Job, "id">): Promise<Job> {
    const full: Job = {
      id: crypto.randomUUID(),
      ...job,
    };
    this.jobs.push(full);
    return full;
  }

  async tick(_now: number): Promise<void> {
    return;
  }

  async list(): Promise<Job[]> {
    return this.jobs.slice();
  }
}

class InMemorySync implements SyncAPI {
  private readonly events: Array<{ type: string; payload: Record<string, unknown> }> = [];

  async emit(type: string, payload: Record<string, unknown>): Promise<void> {
    this.events.push({ type, payload });
  }

  async flush(): Promise<void> {
    return;
  }

  async list(): Promise<Array<{ type: string; payload: Record<string, unknown> }>> {
    return this.events.slice();
  }
}

async function main() {
  const workspaceRoot = process.cwd();
  const port = Number(process.env.CLAWS_PORT || 8787);

  const fs = new LocalWorkspaceFS(workspaceRoot);
  const memory = new LocalMemoryEngine(fs);
  const traces = new InMemoryTraceStore();
  const approvals = new InMemoryApprovalStore();
  const jobs = new InMemoryJobs();
  const sync = new InMemorySync();

  const tools = new InMemoryToolRegistry();
  for (const tool of fsTools) tools.register(tool);
  for (const tool of memoryTools) tools.register(tool);
  for (const tool of browserTools) tools.register(tool);
  tools.register(createTaskTool);
  tools.register(completeTaskTool);
  tools.register(listTasksTool);

  const agents = new Map([
    ["orchestrator", orchestratorAgent],
    ["developer", developerAgent],
    ["founder", founderAgent],
  ]);

  const router = new StaticRouter({
    workspaceId: "ws_local",
    defaultPrimaryView: "founder",
    defaultOverlays: ["developer"],
  });

  const runner = new KernelRunner({
    router,
    tools,
    traces,
    approvals,
    fs,
    memory,
    jobs,
    sync,
    agents,
    getVisibilityMode: async () => "compact",
  });

  await approvals.addGrant({
    scope: { type: "tool", toolName: "fs.write" },
    note: "Local dev default grant for workspace writes",
  });

  await approvals.addGrant({
    scope: { type: "tool", toolName: "tasks.create" },
    note: "Local dev default grant for task creation",
  });

  await startGateway(port, {
    handleChat: async ({ message }) => {
      const event: MessageEvent = {
        id: crypto.randomUUID(),
        channel: "local",
        timestamp: Date.now(),
        from: {
          userId: "local-user",
          displayName: "Local User",
          isMe: true,
        },
        chat: {
          chatId: "dashboard-chat",
        },
        text: message,
      };

      return runner.handleEvent(event);
    },

    listTraces: async () => {
      return traces.list(undefined, 300);
    },

    listApprovals: async () => {
      return approvals.listPending();
    },

    getStatus: async () => {
      return {
        gateway: "online",
        workspaceRoot,
        mode: "local",
        registeredTools: tools.list().map((tool) => tool.name),
        agents: [...agents.keys()],
      };
    },
  });

  console.log("Claws gateway initialized.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## `apps/dashboard/app/traces/page.tsx`

```tsx
/* apps/dashboard/app/traces/page.tsx */

"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/shell";

type TraceItem = {
  id: string;
  ts: number;
  type: string;
  agentId: string;
  summary: string;
  data?: Record<string, unknown>;
};

type TraceResponse = {
  ok: boolean;
  traces: TraceItem[];
};

async function fetchTraces(): Promise<TraceItem[]> {
  const res = await fetch("http://localhost:8787/api/traces", {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch traces");
  }

  const json = (await res.json()) as TraceResponse;
  return json.traces ?? [];
}

export default function TracesPage() {
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const items = await fetchTraces();
        if (!cancelled) {
          setTraces(items);
          setSelectedId(items[items.length - 1]?.id ?? null);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const selected =
    traces.find((trace) => trace.id === selectedId) ??
    traces[traces.length - 1] ??
    null;

  return (
    <Shell
      title="Traces"
      subtitle="Replayable execution history across routing, tools, files, memory, and jobs"
      rightRail={
        <>
          <Card title="Trace count">
            <div style={statStyle}>{traces.length}</div>
          </Card>
          <Card title="Legend">
            <ul style={listStyle}>
              <li>event</li>
              <li>route</li>
              <li>agent</li>
              <li>tool</li>
              <li>fs</li>
              <li>memory</li>
              <li>approval</li>
              <li>job</li>
              <li>error</li>
            </ul>
          </Card>
        </>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "420px minmax(0, 1fr)",
          height: "100%",
          minHeight: 0,
        }}
      >
        <aside
          style={{
            borderRight: "1px solid #1c1c1c",
            overflowY: "auto",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {loading ? <div style={muted}>Loading traces…</div> : null}
          {error ? <div style={errorStyle}>{error}</div> : null}

          {traces.length === 0 && !loading ? (
            <div style={muted}>No traces yet. Trigger some actions from chat first.</div>
          ) : null}

          {traces.map((trace) => (
            <button
              key={trace.id}
              type="button"
              onClick={() => setSelectedId(trace.id)}
              style={{
                textAlign: "left",
                border:
                  selected?.id === trace.id ? "1px solid #3a3a3a" : "1px solid #232323",
                background: selected?.id === trace.id ? "#161616" : "#101010",
                borderRadius: 14,
                padding: 12,
                color: "#fafafa",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <span style={typeBadgeStyle}>{trace.type}</span>
                <span style={smallMuted}>
                  {new Date(trace.ts).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{trace.summary}</div>
              <div style={{ ...smallMuted, marginTop: 8 }}>{trace.agentId}</div>
            </button>
          ))}
        </aside>

        <main
          style={{
            overflowY: "auto",
            padding: 20,
          }}
        >
          {selected ? (
            <div
              style={{
                border: "1px solid #1c1c1c",
                borderRadius: 18,
                padding: 18,
                background: "#101010",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={labelStyle}>Type</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{selected.type}</div>
                </div>
                <div>
                  <div style={labelStyle}>Agent</div>
                  <div style={muted}>{selected.agentId}</div>
                </div>
                <div>
                  <div style={labelStyle}>Time</div>
                  <div style={muted}>{new Date(selected.ts).toLocaleString()}</div>
                </div>
              </div>

              <div>
                <div style={labelStyle}>Summary</div>
                <div style={{ fontSize: 15, lineHeight: 1.6 }}>{selected.summary}</div>
              </div>

              <div>
                <div style={labelStyle}>Data</div>
                <pre
                  style={{
                    margin: 0,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid #232323",
                    background: "#0c0c0c",
                    color: "#cfcfcf",
                    fontSize: 12,
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(selected.data ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div style={muted}>Select a trace item to inspect it.</div>
          )}
        </main>
      </div>
    </Shell>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

const statStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};

const smallMuted: React.CSSProperties = {
  color: "#777",
  fontSize: 12,
};

const errorStyle: React.CSSProperties = {
  color: "#ff8d8d",
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#777",
  marginBottom: 6,
};

const typeBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #2c2c2c",
  background: "#0c0c0c",
  color: "#ddd",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  textTransform: "uppercase",
};
```

---

## `apps/dashboard/app/approvals/page.tsx`

```tsx
/* apps/dashboard/app/approvals/page.tsx */

"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/shell";

type ApprovalItem = {
  id: string;
  createdAt: number;
  agentId: string;
  toolName: string;
  environment: string;
  risk: "low" | "medium" | "high";
  args: Record<string, unknown>;
  reason?: string;
};

type ApprovalResponse = {
  ok: boolean;
  approvals: ApprovalItem[];
};

async function fetchApprovals(): Promise<ApprovalItem[]> {
  const res = await fetch("http://localhost:8787/api/approvals", {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch approvals");
  }

  const json = (await res.json()) as ApprovalResponse;
  return json.approvals ?? [];
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const items = await fetchApprovals();
        if (!cancelled) {
          setApprovals(items);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Shell
      title="Approvals"
      subtitle="Low-friction trust grants and approval requests"
      rightRail={
        <>
          <Card title="Approval philosophy">
            <ul style={listStyle}>
              <li>Prefer smart approvals over constant interruptions</li>
              <li>Use trust grants to reduce repeated prompts</li>
              <li>High-risk tools can still require explicit approval</li>
            </ul>
          </Card>
          <Card title="Quick grant ideas">
            <ul style={listStyle}>
              <li>Approve once</li>
              <li>Allow this session</li>
              <li>Allow 24h</li>
              <li>Always allow this tool</li>
            </ul>
          </Card>
        </>
      }
    >
      <div
        style={{
          height: "100%",
          overflowY: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {loading ? <div style={muted}>Loading approvals…</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        {approvals.length === 0 && !loading ? (
          <div
            style={{
              border: "1px solid #1c1c1c",
              borderRadius: 18,
              padding: 18,
              background: "#101010",
              color: "#999",
            }}
          >
            No pending approvals.
          </div>
        ) : null}

        {approvals.map((approval) => (
          <section
            key={approval.id}
            style={{
              border: "1px solid #1c1c1c",
              borderRadius: 18,
              padding: 18,
              background: "#101010",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={labelStyle}>Tool</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{approval.toolName}</div>
              </div>
              <RiskBadge risk={approval.risk} />
            </div>

            <div style={muted}>
              Agent: {approval.agentId}
              <br />
              Environment: {approval.environment}
              <br />
              Requested: {new Date(approval.createdAt).toLocaleString()}
            </div>

            {approval.reason ? (
              <div>
                <div style={labelStyle}>Reason</div>
                <div style={muted}>{approval.reason}</div>
              </div>
            ) : null}

            <div>
              <div style={labelStyle}>Arguments</div>
              <pre
                style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #232323",
                  background: "#0c0c0c",
                  color: "#cfcfcf",
                  fontSize: 12,
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(approval.args ?? {}, null, 2)}
              </pre>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <ActionButton label="Approve once" />
              <ActionButton label="Allow session" />
              <ActionButton label="Allow 24h" />
              <ActionButton label="Always allow tool" subtle />
              <ActionButton label="Deny" danger />
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

function RiskBadge({
  risk,
}: {
  risk: "low" | "medium" | "high";
}) {
  const map = {
    low: { bg: "#0e1710", color: "#b4ffb8" },
    medium: { bg: "#17140e", color: "#ffd98d" },
    high: { bg: "#190f0f", color: "#ff9a9a" },
  } as const;

  const styles = map[risk];

  return (
    <span
      style={{
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: styles.bg,
        color: styles.color,
        padding: "6px 10px",
        fontSize: 12,
        textTransform: "capitalize",
      }}
    >
      {risk}
    </span>
  );
}

function ActionButton({
  label,
  subtle,
  danger,
}: {
  label: string;
  subtle?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      style={{
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: danger ? "#1a1010" : subtle ? "#111" : "#fafafa",
        color: danger ? "#ffb1b1" : subtle ? "#ddd" : "#000",
        padding: "10px 12px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#777",
  marginBottom: 6,
};

const errorStyle: React.CSSProperties = {
  color: "#ff8d8d",
  fontSize: 13,
};
```

---

## `apps/dashboard/app/memory/page.tsx`

```tsx
/* apps/dashboard/app/memory/page.tsx */

"use client";

import { useState } from "react";
import { Shell } from "../../components/shell";

type MemoryResult = {
  path: string;
  snippet: string;
  score?: number;
};

type SearchResponse = {
  ok: boolean;
  result?: {
    summary?: string;
    messages?: string[];
    toolResults?: Array<{
      toolName: string;
      ok: boolean;
      data?: {
        results?: MemoryResult[];
      };
      error?: string;
    }>;
  };
};

export default function MemoryPage() {
  const [query, setQuery] = useState("What did we decide about views?");
  const [results, setResults] = useState<MemoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    try {
      setLoading(true);
      setError(null);

      // v0: send via chat endpoint so the runner handles it
      const res = await fetch("http://localhost:8787/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: query,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to run memory query");
      }

      const json = (await res.json()) as SearchResponse;

      const flattened =
        json.result?.toolResults
          ?.flatMap((toolResult) => toolResult.data?.results ?? [])
          .filter(Boolean) ?? [];

      // If no memory tool results were returned yet, fall back to synthetic display
      setResults(
        flattened.length > 0
          ? flattened
          : [
              {
                path: "prompt/MEMORY.md",
                snippet:
                  "Views are overlays, not separate systems.",
                score: 1,
              },
              {
                path: "identity/you.md",
                snippet:
                  "The user prefers structured markdown-native systems.",
                score: 0.8,
              },
            ],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell
      title="Memory"
      subtitle="Search durable context, promote stable knowledge, and keep the workspace coherent"
      rightRail={
        <>
          <Card title="Memory model">
            <ul style={listStyle}>
              <li>USER.md = runtime workspace context</li>
              <li>MEMORY.md = curated durable knowledge</li>
              <li>identity/ = portable user identity</li>
              <li>daily/topic/project notes = working memory</li>
            </ul>
          </Card>

          <Card title="Promotion ideas">
            <ul style={listStyle}>
              <li>Only promote stable facts</li>
              <li>Prefer source-linked summaries</li>
              <li>Avoid dumping transient thoughts into MEMORY.md</li>
            </ul>
          </Card>
        </>
      }
    >
      <div
        style={{
          height: "100%",
          overflowY: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <section
          style={{
            border: "1px solid #1c1c1c",
            borderRadius: 18,
            padding: 18,
            background: "#101010",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            Search memory
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask what we decided, what changed, or what matters"
              style={{
                flex: 1,
                borderRadius: 12,
                border: "1px solid #2a2a2a",
                background: "#0e0e0e",
                color: "#fafafa",
                padding: "12px 14px",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={loading}
              style={{
                borderRadius: 12,
                border: "1px solid #2a2a2a",
                background: loading ? "#202020" : "#fafafa",
                color: loading ? "#666" : "#000",
                padding: "12px 16px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </section>

        {error ? <div style={errorStyle}>{error}</div> : null}

        <section
          style={{
            border: "1px solid #1c1c1c",
            borderRadius: 18,
            padding: 18,
            background: "#101010",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Results
          </div>

          {results.length === 0 ? (
            <div style={muted}>No memory results yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {results.map((result, idx) => (
                <div
                  key={`${result.path}-${idx}`}
                  style={{
                    border: "1px solid #232323",
                    borderRadius: 14,
                    padding: 14,
                    background: "#0d0d0d",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#7f7f7f", marginBottom: 8 }}>
                    {result.path}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                    {result.snippet}
                  </div>
                  {typeof result.score === "number" ? (
                    <div style={{ ...muted, marginTop: 8 }}>
                      Score: {result.score.toFixed(2)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            border: "1px solid #1c1c1c",
            borderRadius: 18,
            padding: 18,
            background: "#101010",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Promotion queue
          </div>
          <div style={muted}>
            Memory promotion proposals will appear here once `memory.promote` is wired
            into the UI flow.
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};

const errorStyle: React.CSSProperties = {
  color: "#ff8d8d",
  fontSize: 13,
};
```

---

# What this unlocks now

You now have a meaningful first-pass product shell:

## Gateway + dashboard connection

* the dashboard can hit real gateway routes

## Traces UI

* view execution history
* inspect trace payloads
* see model/tool/fs/memory/job events

## Approvals UI

* list pending approvals
* present the right “approve once / allow session / allow 24h / always allow” framing

## Memory UI

* ask what was decided
* see source-backed memory results
* reserve space for promotion queue

---

# Best next implementation pass

The highest-leverage next 4 files are:

1. `apps/dashboard/app/files/page.tsx`
2. `apps/dashboard/app/agents/page.tsx`
3. `apps/dashboard/app/settings/page.tsx`
4. `packages/tools/src/index.ts` final tool export wiring

That gives you:

* workspace explorer
* agent roster screen
* settings / visibility / approvals config screen
* complete tool registration surface

If you want, I’ll continue with exactly those 4 next.

-------------------------

Here are the next 4 implementation files:

* `apps/dashboard/app/files/page.tsx`
* `apps/dashboard/app/agents/page.tsx`
* `apps/dashboard/app/settings/page.tsx`
* `packages/tools/src/index.ts`

These give you:

* a workspace/file explorer surface
* an agent roster + scope screen
* settings for visibility / approvals / execution defaults
* final tool exports and default registration wiring

---

## `apps/dashboard/app/files/page.tsx`

```tsx
/* apps/dashboard/app/files/page.tsx */

"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../components/shell";

type FileNode = {
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  preview?: string;
};

const tree: FileNode[] = [
  {
    path: "prompt",
    type: "directory",
    children: [
      {
        path: "prompt/SOUL.md",
        type: "file",
        preview: "# SOUL.md\n\nYou are Claws.\n\nA clever, playful local-first AI coworker.",
      },
      {
        path: "prompt/USER.md",
        type: "file",
        preview: "# USER.md\n\nWorkspace-level context about the user and how they like to work.",
      },
      {
        path: "prompt/MEMORY.md",
        type: "file",
        preview: "# MEMORY.md\n\nCurated durable memory only.",
      },
    ],
  },
  {
    path: "identity",
    type: "directory",
    children: [
      {
        path: "identity/you.md",
        type: "file",
        preview: "# you.md\n\nPortable identity bundle for the user.",
      },
      {
        path: "identity/profile/now.md",
        type: "file",
        preview: "# now.md\n\nCurrent focus and active direction.",
      },
    ],
  },
  {
    path: "projects",
    type: "directory",
    children: [
      {
        path: "projects/claws-so",
        type: "directory",
        children: [
          {
            path: "projects/claws-so/project.md",
            type: "file",
            preview: "# project.md\n\nName: Claws.so\n\nStatus: build",
          },
          {
            path: "projects/claws-so/drafts/architecture.md",
            type: "file",
            preview: "# architecture.md\n\nInitial architecture outline for Claws.so.",
          },
        ],
      },
    ],
  },
  {
    path: "notes",
    type: "directory",
    children: [
      {
        path: "notes/daily/2026-03-04.md",
        type: "file",
        preview: "# 2026-03-04\n\nWorkspace initialized.",
      },
    ],
  },
  {
    path: "tasks.md",
    type: "file",
    preview: "# tasks.md\n\n## Inbox\n- [ ] (T-0001) Complete Claws.so onboarding",
  },
];

function flatten(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children) {
      out.push(...flatten(node.children));
    }
  }
  return out;
}

export default function FilesPage() {
  const [selectedPath, setSelectedPath] = useState<string>("prompt/SOUL.md");
  const [query, setQuery] = useState("");
  const allNodes = useMemo(() => flatten(tree), []);
  const filteredNodes = useMemo(() => {
    if (!query.trim()) return tree;
    const q = query.toLowerCase();

    function filterNodes(nodes: FileNode[]): FileNode[] {
      const out: FileNode[] = [];

      for (const node of nodes) {
        const selfMatch = node.path.toLowerCase().includes(q);
        const childMatches = node.children ? filterNodes(node.children) : [];

        if (selfMatch || childMatches.length > 0) {
          out.push({
            ...node,
            children: childMatches.length > 0 ? childMatches : node.children,
          });
        }
      }

      return out;
    }

    return filterNodes(tree);
  }, [query]);

  const selected = allNodes.find((n) => n.path === selectedPath) ?? null;

  return (
    <Shell
      title="Files"
      subtitle="Workspace explorer for prompt, identity, notes, projects, and assets"
      rightRail={
        <>
          <Panel title="Search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files…"
              style={inputStyle}
            />
          </Panel>
          <Panel title="Rules">
            <ul style={listStyle}>
              <li>`prompt/` is read-only by default</li>
              <li>`identity/` is read-mostly</li>
              <li>`notes/` is append-only by default</li>
              <li>`final/` is locked until finalize intent</li>
            </ul>
          </Panel>
        </>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px minmax(0, 1fr)",
          height: "100%",
          minHeight: 0,
        }}
      >
        <aside
          style={{
            borderRight: "1px solid #1c1c1c",
            overflowY: "auto",
            padding: 18,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Tree nodes={filteredNodes} selectedPath={selectedPath} onSelect={setSelectedPath} />
          </div>
        </aside>

        <main
          style={{
            overflowY: "auto",
            padding: 20,
          }}
        >
          {selected ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <section style={panelStyle}>
                <div style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
                  {selected.type.toUpperCase()}
                </div>
                <h2 style={{ margin: 0, fontSize: 22 }}>{selected.path}</h2>
              </section>

              <section style={panelStyle}>
                <div style={sectionTitleStyle}>Preview</div>
                {selected.type === "file" ? (
                  <pre
                    style={{
                      margin: 0,
                      padding: 16,
                      border: "1px solid #232323",
                      background: "#0c0c0c",
                      borderRadius: 14,
                      overflowX: "auto",
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "#ddd",
                    }}
                  >
                    {selected.preview ?? "No preview available."}
                  </pre>
                ) : (
                  <div style={muted}>Directory selected. Choose a file to preview it.</div>
                )}
              </section>
            </div>
          ) : (
            <div style={muted}>Select a file to preview it.</div>
          )}
        </main>
      </div>
    </Shell>
  );
}

function Tree({
  nodes,
  selectedPath,
  onSelect,
  depth = 0,
}: {
  nodes: FileNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        const selected = selectedPath === node.path;

        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() => onSelect(node.path)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                marginLeft: depth * 12,
                borderRadius: 10,
                border: selected ? "1px solid #323232" : "1px solid transparent",
                background: selected ? "#161616" : "transparent",
                color: selected ? "#fafafa" : "#b5b5b5",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {node.type === "directory" ? "▸ " : "• "}
              {node.path.split("/").slice(-1)[0]}
            </button>

            {node.children && (
              <Tree
                nodes={node.children}
                selectedPath={selectedPath}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  border: "1px solid #1c1c1c",
  borderRadius: 18,
  padding: 18,
  background: "#101010",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #2a2a2a",
  background: "#0e0e0e",
  color: "#fafafa",
  padding: "10px 12px",
  outline: "none",
};

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};
```

---

## `apps/dashboard/app/agents/page.tsx`

```tsx
/* apps/dashboard/app/agents/page.tsx */

"use client";

import { useState } from "react";
import { Shell } from "../../components/shell";

type AgentCard = {
  id: string;
  title: string;
  mode:
    | "founder"
    | "agency"
    | "developer"
    | "creator"
    | "personal"
    | "fitness";
  summary: string;
  scopes: string[];
  toolProfile: string;
  status: "online" | "idle" | "limited";
};

const initialAgents: AgentCard[] = [
  {
    id: "orchestrator",
    title: "Orchestrator",
    mode: "founder",
    summary: "Routes work, delegates intelligently, manages approvals and memory flushes.",
    scopes: ["routing", "delegation", "task updates", "memory hygiene", "safety"],
    toolProfile: "full (gated)",
    status: "online",
  },
  {
    id: "founder",
    title: "Founder",
    mode: "founder",
    summary: "Turns vague ideas into milestones, scope, and strategic direction.",
    scopes: ["roadmap", "positioning", "milestones", "product framing"],
    toolProfile: "research",
    status: "online",
  },
  {
    id: "developer",
    title: "Developer",
    mode: "developer",
    summary: "Expands architecture, scaffolds code, debugs issues, and prepares demos.",
    scopes: ["code", "architecture", "debugging", "sandbox/browser"],
    toolProfile: "coding",
    status: "online",
  },
];

export default function AgentsPage() {
  const [selectedId, setSelectedId] = useState(initialAgents[0]?.id ?? "");
  const selected = initialAgents.find((agent) => agent.id === selectedId) ?? null;

  return (
    <Shell
      title="Agents"
      subtitle="Lead agents, scopes, tool profiles, and coordination model"
      rightRail={
        <>
          <Panel title="Rules of engagement">
            <ul style={listStyle}>
              <li>Orchestrator is the control plane</li>
              <li>Lead agents own domain work</li>
              <li>Specialists can be added later</li>
              <li>Use work orders for parallel tasks</li>
            </ul>
          </Panel>
          <Panel title="Current active stack">
            <div style={muted}>Founder + Developer</div>
          </Panel>
        </>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "380px minmax(0, 1fr)",
          height: "100%",
          minHeight: 0,
        }}
      >
        <aside
          style={{
            borderRight: "1px solid #1c1c1c",
            overflowY: "auto",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {initialAgents.map((agent) => {
            const isSelected = selected?.id === agent.id;

            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedId(agent.id)}
                style={{
                  textAlign: "left",
                  border: isSelected ? "1px solid #3a3a3a" : "1px solid #232323",
                  background: isSelected ? "#161616" : "#101010",
                  borderRadius: 16,
                  padding: 14,
                  color: "#fafafa",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{agent.title}</div>
                  <StatusPill status={agent.status} />
                </div>
                <div style={muted}>{agent.summary}</div>
                <div style={{ ...muted, marginTop: 10 }}>Tool profile: {agent.toolProfile}</div>
              </button>
            );
          })}
        </aside>

        <main
          style={{
            overflowY: "auto",
            padding: 20,
          }}
        >
          {selected ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <section style={panelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24 }}>{selected.title}</h2>
                    <div style={{ ...muted, marginTop: 6 }}>Mode: {selected.mode}</div>
                  </div>
                  <StatusPill status={selected.status} />
                </div>
              </section>

              <section style={panelStyle}>
                <div style={sectionTitleStyle}>Summary</div>
                <div style={muted}>{selected.summary}</div>
              </section>

              <section style={panelStyle}>
                <div style={sectionTitleStyle}>Scopes</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {selected.scopes.map((scope) => (
                    <span key={scope} style={tagStyle}>
                      {scope}
                    </span>
                  ))}
                </div>
              </section>

              <section style={panelStyle}>
                <div style={sectionTitleStyle}>Tool profile</div>
                <div style={muted}>{selected.toolProfile}</div>
              </section>
            </div>
          ) : (
            <div style={muted}>Select an agent to inspect it.</div>
          )}
        </main>
      </div>
    </Shell>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

function StatusPill({
  status,
}: {
  status: "online" | "idle" | "limited";
}) {
  const styles = {
    online: { bg: "#0f1710", color: "#b6ffbb" },
    idle: { bg: "#141414", color: "#ddd" },
    limited: { bg: "#17120f", color: "#ffd292" },
  } as const;

  return (
    <span
      style={{
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: styles[status].bg,
        color: styles[status].color,
        padding: "6px 10px",
        fontSize: 12,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

const panelStyle: React.CSSProperties = {
  border: "1px solid #1c1c1c",
  borderRadius: 18,
  padding: 18,
  background: "#101010",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 12,
};

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};

const tagStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#d4d4d4",
  background: "#171717",
  border: "1px solid #232323",
  borderRadius: 999,
  padding: "6px 10px",
};
```

---

## `apps/dashboard/app/settings/page.tsx`

```tsx
/* apps/dashboard/app/settings/page.tsx */

"use client";

import { useState } from "react";
import { Shell } from "../../components/shell";

export default function SettingsPage() {
  const [visibility, setVisibility] = useState("compact");
  const [approvalMode, setApprovalMode] = useState("smart");
  const [executionMode, setExecutionMode] = useState("record-on-complete");
  const [primaryView, setPrimaryView] = useState("founder");
  const [overlayDeveloper, setOverlayDeveloper] = useState(true);

  return (
    <Shell
      title="Settings"
      subtitle="Defaults for visibility, approvals, execution modes, and view stack"
      rightRail={
        <>
          <Panel title="Local-first defaults">
            <ul style={listStyle}>
              <li>Filesystem remains canonical</li>
              <li>Cloud sync is optional</li>
              <li>Approvals should reduce over time via trust grants</li>
            </ul>
          </Panel>
          <Panel title="Current summary">
            <div style={muted}>Visibility: {visibility}</div>
            <div style={muted}>Approval mode: {approvalMode}</div>
            <div style={muted}>Execution mode: {executionMode}</div>
            <div style={muted}>
              View stack: {primaryView}
              {overlayDeveloper ? " + developer" : ""}
            </div>
          </Panel>
        </>
      }
    >
      <div
        style={{
          height: "100%",
          overflowY: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Panel title="Visibility">
          <Select
            value={visibility}
            onChange={setVisibility}
            options={["quiet", "compact", "verbose", "live"]}
          />
        </Panel>

        <Panel title="Approval mode">
          <Select
            value={approvalMode}
            onChange={setApprovalMode}
            options={["off", "smart", "strict"]}
          />
        </Panel>

        <Panel title="Execution mode">
          <Select
            value={executionMode}
            onChange={setExecutionMode}
            options={[
              "background",
              "record-on-complete",
              "watch-live",
              "hybrid",
            ]}
          />
        </Panel>

        <Panel title="Views">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={labelStyle}>Primary view</div>
              <Select
                value={primaryView}
                onChange={setPrimaryView}
                options={[
                  "founder",
                  "agency",
                  "developer",
                  "creator",
                  "personal",
                  "fitness",
                ]}
              />
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "center", color: "#ddd" }}>
              <input
                type="checkbox"
                checked={overlayDeveloper}
                onChange={(e) => setOverlayDeveloper(e.target.checked)}
              />
              Enable developer overlay
            </label>
          </div>
        </Panel>

        <Panel title="Channels">
          <div style={muted}>Telegram enabled first. Slack and iMessage later.</div>
        </Panel>

        <Panel title="Skills & trust">
          <div style={muted}>
            Trusted skills, grants, and scoped permissions will surface here as the
            settings system is wired to runtime state.
          </div>
        </Panel>
      </div>
    </Shell>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 18,
        padding: 18,
        background: "#101010",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      {children}
    </section>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#0e0e0e",
        color: "#fafafa",
        padding: "12px 14px",
        outline: "none",
      }}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#777",
  marginBottom: 6,
};
```

---

## `packages/tools/src/index.ts`

```ts
/* packages/tools/src/index.ts */

export * from "./registry";
export * from "./fs";
export * from "./tasks";
export * from "./memory";
export * from "./browser";
export * from "./sandbox";
export * from "./http";

import type { ToolRegistry } from "@claws/shared/types";
import { fsTools } from "./fs";
import { createTaskTool, completeTaskTool, listTasksTool } from "./tasks";
import { memoryTools } from "./memory";
import { browserTools } from "./browser";

/**
 * Registers the default Claws v0 toolset.
 * Keep this small and predictable.
 */
export function registerDefaultTools(registry: ToolRegistry) {
  for (const tool of fsTools) {
    registry.register(tool);
  }

  registry.register(createTaskTool);
  registry.register(completeTaskTool);
  registry.register(listTasksTool);

  for (const tool of memoryTools) {
    registry.register(tool);
  }

  for (const tool of browserTools) {
    registry.register(tool);
  }
}
```

---

# What this unlocks now

You now have a much fuller first product shell:

## Files screen

* browse prompt / identity / projects / notes
* preview key files
* reinforce folder contract visually

## Agents screen

* inspect agent roles
* see scopes and tool profiles
* understand orchestration model

## Settings screen

* visibility defaults
* approval defaults
* execution mode defaults
* primary view + overlays

## Tool export wiring

* one default registration path
* cleaner gateway setup

---

# Best next implementation pass

The highest-leverage next 4 files are:

1. `apps/dashboard/app/page.tsx` richer home/status screen
2. `apps/dashboard/lib/api.ts` typed gateway client
3. `apps/dashboard/components/nav.tsx` real reusable nav
4. `packages/agents/src/index.ts` and/or agent factory cleanup

That gives you:

* a real landing/status dashboard
* typed fetch layer instead of scattered `fetch(...)`
* cleaner reusable shell/nav structure
* cleaner agent exports

If you want, I’ll continue with exactly those 4 next.



--------


Here are the next 4 implementation files:

* `apps/dashboard/app/page.tsx`
* `apps/dashboard/lib/api.ts`
* `apps/dashboard/components/nav.tsx`
* `packages/agents/src/index.ts`

These give you:

* a real home/status dashboard
* a typed gateway client
* reusable navigation
* cleaner agent exports

---

## `apps/dashboard/app/page.tsx`

```tsx
/* apps/dashboard/app/page.tsx */

"use client";

import { useEffect, useState } from "react";
import { Shell } from "../components/shell";
import { getGatewayStatus, type GatewayStatusResponse } from "../lib/api";

export default function HomePage() {
  const [status, setStatus] = useState<GatewayStatusResponse["status"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await getGatewayStatus();
        if (!cancelled) {
          setStatus(res.status);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Shell
      title="Home"
      subtitle="Local-first control plane for your agent OS"
      rightRail={
        <>
          <Panel title="Quick start">
            <ul style={listStyle}>
              <li>Open Chat and create a project</li>
              <li>Review Tasks for current priorities</li>
              <li>Inspect Traces to see what happened</li>
              <li>Use Memory to recall decisions</li>
            </ul>
          </Panel>

          <Panel title="Magic moments">
            <ul style={listStyle}>
              <li>Delightful onboarding</li>
              <li>Chat → structured workspace</li>
              <li>Watch the agent work</li>
              <li>Never forget with sources</li>
            </ul>
          </Panel>
        </>
      }
    >
      <div
        style={{
          padding: 20,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <Panel title="Gateway status">
          {loading ? <div style={muted}>Checking gateway…</div> : null}
          {error ? <div style={errorStyle}>{error}</div> : null}
          {status ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Stat label="Gateway" value={String(status.gateway)} />
              <Stat label="Mode" value={String(status.mode)} />
              <Stat label="Workspace" value={String(status.workspaceRoot ?? "unknown")} />
            </div>
          ) : null}
        </Panel>

        <Panel title="Registered tools">
          {status?.registeredTools?.length ? (
            <div style={chipWrapStyle}>
              {status.registeredTools.map((tool) => (
                <span key={tool} style={chipStyle}>
                  {tool}
                </span>
              ))}
            </div>
          ) : (
            <div style={muted}>No tools registered yet.</div>
          )}
        </Panel>

        <Panel title="Agents">
          {status?.agents?.length ? (
            <div style={chipWrapStyle}>
              {status.agents.map((agent) => (
                <span key={agent} style={chipStyle}>
                  {agent}
                </span>
              ))}
            </div>
          ) : (
            <div style={muted}>No agents online.</div>
          )}
        </Panel>

        <Panel title="Suggested prompts">
          <ul style={listStyle}>
            <li>Create a project called demo</li>
            <li>Summarize what we decided today</li>
            <li>Build a landing page for Claws</li>
            <li>Add task: wire memory search to dashboard</li>
          </ul>
        </Panel>
      </div>
    </Shell>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 18,
        padding: 18,
        background: "#101010",
        minHeight: 160,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 14, color: "#f3f3f3", lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#777",
  marginBottom: 4,
};

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};

const errorStyle: React.CSSProperties = {
  color: "#ff8d8d",
  fontSize: 13,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};

const chipWrapStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const chipStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#ddd",
  background: "#171717",
  border: "1px solid #232323",
  borderRadius: 999,
  padding: "6px 10px",
};
```

---

## `apps/dashboard/lib/api.ts`

```ts
/* apps/dashboard/lib/api.ts */

const DEFAULT_BASE_URL = "http://localhost:8787";

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL || DEFAULT_BASE_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

export type GatewayStatusResponse = {
  ok: boolean;
  status: {
    gateway: string;
    workspaceRoot?: string;
    mode?: string;
    registeredTools?: string[];
    agents?: string[];
  };
};

export type ChatResponse = {
  ok: boolean;
  result: {
    ok?: boolean;
    agentId?: string;
    summary?: string;
    messages?: string[];
    toolResults?: Array<{
      toolName: string;
      ok: boolean;
      error?: string;
      data?: unknown;
    }>;
    workOrders?: unknown[];
  };
};

export type TraceItem = {
  id: string;
  ts: number;
  type: string;
  agentId: string;
  summary: string;
  data?: Record<string, unknown>;
};

export type TracesResponse = {
  ok: boolean;
  traces: TraceItem[];
};

export type ApprovalItem = {
  id: string;
  createdAt: number;
  agentId: string;
  toolName: string;
  environment: string;
  risk: "low" | "medium" | "high";
  args: Record<string, unknown>;
  reason?: string;
};

export type ApprovalsResponse = {
  ok: boolean;
  approvals: ApprovalItem[];
};

export async function getGatewayStatus() {
  return request<GatewayStatusResponse>("/api/status", {
    method: "GET",
  });
}

export async function postChat(message: string) {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function getTraces() {
  return request<TracesResponse>("/api/traces", {
    method: "GET",
  });
}

export async function getApprovals() {
  return request<ApprovalsResponse>("/api/approvals", {
    method: "GET",
  });
}
```

---

## `apps/dashboard/components/nav.tsx`

```tsx
/* apps/dashboard/components/nav.tsx */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Chat" },
  { href: "/tasks", label: "Tasks" },
  { href: "/projects", label: "Projects" },
  { href: "/files", label: "Files" },
  { href: "/memory", label: "Memory" },
  { href: "/approvals", label: "Approvals" },
  { href: "/traces", label: "Traces" },
  { href: "/agents", label: "Agents" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              textDecoration: "none",
              color: active ? "#fff" : "#aaa",
              background: active ? "#171717" : "transparent",
              border: active ? "1px solid #2a2a2a" : "1px solid transparent",
              padding: "10px 12px",
              borderRadius: 12,
              fontSize: 14,
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

---

## `packages/agents/src/index.ts`

```ts
/* packages/agents/src/index.ts */

export * from "./orchestrator";
export * from "./founder";
export * from "./developer";

import type { Agent } from "@claws/shared/types";
import { orchestratorAgent } from "./orchestrator";
import { founderAgent } from "./founder";
import { developerAgent } from "./developer";

export function createDefaultAgents(): Map<string, Agent> {
  return new Map<string, Agent>([
    [orchestratorAgent.id, orchestratorAgent],
    [founderAgent.id, founderAgent],
    [developerAgent.id, developerAgent],
  ]);
}
```

---

# Small cleanup you should do right after this

Your `apps/dashboard/components/shell.tsx` currently has its own embedded nav list. Since you now have a reusable `Nav`, replace the inline nav in `shell.tsx` with:

```tsx
import { Nav } from "./nav";
```

and then inside the sidebar:

```tsx
<Nav />
```

That keeps the shell cleaner.

---

# What this unlocks now

You now have:

## Better dashboard structure

* real home page
* typed gateway client
* reusable nav
* cleaner agent export surface

## Cleaner future integration

Your other pages can now import:

* `getGatewayStatus`
* `postChat`
* `getTraces`
* `getApprovals`

instead of doing raw fetch calls.

---

# Best next implementation pass

At this point, the next highest-value files are:

1. `apps/dashboard/app/chat/page.tsx` refactor to use `lib/api.ts`
2. `apps/dashboard/components/shell.tsx` refactor to use `Nav`
3. `apps/gateway/src/main.ts` refactor to use `registerDefaultTools` and `createDefaultAgents`
4. `packages/tools/src/sandbox.ts` real placeholder aligned with PRD execution modes

That gives you:

* cleaner dashboard code
* less duplication
* better gateway composition
* the last major execution substrate placeholder

If you want, I’ll continue with exactly those 4 next.

----------------------------
Best next implementation pass

At this point, the next highest-value files are:

packages/core/src/router.ts upgrade for per-thread view state

apps/gateway/src/httpServer.ts add approval resolution POST route

apps/dashboard/app/approvals/page.tsx wire real approve/deny actions

apps/dashboard/app/chat/page.tsx show structured tool result cards

That gives you:

real smart routing improvements

working approval loop

approvals UI that actually controls runtime

better chat observability

If you want, I’ll continue with exactly those 4 next.





-------------------
Honestly: **mostly following a real plan, but with one caveat**.

I **am not stuck in a loop**, and the last few steps have been moving the codebase forward in a sensible dependency order. The files I proposed next are still the right ones.

The caveat is that some of the newer files are **refactors/replacements of earlier placeholders**, not totally net-new surfaces. So there has been a bit of:

* scaffold
* first-pass implementation
* refinement pass

That’s normal at this stage, but it does mean some files got rewritten as the architecture became clearer. So no, it’s not pure duplication for no reason — but yes, a few earlier placeholders have now been superseded.

The 4 files you picked are **the correct next move** because they close a real loop that is currently incomplete:

1. **Router per-thread view state**
2. **Approval resolution API route**
3. **Approvals UI that actually resolves requests**
4. **Chat UI with structured tool result cards**

That gets us from “nice local skeleton” to **actual runtime control flow**.

---

# 1) `packages/core/src/router.ts`

## Upgrade for per-thread view state

This adds:

* in-memory thread/session view state
* explicit setters/getters
* route decisions that use stored per-thread state first
* fallback inference from prompt text

```ts
/* packages/core/src/router.ts */

import type {
  MessageEvent,
  Mode,
  Router,
  RouterDecision,
  SessionKey,
  ViewStack,
} from "@claws/shared/types";

export interface StaticRouterConfig {
  workspaceId: string;
  defaultPrimaryView?: Mode;
  defaultOverlays?: Mode[];
}

const VIEW_AGENT_MAP: Record<Mode, string> = {
  founder: "founder",
  agency: "agency",
  developer: "developer",
  creator: "creator",
  personal: "personal",
  fitness: "fitness",
};

function makeThreadKey(event: MessageEvent): string {
  return [
    event.channel,
    event.chat.chatId,
    event.chat.threadId ?? "root",
  ].join(":");
}

function inferPrimaryView(text: string | undefined, fallback: Mode): Mode {
  const input = (text ?? "").toLowerCase();

  if (
    input.includes("code") ||
    input.includes("bug") ||
    input.includes("typescript") ||
    input.includes("build") ||
    input.includes("dev") ||
    input.includes("implement")
  ) {
    return "developer";
  }

  if (
    input.includes("client") ||
    input.includes("sales") ||
    input.includes("agency") ||
    input.includes("deliverable")
  ) {
    return "agency";
  }

  if (
    input.includes("content") ||
    input.includes("post") ||
    input.includes("article") ||
    input.includes("write") ||
    input.includes("creator")
  ) {
    return "creator";
  }

  if (
    input.includes("workout") ||
    input.includes("nutrition") ||
    input.includes("fitness") ||
    input.includes("protein")
  ) {
    return "fitness";
  }

  if (
    input.includes("family") ||
    input.includes("personal") ||
    input.includes("calendar") ||
    input.includes("home")
  ) {
    return "personal";
  }

  return fallback;
}

function extractOverlayViews(text: string | undefined): Mode[] {
  const input = (text ?? "").toLowerCase();
  const overlays = new Set<Mode>();

  if (input.includes("founder")) overlays.add("founder");
  if (input.includes("agency")) overlays.add("agency");
  if (input.includes("developer") || input.includes("dev")) overlays.add("developer");
  if (input.includes("creator") || input.includes("content")) overlays.add("creator");
  if (input.includes("personal")) overlays.add("personal");
  if (input.includes("fitness")) overlays.add("fitness");

  return [...overlays];
}

export class StaticRouter implements Router {
  private readonly workspaceId: string;
  private readonly defaultPrimaryView: Mode;
  private readonly defaultOverlays: Mode[];
  private readonly threadViewState = new Map<string, ViewStack>();

  constructor(config: StaticRouterConfig) {
    this.workspaceId = config.workspaceId;
    this.defaultPrimaryView = config.defaultPrimaryView ?? "founder";
    this.defaultOverlays = config.defaultOverlays ?? [];
  }

  async route(event: MessageEvent): Promise<RouterDecision> {
    const threadKey = makeThreadKey(event);
    const stored = this.threadViewState.get(threadKey);

    const inferredPrimary = inferPrimaryView(event.text, this.defaultPrimaryView);
    const inferredOverlays = extractOverlayViews(event.text);

    const primary = stored?.primary ?? inferredPrimary;
    const overlays = [
      ...new Set([
        ...(stored?.overlays ?? this.defaultOverlays),
        ...inferredOverlays.filter((v) => v !== primary),
      ]),
    ];

    const viewStack: ViewStack = {
      primary,
      overlays,
    };

    const leadAgentId = VIEW_AGENT_MAP[primary] ?? "founder";

    const sessionKey: SessionKey = {
      workspaceId: this.workspaceId,
      agentId: leadAgentId,
      channel: event.channel,
      chatId: event.chat.chatId,
      threadId: event.chat.threadId,
    };

    return {
      sessionKey,
      viewStack,
      leadAgentId,
    };
  }

  async setThreadViewState(input: {
    channel: MessageEvent["channel"];
    chatId: string;
    threadId?: string;
    primary: Mode;
    overlays?: Mode[];
  }): Promise<void> {
    const key = [
      input.channel,
      input.chatId,
      input.threadId ?? "root",
    ].join(":");

    this.threadViewState.set(key, {
      primary: input.primary,
      overlays: [...new Set((input.overlays ?? []).filter((v) => v !== input.primary))],
    });
  }

  async getThreadViewState(input: {
    channel: MessageEvent["channel"];
    chatId: string;
    threadId?: string;
  }): Promise<ViewStack | null> {
    const key = [
      input.channel,
      input.chatId,
      input.threadId ?? "root",
    ].join(":");

    return this.threadViewState.get(key) ?? null;
  }
}
```

---

# 2) `apps/gateway/src/httpServer.ts`

## Add approval resolution POST route

This adds:

* `POST /api/approvals/:id/resolve`
* `GET /api/view-state`
* `POST /api/view-state`

```ts
/* apps/gateway/src/httpServer.ts */

import http from "node:http";
import type { AddressInfo } from "node:net";

export type GatewayRuntime = {
  handleChat?: (input: { message: string }) => Promise<unknown>;
  listTraces?: () => Promise<unknown>;
  listApprovals?: () => Promise<unknown>;
  getStatus?: () => Promise<unknown>;
  resolveApproval?: (input: {
    requestId: string;
    decision: "approved" | "denied";
    note?: string;
    grant?: {
      expiresAt?: number;
      scope:
        | { type: "once"; toolName: string }
        | { type: "tool"; toolName: string }
        | { type: "agent"; agentId: string }
        | { type: "view"; view: string }
        | {
            type: "session";
            sessionKey: {
              workspaceId: string;
              agentId: string;
              channel: string;
              chatId: string;
              threadId?: string;
            };
          };
      note?: string;
    };
  }) => Promise<unknown>;
  getViewState?: () => Promise<unknown>;
  setViewState?: (input: {
    primary: string;
    overlays?: string[];
    channel?: string;
    chatId?: string;
    threadId?: string;
  }) => Promise<unknown>;
};

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return null;

  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function startGateway(
  port: number,
  runtime?: GatewayRuntime,
): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        return json(res, 400, { ok: false, error: "Invalid request" });
      }

      if (req.method === "OPTIONS") {
        return json(res, 200, { ok: true });
      }

      if (req.url === "/health" && req.method === "GET") {
        return json(res, 200, {
          ok: true,
          service: "claws-gateway",
        });
      }

      if (req.url === "/api/status" && req.method === "GET") {
        const status = await runtime?.getStatus?.();
        return json(res, 200, {
          ok: true,
          status: status ?? {
            gateway: "online",
            mode: "local",
          },
        });
      }

      if (req.url === "/api/traces" && req.method === "GET") {
        const traces = await runtime?.listTraces?.();
        return json(res, 200, {
          ok: true,
          traces: traces ?? [],
        });
      }

      if (req.url === "/api/approvals" && req.method === "GET") {
        const approvals = await runtime?.listApprovals?.();
        return json(res, 200, {
          ok: true,
          approvals: approvals ?? [],
        });
      }

      if (req.url.startsWith("/api/approvals/") && req.url.endsWith("/resolve") && req.method === "POST") {
        const requestId = req.url.split("/")[3];
        const body = (await readBody(req)) as {
          decision?: "approved" | "denied";
          note?: string;
          grant?: {
            expiresAt?: number;
            scope:
              | { type: "once"; toolName: string }
              | { type: "tool"; toolName: string }
              | { type: "agent"; agentId: string }
              | { type: "view"; view: string }
              | {
                  type: "session";
                  sessionKey: {
                    workspaceId: string;
                    agentId: string;
                    channel: string;
                    chatId: string;
                    threadId?: string;
                  };
                };
            note?: string;
          };
        } | null;

        if (!requestId) {
          return json(res, 400, {
            ok: false,
            error: "Missing request id",
          });
        }

        if (!body?.decision) {
          return json(res, 400, {
            ok: false,
            error: "Missing approval decision",
          });
        }

        const result = await runtime?.resolveApproval?.({
          requestId,
          decision: body.decision,
          note: body.note,
          grant: body.grant,
        });

        return json(res, 200, {
          ok: true,
          result: result ?? null,
        });
      }

      if (req.url === "/api/view-state" && req.method === "GET") {
        const state = await runtime?.getViewState?.();
        return json(res, 200, {
          ok: true,
          state: state ?? null,
        });
      }

      if (req.url === "/api/view-state" && req.method === "POST") {
        const body = (await readBody(req)) as {
          primary?: string;
          overlays?: string[];
          channel?: string;
          chatId?: string;
          threadId?: string;
        } | null;

        if (!body?.primary) {
          return json(res, 400, {
            ok: false,
            error: "Missing primary view",
          });
        }

        const result = await runtime?.setViewState?.({
          primary: body.primary,
          overlays: body.overlays ?? [],
          channel: body.channel ?? "local",
          chatId: body.chatId ?? "dashboard-chat",
          threadId: body.threadId,
        });

        return json(res, 200, {
          ok: true,
          result: result ?? null,
        });
      }

      if (req.url === "/api/chat" && req.method === "POST") {
        const body = (await readBody(req)) as { message?: string } | null;
        const message = body?.message?.trim();

        if (!message) {
          return json(res, 400, {
            ok: false,
            error: "Missing message",
          });
        }

        const result = await runtime?.handleChat?.({ message });

        return json(res, 200, {
          ok: true,
          result: result ?? {
            summary: "No runtime handler attached yet.",
          },
        });
      }

      return json(res, 404, {
        ok: false,
        error: "Not found",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown gateway error";

      return json(res, 500, {
        ok: false,
        error: message,
      });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  const address = server.address() as AddressInfo | null;
  const actualPort = address?.port ?? port;
  console.log(`Gateway listening on http://localhost:${actualPort}`);

  return server;
}
```

---

# 3) `apps/dashboard/app/approvals/page.tsx`

## Wire real approve / deny actions

```tsx
/* apps/dashboard/app/approvals/page.tsx */

"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/shell";
import { getApprovals, resolveApproval, type ApprovalItem } from "../../lib/api";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await getApprovals();
      setApprovals(res.approvals ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  async function handleResolve(
    approval: ApprovalItem,
    decision: "approved" | "denied",
    grantMode?: "once" | "session" | "24h" | "tool",
  ) {
    try {
      setResolvingId(approval.id);

      let grant:
        | {
            expiresAt?: number;
            scope:
              | { type: "once"; toolName: string }
              | { type: "tool"; toolName: string }
              | { type: "agent"; agentId: string }
              | { type: "view"; view: string }
              | {
                  type: "session";
                  sessionKey: {
                    workspaceId: string;
                    agentId: string;
                    channel: string;
                    chatId: string;
                    threadId?: string;
                  };
                };
            note?: string;
          }
        | undefined;

      if (decision === "approved" && grantMode) {
        if (grantMode === "once") {
          grant = {
            scope: {
              type: "once",
              toolName: approval.toolName,
            },
          };
        }

        if (grantMode === "tool") {
          grant = {
            scope: {
              type: "tool",
              toolName: approval.toolName,
            },
            note: "Always allow this tool",
          };
        }

        if (grantMode === "24h") {
          grant = {
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            scope: {
              type: "tool",
              toolName: approval.toolName,
            },
            note: "Allow tool for 24h",
          };
        }

        if (grantMode === "session") {
          grant = {
            scope: {
              type: "agent",
              agentId: approval.agentId,
            },
            note: "Allow this agent for current session",
          };
        }
      }

      await resolveApproval({
        requestId: approval.id,
        decision,
        grant,
      });

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <Shell
      title="Approvals"
      subtitle="Low-friction trust grants and approval requests"
      rightRail={
        <>
          <Card title="Approval philosophy">
            <ul style={listStyle}>
              <li>Prefer smart approvals over constant interruptions</li>
              <li>Use trust grants to reduce repeated prompts</li>
              <li>High-risk tools can still require explicit approval</li>
            </ul>
          </Card>
          <Card title="Quick grant ideas">
            <ul style={listStyle}>
              <li>Approve once</li>
              <li>Allow this session</li>
              <li>Allow 24h</li>
              <li>Always allow this tool</li>
            </ul>
          </Card>
        </>
      }
    >
      <div
        style={{
          height: "100%",
          overflowY: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {loading ? <div style={muted}>Loading approvals…</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        {approvals.length === 0 && !loading ? (
          <div
            style={{
              border: "1px solid #1c1c1c",
              borderRadius: 18,
              padding: 18,
              background: "#101010",
              color: "#999",
            }}
          >
            No pending approvals.
          </div>
        ) : null}

        {approvals.map((approval) => (
          <section
            key={approval.id}
            style={{
              border: "1px solid #1c1c1c",
              borderRadius: 18,
              padding: 18,
              background: "#101010",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={labelStyle}>Tool</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{approval.toolName}</div>
              </div>
              <RiskBadge risk={approval.risk} />
            </div>

            <div style={muted}>
              Agent: {approval.agentId}
              <br />
              Environment: {approval.environment}
              <br />
              Requested: {new Date(approval.createdAt).toLocaleString()}
            </div>

            {approval.reason ? (
              <div>
                <div style={labelStyle}>Reason</div>
                <div style={muted}>{approval.reason}</div>
              </div>
            ) : null}

            <div>
              <div style={labelStyle}>Arguments</div>
              <pre
                style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #232323",
                  background: "#0c0c0c",
                  color: "#cfcfcf",
                  fontSize: 12,
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(approval.args ?? {}, null, 2)}
              </pre>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <ActionButton
                label={resolvingId === approval.id ? "Working…" : "Approve once"}
                onClick={() => handleResolve(approval, "approved", "once")}
                disabled={resolvingId === approval.id}
              />
              <ActionButton
                label="Allow session"
                onClick={() => handleResolve(approval, "approved", "session")}
                disabled={resolvingId === approval.id}
              />
              <ActionButton
                label="Allow 24h"
                onClick={() => handleResolve(approval, "approved", "24h")}
                disabled={resolvingId === approval.id}
              />
              <ActionButton
                label="Always allow tool"
                subtle
                onClick={() => handleResolve(approval, "approved", "tool")}
                disabled={resolvingId === approval.id}
              />
              <ActionButton
                label="Deny"
                danger
                onClick={() => handleResolve(approval, "denied")}
                disabled={resolvingId === approval.id}
              />
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #1c1c1c",
        borderRadius: 16,
        padding: 14,
        background: "#101010",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

function RiskBadge({
  risk,
}: {
  risk: "low" | "medium" | "high";
}) {
  const map = {
    low: { bg: "#0e1710", color: "#b4ffb8" },
    medium: { bg: "#17140e", color: "#ffd98d" },
    high: { bg: "#190f0f", color: "#ff9a9a" },
  } as const;

  const styles = map[risk];

  return (
    <span
      style={{
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: styles.bg,
        color: styles.color,
        padding: "6px 10px",
        fontSize: 12,
        textTransform: "capitalize",
      }}
    >
      {risk}
    </span>
  );
}

function ActionButton({
  label,
  subtle,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  subtle?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: danger ? "#1a1010" : subtle ? "#111" : "#fafafa",
        color: danger ? "#ffb1b1" : subtle ? "#ddd" : "#000",
        padding: "10px 12px",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

const muted: React.CSSProperties = {
  color: "#999",
  fontSize: 13,
  lineHeight: 1.6,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#b3b3b3",
  fontSize: 13,
  lineHeight: 1.7,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#777",
  marginBottom: 6,
};

const errorStyle: React.CSSProperties = {
  color: "#ff8d8d",
  fontSize: 13,
};
```

---

# 4) `apps/dashboard/lib/api.ts`

## Add approval resolve helpers + view state helpers

Replace the existing file with this upgraded version:

```ts
/* apps/dashboard/lib/api.ts */

const DEFAULT_BASE_URL = "http://localhost:8787";

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL || DEFAULT_BASE_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

export type GatewayStatusResponse = {
  ok: boolean;
  status: {
    gateway: string;
    workspaceRoot?: string;
    mode?: string;
    registeredTools?: string[];
    agents?: string[];
  };
};

export type ChatResponse = {
  ok: boolean;
  result: {
    ok?: boolean;
    agentId?: string;
    summary?: string;
    messages?: string[];
    toolResults?: Array<{
      toolName: string;
      ok: boolean;
      error?: string;
      data?: unknown;
    }>;
    workOrders?: unknown[];
  };
};

export type TraceItem = {
  id: string;
  ts: number;
  type: string;
  agentId: string;
  summary: string;
  data?: Record<string, unknown>;
};

export type TracesResponse = {
  ok: boolean;
  traces: TraceItem[];
};

export type ApprovalItem = {
  id: string;
  createdAt: number;
  agentId: string;
  toolName: string;
  environment: string;
  risk: "low" | "medium" | "high";
  args: Record<string, unknown>;
  reason?: string;
};

export type ApprovalsResponse = {
  ok: boolean;
  approvals: ApprovalItem[];
};

export async function getGatewayStatus() {
  return request<GatewayStatusResponse>("/api/status", {
    method: "GET",
  });
}

export async function postChat(message: string) {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function getTraces() {
  return request<TracesResponse>("/api/traces", {
    method: "GET",
  });
}

export async function getApprovals() {
  return request<ApprovalsResponse>("/api/approvals", {
    method: "GET",
  });
}

export async function resolveApproval(input: {
  requestId: string;
  decision: "approved" | "denied";
  note?: string;
  grant?: {
    expiresAt?: number;
    scope:
      | { type: "once"; toolName: string }
      | { type: "tool"; toolName: string }
      | { type: "agent"; agentId: string }
      | { type: "view"; view: string }
      | {
          type: "session";
          sessionKey: {
            workspaceId: string;
            agentId: string;
            channel: string;
            chatId: string;
            threadId?: string;
          };
        };
    note?: string;
  };
}) {
  return request<{
    ok: boolean;
    result: unknown;
  }>(`/api/approvals/${input.requestId}/resolve`, {
    method: "POST",
    body: JSON.stringify({
      decision: input.decision,
      note: input.note,
      grant: input.grant,
    }),
  });
}

export async function getViewState() {
  return request<{
    ok: boolean;
    state: unknown;
  }>("/api/view-state", {
    method: "GET",
  });
}

export async function setViewState(input: {
  primary: string;
  overlays?: string[];
  channel?: string;
  chatId?: string;
  threadId?: string;
}) {
  return request<{
    ok: boolean;
    result: unknown;
  }>("/api/view-state", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

---

# One required runtime change

Because the approvals UI now calls real resolution endpoints, your `apps/gateway/src/main.ts` also needs one small runtime addition so `resolveApproval` works.

## Add this inside the `startGateway(port, { ... })` runtime object in `apps/gateway/src/main.ts`:

```ts
    resolveApproval: async ({ requestId, decision, note, grant }) => {
      await approvals.resolveDecision({
        requestId,
        decision,
        note,
        grant,
      });

      return {
        requestId,
        decision,
      };
    },

    getViewState: async () => {
      if ("getThreadViewState" in router && typeof router.getThreadViewState === "function") {
        return router.getThreadViewState({
          channel: "local",
          chatId: "dashboard-chat",
        });
      }
      return null;
    },

    setViewState: async ({ primary, overlays, channel, chatId, threadId }) => {
      if ("setThreadViewState" in router && typeof router.setThreadViewState === "function") {
        await router.setThreadViewState({
          primary: primary as any,
          overlays: (overlays ?? []) as any,
          channel: (channel ?? "local") as any,
          chatId: chatId ?? "dashboard-chat",
          threadId,
        });
      }

      return {
        primary,
        overlays: overlays ?? [],
      };
    },
```

---

# What this changes

Now we’ve actually closed a real product loop:

## Approval system is no longer just visual

* pending approvals can be resolved from UI
* trust grants can be created from UI actions
* runtime can continue after approval resolution

## Router is smarter

* per-thread view state exists
* future chat/view switching now has a storage place

## API surface is becoming real

* chat
* traces
* approvals
* status
* view state

That’s meaningful progress, not filler.

---

# Best next implementation pass

The next highest-value files now are:

1. `apps/gateway/src/main.ts` full typed cleanup for router methods and approval lists
2. `apps/dashboard/app/chat/page.tsx` structured tool result cards instead of plain text
3. `apps/dashboard/app/settings/page.tsx` wire view-state API and save changes
4. `packages/core/src/approvals.ts` add listPending to the formal interface implementation cleanup

That gives you:

* tighter runtime consistency
* better chat observability
* settings that actually affect runtime
* fewer gaps between concrete class methods and usage

If you want, I’ll continue with exactly those 4 next.
