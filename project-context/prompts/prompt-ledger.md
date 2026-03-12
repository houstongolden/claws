# Prompt Ledger

Every prompt provided during development that drove implementation. Reconstructed from project-context docs, tasks.jsonl events, and implementation artifacts.

**Execution order** is approximate (earliest first). **Status**: complete | partial | missing.

For **implementation status** of each area (files, routes, runtime), see [feature-ledger.md](../feature-ledger.md). For the **task queue** and next work, see [tasks.md](../tasks.md) and [next-pass.md](../next-pass.md).

---

## 1. Bootstrap and Monorepo

**Prompt (inferred):** Bootstrap root monorepo and app/package skeleton.

**Requested:**
- Root monorepo files (package.json, pnpm-workspace, turbo, tsconfig)
- App/package directory skeleton from repo-map
- .env.example and config schema skeleton
- Consolidate planning docs and agent rules

**Status:** complete

**Evidence:**
- files: root package.json, pnpm-workspace.yaml, turbo.json, apps/*, packages/*, templates/base/workspace
- routes: N/A
- runtime: pnpm install / typecheck / dev run

---

## 2. Runtime Kernel and Gateway

**Prompt (inferred):** Implement shared kernel types, router, approvals, gateway HTTP server.

**Requested:**
- Shared kernel types (router, runtime, UI)
- Router with per-thread view-state get/set
- Approvals core: pending list, resolve flow, trust grants
- Gateway: /health, /api/status, /api/chat, /api/traces, /api/approvals, /api/approvals/:id/resolve, /api/view-state

**Status:** complete

**Evidence:**
- files: packages/shared/src/types.ts, packages/core/src/router.ts, packages/core/src/approvals.ts, apps/gateway/src/httpServer.ts, apps/gateway/src/main.ts
- routes: all above endpoints exist
- runtime: gateway responds; approvals resolve; view-state round-trips

---

## 3. Local Persistence

**Prompt (inferred):** Add lightweight local persistence for traces/approvals/view-state.

**Requested:**
- Restarts preserve minimal runtime state
- Traces, approvals, view-state persisted

**Status:** complete (superseded by PGlite)

**Evidence:**
- files: packages/runtime-db (PGlite schema, sessions, messages, traces, approvals, workflow_runs, etc.); apps/gateway/src/localStore.ts exists but deprecated
- routes: N/A (persistence layer)
- runtime: initRuntimeDb at gateway startup; state in .claws/runtime/

**Note:** tasks.md RUN-005 still references localStore.ts; actual persistence is PGlite via @claws/runtime-db.

---

## 4. Dashboard Scaffold and API Client

**Prompt (inferred):** Scaffold Next.js dashboard and wire API client to gateway.

**Requested:**
- Next.js dashboard app and base layout
- API client for status, chat, traces, approvals, view-state
- Chat page with tool result cards
- Approvals page with resolve actions
- Settings page for view-state
- Traces page and runtime status

**Status:** complete

**Evidence:**
- files: apps/dashboard/*, apps/dashboard/lib/api.ts, app/page.tsx, app/approvals/page.tsx, app/settings/page.tsx, app/traces/page.tsx
- routes: dashboard pages and API client calls
- runtime: dashboard boots on 4318; all core pages load

---

## 5. Design System (Geist, Tailwind, shadcn/ui)

**Prompt (inferred):** Upgrade design system to Geist + Tailwind + Lucide; add shadcn/ui.

**Requested:**
- Geist font + Tailwind CSS + Lucide icons
- Zero inline styles
- shadcn/ui: Button, Input, Select, Badge, Card, Textarea, Tabs, Dialog, etc.
- All pages use design system

**Status:** complete

**Evidence:**
- files: apps/dashboard/app/layout.tsx, globals.css, components/ui/*, all page components
- ui: Geist loaded; Tailwind throughout; shadcn variants

---

## 6. AI SDK Integration

**Prompt (inferred):** Integrate Vercel AI SDK for streaming chat and tool use.

**Requested:**
- AI SDK v6, generateText, streamText
- Tool calling with JSON Schema
- SSE streaming endpoint (POST /api/chat/stream)
- Streaming-capable dashboard chat UI
- Model routing (AI_MODEL, AI_GATEWAY_URL, OPENAI_API_KEY)

**Status:** complete

**Evidence:**
- files: apps/gateway/src/aiHandler.ts, packages/tools AI SDK adapter, dashboard chat/session-workbench
- routes: POST /api/chat, POST /api/chat/stream
- runtime: streaming works; tool calls execute; fallback to keyword dispatch when AI disabled

---

## 7. Workflow Engine and Durable Execution

**Prompt (inferred):** Implement workflow engine with pause/resume/approval and persistence.

**Requested:**
- In-memory then disk-backed workflow engine
- create, advance, pause, resume, cancel
- Step-level tracking; approval checkpoints
- Workflow API routes; dashboard workflow viewer
- Worker to execute workflow steps

**Status:** complete

**Evidence:**
- files: packages/core/src/workflow.ts, packages/runtime-db (workflow_runs, workflow_steps), apps/gateway httpServer workflows, apps/worker, workflows/page.tsx
- routes: GET/POST /api/workflows, get, advance, pause, resume, cancel
- runtime: worker polls and runs steps via /api/tools/run; state persists in PGlite

---

## 8. Browser / Execution Substrates

**Prompt (inferred):** Browser tool with Agent Browser–first architecture; execution substrates; Playwright fallback.

**Requested:**
- Browser tool: modes (background, record-on-complete, watch-live, hybrid), provider (agent-browser | playwright | native)
- Agent Browser adapter (dynamic import); Playwright fallback
- ToolSpec.environment; registry byEnvironment/listSpecs
- /api/status execution block; Settings Execution tab; substrate-aware traces
- Sandbox skeleton with policy gate; demo artifact pathing

**Status:** partial

**Evidence:**
- files: packages/tools/src/browser.ts, sandbox.ts, demo.ts; Settings Execution tab; traces with environment
- routes: N/A (tools invoked via chat/worker)
- runtime: Playwright works; Agent Browser adapter present but not wired to real SDK; sandbox gated, no Vercel Sandbox SDK

---

## 9. Multi-Tenant and Hosted Path

**Prompt (inferred):** Add multi-tenant types and tenant routing; hosted deployment path.

**Requested:**
- TenantConfig type; tenant routing (subdomain, header, custom domain)
- Tenant API: create, list, get
- Tenant-aware dashboard shell
- Vercel Workflow adapter

**Status:** complete (scaffolded)

**Evidence:**
- files: packages/shared/types (TenantConfig), apps/gateway/src/tenantRouter.ts, httpServer tenant routes, dashboard shell/nav
- routes: GET/POST /api/tenants, GET /api/tenants/:id
- runtime: resolveTenant on each request; tenants in memory (no per-tenant persistence)

---

## 10. Screen Completion and Runtime Semantics

**Prompt (inferred):** Screen completion pass; replace fake data with real pipelines.

**Requested:**
- All 11 screens fully wired and usable
- Tasks from canonical tasks.md + tasks.jsonl; Projects from filesystem scan; Files from fs.read/fs.list; Memory from memory.search; Workflows real; Agents from runtime; no synthetic/demo filler
- Gateway /api/tools/run, /api/projects

**Status:** complete

**Evidence:**
- files: all dashboard pages; gateway tools/run and projects scan
- routes: /api/tools/run, /api/projects, full dashboard routes
- runtime: real data sources; create project/task from chat writes real files

---

## 11. Session-First IA and Master Verification

**Prompt (inferred):** Session-first information architecture; master verification pass.

**Requested:**
- Root = Session workbench; chat center-stage; right rail context (task, project, files, approvals, memory, traces, workflows)
- Session requests carry chatId + history; approval “allow session” uses session grants
- Tasks read project-context/tasks.md; Files fs.list; Memory flush/promote; worker runs steps via /api/tools/run; Playwright default; README/env aligned

**Status:** complete

**Evidence:**
- files: session-workbench.tsx, nav, shell, apps/gateway/src/main.ts (session routing, replaceSessionMessages, getOrCreateSession, onComplete → persistSessionHistory)
- routes: chat carries chatId/threadId; PGlite sessions table
- runtime: chatId/threadId sent; streaming path persists assistant reply after stream complete; approval session grant scoped by session key; session list/resume UI optional for v0

**Note:** Session transcript persistence: streaming path now persists assistant reply via onComplete → persistSessionHistory in apps/gateway/src/main.ts. Session list/resume in UI optional for v0.

---

## 12. Conversations and Channels

**Prompt (inferred):** Conversations and channels model for routing and group chats.

**Requested:**
- Conversations (session, project, channel, agent); channels with slug; conversation agents; getOrCreateConversationForDestination
- API: list/create/get conversations, messages, post message; channels list/create; conversation agents

**Status:** complete

**Evidence:**
- files: packages/runtime-db (conversations, conversation_agents, CHANNELS_SCHEMA_SQL), gateway routes for /api/conversations, /api/channels
- routes: full CRUD conversations, messages, channels, agents
- runtime: create channel, add agents, postConversationMessage triggers chat with lead agent

---

## 13. Intelligence / Context Analysis

**Prompt (inferred):** Chat intelligence analysis (extracted tasks, memories, preferences).

**Requested:**
- Analyze conversation for summary, detected_tasks, memory_candidates, preferences, key_insights
- Upsert to conversation_intelligence; get by session or conversation
- API: getChatIntelligence, getConversationIntelligence

**Status:** complete

**Evidence:**
- files: apps/gateway/src/intelligenceAnalysis.ts, runtime-db conversation_intelligence table, getIntelligenceBySession/ByConversation
- routes: /api/chat/intelligence, /api/conversations/:id/intelligence
- runtime: runChatIntelligenceAnalysis after chat; live state uses intelligence for extractedTasks, memoryCandidates, proposedNextActions

---

## 14. Proactivity Engine

**Prompt (inferred):** Build the Proactivity Engine — scheduled jobs, heartbeats, watchdogs, goal loops, proactive notifications, model policies.

**Requested:**
- scheduled_jobs, job_executions, proactive_notifications, model_policies (schema + types)
- Gateway API: list/create/pause/resume jobs, run now, list notifications, list runs, mark read
- Dashboard Proactivity page (jobs, notifications, recent runs)
- Slash commands: /morning-brief, /eod, /watchdog, etc.
- Built-in jobs: Morning Brief, Midday Report, EOD Report, Approvals Watchdog, Stale Project Watchdog
- Stub handlers (no AI synthesis in handlers); **cron/interval scheduler:** gateway runs 30s setInterval calling listDueScheduledJobs and runProactiveJob (apps/gateway/src/main.ts)

**Status:** partial

**Evidence:**
- files: packages/shared/types (proactivity types), packages/runtime-db schema + proactivity.ts, apps/gateway/src/main.ts (scheduler), apps/gateway httpServer proactivity routes, proactiveRunner.ts, dashboard app/proactivity/page.tsx, session-workbench slash handling
- routes: GET/POST /api/proactive/jobs, pause, resume, run, notifications, runs
- runtime: seedBuiltInProactiveJobs at startup; runProactiveJobNow and 30s scheduler run stub handlers; slash commands trigger run now
- docs: project-context/PROACTIVITY-ENGINE-REPORT.md

---

## 15. PGlite Migration (Runtime Persistence)

**Prompt (inferred):** Migrate runtime state from localStore/disk JSON to PGlite.

**Requested:**
- Sessions, messages, traces, approvals, approval_grants, workflow_runs, workflow_steps, task_events in PGlite
- Schema in packages/runtime-db; init at gateway startup; .claws/runtime/

**Status:** complete

**Evidence:**
- files: packages/runtime-db/src/schema.ts, index.ts, db-internal.ts; gateway uses initRuntimeDb and all runtime-db APIs
- runtime: PGlite used; localStore deprecated
- docs: project-context/runtime-persistence.md

---

## 16. Full Browser QA and Product Quality

**Prompt (inferred):** Full browser QA; product quality elevation; PRD-aligned copy.

**Requested:**
- Browser-test all 11 screens and key flows
- Fix chat history persistence, create project/task commands, Files quick reads, settings round-trip
- Home as command center; nav and copy reflect local-first agent OS; clearer empty states and microcopy

**Status:** complete

**Evidence:**
- Manual browser verification documented in next-pass; tasks WEB-014, WEB-015
- runtime: flows work in browser

---

## Summary

| # | Prompt / theme | Status |
|---|----------------|--------|
| 1 | Bootstrap and monorepo | complete |
| 2 | Runtime kernel and gateway | complete |
| 3 | Local persistence | complete (PGlite) |
| 4 | Dashboard scaffold and API client | complete |
| 5 | Design system | complete |
| 6 | AI SDK integration | complete |
| 7 | Workflow engine | complete |
| 8 | Browser / execution substrates | partial |
| 9 | Multi-tenant | complete (scaffolded) |
| 10 | Screen completion and runtime semantics | complete |
| 11 | Session-first IA and verification | complete |
| 12 | Conversations and channels | complete |
| 13 | Intelligence / context analysis | complete |
| 14 | Proactivity engine | partial |
| 15 | PGlite migration | complete |
| 16 | Browser QA and product quality | complete |

**Total prompts reconstructed:** 16
