# Next Pass — Next 10–15 Highest-Value Implementation Tasks

Ordered by dependency. Generated from Feature Ledger Reconciliation (prompt-ledger, feature-ledger, current-state).

---

## 1. Persist session transcripts server-side (P0)

- Store transcripts keyed by chatId in PGlite (messages table exists); load on reconnect.
- Add session list and "resume session" in UI or nav.
- **Unblocks:** Session-centric UX, trace/session linkage, "what did we decide?" magic moment.
- **Depends on:** None.
- **Files:** apps/gateway (session load/save), runtime-db (sessions/messages), session-workbench, nav.

## 2. Load FOLDER.md and enforce from file (P0)

- Parse FOLDER.md (or fallback to current ALLOWED_ROOTS); apply to WorkspaceFS.
- Document write behavior and safety boundaries in code/docs.
- **Unblocks:** PRD-aligned filesystem governance; path enforcement from single source of truth.
- **Depends on:** None.
- **Files:** packages/workspace/workspace-fs.ts, schema for FOLDER.md format.

## 3. Stream tool-call events in SSE (P1)

- Emit tool start/complete (and optionally progress) in the stream so the UI can show tools incrementally.
- **Unblocks:** Better chat UX during long tool runs.
- **Depends on:** None.
- **Files:** apps/gateway/aiHandler.ts, dashboard chat/session-workbench.

## 4. Task update path (P1)

- Add tool or UI to update tasks.md (e.g. move line between sections or set status); keep JSONL as event log.
- **Unblocks:** PRD "move tasks across lanes/statuses"; task editing from dashboard.
- **Depends on:** FOLDER.md or allowed-write paths for project-context/tasks.md.
- **Files:** packages/tools/tasks.ts, apps/gateway tools/run, tasks/page.tsx.

## 5. Project detail view (P1)

- Add /projects/[slug] (or modal) with fs.read(project.md) and fs.read(tasks.md).
- **Unblocks:** Project drill-in; builder workflow.
- **Depends on:** None.
- **Files:** apps/dashboard/app/projects/[slug]/page.tsx or modal in projects/page.tsx, api/tools/run or projects API.

## 6. Wire real Agent Browser execution (P1)

- When @anthropic-ai/agent-browser is installed, complete executeWithAgentBrowser() path.
- Connect browser task result screenshots to demo.saveScreenshot; wire visibility mode to launch config.
- **Depends on:** None (optional dependency).
- **Files:** packages/tools/browser.ts.

## 7. Memory promotion to MEMORY.md (P1)

- Propose diff for promoted entry → prompt/MEMORY.md; gate with approval; apply on approve.
- **Unblocks:** PRD "propose curated memory diffs (approval-gated)".
- **Depends on:** Approval flow for file writes.
- **Files:** packages/tools/memory.ts, gateway approval flow, memory/page.tsx.

## 8. Apply view lens to queries (P2)

- Pass view stack (or lens) to getTaskEvents, scanProjects, fs or filter results by lens (e.g. project tags).
- **Depends on:** View/lens schema stable.
- **Files:** router.ts, main.ts (project/task/file fetch), dashboard pages.

## 9. Toast or soft-refresh on chat mutation (P1)

- After create project/task/draft in chat, show toast or trigger refresh for Tasks/Projects/Traces.
- **Depends on:** None.
- **Files:** session-workbench.tsx, optional toast component or refresh hooks.

## 10. Proactivity cron/interval scheduler (P1)

- Gateway loop or worker that polls every N seconds, calls listDueScheduledJobs(now), runs due jobs.
- Add cron parsing for schedule_cron next-run computation.
- **Depends on:** None.
- **Files:** apps/gateway or apps/worker, packages/runtime-db proactivity.ts.

## 11. Workflow create from dashboard (P2)

- Simple form: name + steps (tool + args); POST to /api/workflows.
- **Depends on:** None.
- **Files:** apps/dashboard/app/workflows/page.tsx.

## 12. Vercel Sandbox adapter (P2)

- Wire sandbox.exec to @vercel/sandbox SDK when available; language runtime selection.
- **Depends on:** Human/env decision to enable Sandbox.
- **Files:** packages/tools/sandbox.ts.

## 13. Workflow step → substrate routing (P2)

- When a workflow step executes, determine substrate from tool environment; emit substrate-specific traces.
- **Depends on:** None.
- **Files:** apps/worker, packages/core/workflow.ts, main.ts trace emission.

## 14. Mobile/responsive context rail (P2)

- Collapse or drawer-ify the context rail on small screens without losing current-task/project visibility.
- **Depends on:** None.
- **Files:** session-workbench.tsx, shell/nav.

## 15. Demo artifact link in completion (P2)

- record-on-complete and completion messages reliably link demo path + notes and next steps.
- **Depends on:** Browser/demo flow.
- **Files:** packages/tools/browser.ts, demo.ts, aiHandler or response formatting.

---

## Sprint exit criteria (next pass)

- Session persistence: server-side transcript save/load and optional session list.
- FOLDER.md: at least read and apply allowed roots (write behavior can be phase 2).
- At least one of: task update path, project drill-in, toast/refresh.
- Proactivity: scheduler running due jobs OR cron parsing in place.
- Feature ledger and prompt ledger updated after any new implementation.

---

## Reference

- **Prompt ledger:** project-context/prompts/prompt-ledger.md
- **Feature ledger:** project-context/feature-ledger.md
- **Current state:** project-context/current-state.md
- **Audit:** project-context/IMPLEMENTATION_AUDIT.md
