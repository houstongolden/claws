/**
 * Proactivity Engine: scheduled jobs, executions, notifications, model policies.
 * Uses getDb() from the runtime-db package (no circular ref: index assigns getDb before re-exporting this).
 */

import { getDb } from "./db-internal.js";
import type {
  ScheduledJob,
  JobExecution,
  ProactiveNotification,
  ProactiveJobKind,
  ProactiveJobStatus,
  ModelTier,
} from "@claws/shared/types";

export type ScheduledJobRow = {
  id: string;
  kind: string;
  name: string;
  schedule_cron: string | null;
  interval_sec: number | null;
  config: string | Record<string, unknown>;
  model_tier: string;
  conversation_id: string | null;
  project_slug: string | null;
  status: string;
  created_at: number;
  updated_at: number;
  last_run_at: number | null;
};

function scheduledJobFromRow(r: ScheduledJobRow): ScheduledJob {
  return {
    id: r.id,
    kind: r.kind as ProactiveJobKind,
    name: r.name,
    scheduleCron: r.schedule_cron ?? undefined,
    intervalSec: r.interval_sec ?? undefined,
    config: typeof r.config === "string" ? (JSON.parse(r.config || "{}") as Record<string, unknown>) : (r.config ?? {}),
    modelTier: r.model_tier as ModelTier,
    conversationId: r.conversation_id ?? undefined,
    projectSlug: r.project_slug ?? undefined,
    status: r.status as ProactiveJobStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastRunAt: r.last_run_at ?? undefined,
  };
}

export async function listScheduledJobs(status?: ProactiveJobStatus): Promise<ScheduledJob[]> {
  const db = getDb();
  const res = status
    ? await db.query<ScheduledJobRow>("SELECT * FROM scheduled_jobs WHERE status = $1 ORDER BY created_at DESC", [status])
    : await db.query<ScheduledJobRow>("SELECT * FROM scheduled_jobs ORDER BY created_at DESC");
  return (res.rows ?? []).map(scheduledJobFromRow);
}

/** Jobs that are due to run: active, and (next run by cron or interval has passed). */
export async function listDueScheduledJobs(nowMs: number): Promise<ScheduledJob[]> {
  const db = getDb();
  const res = await db.query<ScheduledJobRow>(
    "SELECT * FROM scheduled_jobs WHERE status = 'active' ORDER BY last_run_at ASC NULLS FIRST"
  );
  const rows = (res.rows ?? []).map(scheduledJobFromRow);
  const MIN_CRON_INTERVAL_MS = 60 * 60 * 1000; // 1h minimum between cron runs until we have cron parsing
  return rows.filter((job: ScheduledJob) => {
    const lastRun = job.lastRunAt ?? 0;
    if (job.intervalSec != null) {
      return nowMs >= lastRun + job.intervalSec * 1000;
    }
    if (job.scheduleCron) {
      return nowMs >= lastRun + MIN_CRON_INTERVAL_MS;
    }
    return nowMs >= lastRun + 60_000;
  });
}

export async function createScheduledJob(params: {
  kind: ProactiveJobKind;
  name: string;
  scheduleCron?: string | null;
  intervalSec?: number | null;
  config?: Record<string, unknown>;
  modelTier?: ModelTier;
  conversationId?: string | null;
  projectSlug?: string | null;
}): Promise<ScheduledJob> {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  const db = getDb();
  await db.query(
    `INSERT INTO scheduled_jobs (id, kind, name, schedule_cron, interval_sec, config, model_tier, conversation_id, project_slug, status, created_at, updated_at, last_run_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $10, NULL)`,
    [
      id,
      params.kind,
      params.name,
      params.scheduleCron ?? null,
      params.intervalSec ?? null,
      JSON.stringify(params.config ?? {}),
      params.modelTier ?? "cheap",
      params.conversationId ?? null,
      params.projectSlug ?? null,
      now,
    ]
  );
  const res = await db.query<ScheduledJobRow>("SELECT * FROM scheduled_jobs WHERE id = $1", [id]);
  return scheduledJobFromRow(res.rows![0]);
}

export async function getScheduledJob(id: string): Promise<ScheduledJob | null> {
  const res = await getDb().query<ScheduledJobRow>("SELECT * FROM scheduled_jobs WHERE id = $1", [id]);
  const row = res.rows?.[0];
  if (!row) return null;
  return scheduledJobFromRow(row);
}

export async function pauseScheduledJob(id: string): Promise<ScheduledJob | null> {
  const job = await getScheduledJob(id);
  if (!job || job.status === "paused") return job;
  const now = Date.now();
  await getDb().query("UPDATE scheduled_jobs SET status = 'paused', updated_at = $1 WHERE id = $2", [now, id]);
  return getScheduledJob(id);
}

export async function resumeScheduledJob(id: string): Promise<ScheduledJob | null> {
  const job = await getScheduledJob(id);
  if (!job || job.status === "active") return job;
  const now = Date.now();
  await getDb().query("UPDATE scheduled_jobs SET status = 'active', updated_at = $1 WHERE id = $2", [now, id]);
  return getScheduledJob(id);
}

export async function updateScheduledJobLastRun(id: string, lastRunAt: number): Promise<void> {
  await getDb().query("UPDATE scheduled_jobs SET last_run_at = $1, updated_at = $2 WHERE id = $3", [
    lastRunAt,
    lastRunAt,
    id,
  ]);
}

export type JobExecutionRow = {
  id: string;
  job_id: string;
  started_at: number;
  finished_at: number | null;
  status: string;
  summary: string | null;
  result: string | Record<string, unknown> | null;
  error: string | null;
  model_used: string | null;
  created_at: number;
};

function jobExecutionFromRow(r: JobExecutionRow): JobExecution {
  return {
    id: r.id,
    jobId: r.job_id,
    startedAt: r.started_at,
    finishedAt: r.finished_at ?? undefined,
    status: r.status as JobExecution["status"],
    summary: r.summary ?? undefined,
    result: r.result ? (typeof r.result === "string" ? (JSON.parse(r.result) as Record<string, unknown>) : r.result) : undefined,
    error: r.error ?? undefined,
    modelUsed: r.model_used ?? undefined,
  };
}

export async function createJobExecution(jobId: string): Promise<JobExecution> {
  const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO job_executions (id, job_id, started_at, status, created_at) VALUES ($1, $2, $3, 'running', $3)`,
    [id, jobId, now]
  );
  const res = await getDb().query<JobExecutionRow>("SELECT * FROM job_executions WHERE id = $1", [id]);
  return jobExecutionFromRow(res.rows![0]);
}

export async function updateJobExecution(
  executionId: string,
  update: { status: "completed" | "failed"; summary?: string; result?: Record<string, unknown>; error?: string; modelUsed?: string }
): Promise<void> {
  const now = Date.now();
  await getDb().query(
    `UPDATE job_executions SET finished_at = $1, status = $2, summary = $3, result = $4, error = $5, model_used = $6 WHERE id = $7`,
    [
      now,
      update.status,
      update.summary ?? null,
      update.result ? JSON.stringify(update.result) : null,
      update.error ?? null,
      update.modelUsed ?? null,
      executionId,
    ]
  );
}

export async function listJobExecutions(jobId?: string, limit = 50): Promise<JobExecution[]> {
  const db = getDb();
  const res = jobId
    ? await db.query<JobExecutionRow>("SELECT * FROM job_executions WHERE job_id = $1 ORDER BY started_at DESC LIMIT $2", [jobId, limit])
    : await db.query<JobExecutionRow>("SELECT * FROM job_executions ORDER BY started_at DESC LIMIT $1", [limit]);
  return (res.rows ?? []).map(jobExecutionFromRow);
}

export type ProactiveNotificationRow = {
  id: string;
  job_id: string | null;
  execution_id: string | null;
  kind: string;
  title: string;
  body: string;
  conversation_id: string | null;
  session_chat_id: string | null;
  read_at: number | null;
  created_at: number;
};

function proactiveNotificationFromRow(r: ProactiveNotificationRow): ProactiveNotification {
  return {
    id: r.id,
    jobId: r.job_id ?? undefined,
    executionId: r.execution_id ?? undefined,
    kind: r.kind as ProactiveNotification["kind"],
    title: r.title,
    body: r.body,
    conversationId: r.conversation_id ?? undefined,
    sessionChatId: r.session_chat_id ?? undefined,
    readAt: r.read_at ?? undefined,
    createdAt: r.created_at,
  };
}

export async function listProactiveNotifications(opts?: { unreadOnly?: boolean; limit?: number }): Promise<ProactiveNotification[]> {
  const db = getDb();
  const limit = opts?.limit ?? 50;
  const res = opts?.unreadOnly
    ? await db.query<ProactiveNotificationRow>("SELECT * FROM proactive_notifications WHERE read_at IS NULL ORDER BY created_at DESC LIMIT $1", [limit])
    : await db.query<ProactiveNotificationRow>("SELECT * FROM proactive_notifications ORDER BY created_at DESC LIMIT $1", [limit]);
  return (res.rows ?? []).map(proactiveNotificationFromRow);
}

export async function createProactiveNotification(params: {
  jobId?: string | null;
  executionId?: string | null;
  kind: ProactiveNotification["kind"];
  title: string;
  body: string;
  conversationId?: string | null;
  sessionChatId?: string | null;
}): Promise<ProactiveNotification> {
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO proactive_notifications (id, job_id, execution_id, kind, title, body, conversation_id, session_chat_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      params.jobId ?? null,
      params.executionId ?? null,
      params.kind,
      params.title,
      params.body,
      params.conversationId ?? null,
      params.sessionChatId ?? null,
      now,
    ]
  );
  const res = await getDb().query<ProactiveNotificationRow>("SELECT * FROM proactive_notifications WHERE id = $1", [id]);
  return proactiveNotificationFromRow(res.rows![0]);
}

export async function markProactiveNotificationRead(id: string): Promise<void> {
  await getDb().query("UPDATE proactive_notifications SET read_at = $1 WHERE id = $2", [Date.now(), id]);
}

export type ModelPolicyRow = { id: string; job_type: string; default_tier: string; escalation_rules: string | unknown[] };

export async function listModelPolicies(): Promise<{ jobType: string; defaultTier: ModelTier; escalationRules: string[] }[]> {
  const res = await getDb().query<ModelPolicyRow>("SELECT * FROM model_policies");
  return (res.rows ?? []).map((r: ModelPolicyRow) => ({
    jobType: r.job_type,
    defaultTier: r.default_tier as ModelTier,
    escalationRules: (Array.isArray(r.escalation_rules) ? r.escalation_rules : (typeof r.escalation_rules === "string" ? (JSON.parse(r.escalation_rules || "[]") as string[]) : [])) as string[],
  }));
}

export async function getModelPolicyForJobType(jobType: string): Promise<{ defaultTier: ModelTier; escalationRules: string[] } | null> {
  const res = await getDb().query<ModelPolicyRow>("SELECT * FROM model_policies WHERE job_type = $1", [jobType]);
  const r = res.rows?.[0];
  if (!r) return null;
  return {
    defaultTier: r.default_tier as ModelTier,
    escalationRules: (Array.isArray(r.escalation_rules) ? r.escalation_rules : (typeof r.escalation_rules === "string" ? (JSON.parse(r.escalation_rules || "[]") as string[]) : [])) as string[],
  };
}

/** Seed default model policies for built-in job types. Safe to call on every init. */
export async function seedModelPolicies(): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const policies: Array<{ job_type: string; default_tier: ModelTier }> = [
    { job_type: "morning-brief", default_tier: "cheap" },
    { job_type: "midday-report", default_tier: "cheap" },
    { job_type: "eod-report", default_tier: "cheap" },
    { job_type: "approvals-watchdog", default_tier: "cheap" },
    { job_type: "stale-project-watchdog", default_tier: "cheap" },
    { job_type: "goal_loop", default_tier: "standard" },
    { job_type: "report", default_tier: "cheap" },
    { job_type: "heartbeat", default_tier: "cheap" },
    { job_type: "watchdog", default_tier: "cheap" },
  ];
  for (const p of policies) {
    await db.query(
      `INSERT INTO model_policies (id, job_type, default_tier, escalation_rules, created_at, updated_at)
       VALUES ($1, $2, $3, '[]', $4, $4)
       ON CONFLICT (job_type) DO NOTHING`,
      [`mp_${p.job_type}`, p.job_type, p.default_tier, now]
    );
  }
}

/** Ensure built-in proactive jobs exist. Call after init if desired. */
export async function seedBuiltInProactiveJobs(): Promise<ScheduledJob[]> {
  const existing = await listScheduledJobs();
  const names = new Set(existing.map((j) => j.name));
  const builtIn: Array<{ kind: ProactiveJobKind; name: string; scheduleCron?: string; intervalSec?: number }> = [
    { kind: "report", name: "Morning Brief", scheduleCron: "0 9 * * *" },
    { kind: "report", name: "Midday Report", scheduleCron: "0 12 * * *" },
    { kind: "report", name: "End of Day Report", scheduleCron: "0 18 * * *" },
    { kind: "watchdog", name: "Approvals Watchdog", intervalSec: 300 },
    { kind: "watchdog", name: "Stale Project Watchdog", intervalSec: 86400 },
  ];
  const created: ScheduledJob[] = [];
  for (const b of builtIn) {
    if (names.has(b.name)) continue;
    const job = await createScheduledJob({
      kind: b.kind,
      name: b.name,
      scheduleCron: b.scheduleCron ?? null,
      intervalSec: b.intervalSec ?? null,
      modelTier: "cheap",
    });
    created.push(job);
    names.add(job.name);
  }
  return created;
}
