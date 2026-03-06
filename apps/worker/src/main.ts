/**
 * Claws background worker — polls for pending workflow steps and executes them.
 *
 * Connects to the gateway API to:
 *   1. List workflows with "running" or "pending" status
 *   2. Find the next actionable step
 *   3. Execute the step's tool (if any)
 *   4. Advance the step with the result
 *
 * In local-first mode, this runs alongside the gateway.
 * In hosted mode, this would run as a separate Vercel cron/queue worker.
 */

const GATEWAY_URL = process.env.CLAWS_GATEWAY_URL || "http://localhost:4317";
const POLL_INTERVAL_MS = Number(process.env.CLAWS_WORKER_POLL_MS || 5000);

type WorkflowStep = {
  id: string;
  name: string;
  status: string;
  tool?: string;
  args?: Record<string, unknown>;
  startedAt?: number;
  completedAt?: number;
};

type WorkflowRun = {
  id: string;
  name: string;
  status: string;
  steps: WorkflowStep[];
  agentId: string;
};

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`Worker fetch ${path}: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function getActiveWorkflows(): Promise<WorkflowRun[]> {
  const data = await fetchJSON<{ ok: boolean; workflows: WorkflowRun[] }>("/api/workflows");
  return (data.workflows ?? []).filter(
    (w) => w.status === "running" || w.status === "pending"
  );
}

function findNextStep(workflow: WorkflowRun): WorkflowStep | null {
  for (const step of workflow.steps) {
    if (step.status === "pending") return step;
  }
  return null;
}

async function executeStep(workflow: WorkflowRun, step: WorkflowStep): Promise<void> {
  console.log(`  Executing step "${step.name}" (${step.id}) in workflow "${workflow.name}"`);

  await fetchJSON(`/api/workflows/${workflow.id}/advance`, {
    method: "POST",
    body: JSON.stringify({ stepId: step.id, status: "running" }),
  });

  try {
    if (step.tool) {
      const result = await fetchJSON<{ ok: boolean; result?: unknown; error?: string }>("/api/tools/run", {
        method: "POST",
        body: JSON.stringify({ name: step.tool, args: step.args ?? {} }),
      });

      if (!result.ok) {
        throw new Error(result.error ?? `Tool ${step.tool} failed`);
      }

      await fetchJSON(`/api/workflows/${workflow.id}/advance`, {
        method: "POST",
        body: JSON.stringify({
          stepId: step.id,
          status: "completed",
          result: result.result,
        }),
      });
    } else {
      await fetchJSON(`/api/workflows/${workflow.id}/advance`, {
        method: "POST",
        body: JSON.stringify({
          stepId: step.id,
          status: "completed",
          result: { note: "No tool configured, auto-completed" },
        }),
      });
    }

    console.log(`  Step "${step.name}" completed.`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  Step "${step.name}" failed: ${msg}`);

    try {
      await fetchJSON(`/api/workflows/${workflow.id}/advance`, {
        method: "POST",
        body: JSON.stringify({ stepId: step.id, status: "failed", error: msg }),
      });
    } catch {
      console.error(`  Failed to report step failure for ${step.id}`);
    }
  }
}

async function pollCycle(): Promise<void> {
  try {
    const workflows = await getActiveWorkflows();

    if (workflows.length === 0) return;

    console.log(`[worker] ${workflows.length} active workflow(s)`);

    for (const workflow of workflows) {
      const step = findNextStep(workflow);
      if (step) {
        await executeStep(workflow, step);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Gateway not running or unreachable — retry quietly
    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("fetch failed") ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError")
    ) {
      return;
    }
    console.error("[worker] Poll error:", msg);
  }
}

async function waitForGateway(): Promise<void> {
  const maxWait = 30_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`${GATEWAY_URL}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        console.log(`[worker] Gateway connected at ${GATEWAY_URL}`);
        return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.warn("[worker] Gateway not responding after 30s, starting anyway...");
}

async function main() {
  console.log(`[worker] Claws background worker starting...`);
  console.log(`[worker] Gateway: ${GATEWAY_URL}`);
  console.log(`[worker] Poll interval: ${POLL_INTERVAL_MS}ms`);

  await waitForGateway();

  console.log("[worker] Polling for workflow steps...");

  const tick = async () => {
    await pollCycle();
    setTimeout(tick, POLL_INTERVAL_MS);
  };

  await tick();
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});
