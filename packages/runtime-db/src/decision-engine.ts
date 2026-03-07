/**
 * Proactivity Decision Engine — persistence for trigger_events, attention_candidates,
 * attention_decisions, work_items, initiative_artifacts, and attention budget.
 * All proactive triggers flow: trigger -> evaluation -> decision -> work/notify -> audit.
 */

import { getDb } from "./db-internal.js";
import type {
  TriggerEvent,
  AttentionCandidate,
  AttentionDecision,
  WorkItem,
  InitiativeArtifact,
  AttentionBudgetConfig,
  AttentionDecisionOutcome,
  ProactiveOwner,
  ProactiveJobKind,
} from "@claws/shared/types";

// ---------------------------------------------------------------------------
// Trigger events
// ---------------------------------------------------------------------------

export async function insertTriggerEvent(params: {
  id?: string;
  jobId: string;
  executionId: string;
  kind: ProactiveJobKind;
  jobName: string;
  payload?: Record<string, unknown>;
  conversationId?: string | null;
  projectSlug?: string | null;
  sessionChatId?: string | null;
}): Promise<TriggerEvent> {
  const id = params.id ?? `te_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO trigger_events (id, job_id, execution_id, kind, job_name, payload, conversation_id, project_slug, session_chat_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      params.jobId,
      params.executionId,
      params.kind,
      params.jobName,
      JSON.stringify(params.payload ?? {}),
      params.conversationId ?? null,
      params.projectSlug ?? null,
      params.sessionChatId ?? null,
      now,
    ]
  );
  return {
    id,
    jobId: params.jobId,
    executionId: params.executionId,
    kind: params.kind,
    jobName: params.jobName,
    payload: params.payload ?? {},
    conversationId: params.conversationId,
    projectSlug: params.projectSlug,
    sessionChatId: params.sessionChatId,
    createdAt: now,
  };
}

export async function getTriggerEvent(id: string): Promise<TriggerEvent | null> {
  const res = await getDb().query<{
    id: string;
    job_id: string;
    execution_id: string;
    kind: string;
    job_name: string;
    payload: string;
    conversation_id: string | null;
    project_slug: string | null;
    session_chat_id: string | null;
    created_at: number;
  }>("SELECT * FROM trigger_events WHERE id = $1", [id]);
  const r = res.rows?.[0];
  if (!r) return null;
  return {
    id: r.id,
    jobId: r.job_id,
    executionId: r.execution_id,
    kind: r.kind as ProactiveJobKind,
    jobName: r.job_name,
    payload: r.payload ? (JSON.parse(r.payload) as Record<string, unknown>) : {},
    conversationId: r.conversation_id,
    projectSlug: r.project_slug,
    sessionChatId: r.session_chat_id,
    createdAt: r.created_at,
  };
}

export async function listTriggerEvents(limit = 50, offset = 0): Promise<TriggerEvent[]> {
  const res = await getDb().query<{
    id: string;
    job_id: string;
    execution_id: string;
    kind: string;
    job_name: string;
    payload: string;
    conversation_id: string | null;
    project_slug: string | null;
    session_chat_id: string | null;
    created_at: number;
  }>("SELECT * FROM trigger_events ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]);
  return (res.rows ?? []).map((r) => ({
    id: r.id,
    jobId: r.job_id,
    executionId: r.execution_id,
    kind: r.kind as ProactiveJobKind,
    jobName: r.job_name,
    payload: r.payload ? (JSON.parse(r.payload) as Record<string, unknown>) : {},
    conversationId: r.conversation_id,
    projectSlug: r.project_slug,
    sessionChatId: r.session_chat_id,
    createdAt: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Attention candidates
// ---------------------------------------------------------------------------

export async function insertAttentionCandidate(params: {
  id?: string;
  triggerEventId: string;
  jobId: string;
  executionId: string;
  reason: string;
  suggestedUrgency: AttentionCandidate["suggestedUrgency"];
  dedupeKey: string;
  alreadyDone?: string;
  needsAttention?: string;
  nextStep?: string;
}): Promise<AttentionCandidate> {
  const id = params.id ?? `ac_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO attention_candidates (id, trigger_event_id, job_id, execution_id, reason, suggested_urgency, dedupe_key, already_done, needs_attention, next_step, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      params.triggerEventId,
      params.jobId,
      params.executionId,
      params.reason,
      params.suggestedUrgency,
      params.dedupeKey,
      params.alreadyDone ?? null,
      params.needsAttention ?? null,
      params.nextStep ?? null,
      now,
    ]
  );
  return {
    id,
    triggerEventId: params.triggerEventId,
    jobId: params.jobId,
    executionId: params.executionId,
    reason: params.reason,
    suggestedUrgency: params.suggestedUrgency,
    dedupeKey: params.dedupeKey,
    alreadyDone: params.alreadyDone,
    needsAttention: params.needsAttention,
    nextStep: params.nextStep,
    createdAt: now,
  };
}

// ---------------------------------------------------------------------------
// Attention decisions
// ---------------------------------------------------------------------------

export async function insertAttentionDecision(params: {
  id?: string;
  candidateId: string;
  triggerEventId: string;
  outcome: AttentionDecisionOutcome;
  rationale: string;
  owner: ProactiveOwner;
  notificationId?: string | null;
  workItemId?: string | null;
  criteria?: Record<string, unknown>;
}): Promise<AttentionDecision> {
  const id = params.id ?? `ad_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO attention_decisions (id, candidate_id, trigger_event_id, outcome, rationale, owner, notification_id, work_item_id, criteria, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      params.candidateId,
      params.triggerEventId,
      params.outcome,
      params.rationale,
      params.owner,
      params.notificationId ?? null,
      params.workItemId ?? null,
      JSON.stringify(params.criteria ?? {}),
      now,
    ]
  );
  return {
    id,
    candidateId: params.candidateId,
    triggerEventId: params.triggerEventId,
    outcome: params.outcome,
    rationale: params.rationale,
    owner: params.owner,
    notificationId: params.notificationId,
    workItemId: params.workItemId,
    criteria: params.criteria ?? {},
    createdAt: now,
  };
}

export async function updateAttentionDecisionNotificationAndWorkItem(
  decisionId: string,
  notificationId: string | null,
  workItemId: string | null
): Promise<void> {
  await getDb().query(
    "UPDATE attention_decisions SET notification_id = $1, work_item_id = $2 WHERE id = $3",
    [notificationId, workItemId, decisionId]
  );
}

export async function listAttentionDecisions(limit = 50, offset = 0): Promise<AttentionDecision[]> {
  const res = await getDb().query<{
    id: string;
    candidate_id: string;
    trigger_event_id: string;
    outcome: string;
    rationale: string;
    owner: string;
    notification_id: string | null;
    work_item_id: string | null;
    criteria: string;
    created_at: number;
  }>("SELECT * FROM attention_decisions ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]);
  return (res.rows ?? []).map((r) => ({
    id: r.id,
    candidateId: r.candidate_id,
    triggerEventId: r.trigger_event_id,
    outcome: r.outcome as AttentionDecisionOutcome,
    rationale: r.rationale,
    owner: r.owner as ProactiveOwner,
    notificationId: r.notification_id,
    workItemId: r.work_item_id,
    criteria: r.criteria ? (JSON.parse(r.criteria) as Record<string, unknown>) : {},
    createdAt: r.created_at,
  }));
}

/** Check if we recently decided something for this dedupe key (avoid duplicate nudges). */
export async function getRecentDecisionByDedupeKey(
  dedupeKey: string,
  withinMinutes: number
): Promise<AttentionDecision | null> {
  const since = Date.now() - withinMinutes * 60 * 1000;
  const res = await getDb().query<{ id: string }>(
    `SELECT d.id FROM attention_decisions d
     JOIN attention_candidates c ON c.id = d.candidate_id
     WHERE c.dedupe_key = $1 AND d.created_at >= $2
     ORDER BY d.created_at DESC LIMIT 1`,
    [dedupeKey, since]
  );
  const row = res.rows?.[0];
  if (!row) return null;
  const decRes = await getDb().query<{
    id: string;
    candidate_id: string;
    trigger_event_id: string;
    outcome: string;
    rationale: string;
    owner: string;
    notification_id: string | null;
    work_item_id: string | null;
    criteria: string;
    created_at: number;
  }>("SELECT * FROM attention_decisions WHERE id = $1", [row.id]);
  const r = decRes.rows?.[0];
  if (!r) return null;
  return {
    id: r.id,
    candidateId: r.candidate_id,
    triggerEventId: r.trigger_event_id,
    outcome: r.outcome as AttentionDecisionOutcome,
    rationale: r.rationale,
    owner: r.owner as ProactiveOwner,
    notificationId: r.notification_id,
    workItemId: r.work_item_id,
    criteria: r.criteria ? (JSON.parse(r.criteria) as Record<string, unknown>) : {},
    createdAt: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// Work items
// ---------------------------------------------------------------------------

export async function createWorkItem(params: {
  id?: string;
  decisionId: string;
  candidateId: string;
  triggerEventId: string;
  jobId: string;
  kind: string;
  title: string;
  summary?: string;
  owner: ProactiveOwner;
  conversationId?: string | null;
  projectSlug?: string | null;
}): Promise<WorkItem> {
  const id = params.id ?? `wi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO work_items (id, decision_id, candidate_id, trigger_event_id, job_id, kind, title, summary, owner, status, conversation_id, project_slug, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12, $12)`,
    [
      id,
      params.decisionId,
      params.candidateId,
      params.triggerEventId,
      params.jobId,
      params.kind,
      params.title,
      params.summary ?? null,
      params.owner,
      params.conversationId ?? null,
      params.projectSlug ?? null,
      now,
    ]
  );
  return {
    id,
    decisionId: params.decisionId,
    candidateId: params.candidateId,
    triggerEventId: params.triggerEventId,
    jobId: params.jobId,
    kind: params.kind,
    title: params.title,
    summary: params.summary,
    owner: params.owner,
    status: "pending",
    conversationId: params.conversationId,
    projectSlug: params.projectSlug,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listWorkItems(limit = 50, status?: WorkItem["status"]): Promise<WorkItem[]> {
  const db = getDb();
  const res = status
    ? await db.query<{
        id: string;
        decision_id: string;
        candidate_id: string;
        trigger_event_id: string;
        job_id: string;
        kind: string;
        title: string;
        summary: string | null;
        owner: string;
        status: string;
        conversation_id: string | null;
        project_slug: string | null;
        created_at: number;
        updated_at: number;
        completed_at: number | null;
      }>("SELECT * FROM work_items WHERE status = $1 ORDER BY created_at DESC LIMIT $2", [status, limit])
    : await db.query<{
        id: string;
        decision_id: string;
        candidate_id: string;
        trigger_event_id: string;
        job_id: string;
        kind: string;
        title: string;
        summary: string | null;
        owner: string;
        status: string;
        conversation_id: string | null;
        project_slug: string | null;
        created_at: number;
        updated_at: number;
        completed_at: number | null;
      }>("SELECT * FROM work_items ORDER BY created_at DESC LIMIT $1", [limit]);
  return (res.rows ?? []).map((r) => ({
    id: r.id,
    decisionId: r.decision_id,
    candidateId: r.candidate_id,
    triggerEventId: r.trigger_event_id,
    jobId: r.job_id,
    kind: r.kind,
    title: r.title,
    summary: r.summary ?? undefined,
    owner: r.owner as ProactiveOwner,
    status: r.status as WorkItem["status"],
    conversationId: r.conversation_id,
    projectSlug: r.project_slug,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  }));
}

// ---------------------------------------------------------------------------
// Attention budget
// ---------------------------------------------------------------------------

export async function getAttentionBudgetConfig(): Promise<AttentionBudgetConfig> {
  const res = await getDb().query<{
    max_proactive_messages_per_day: number;
    quiet_hours_start: number | null;
    quiet_hours_end: number | null;
    bundle_related: boolean;
    min_minutes_between_same_type_nudge: number;
    prefer_silent_progress: boolean;
  }>("SELECT * FROM attention_budget WHERE id = 'default'");
  const r = res.rows?.[0];
  if (!r) {
    return {
      maxProactiveMessagesPerDay: 20,
      bundleRelated: true,
      minMinutesBetweenSameTypeNudge: 60,
      preferSilentProgress: true,
    };
  }
  return {
    maxProactiveMessagesPerDay: r.max_proactive_messages_per_day,
    quietHours:
      r.quiet_hours_start != null && r.quiet_hours_end != null ? [r.quiet_hours_start, r.quiet_hours_end] : null,
    bundleRelated: r.bundle_related,
    minMinutesBetweenSameTypeNudge: r.min_minutes_between_same_type_nudge,
    preferSilentProgress: r.prefer_silent_progress,
  };
}

/** Count proactive notifications created today (for attention budget). */
export async function countProactiveNotificationsToday(): Promise<number> {
  const db = getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since = startOfDay.getTime();
  const res = await db.query<{ count: string }>(
    "SELECT COUNT(*)::text as count FROM proactive_notifications WHERE created_at >= $1",
    [since]
  );
  return parseInt(res.rows?.[0]?.count ?? "0", 10);
}

/** Check if we're in quiet hours (local hour 0-23). */
export function isQuietHours(quietHours: [number, number] | null | undefined): boolean {
  if (!quietHours || quietHours.length !== 2) return false;
  const [start, end] = quietHours;
  const now = new Date();
  const hour = now.getHours();
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}
