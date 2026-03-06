/**
 * Proactive job runner: runs a single job by id (on-demand or from scheduler).
 * Stub handlers for built-in jobs produce notifications and traces; full AI synthesis can be added later.
 */
import { randomUUID } from "node:crypto";
import type { ScheduledJob, ProactiveNotification } from "@claws/shared/types";
import type { ApprovalItem } from "@claws/shared/types";

export type RunProactiveJobDeps = {
  insertTrace: (item: { id?: string; ts: number; type: string; agentId: string; summary: string; data?: Record<string, unknown> }, sessionId?: string) => Promise<void>;
  listPendingApprovals: () => Promise<ApprovalItem[]>;
  dbCreateProactiveNotification: (params: {
    jobId?: string | null;
    executionId?: string | null;
    kind: ProactiveNotification["kind"];
    title: string;
    body: string;
    conversationId?: string | null;
    sessionChatId?: string | null;
  }) => Promise<ProactiveNotification>;
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
    return {
      executionId: execution.id,
      summary: result.summary,
      notification: result.notification,
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
): Promise<{
  summary: string;
  result?: Record<string, unknown>;
  modelUsed?: string;
  notification?: ProactiveNotification;
}> {
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
    let notification: ProactiveNotification | undefined;
    if (count > 0) {
      notification = await deps.dbCreateProactiveNotification({
        jobId: job.id,
        executionId,
        kind: "inform",
        title: "Approvals waiting",
        body: `${count} approval(s) need your attention.`,
        conversationId: job.conversationId ?? undefined,
      });
    }
    await deps.insertTrace(
      {
        id: randomUUID(),
        ts: Date.now(),
        type: "proactive-run",
        agentId: "system",
        summary: `Approvals watchdog: ${summary}`,
        data: { jobId: job.id, executionId, pendingCount: count },
      },
      undefined
    );
    return { summary, result: { pendingCount: count }, modelUsed: "none", notification };
  }

  if (isMorningBrief || isMidday || isEod) {
    const label = isMorningBrief ? "Morning brief" : isMidday ? "Midday report" : "End of day report";
    const summary = `${label} ran (stub). Add AI synthesis to generate real content.`;
    const notification = await deps.dbCreateProactiveNotification({
      jobId: job.id,
      executionId,
      kind: "inform",
      title: label,
      body: summary,
      conversationId: job.conversationId ?? undefined,
    });
    await deps.insertTrace(
      {
        id: randomUUID(),
        ts: Date.now(),
        type: "proactive-run",
        agentId: "system",
        summary,
        data: { jobId: job.id, executionId, kind: job.kind },
      },
      undefined
    );
    return { summary, result: { stub: true }, modelUsed: "cheap", notification };
  }

  if (isStaleProject) {
    const summary = "Stale project watchdog ran (stub). Add project activity scan for real detection.";
    const notification = await deps.dbCreateProactiveNotification({
      jobId: job.id,
      executionId,
      kind: "inform",
      title: "Stale project check",
      body: summary,
      conversationId: job.conversationId ?? undefined,
    });
    await deps.insertTrace(
      {
        id: randomUUID(),
        ts: Date.now(),
        type: "proactive-run",
        agentId: "system",
        summary,
        data: { jobId: job.id, executionId, kind: job.kind, projectSlug: job.projectSlug },
      },
      undefined
    );
    return { summary, result: { stub: true }, modelUsed: "cheap", notification };
  }

  const summary = `Proactive job "${job.name}" ran (generic stub).`;
  await deps.insertTrace(
    {
      id: randomUUID(),
      ts: Date.now(),
      type: "proactive-run",
      agentId: "system",
      summary,
      data: { jobId: job.id, executionId, kind: job.kind },
    },
    undefined
  );
  return { summary, result: { stub: true } };
}
