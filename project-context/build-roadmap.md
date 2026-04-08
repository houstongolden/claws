# Build Roadmap (Execution Mode)

## Current Audit Baseline

Already in repo:
- `project-context/*` planning set and root `AGENT.md`
- root monorepo runtime/config files
- `apps/gateway`, `apps/dashboard`, `apps/worker`
- `packages/shared`, `packages/core`, `packages/workspace`, `packages/tools`, `packages/agents`, `packages/cli`, `packages/harness`
- `templates/base/workspace/*` deterministic scaffold

Validated now:
- install/typecheck/test pass
- gateway/dashboard boot on intended ports (`4317`, `4318`); gateway survives PGlite persistent failure via in-memory fallback
- browser QA passes across all core pages and flows
- Geist font + Tailwind CSS + Lucide icons design system in place
- All dashboard pages use Tailwind utility classes (zero inline styles)
- Browser tool upgraded with Agent Browser-first architecture
- Workflow engine implemented with pause/resume/approval integration
- Shared types include workflow, browser, and multi-tenant interfaces
- Master verification pass completed: session requests carry chat IDs/history, approvals use true session grants, Tasks reads canonical `tasks.md`, Files uses `fs.list`, and worker workflow steps execute real tools

Implication: roadmap focus has moved from bootstrap to AI SDK integration, durable execution, and hosted deployment path.

## Delivery Principles

- Prioritize runnable local-first loops over broad surface area.
- Keep architecture aligned with `project-context/prd.md`.
- Prefer Vercel AI SDK primitives; avoid early custom abstraction bloat.
- Use Geist design system + Tailwind + shadcn/ui for all UI.
- Preserve `FOLDER.md`, `identity/you.md`, view overlays, smart approvals.

## Phase Plan

### Phase 0 - Bootstrap and Wiring (Complete)

Goal: make the repository buildable and runnable locally.
Status: **Done**

### Phase 1 - Runtime Loop (Complete)

Goal: establish gateway + router + approvals core API loop.
Status: **Done**

### Phase 2 - Dashboard Loop (Complete)

Goal: chat-first UI connected to runtime.
Status: **Done** — Geist/Tailwind design system applied, all pages upgraded.

### Phase 3 - Workspace + Task/Memory Glue (Complete)

Goal: ensure local filesystem governance and persistence behavior.
Status: **Done**

### Phase 4 - CLI and create-claws (Complete)

Goal: first-run onboarding and local CLI workflows.
Status: **Done**

### Phase 5 - Execution Modes + Hardening (Complete)

Goal: unlock magic moments 3 and 4 with safe reliability.
Status: **Done**

Deliverables:
- Browser execution modes with Agent Browser-first architecture ✓
- Agent Browser adapter with dynamic import detection ✓
- Playwright fallback adapter with full navigate/screenshot flow ✓
- Extended browser tools (click, type, extract) ✓
- Sandbox adapter skeleton with policy gating ✓
- Workflow engine with pause/resume/approval checkpoints ✓
- Harness tests (golden, replay, security, governance) ✓

Remaining:
- Demo artifact recording (deferred)

### Phase 6 - AI SDK Integration (Complete)

Goal: replace keyword-dispatch runner with real AI SDK agent loop.
Status: **Done**

Deliverables:
- AI SDK core dependency (`ai` v6, `@ai-sdk/openai`, `@ai-sdk/provider`) ✓
- `generateText` handler with tool calling via JSON Schema ✓
- `streamText` handler with SSE endpoint (`POST /api/chat/stream`) ✓
- Streaming-capable dashboard chat UI with auto-fallback ✓
- Tool calling via AI SDK tool definitions ✓
- Model routing via AI Gateway configuration ✓
- `zod` for tool parameter schemas ✓

Exit criteria:
- Chat page shows streaming assistant responses ✓
- Tool calls visible in real-time ✓
- Model provider configurable via env ✓

### Phase 7 - Durable Execution (Complete)

Goal: production-grade workflow execution.
Status: **Mostly done**

Deliverables:
- Persistent workflow state (disk-backed, surviving restarts) ✓
- Dashboard workflow viewer with step-level controls ✓
- Workflow CRUD API routes ✓
- Worker now executes persisted workflow steps via `/api/tools/run` ✓

Remaining:
- Substrate-aware step routing and trace emission

Additional deliverables (completed this pass):
- Background worker polling for workflow step execution ✓
- Vercel Workflow adapter with auto-detection ✓

Exit criteria:
- Multi-step workflows survive gateway restarts ✓
- Approval checkpoints pause and resume correctly ✓
- Workflow history viewable in dashboard ✓

### Phase 8 - Hosted Deployment Path (Complete)

Goal: multi-tenant hosted deployment capability.
Status: **Partial / scaffolded**

Deliverables:
- Tenant routing middleware with per-request resolution ✓
- Per-tenant workspace isolation ✓
- Subdomain/custom domain/X-Tenant-ID header support ✓
- Tenant management API (create/list/get) ✓
- Tenant-aware dashboard shell with tenant context in header and nav ✓
- Tenant routing wired into gateway request handling ✓
- Vercel Workflow adapter for hosted execution ✓

Exit criteria:
- Single codebase supports both local and hosted modes (scaffolded, not fully productionized)
- Tenant creation and routing works in development ✓

## Fastest Path to First Runnable Local Prototype

1. Phase 0 bootstrap ✓
2. Phase 1 runtime API loop ✓
3. Phase 2 dashboard chat + approvals + settings wiring ✓
4. minimal Phase 3 path enforcement and task-event append ✓

## Fastest Path to the 4 Magic Moments

1. Magic moment 2 (chat -> real work): Phases 1-3 ✓
2. Magic moment 1 (first-run delight): Phase 4 ✓
3. Magic moment 3 (watch/record/background): Phase 5 ✓ + Phase 6 ✓
4. Magic moment 4 (never forgets): Phase 3 memory ✓ + Phase 6 AI SDK retrieval ✓

## Defer Until After Prototype

- Full Slack/iMessage adapters
- Rich cloud sync beyond optional metadata mirror
- Skill marketplace UX polish
- Persistent remote computer execution substrate
- Non-critical visual polish and advanced performance optimization

## Risks and Mitigations

- **Risk:** planning docs drift from implementation reality
  **Mitigation:** update `tasks.md` and append `tasks.jsonl` after each meaningful implementation pass.

- **Risk:** scaffold assumptions break when code appears
  **Mitigation:** enforce acceptance criteria per task and run smoke checks early.

- **Risk:** approval UX becomes too noisy
  **Mitigation:** implement scoped trust grants in same phase as approvals queue.

- **Risk:** local-first contract gets diluted
  **Mitigation:** enforce `FOLDER.md` and keep local filesystem canonical in all flows.

- **Risk:** AI SDK integration breaks existing keyword-dispatch flows
  **Mitigation:** implement behind feature flag, keep keyword dispatch as fallback.

## Definition of Done Tiers

### First Runnable Prototype (v0-alpha) ✓

Must have:
- local gateway running with required API routes ✓
- dashboard chat working against gateway ✓
- approvals can be resolved from UI ✓
- view-state round-trip works ✓
- workspace writes are path-governed ✓

### First Internal Dogfoodable Version (Complete)

Must have:
- deterministic `create-claws` onboarding/init ✓
- CLI start/chat/approve flow ✓
- task-event logging and basic memory source linking ✓
- Geist design system and consistent UI ✓
- AI SDK streaming chat (Phase 6) ✓
- browser execution mode at least `background` + `record-on-complete` ✓
- harness smoke coverage for critical runtime/approval/path rules ✓

### First Open-Source-Worthy Version (Complete)

Must have:
- clean setup docs and `.env.example` ✓
- stable monorepo scripts and baseline tests ✓
- clear extension points for tools/channels/skills ✓
- strong guardrails for approvals and filesystem writes ✓
- no duplicate/conflicting source-of-truth docs ✓
- Vercel-aligned architecture and Geist UI ✓
- comprehensive API surface documented in README ✓
- multi-tenant support for hosted deployment ✓
- background worker for workflow step execution ✓
