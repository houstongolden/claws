/**
 * Proactive job runner: runs a single job by id (on-demand or from scheduler).
 * All proactive output flows through the Decision Engine; handlers return raw results + suggested notification.
 */
import { randomUUID } from "node:crypto";
import type { ScheduledJob, ProactiveNotification } from "@claws/shared/types";
import type { ApprovalItem } from "@claws/shared/types";
import { runProactivityDecisionEngine, type HandlerResult, type DecisionEngineDeps } from "./proactivityDecisionEngine.js";

export type RunProactiveJobDeps = {
  insertTrace: (item: { id?: string; ts: number; type: string; agentId: string; summary: string; data?: Record<string, unknown> }, sessionId?: string) => Promise<void>;
  listPendingApprovals: () => Promise<ApprovalItem[]>;
  dbCreateProactiveNotification: DecisionEngineDeps["createProactiveNotification"];
  dbCreateJobExecution: (jobId: string) => Promise<{ id: string; jobId: string; startedAt: number; status: string }>;
  dbUpdateJobExecution: (executionId: string, update: { status: "completed" | "failed"; summary?: string; result?: Record<string, unknown>; error?: string; modelUsed?: string }) => Promise<void>;
  dbUpdateScheduledJobLastRun: (jobId: string, lastRunAt: number) => Promise<void>;
  getScheduledJob: (id: string) => Promise<ScheduledJob | null>;
};

export async function runProactiveJob(
  jobId: string,
  deps: RunProactiveJobDeps
): Promise<{ executionId: string; summary: string; notification?: ProactiveNotification }> {
  const job = await deps.getScheduledJob(jobId);
  if (!job) throw new Error(`Proactive job not found: ${jobId}`);
  if (job.status !== "active") throw new Error(`Job is not active: ${jobId}`);

  const execution = await deps.dbCreateJobExecution(jobId);
  const startedAt = Date.now();

  try {
    const result = await runHandler(job, execution.id, deps);
    await deps.dbUpdateJobExecution(execution.id, {
      status: "completed",
      summary: result.summary,
      result: result.result,
      modelUsed: result.modelUsed,
    });
    await deps.dbUpdateScheduledJobLastRun(jobId, startedAt);

    const decisionResult = await runProactivityDecisionEngine(job, execution.id, result, {
      createProactiveNotification: deps.dbCreateProactiveNotification,
    });

    await deps.insertTrace(
      {
        id: randomUUID(),
        ts: Date.now(),
        type: "proactive-decision",
        agentId: "system",
        summary: `${decisionResult.outcome}: ${decisionResult.rationale}`,
        data: {
          jobId: job.id,
          executionId: execution.id,
          triggerEventId: decisionResult.triggerEventId,
          decisionId: decisionResult.decisionId,
          outcome: decisionResult.outcome,
          owner: decisionResult.owner,
          notificationId: decisionResult.notification?.id,
          workItemId: decisionResult.workItem?.id,
        },
      },
      undefined
    );

    return {
      executionId: execution.id,
      summary: result.summary,
      notification: decisionResult.notification,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await deps.dbUpdateJobExecution(execution.id, {
      status: "failed",
      summary: message,
      error: message,
    });
    await deps.dbUpdateScheduledJobLastRun(jobId, startedAt);
    throw err;
  }
}

async function runHandler(
  job: ScheduledJob,
  executionId: string,
  deps: RunProactiveJobDeps
): Promise<HandlerResult> {
  const nameLower = job.name.toLowerCase();
  const isMorningBrief = nameLower.includes("morning") || (job.config?.type as string) === "morning-brief";
  const isMidday = nameLower.includes("midday") || (job.config?.type as string) === "midday-report";
  const isEod = nameLower.includes("end of day") || nameLower.includes("eod") || (job.config?.type as string) === "eod-report";
  const isApprovalsWatchdog = nameLower.includes("approval") || (job.config?.type as string) === "approvals-watchdog";
  const isStaleProject = nameLower.includes("stale") || (job.config?.type as string) === "stale-project-watchdog";

  if (isApprovalsWatchdog) {
    const pending = await deps.listPendingApprovals();
    const count = pending.length;
    const summary = count === 0 ? "No pending approvals." : `${count} approval(s) pending.`;
    return {
      summary,
      result: { pendingCount: count },
      modelUsed: "none",
      suggestedNotification:
        count > 0
          ? { kind: "inform", title: "Approvals waiting", body: `${count} approval(s) need your attention.` }
          : undefined,
    };
  }

  if (isMorningBrief || isMidday || isEod) {
    const label = isMorningBrief ? "Morning brief" : isMidday ? "Midday report" : "End of day report";
    const summary = `${label} ran (stub). Add AI synthesis to generate real content.`;
    return {
      summary,
      result: { stub: true },
      modelUsed: "cheap",
      suggestedNotification: { kind: "inform", title: label, body: summary },
    };
  }

  if (isStaleProject) {
    const summary = "Stale project watchdog ran (stub). Add project activity scan for real detection.";
    return {
      summary,
      result: { stub: true },
      modelUsed: "cheap",
      suggestedNotification: { kind: "inform", title: "Stale project check", body: summary },
    };
  }

  return {
    summary: `Proactive job "${job.name}" ran (generic stub).`,
    result: { stub: true },
  };
}
