/**
 * Proactivity Decision Engine: trigger → evaluation → decision → work/notify → audit.
 * No proactive trigger may directly notify or act; all flow through this engine.
 */

import type { ScheduledJob, ProactiveNotification, AttentionDecisionOutcome, ProactiveOwner } from "@claws/shared/types";
import {
  insertTriggerEvent,
  insertAttentionCandidate,
  insertAttentionDecision,
  updateAttentionDecisionNotificationAndWorkItem,
  createWorkItem,
  getAttentionBudgetConfig,
  countProactiveNotificationsToday,
  getRecentDecisionByDedupeKey,
  isQuietHours,
} from "@claws/runtime-db";

export type HandlerResult = {
  summary: string;
  result?: Record<string, unknown>;
  modelUsed?: string;
  /** Suggested notification (engine may still decide to ignore/bundle/act_silently). */
  suggestedNotification?: { title: string; body: string; kind: ProactiveNotification["kind"] };
};

export type DecisionEngineDeps = {
  createProactiveNotification: (params: {
    jobId?: string | null;
    executionId?: string | null;
    kind: ProactiveNotification["kind"];
    title: string;
    body: string;
    conversationId?: string | null;
    sessionChatId?: string | null;
  }) => Promise<ProactiveNotification>;
};

export type DecisionEngineResult = {
  triggerEventId: string;
  candidateId: string;
  decisionId: string;
  outcome: AttentionDecisionOutcome;
  rationale: string;
  owner: ProactiveOwner;
  notification?: ProactiveNotification;
  workItem?: { id: string; title: string };
};

/**
 * Run the full pipeline: record trigger → build candidate → evaluate → decide → create notification/work_item if appropriate.
 * Call this after every proactive handler; do not create notifications directly from handlers.
 */
export async function runProactivityDecisionEngine(
  job: ScheduledJob,
  executionId: string,
  handlerResult: HandlerResult,
  deps: DecisionEngineDeps
): Promise<DecisionEngineResult> {
  const now = Date.now();

  // 1. Record trigger event (audit)
  const triggerEvent = await insertTriggerEvent({
    jobId: job.id,
    executionId,
    kind: job.kind,
    jobName: job.name,
    payload: {
      summary: handlerResult.summary,
      ...handlerResult.result,
      suggestedNotification: handlerResult.suggestedNotification,
    },
    conversationId: job.conversationId,
    projectSlug: job.projectSlug,
    sessionChatId: undefined,
  });

  // 2. Build attention candidate
  const { reason, suggestedUrgency, dedupeKey, alreadyDone, needsAttention, nextStep } = buildCandidateFromResult(
    job,
    handlerResult
  );
  const candidate = await insertAttentionCandidate({
    triggerEventId: triggerEvent.id,
    jobId: job.id,
    executionId,
    reason,
    suggestedUrgency,
    dedupeKey,
    alreadyDone,
    needsAttention,
    nextStep,
  });

  // 3. Evaluate criteria
  const budget = await getAttentionBudgetConfig();
  const notificationsToday = await countProactiveNotificationsToday();
  const recentDecision = await getRecentDecisionByDedupeKey(
    dedupeKey,
    budget.minMinutesBetweenSameTypeNudge
  );
  const quiet = isQuietHours(budget.quietHours);
  const overBudget = notificationsToday >= budget.maxProactiveMessagesPerDay;
  const duplicate = recentDecision != null && recentDecision.outcome !== "ignore";

  // 4. Decide outcome
  const { outcome, rationale, owner } = decideOutcome({
    suggestedUrgency,
    overBudget,
    quiet,
    duplicate,
    preferSilentProgress: budget.preferSilentProgress,
    hasSuggestedNotification: !!handlerResult.suggestedNotification,
  });

  // 5. Record decision first (audit), then create notification/work_item and link
  const decision = await insertAttentionDecision({
    candidateId: candidate.id,
    triggerEventId: triggerEvent.id,
    outcome,
    rationale,
    owner,
    notificationId: null,
    workItemId: null,
    criteria: {
      urgency: suggestedUrgency,
      withinAttentionBudget: !overBudget,
      quietHours: quiet,
      duplicateWork: duplicate,
      notificationFatigue: overBudget,
      preferSilentProgress: budget.preferSilentProgress,
    },
  });

  let notificationId: string | null = null;
  let workItemId: string | null = null;
  let notification: ProactiveNotification | undefined;
  let workItem: { id: string; title: string } | undefined;

  if (outcome === "notify" && handlerResult.suggestedNotification && !overBudget && !quiet) {
    const n = await deps.createProactiveNotification({
      jobId: job.id,
      executionId,
      kind: handlerResult.suggestedNotification.kind,
      title: handlerResult.suggestedNotification.title,
      body: handlerResult.suggestedNotification.body,
      conversationId: job.conversationId,
      sessionChatId: undefined,
    });
    notificationId = n.id;
    notification = n;
  }

  if ((outcome === "act_silently" || outcome === "delegate") && !duplicate) {
    const wi = await createWorkItem({
      decisionId: decision.id,
      candidateId: candidate.id,
      triggerEventId: triggerEvent.id,
      jobId: job.id,
      kind: job.kind,
      title: reason.slice(0, 200),
      summary: handlerResult.summary,
      owner: outcome === "delegate" ? "specialist_agent" : "orchestrator",
      conversationId: job.conversationId,
      projectSlug: job.projectSlug,
    });
    workItemId = wi.id;
    workItem = { id: wi.id, title: wi.title };
  }

  if (notificationId || workItemId) {
    await updateAttentionDecisionNotificationAndWorkItem(decision.id, notificationId, workItemId);
  }

  return {
    triggerEventId: triggerEvent.id,
    candidateId: candidate.id,
    decisionId: decision.id,
    outcome,
    rationale,
    owner,
    notification,
    workItem,
  };
}

function buildCandidateFromResult(
  job: ScheduledJob,
  result: HandlerResult
): {
  reason: string;
  suggestedUrgency: AttentionCandidate["suggestedUrgency"];
  dedupeKey: string;
  alreadyDone?: string;
  needsAttention?: string;
  nextStep?: string;
} {
  const nameLower = job.name.toLowerCase();
  const isApprovals = nameLower.includes("approval");
  const isReport = nameLower.includes("morning") || nameLower.includes("midday") || nameLower.includes("eod") || nameLower.includes("end of day");
  const isStale = nameLower.includes("stale");

  if (isApprovals && typeof result.result?.pendingCount === "number") {
    const count = result.result.pendingCount as number;
    return {
      reason: count === 0 ? "No pending approvals." : `${count} approval(s) pending.`,
      suggestedUrgency: count > 3 ? "high" : count > 0 ? "normal" : "low",
      dedupeKey: `job:${job.id}:approvals`,
      alreadyDone: "Checked approval queue.",
      needsAttention: count > 0 ? `${count} item(s) need your decision.` : undefined,
      nextStep: count > 0 ? "Open Approvals to approve or deny." : undefined,
    };
  }

  if (isReport) {
    return {
      reason: result.summary,
      suggestedUrgency: "low",
      dedupeKey: `job:${job.id}:report`,
      alreadyDone: "Report run completed.",
      nextStep: "Review in Proactivity if needed.",
    };
  }

  if (isStale) {
    return {
      reason: result.summary,
      suggestedUrgency: "normal",
      dedupeKey: `job:${job.id}:stale`,
      alreadyDone: "Stale project check ran.",
      nextStep: "Review project activity.",
    };
  }

  return {
    reason: result.summary,
    suggestedUrgency: "low",
    dedupeKey: `job:${job.id}:generic`,
    alreadyDone: result.summary,
  };
}

type AttentionCandidate = import("@claws/shared/types").AttentionCandidate;

function decideOutcome(params: {
  suggestedUrgency: AttentionCandidate["suggestedUrgency"];
  overBudget: boolean;
  quiet: boolean;
  duplicate: boolean;
  preferSilentProgress: boolean;
  hasSuggestedNotification: boolean;
}): { outcome: AttentionDecisionOutcome; rationale: string; owner: ProactiveOwner } {
  const { overBudget, quiet, duplicate, preferSilentProgress, suggestedUrgency, hasSuggestedNotification } = params;

  if (duplicate) {
    return { outcome: "ignore", rationale: "Recent decision for same context; avoiding duplicate nudge.", owner: "orchestrator" };
  }
  if (overBudget) {
    return {
      outcome: "ignore",
      rationale: "Daily proactive message limit reached; deferring to respect attention budget.",
      owner: "orchestrator",
    };
  }
  if (quiet) {
    return {
      outcome: "bundle",
      rationale: "Quiet hours; will bundle with next non-quiet delivery.",
      owner: "orchestrator",
    };
  }
  if (preferSilentProgress && suggestedUrgency === "low" && hasSuggestedNotification) {
    return {
      outcome: "act_silently",
      rationale: "Low urgency; recording as work item instead of notifying.",
      owner: "orchestrator",
    };
  }
  if (suggestedUrgency === "urgent" || suggestedUrgency === "high") {
    return {
      outcome: "notify",
      rationale: "Urgent or high priority; notifying user.",
      owner: "orchestrator",
    };
  }
  if (hasSuggestedNotification) {
    return {
      outcome: "notify",
      rationale: "Within budget and not quiet; sending notification.",
      owner: "orchestrator",
    };
  }
  return {
    outcome: "ignore",
    rationale: "No suggested notification; recorded for audit only.",
    owner: "orchestrator",
  };
}
