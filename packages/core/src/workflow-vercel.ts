import type { UUID, WorkflowRun, WorkflowStatus, WorkflowDefinition } from "@claws/shared";

/**
 * Vercel Workflow adapter for hosted deployment.
 *
 * When running in hosted mode, this adapter delegates workflow execution
 * to Vercel's Workflow / Workflow DevKit infrastructure instead of the
 * local disk-backed engine.
 *
 * This is a structural skeleton — the actual Vercel Workflow SDK integration
 * requires the `@vercel/workflow` package and deployment to Vercel.
 *
 * Usage:
 *   import { VercelWorkflowAdapter } from '@claws/core/workflow-vercel';
 *   const adapter = new VercelWorkflowAdapter({ projectId: 'prj_xxx' });
 *   await adapter.createRun(definition, context);
 */

export interface VercelWorkflowConfig {
  projectId?: string;
  apiToken?: string;
  baseUrl?: string;
}

export class VercelWorkflowAdapter {
  private config: VercelWorkflowConfig;

  constructor(config: VercelWorkflowConfig = {}) {
    this.config = {
      projectId: config.projectId ?? process.env.VERCEL_PROJECT_ID,
      apiToken: config.apiToken ?? process.env.VERCEL_API_TOKEN,
      baseUrl: config.baseUrl ?? "https://api.vercel.com",
    };
  }

  isConfigured(): boolean {
    return Boolean(this.config.projectId && this.config.apiToken);
  }

  async createRun(
    definition: WorkflowDefinition,
    context: {
      agentId: string;
      channel: string;
      chatId: string;
      threadId?: string;
    }
  ): Promise<WorkflowRun> {
    if (!this.isConfigured()) {
      throw new Error(
        "Vercel Workflow adapter not configured. Set VERCEL_PROJECT_ID and VERCEL_API_TOKEN."
      );
    }

    // In production, this would call the Vercel Workflow API:
    //
    // const res = await fetch(`${this.config.baseUrl}/v1/workflows`, {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${this.config.apiToken}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     projectId: this.config.projectId,
    //     name: definition.name,
    //     steps: definition.steps,
    //   }),
    // });

    const now = Date.now();
    return {
      id: `vwf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: definition.name,
      status: "pending",
      steps: definition.steps.map((s) => ({
        id: s.id,
        name: s.name,
        status: "pending" as WorkflowStatus,
      })),
      createdAt: now,
      updatedAt: now,
      agentId: context.agentId,
      channel: context.channel as WorkflowRun["channel"],
      chatId: context.chatId,
      threadId: context.threadId,
    };
  }

  async advanceStep(
    runId: string,
    stepId: string,
    update: { status: WorkflowStatus; result?: unknown; error?: string }
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Vercel Workflow adapter not configured.");
    }

    // In production: PATCH /v1/workflows/{runId}/steps/{stepId}
    void runId;
    void stepId;
    void update;
  }

  async pause(runId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Vercel Workflow adapter not configured.");
    }
    void runId;
  }

  async resume(runId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Vercel Workflow adapter not configured.");
    }
    void runId;
  }

  async cancel(runId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Vercel Workflow adapter not configured.");
    }
    void runId;
  }

  async list(): Promise<WorkflowRun[]> {
    if (!this.isConfigured()) {
      return [];
    }
    // In production: GET /v1/workflows?projectId={projectId}
    return [];
  }

  async get(runId: string): Promise<WorkflowRun | undefined> {
    if (!this.isConfigured()) {
      return undefined;
    }
    void runId;
    return undefined;
  }
}

/**
 * Factory: creates either a Vercel adapter (if configured) or returns null
 * so callers can fall back to the local engine.
 */
export function createVercelWorkflowAdapter(): VercelWorkflowAdapter | null {
  const adapter = new VercelWorkflowAdapter();
  return adapter.isConfigured() ? adapter : null;
}
