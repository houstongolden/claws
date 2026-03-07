# Proactivity Decision Engine — Implementation Report

## Summary

Claws now has a **Proactivity Decision Engine** that replaces the pattern **trigger → direct action** with **trigger → evaluation → decision → work item / notification / delegation → audit**. No cron job, heartbeat, or watchdog may directly notify users or take major actions; all proactive triggers flow through this central decision system.

---

## 1. New decision engine structures

### Shared types (`packages/shared/src/types.ts`)

- **AttentionDecisionOutcome**: `"ignore" | "bundle" | "notify" | "act_silently" | "delegate" | "escalate"`
- **ProactiveOwner**: `"orchestrator" | "project_agent" | "specialist_agent" | "waiting_on_user" | "completed" | "snoozed"`
- **TriggerEvent**: id, jobId, executionId, kind, jobName, payload, conversationId, projectSlug, sessionChatId, createdAt
- **AttentionCandidate**: id, triggerEventId, jobId, executionId, reason, suggestedUrgency (low|normal|high|urgent), dedupeKey, alreadyDone, needsAttention, nextStep, createdAt
- **AttentionDecision**: id, candidateId, triggerEventId, outcome, rationale, owner, notificationId, workItemId, criteria, createdAt
- **WorkItem**: id, decisionId, candidateId, triggerEventId, jobId, kind, title, summary, owner, status (pending|in_progress|completed|cancelled), conversationId, projectSlug, createdAt, updatedAt, completedAt
- **InitiativeArtifact**: id, decisionId, workItemId, kind, title, ref, summary, createdAt
- **AttentionBudgetConfig**: maxProactiveMessagesPerDay, quietHours [start,end], bundleRelated, minMinutesBetweenSameTypeNudge, preferSilentProgress

### Schema (`packages/runtime-db/src/schema.ts` — `DECISION_ENGINE_SCHEMA_SQL`)

- **trigger_events**: every proactive trigger recorded (job_id, execution_id, kind, job_name, payload, …)
- **attention_candidates**: produced from trigger + context (reason, suggested_urgency, dedupe_key, already_done, needs_attention, next_step)
- **attention_decisions**: outcome + rationale + owner + notification_id/work_item_id + criteria (audit)
- **work_items**: when outcome is delegate or act_silently (trackable, no user ping)
- **initiative_artifacts**: surprise-and-delight / initiative outputs (for future use)
- **attention_budget**: singleton row `id = 'default'` with max_proactive_messages_per_day, quiet_hours_start/end, bundle_related, min_minutes_between_same_type_nudge, prefer_silent_progress

### Runtime-db APIs (`packages/runtime-db/src/decision-engine.ts`)

- **Trigger events**: insertTriggerEvent, getTriggerEvent, listTriggerEvents
- **Candidates**: insertAttentionCandidate
- **Decisions**: insertAttentionDecision, updateAttentionDecisionNotificationAndWorkItem, listAttentionDecisions, getRecentDecisionByDedupeKey
- **Work items**: createWorkItem, listWorkItems
- **Attention budget**: getAttentionBudgetConfig, countProactiveNotificationsToday, isQuietHours

### Gateway decision engine (`apps/gateway/src/proactivityDecisionEngine.ts`)

- **runProactivityDecisionEngine(job, executionId, handlerResult, deps)**:
  1. Inserts **trigger_event** (audit).
  2. Builds **attention_candidate** (reason, urgency, dedupeKey, alreadyDone, needsAttention, nextStep).
  3. Evaluates: attention budget (count today), quiet hours, recent decision by dedupe key (duplicate?), preferSilentProgress.
  4. **Decides** outcome: ignore | bundle | notify | act_silently | delegate | escalate.
  5. Records **attention_decision** (rationale, owner, criteria).
  6. If outcome **notify** and within budget and not quiet → creates **proactive_notification**.
  7. If outcome **act_silently** or **delegate** and not duplicate → creates **work_item**.
  8. Updates decision row with notification_id / work_item_id.
- **Decision criteria** used: urgency, withinAttentionBudget, quietHours, duplicateWork, notificationFatigue, preferSilentProgress.

---

## 2. Where proactive decisions are stored

- **Trigger history**: table `trigger_events` (PGlite in `.claws/runtime/`). Every job run records one row.
- **Decisions**: table `attention_decisions`. Each row links to a candidate, stores outcome, rationale, owner, optional notification_id and work_item_id, and criteria JSON for audit.
- **Work items**: table `work_items` for act_silently/delegate outcomes (no direct user notification).
- **Notifications**: existing table `proactive_notifications`; only written when decision outcome is **notify** and budget/quiet-hours allow.
- **Traces**: each proactive run inserts a trace of type **proactive-decision** with summary `outcome: rationale` and data: jobId, executionId, triggerEventId, decisionId, outcome, owner, notificationId, workItemId.

---

## 3. How duplicate / noisy behavior is prevented

- **Attention budget**: `attention_budget` row (default: 20 proactive messages/day). `countProactiveNotificationsToday()` gates whether a **notify** is allowed.
- **Quiet hours**: optional `quiet_hours_start` / `quiet_hours_end`. If current time is in quiet hours, outcome is forced to **bundle** (no immediate notify).
- **Dedupe**: `getRecentDecisionByDedupeKey(dedupeKey, withinMinutes)` (withinMinutes from `min_minutes_between_same_type_nudge`, default 60). If a recent decision exists for the same dedupe key (e.g. `job:xyz:approvals`), outcome is **ignore** to avoid repeated nudges.
- **Prefer silent progress**: when `preferSilentProgress` is true and suggested urgency is low and a notification was suggested, outcome is **act_silently** (work_item only, no notification).
- **Ownership**: every decision has an **owner** (orchestrator, project_agent, specialist_agent, etc.); work_items carry owner so multiple agents do not duplicate the same proactive work.

---

## 4. How this protects Claws as it scales

- **Single control plane**: all proactive behavior (cron, heartbeats, watchdogs, reports, stale checks, approval reminders, future surprise-and-delight) must go through the decision engine. Handlers only return raw results + optional suggested notification; the engine decides whether to notify, create a work item, or ignore.
- **Audit trail**: trigger_events and attention_decisions are persisted; traces carry proactive-decision type. Debugging and tuning (e.g. relaxing budget, adjusting quiet hours) is data-driven.
- **Configurable policy**: attention_budget is a single row; future UI or env can change max messages/day, quiet hours, bundle behavior, and prefer_silent_progress without code changes.
- **Extensible outcomes**: ignore, bundle, notify, act_silently, delegate, escalate are defined; bundle can later drive “digest” notifications; delegate can assign to specialist agents; escalate can route to human or higher-tier models.
- **Product behavior**: candidates carry alreadyDone, needsAttention, nextStep so every proactive message can answer “why now”, “what was noticed”, “what was done”, “what needs attention”, “what happens next” when we surface them in UI or notifications.

---

## 5. Files touched

| Area | Files |
|------|--------|
| Types | `packages/shared/src/types.ts` |
| Schema | `packages/runtime-db/src/schema.ts` (DECISION_ENGINE_SCHEMA_SQL) |
| Persistence | `packages/runtime-db/src/decision-engine.ts` (new) |
| Init | `packages/runtime-db/src/index.ts` (exec DECISION_ENGINE_SCHEMA_SQL, re-export decision-engine) |
| Engine | `apps/gateway/src/proactivityDecisionEngine.ts` (new) |
| Runner | `apps/gateway/src/proactiveRunner.ts` (handlers return HandlerResult; runner calls decision engine; trace type proactive-decision) |
| Gateway API | `apps/gateway/src/httpServer.ts` (listTriggerEvents, listAttentionDecisions, getAttentionBudgetConfig; routes /api/proactive/triggers, /api/proactive/decisions, /api/proactive/attention-budget) |
| Main | `apps/gateway/src/main.ts` (wire listTriggerEvents, listAttentionDecisions, getAttentionBudgetConfig) |
| Dashboard API | `apps/dashboard/lib/api.ts` (TriggerEvent, AttentionDecision, AttentionBudgetConfig; getProactiveTriggers, getProactiveDecisions, getAttentionBudgetConfig) |
| Dashboard UI | `apps/dashboard/app/proactivity/page.tsx` (Decisions tab: list decisions with outcome, rationale, owner, notification/work item) |

---

## 6. Optional next steps (not in this pass)

- **Cron/interval scheduler**: run `listDueScheduledJobs(now)` periodically and call the runner; decision engine already governs what each run produces.
- **Bundling**: when outcome is **bundle**, accumulate and send one digest later (e.g. next non–quiet-hour window).
- **Model policy**: wire getModelPolicyForJobType into runner so job tier drives model selection.
- **Initiative artifacts**: when surprise-and-delight handlers create drafts/copy, insert into initiative_artifacts and link to decision/work_item.
- **UI for attention budget**: Settings or Proactivity page to edit attention_budget (max messages, quiet hours, prefer silent progress).
