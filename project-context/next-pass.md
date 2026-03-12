# Next Pass — Next 10–15 Highest-Value Implementation Tasks

Ordered by dependency. **Strategy:** Magic moments first; no broad dashboard polish unless it directly supports one of the four moments. See `project-context/MAGIC-MOMENTS-AUDIT.md`.

**Four magic moments:** (1) Install + onboarding magical, (2) Working persistent session chat, (3) Agent visibly works (tool streaming, approvals), (4) Proactive follow-up / scheduled brief.

---

## 1. ~~Persist session transcripts (streaming path)~~ — DONE this pass

- **Done:** Streaming chat now persists assistant reply after stream complete via `onComplete` in `writeStreamToResponse`. Session history survives reload without client re-sending history.
- **Remaining:** Session list and "resume session" in UI (optional for v0).

## 2. Persist session transcripts — session list / resume (P0)

- Add session list and "resume session" in nav or session workbench.
- **Unblocks:** Session-centric UX, "what did we decide?" magic moment.
- **Files:** apps/dashboard (nav or session picker), gateway already has list conversations/sessions.

## 3. ~~Proactivity cron/interval scheduler (P0 for moment 4)~~ — DONE this pass

- **Done:** Gateway runs a 30s interval that calls `listDueScheduledJobs(Date.now())` and runs each due job via `runProactiveJob`. Cron jobs use a 1h minimum between runs until real cron parsing. Same `proactiveJobDeps` used for "Run now" and scheduler.
- **Optional later:** Full cron parsing for next-run (e.g. "0 9 * * *" = 9am daily).
- **Files:** apps/gateway/src/main.ts (scheduler loop), packages/runtime-db/src/proactivity.ts (listDueScheduledJobs cron throttle).

## 4. Load FOLDER.md and enforce from file (P0)

- Parse FOLDER.md (or fallback to current ALLOWED_ROOTS); apply to WorkspaceFS.
- Document write behavior and safety boundaries in code/docs.
- **Unblocks:** PRD-aligned filesystem governance; path enforcement from single source of truth.
- **Depends on:** None.
- **Files:** packages/workspace/workspace-fs.ts, schema for FOLDER.md format.

## 5. Stream tool-call events — dashboard consumption (P1)

- **Gateway:** Already emits `tool_call` and `tool_result` incrementally in `writeStreamToResponse`. No change needed.
- **Remaining:** Ensure dashboard chat consumes these for incremental tool UI (verify or add minimal display).
- **Files:** apps/dashboard chat/session-workbench.

## 6. ~~Task update path (P1)~~ — DONE

- **Done:** packages/tools/tasks.ts create/update/move/complete write tasks.md; gateway POST /api/tasks/create, update, move, complete; tasks/page.tsx status dropdown, complete, edit, create form.
- **Files:** packages/tools/tasks.ts, apps/gateway httpServer.ts, tasks/page.tsx.

## 7. Project detail view (P1)

- Add /projects/[slug] (or modal) with fs.read(project.md) and fs.read(tasks.md).
- **Unblocks:** Project drill-in; builder workflow.
- **Depends on:** None.
- **Files:** apps/dashboard/app/projects/[slug]/page.tsx or modal in projects/page.tsx, api/tools/run or projects API.

## 8. ~~Wire real Agent Browser execution (P1)~~ — DONE

- **Done:** executeWithAgentBrowser tries SDK launch/newPage/goto/screenshot/close when @anthropic-ai/agent-browser is installed; demo path still via browser tool + saveDemoScreenshot.
- **Files:** packages/tools/browser.ts.

## 9. ~~Memory promotion to MEMORY.md (P1)~~ — DONE

- **Done:** createMemoryProposal enqueues approval; resolveApproval appends to prompt/MEMORY.md on approve; memory page "Propose to MEMORY.md"; POST /api/memory/propose.
- **Files:** packages/tools/memory.ts, apps/gateway main.ts, httpServer.ts, memory/page.tsx.

## 10. ~~Apply view lens to queries (P2)~~ — DONE

- **Done:** getTaskEvents and scanProjects accept optional view and project_slug; gateway passes query params; project drill-in page passes project_slug for task events.
- **Files:** main.ts, httpServer.ts, api.ts, projects/[slug]/page.tsx.

## 11. Toast or soft-refresh on chat mutation (P1)

- After create project/task/draft in chat, show toast or trigger refresh for Tasks/Projects/Traces.
- **Depends on:** None.
- **Files:** session-workbench.tsx, optional toast component or refresh hooks.

## 12. ~~Workflow create from dashboard (P2)~~ — DONE

- **Done:** Create tab on workflows page with form (name, description, steps with tool + args + requiresApproval); POST via createWorkflow.
- **Files:** apps/dashboard/app/workflows/page.tsx.

## 13. ~~Vercel Sandbox adapter (P2)~~ — DONE

- **Done:** sandbox.exec dynamically imports @vercel/sandbox, creates sandbox, runCommand with code; returns stdout/stderr/exitCode when CLAWS_SANDBOX_ENABLED=true and provider=vercel.
- **Files:** packages/tools/sandbox.ts.

## 14. ~~Workflow step → substrate routing (P2)~~ — DONE

- **Done:** advanceWorkflowStep in main.ts inserts workflow-step-run trace with runId, stepId, tool, substrate (from registry), status after dbAdvanceWorkflowStep.
- **Files:** apps/gateway/src/main.ts.

## 15. ~~Mobile/responsive context rail (P2)~~ — DONE

- **Done:** Context button (visible below xl) opens slide-over drawer with same context rail content; close via overlay or button.
- **Files:** session-workbench.tsx.

## 16. ~~Demo artifact link in completion (P2)~~ — DONE

- **Done:** Browser tool (createBrowserTools(workspaceRoot)) calls saveDemoScreenshot when recordDemo and screenshot; result includes demoPath; aiHandler system prompt instructs model to include demo path in reply.
- **Files:** packages/tools/browser.ts, demo.ts, aiHandler.ts.

---

## Sprint exit criteria (next pass)

- Session persistence: server-side transcript save/load and optional session list.
- FOLDER.md: at least read and apply allowed roots (write behavior can be phase 2).
- At least one of: task update path, project drill-in, toast/refresh.
- Proactivity: scheduler running due jobs OR cron parsing in place.
- Feature ledger and prompt ledger updated after any new implementation.

---

## Reference

- **Magic moments audit:** project-context/MAGIC-MOMENTS-AUDIT.md
- **Prompt ledger:** project-context/prompts/prompt-ledger.md
- **Feature ledger:** project-context/feature-ledger.md
- **Current state:** project-context/current-state.md
- **Audit:** project-context/IMPLEMENTATION_AUDIT.md
