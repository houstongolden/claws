import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UUID, WorkflowRun, WorkflowStatus, WorkflowDefinition } from "@claws/shared";

/**
 * Workflow engine aligned with Vercel Workflow / Workflow DevKit patterns.
 *
 * Supports both in-memory and disk-backed persistence. When a workspaceRoot
 * is provided via `initWorkflowStorage()`, all mutations are persisted to
 * `.claws/workflow-store.json` and survive gateway restarts.
 */

const runs = new Map<string, WorkflowRun>();
let storePath: string | null = null;

function generateId(): UUID {
  return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function initWorkflowStorage(workspaceRoot: string): Promise<void> {
  storePath = path.join(workspaceRoot, ".claws", "workflow-store.json");

  if (existsSync(storePath)) {
    try {
      const raw = await readFile(storePath, "utf8");
      const data = JSON.parse(raw) as { runs?: WorkflowRun[] };
      if (Array.isArray(data.runs)) {
        for (const run of data.runs) {
          runs.set(run.id, run);
        }
      }
    } catch {
      // ignore corrupt store, start fresh
    }
  }
}

async function persist(): Promise<void> {
  if (!storePath) return;
  await mkdir(path.dirname(storePath), { recursive: true });
  const data = { runs: [...runs.values()], updatedAt: Date.now() };
  await writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}

export async function createWorkflowRun(
  definition: WorkflowDefinition,
  context: {
    agentId: string;
    channel: string;
    chatId: string;
    threadId?: string;
  }
): Promise<WorkflowRun> {
  const now = Date.now();
  const run: WorkflowRun = {
    id: generateId(),
    name: definition.name,
    status: "pending",
    steps: definition.steps.map((s) => ({
      id: s.id,
      name: s.name,
      status: "pending" as WorkflowStatus,
      tool: s.tool,
      args: s.args,
      requiresApproval: s.requiresApproval,
    })),
    createdAt: now,
    updatedAt: now,
    agentId: context.agentId,
    channel: context.channel as WorkflowRun["channel"],
    chatId: context.chatId,
    threadId: context.threadId,
  };
  runs.set(run.id, run);
  await persist();
  return run;
}

export function getWorkflowRun(id: string): WorkflowRun | undefined {
  return runs.get(id);
}

export function listWorkflowRuns(): WorkflowRun[] {
  return [...runs.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function advanceStep(
  runId: string,
  stepId: string,
  update: { status: WorkflowStatus; result?: unknown; error?: string }
): Promise<WorkflowRun | undefined> {
  const run = runs.get(runId);
  if (!run) return undefined;

  const step = run.steps.find((s) => s.id === stepId);
  if (!step) return undefined;

  const now = Date.now();
  step.status = update.status;
  if (update.result !== undefined) step.result = update.result;
  if (update.error !== undefined) step.error = update.error;

  if (update.status === "running" && !step.startedAt) {
    step.startedAt = now;
  }
  if (update.status === "completed" || update.status === "failed") {
    step.completedAt = now;
  }

  run.updatedAt = now;
  recalculateRunStatus(run);
  await persist();
  return run;
}

export async function pauseWorkflow(runId: string): Promise<WorkflowRun | undefined> {
  const run = runs.get(runId);
  if (!run || run.status === "completed" || run.status === "failed") return undefined;
  run.status = "paused";
  run.updatedAt = Date.now();
  await persist();
  return run;
}

export async function resumeWorkflow(runId: string): Promise<WorkflowRun | undefined> {
  const run = runs.get(runId);
  if (!run || run.status !== "paused") return undefined;
  run.status = "running";
  run.updatedAt = Date.now();
  await persist();
  return run;
}

export async function cancelWorkflow(runId: string): Promise<WorkflowRun | undefined> {
  const run = runs.get(runId);
  if (!run || run.status === "completed") return undefined;
  run.status = "cancelled";
  run.updatedAt = Date.now();
  await persist();
  return run;
}

export async function resetWorkflows(): Promise<void> {
  runs.clear();
  await persist();
}

function recalculateRunStatus(run: WorkflowRun): void {
  const statuses = run.steps.map((s) => s.status);

  if (statuses.every((s) => s === "completed")) {
    run.status = "completed";
  } else if (statuses.some((s) => s === "failed")) {
    run.status = "failed";
  } else if (statuses.some((s) => s === "waiting-approval")) {
    run.status = "waiting-approval";
  } else if (statuses.some((s) => s === "running")) {
    run.status = "running";
  } else if (run.status !== "paused" && run.status !== "cancelled") {
    run.status = "pending";
  }
}
