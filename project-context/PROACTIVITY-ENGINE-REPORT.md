# Proactivity Engine — Implementation Report

## Summary

Claws now has a **Proactivity Engine**: a first-class runtime layer for scheduled jobs, proactive notifications, execution history, and model policies. The system supports the product shift from “reactive chat app” toward “proactive AI operating system” where agents monitor, follow up, summarize, and notify without constant user prompting.

---

## Architecture Added

### 1. Shared types (`packages/shared/src/types.ts`)

- **ModelTier**: `"cheap" | "standard" | "premium"` for job-aware model routing.
- **ModelPolicy**: `jobType`, `defaultTier`, `escalationRules`.
- **ProactiveJobKind**: `cron | heartbeat | watchdog | goal_loop | report`.
- **ProactiveJobStatus**: `active | paused`.
- **ScheduledJob**: id, kind, name, scheduleCron, intervalSec, config, modelTier, conversationId, projectSlug, status, createdAt, updatedAt, lastRunAt.
- **JobExecution**: id, jobId, startedAt, finishedAt, status, summary, result, error, modelUsed.
- **ProactiveNotificationKind**: `inform | reassure | escalate | delight`.
- **ProactiveNotification**: id, jobId, executionId, kind, title, body, conversationId, sessionChatId, readAt, createdAt.

### 2. Schema (`packages/runtime-db/src/schema.ts`)

- **PROACTIVITY_SCHEMA_SQL**:
  - `model_policies`: job_type, default_tier, escalation_rules (UNIQUE on job_type).
  - `scheduled_jobs`: kind, name, schedule_cron, interval_sec, config, model_tier, conversation_id, project_slug, status, last_run_at.
  - `job_executions`: job_id FK, started_at, finished_at, status, summary, result, error, model_used.
  - `proactive_notifications`: job_id, execution_id, kind, title, body, conversation_id, session_chat_id, read_at.
- Run after CHANNELS_SCHEMA_SQL in `initRuntimeDb`.

### 3. Runtime-db layer

- **db-internal.ts**: Shared `getDb` / `setDb` / `clearDb` to avoid circular imports.
- **proactivity.ts**: Full CRUD for jobs, executions, notifications, model policies; `listDueScheduledJobs(nowMs)`; `seedModelPolicies()`; `seedBuiltInProactiveJobs()` (Morning Brief, Midday Report, End of Day Report, Approvals Watchdog, Stale Project Watchdog).
- **index.ts**: Re-exports proactivity; runs PROACTIVITY_SCHEMA_SQL and calls seed functions after init (in gateway main).

---

## Runtime / Job Model

- **Jobs**: Stored in PGlite; active/paused; cron or interval_sec; optional conversation_id/project_slug for targeting.
- **Executions**: One row per run; status running → completed | failed; summary, result, error, modelUsed.
- **Notifications**: Inform / reassure / escalate / delight; optional link to job and execution; read_at for inbox behavior.
- **Model policies**: Per job_type default tier (e.g. report → cheap, goal_loop → standard); escalation rules scaffolded for future use.

---

## APIs Added

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/proactive/jobs | List jobs (optional ?status=active\|paused) |
| POST | /api/proactive/jobs | Create job (kind, name, scheduleCron, intervalSec, config, modelTier, conversationId, projectSlug) |
| GET | /api/proactive/jobs/:id | Get one job |
| POST | /api/proactive/jobs/:id/pause | Pause job |
| POST | /api/proactive/jobs/:id/resume | Resume job |
| POST | /api/proactive/jobs/:id/run | Run job now (on-demand) |
| GET | /api/proactive/notifications | List notifications (?unreadOnly=true, ?limit=N) |
| POST | /api/proactive/notifications/:id/read | Mark notification read |
| GET | /api/proactive/runs | List recent runs (?jobId=, ?limit=) |

---

## UI Changes

- **Proactivity page** (`apps/dashboard/app/proactivity/page.tsx`): Tabs — Jobs (list with status, pause/resume, Run now), Notifications (list with mark read), Recent runs (execution history). Uses existing Shell, Badge, Button, Tabs, EmptyState.
- **Nav**: New “Proactivity” link with Zap icon.
- **API client** (`apps/dashboard/lib/api.ts`): getProactiveJobs, getProactiveJob, createProactiveJob, pauseProactiveJob, resumeProactiveJob, runProactiveJobNow, getProactiveNotifications, markProactiveNotificationRead, getProactiveRuns with types ProactiveJob, ProactiveNotification, ProactiveRun.

---

## Slash Commands Implemented / Scaffolded

In **session-workbench** chat input, messages starting with `/` are parsed:

- **Implemented**: `/morning-brief`, `/midday-report`, `/eod`, `/eod-report`, `/approvals-watchdog`, `/watchdog`, `/stale-project-watchdog` → resolve job by name (from active jobs), call `runProactiveJobNow(job.id)`, show result summary in assistant bubble. If no matching job, message falls through to normal chat.
- **Scaffolded for later**: `/new`, `/search`, `/project`, `/channel`, `/agent`, `/handoff`, `/task`, `/assign`, `/ship`, `/review`, `/brief`, `/remember`, `/recall`, `/summary`, `/context`, `/approve`, `/deny`, `/watch`, `/quiet`, `/workflow`, `/heartbeat`, `/autopilot`, `/pause-agent` — not yet implemented; can be added in the same pattern (command → API or agent action).

---

## What Is Proactive Now

- **Built-in jobs** (created at gateway startup via seedBuiltInProactiveJobs): Morning Brief (cron 9am), Midday Report (12pm), End of Day Report (6pm), Approvals Watchdog (every 5 min), Stale Project Watchdog (every 24h). All exist as rows; cron/interval are stored and can be used by a future scheduler.
- **On-demand execution**: User or API can trigger any job via “Run now” or slash command. Runner creates an execution row, runs a **stub handler** (no LLM yet), writes summary/result, optionally creates a proactive notification, updates last_run_at.
- **Stub handlers** (in `apps/gateway/src/proactiveRunner.ts`): Approvals Watchdog → count pending approvals, create “inform” notification if count > 0; Morning/Midday/EOD → create “inform” notification with stub text; Stale Project → same. Generic fallback creates a trace and returns a stub summary. Full AI synthesis (real briefs, real EOD summaries, goal loops, surprise-and-delight) is left for a later pass.
- **Traces**: Each proactive run inserts a trace of type `proactive-run` with jobId, executionId, and handler-specific data (e.g. pendingCount).
- **Notifications**: Proactive runs can create notifications that appear in the Proactivity → Notifications tab and can be marked read.

---

## What Still Needs Deeper Work

- **Cron/interval scheduler**: No process yet that periodically calls `listDueScheduledJobs(now)` and runs them; only on-demand and slash commands run jobs. Adding a gateway loop or worker that polls every N seconds and runs due jobs would make recurring behavior truly proactive.
- **Cron parsing**: `schedule_cron` is stored but not interpreted (no cron parser). Next step: use a small cron library to compute next run time and drive “due” logic.
- **Goal loops**: goal_loop kind and project-scoped “keep moving project X forward” are in the schema and types but have no runner logic; would need task/trace inspection and delegation.
- **Surprise-and-delight**: No handlers that create real artifacts (drafts, copy, mockups); only stub notifications. Requires model calls and artifact writes.
- **Session/conversation linkage**: conversation_id and session_chat_id on jobs/notifications are stored but not yet used to post proactive messages into a specific conversation thread; would need to call addConversationMessage or equivalent when a notification is created for a conversation.
- **Model policy usage**: getModelPolicyForJobType exists but the runner does not yet select a model by tier; stub handlers use “cheap”/“none” implicitly. Wiring tier → provider/model is next step.
- **Slash command set**: Only proactive job triggers are implemented; /task, /remember, /approve, etc. are not yet wired.

---

## How This Moves Claws Toward an AI OS

- **Rhythm**: Recurring jobs and execution history exist; once a scheduler is added, morning brief, EOD, and watchdogs can run without user action.
- **Visibility**: Proactivity page and notifications give one place to see what the system did and what needs attention (inform / escalate).
- **Control**: Pause/resume and “Run now” put the user in control of when and whether proactive behavior runs.
- **Extensibility**: New job kinds and handlers can be added in the same runner; model policies and goal_loop/artifact creation can be layered on without changing the core tables or API shape.
- **Product feel**: Slash commands and a dedicated Proactivity screen make “the system has its own initiative” visible and discoverable, even before full AI-powered briefs and surprise-and-delight are implemented.

---

## Files Touched (Summary)

- **packages/shared/src/types.ts**: Proactivity types.
- **packages/runtime-db/src/schema.ts**: PROACTIVITY_SCHEMA_SQL.
- **packages/runtime-db/src/db-internal.ts**: New (getDb/setDb/clearDb).
- **packages/runtime-db/src/proactivity.ts**: New (all proactivity DB APIs).
- **packages/runtime-db/src/index.ts**: Init proactivity schema; re-export proactivity; use db-internal.
- **apps/gateway/src/httpServer.ts**: GatewayRuntime proactivity methods; routes for /api/proactive/*.
- **apps/gateway/src/main.ts**: Imports, seedModelPolicies + seedBuiltInProactiveJobs after init, runtime proactivity handlers, runProactiveJobNow → proactiveRunner.
- **apps/gateway/src/proactiveRunner.ts**: New (runProactiveJob, stub handlers).
- **apps/dashboard/lib/api.ts**: Proactivity API client and types.
- **apps/dashboard/app/proactivity/page.tsx**: New (Jobs, Notifications, Recent runs).
- **apps/dashboard/components/nav.tsx**: Proactivity nav link.
- **apps/dashboard/components/session-workbench.tsx**: Slash command handling, getProactiveJobs, runProactiveJobNow.
- **project-context/tasks.md**: Audit snapshot line for Proactivity Engine.
- **project-context/PROACTIVITY-ENGINE-REPORT.md**: This report.
