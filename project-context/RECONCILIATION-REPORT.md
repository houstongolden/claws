# Feature Ledger Reconciliation — Final Report

**Date:** 2026-03-06  
**Mode:** Feature Ledger Reconciliation (reality-check audit)

---

## 1. Total prompts reconstructed

**16** prompts were reconstructed and recorded in `/project-context/prompts/prompt-ledger.md`:

| # | Prompt theme | Status |
|---|----------------|--------|
| 1 | Bootstrap and monorepo | complete |
| 2 | Runtime kernel and gateway | complete |
| 3 | Local persistence | complete (PGlite) |
| 4 | Dashboard scaffold and API client | complete |
| 5 | Design system (Geist, Tailwind, shadcn/ui) | complete |
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

---

## 2. Total features identified

**71** feature rows in the canonical list (`/project-context/feature-ledger.md`), grouped by category:

- **Core OS:** 5 (session, project, channel, agent conversations, group chats)
- **Runtime:** 9 (gateway, approvals, traces, tasks x2, memory, workflows, view state, intelligence)
- **UI:** 12 (chat, sidecar, project drill-in, files, memory search, task editing, workflow UI, agent UI, settings, proactivity UI, toast, mobile)
- **Execution:** 7 (browser Playwright, Agent Browser, computer use, sandbox, execution modes, demo pathing, tool registry)
- **Proactivity:** 9 (jobs schema, notifications, job runner, cron scheduler, heartbeats, watchdogs, proactive messages, slash commands, surprise artifacts)
- **Integrations:** 5 (Telegram, Slack, Agent Browser, AI Gateway, model routing)
- **Workspace & governance:** 5 (WorkspaceFS, FOLDER.md, identity, create-claws, claws start/chat)
- **Testing:** 5 (typecheck/lint/test, golden/replay, path-governance/approval tests, API smoke, E2E)

---

## 3. Features complete

**38** features classified as **complete** (code exists, runtime behavior works, UI supports it, docs reflect it where applicable).

Examples: Gateway, approvals, traces, workflow engine, project model, channel model, conversations, intelligence, sidecar, files explorer, memory search UI, agent UI, settings, proactivity UI/schema/API/slash, Playwright browser, execution modes, tool registry, identity loader, create-claws, CLI, harness tests.

---

## 4. Features partial

**18** features classified as **partial** (some behavior or UI present, but gaps vs PRD or audit).

Examples: Session model (no server-side transcript load/resume), tasks build queue (tasks.md read-only), memory (no MEMORY.md write), chat surface (no durable history / incremental tool stream), workflow UI (no create form), WorkspaceFS (hardcoded roots, no FOLDER.md), Agent Browser (adapter only), sandbox (no Vercel SDK), proactivity (no cron scheduler), AI Gateway (single model), multi-tenant (in-memory only), mobile sidecar (no drawer/collapse).

---

## 5. Features missing

**12** features classified as **missing** (requested or implied by PRD but not implemented).

Examples: Project drill-in view, task editing (writes to tasks.md), toast/live updates, FOLDER.md governance, proactivity cron/interval scheduler, proactive messages to conversation, surprise artifact generation, Telegram adapter, Slack adapter, computer use substrate, full Agent Browser execution path.

(Placeholder count: **3** — Agent Browser execution, sandbox Vercel adapter, and similar “scaffold only” items.)

---

## 6. False positives detected

**10** cases where a prompt or task was marked done but implementation is incomplete, stubbed, or placeholder (documented in `feature-ledger.md` → False Positives):

1. Session persistence (durable transcript load / session list)
2. RUN-005 description (localStore vs PGlite — task text fixed)
3. Agent Browser (adapter exists; execution not wired)
4. FOLDER.md (never read; roots hardcoded)
5. Tasks.md write path (read-only)
6. Memory → MEMORY.md (promote to store only)
7. Proactivity cron scheduler (only on-demand/slash)
8. Multi-tenant per-tenant isolation (in-memory only)
9. Streaming tool-call UX (events only at end of stream)
10. Workflow create from dashboard (API only, no UI form)

---

## 7. Planning docs updated

| Doc | Changes |
|-----|--------|
| **project-context/tasks.md** | RUN-005: reference updated from `localStore.ts` to PGlite / `packages/runtime-db`; audit snapshot now references feature-ledger, prompt-ledger, and proactivity scheduler caveat. |
| **project-context/tasks.jsonl** | One new event: `plan.reconciliation.completed` with summary of reconciliation. |
| **project-context/current-state.md** | “What still needs implementation” expanded; **System readiness score** added (~62%); **Critical missing capabilities** section added (15 items). |
| **project-context/next-pass.md** | Replaced with **next 10–15 highest-value tasks**, dependency-ordered (session persistence, FOLDER.md, stream tool events, task update path, project drill-in, Agent Browser, memory→MEMORY.md, lens, toast, proactivity scheduler, workflow create UI, sandbox, workflow substrate routing, mobile rail, demo link). |
| **project-context/feature-ledger.md** | New file: full feature list by category with status and evidence; False Positives section; Critical Missing Capabilities section. |
| **project-context/prompts/prompt-ledger.md** | New file: 16 prompts with title, intent, requested features, status, evidence. |
| **AGENT.md** | New rule: record every development prompt in `/project-context/prompts/`; update feature ledger and task list before implementation. Source of truth list extended with feature-ledger and prompt-ledger. |

**Not changed:** `build-roadmap.md` (already matches phases); `human-tasks.md` (no new human tasks from reconciliation).

---

## 8. Next sprint tasks (from next-pass.md)

The next 15 implementation tasks, ordered by dependency:

1. Persist session transcripts server-side (P0)
2. Load FOLDER.md and enforce from file (P0)
3. Stream tool-call events in SSE (P1)
4. Task update path (P1)
5. Project detail view (P1)
6. Wire real Agent Browser execution (P1)
7. Memory promotion to MEMORY.md (P1)
8. Apply view lens to queries (P2)
9. Toast or soft-refresh on chat mutation (P1)
10. Proactivity cron/interval scheduler (P1)
11. Workflow create from dashboard (P2)
12. Vercel Sandbox adapter (P2)
13. Workflow step → substrate routing (P2)
14. Mobile/responsive context rail (P2)
15. Demo artifact link in completion (P2)

---

## Summary

- **Prompts:** 16 reconstructed and logged.
- **Features:** 71 total; 38 complete, 18 partial, 3 placeholder, 12 missing.
- **False positives:** 10 documented.
- **Planning docs:** tasks.md, tasks.jsonl, current-state.md, next-pass.md, feature-ledger.md, prompts/prompt-ledger.md, AGENT.md updated or created.
- **Next sprint:** 15 tasks in next-pass.md, dependency-ordered.

Reconciliation is complete. The codebase is a **high-fidelity prototype** with a clear ledger of what is done, partial, or missing; the next pass is prioritized and documented.
