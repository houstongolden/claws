# Next Pass — Next 10–15 Highest-Value Implementation Tasks

Ordered by dependency. **Strategy:** Magic moments first; no broad dashboard polish unless it directly supports one of the four moments. See `project-context/MAGIC-MOMENTS-AUDIT.md`.

**Four magic moments:** (1) Install + onboarding magical, (2) Working persistent session chat, (3) Agent visibly works (tool streaming, approvals), (4) Proactive follow-up / scheduled brief.

---

## 1. ~~Persist session transcripts (streaming path)~~ — DONE this pass

- **Done:** Streaming chat now persists assistant reply after stream complete via `onComplete` in `writeStreamToResponse`. Session history survives reload without client re-sending history.
- **Remaining:** None for transcript persistence.

## 2. ~~Persist session transcripts — session list / resume (P0)~~ — DONE

- **Done:** Nav **Sessions** (starred + recent), select chat resumes; `chat-list-context`, `ensureChatInList`; gateway list conversations/sessions unchanged.
- **Files:** apps/dashboard/components/nav.tsx, chat-list-context, session-workbench.

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

## 5. ~~Stream tool-call events — dashboard consumption (P1)~~ — DONE

- **Done:** Session workbench shows **compact file cards** during stream and on complete for `fs.write` / `fs.append`; **artifact panel** (Code + HTML Preview + Open in browser); sidebar can collapse when artifact opens; system prompt steers model to **fs.write** instead of pasting files in chat.
- **Files:** apps/dashboard/components/session-workbench.tsx, artifact-panel.tsx, shell.tsx; apps/gateway/src/aiHandler.ts.

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

## Sprint exit criteria (this pass / next)

- ~~Session persistence + session list~~ — done.
- ~~FOLDER.md read/apply~~ — done (folder-md.ts + WorkspaceFS).
- ~~Task update, project drill-in, toast/refresh~~ — done.
- ~~Proactivity scheduler~~ — done (30s interval + listDueScheduledJobs).
- **Next high-value:** Multi-agent delegation UX; proactive messages into conversation thread; full cron parsing for jobs; PGlite persistent mode on all hosts (or document in-memory fallback only).
- Feature ledger + current-state + next-pass updated when behavior changes.

---

## Reference

- **Magic moments audit:** project-context/MAGIC-MOMENTS-AUDIT.md
- **Prompt ledger:** project-context/prompts/prompt-ledger.md
- **Feature ledger:** project-context/feature-ledger.md
- **Current state:** project-context/current-state.md
- **Audit:** project-context/IMPLEMENTATION_AUDIT.md
