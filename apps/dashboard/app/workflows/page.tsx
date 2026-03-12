"use client";

import { useEffect, useState } from "react";
import {
  Play,
  Pause,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Workflow,
  ArrowRight,
} from "lucide-react";
import {
  Shell,
  PageHeader,
  PageContent,
  EmptyState,
} from "../../components/shell";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Toolbar, ToolbarLabel, ToolbarSeparator } from "../../components/ui/toolbar";
import { StatusDot } from "../../components/ui/status-dot";
import { InlineCode } from "../../components/ui/code-block";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import {
  getWorkflows,
  createWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  cancelWorkflow,
  type WorkflowRun,
  type WorkflowStep,
} from "../../lib/api";

const statusToVariant: Record<
  string,
  "success" | "error" | "warning" | "info" | "neutral" | "running"
> = {
  completed: "success",
  failed: "error",
  running: "running",
  paused: "warning",
  "waiting-approval": "warning",
  cancelled: "neutral",
  pending: "neutral",
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState("runs");

  type CreateStep = { id: string; name: string; tool: string; argsJson: string; requiresApproval: boolean };
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createSteps, setCreateSteps] = useState<CreateStep[]>([
    { id: `step_${Date.now()}_0`, name: "Step 1", tool: "", argsJson: "{}", requiresApproval: false },
  ]);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function addCreateStep() {
    setCreateSteps((s) => [
      ...s,
      { id: `step_${Date.now()}_${s.length}`, name: `Step ${s.length + 1}`, tool: "", argsJson: "{}", requiresApproval: false },
    ]);
  }
  function removeCreateStep(id: string) {
    setCreateSteps((s) => (s.length <= 1 ? s : s.filter((x) => x.id !== id)));
  }
  function updateCreateStep(id: string, patch: Partial<CreateStep>) {
    setCreateSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) {
      setCreateError("Name is required");
      return;
    }
    setCreateError(null);
    setCreateBusy(true);
    try {
      const steps = createSteps.map((s) => {
        let args: Record<string, unknown> = {};
        if (s.argsJson.trim()) {
          try {
            args = JSON.parse(s.argsJson) as Record<string, unknown>;
          } catch {
            args = {};
          }
        }
        return {
          id: s.id,
          name: s.name.trim() || s.id,
          tool: s.tool.trim() || undefined,
          args: Object.keys(args).length ? args : undefined,
          requiresApproval: s.requiresApproval,
        };
      });
      const res = await createWorkflow({
        definition: {
          id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name,
          description: createDesc.trim() || "",
          steps,
        },
        agentId: "orchestrator",
      });
      setCreateName("");
      setCreateDesc("");
      setCreateSteps([{ id: `step_${Date.now()}_0`, name: "Step 1", tool: "", argsJson: "{}", requiresApproval: false }]);
      setCreateError(null);
      await load();
      setTab("runs");
      if (res.workflow?.id) setExpandedId(res.workflow.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  async function load() {
    try {
      const res = await getWorkflows();
      setWorkflows(res.workflows ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  async function handlePause(id: string) {
    await pauseWorkflow(id);
    await load();
  }
  async function handleResume(id: string) {
    await resumeWorkflow(id);
    await load();
  }
  async function handleCancel(id: string) {
    await cancelWorkflow(id);
    await load();
  }

  const active = workflows.filter(
    (w) => w.status === "running" || w.status === "pending"
  );
  const completed = workflows.filter(
    (w) => w.status === "completed" || w.status === "failed" || w.status === "cancelled"
  );

  return (
    <Shell>
      <PageHeader
        title="Workflows"
        description="Durable execution for long-running, approval-aware, and multi-step agent work."
        actions={
          <Toolbar>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw size={13} />
              Refresh
            </Button>
            <ToolbarLabel>
              {workflows.length} total · {active.length} active
            </ToolbarLabel>
          </Toolbar>
        }
      />
      <PageContent>
        <div className="max-w-3xl space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="runs">
                Runs ({workflows.length})
              </TabsTrigger>
              <TabsTrigger value="create">Create</TabsTrigger>
              <TabsTrigger value="architecture">Architecture</TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-4">
                <div className="text-[13px] font-medium">New workflow</div>
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="wf-name" className="text-[12px] font-medium text-muted-foreground block mb-1.5">
                      Name
                    </label>
                    <Input
                      id="wf-name"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="My workflow"
                      className="max-w-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="wf-desc" className="text-[12px] font-medium text-muted-foreground block mb-1.5">
                      Description (optional)
                    </label>
                    <Input
                      id="wf-desc"
                      value={createDesc}
                      onChange={(e) => setCreateDesc(e.target.value)}
                      placeholder="Short description"
                      className="max-w-md"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[12px] font-medium text-muted-foreground">Steps</label>
                      <Button type="button" variant="outline" size="sm" onClick={addCreateStep}>
                        <Plus size={12} /> Add step
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {createSteps.map((step, idx) => (
                        <div
                          key={step.id}
                          className="rounded-md border border-border bg-surface-2 p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <Input
                              placeholder="Step name"
                              value={step.name}
                              onChange={(e) => updateCreateStep(step.id, { name: e.target.value })}
                              className="flex-1 min-w-[120px]"
                            />
                            <Input
                              placeholder="Tool (e.g. fs.read)"
                              value={step.tool}
                              onChange={(e) => updateCreateStep(step.id, { tool: e.target.value })}
                              className="w-32"
                            />
                            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={step.requiresApproval}
                                onChange={(e) => updateCreateStep(step.id, { requiresApproval: e.target.checked })}
                                className="rounded border-border"
                              />
                              Approval
                            </label>
                            {createSteps.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCreateStep(step.id)}
                                aria-label={`Remove step ${idx + 1}`}
                              >
                                <Trash2 size={14} />
                              </Button>
                            ) : null}
                          </div>
                          <Textarea
                            placeholder='Args as JSON, e.g. {"path": "prompt/ROUTING.md"}'
                            value={step.argsJson}
                            onChange={(e) => updateCreateStep(step.id, { argsJson: e.target.value })}
                            rows={2}
                            className="text-[12px] font-[family-name:var(--font-geist-mono)]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {createError ? (
                    <div className="text-[13px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                      {createError}
                    </div>
                  ) : null}
                  <Button type="submit" disabled={createBusy}>
                    {createBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                    {createBusy ? " Creating..." : "Create workflow"}
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="runs">
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
                  Workflows are promoted runs, not every chat turn. Run state is backed by{" "}
                  <InlineCode>.claws/workflow-store.json</InlineCode> (local) or Vercel Workflow when configured.
                  They matter when work needs retries, pausing, approvals, or background execution beyond a single response.
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
                    <Loader2 size={14} className="animate-spin" />
                    Loading...
                  </div>
                ) : null}

                {error ? (
                  <div className="text-[13px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                ) : null}

                {!loading && workflows.length === 0 ? (
                  <EmptyState
                    icon={<Workflow size={28} strokeWidth={1.2} />}
                    title="No workflow runs"
                    description="Nothing has been promoted into durable execution yet. Browser runs, sandbox work, or longer multi-step jobs will appear here once the runtime needs persistence."
                  />
                ) : null}

                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="rounded-lg border border-border bg-surface-1 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expandedId === wf.id ? null : wf.id)
                      }
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors"
                      aria-expanded={expandedId === wf.id}
                      aria-label={expandedId === wf.id ? `Collapse ${wf.name}` : `Expand ${wf.name}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <StatusDot
                          variant={statusToVariant[wf.status] ?? "neutral"}
                          pulse={wf.status === "running"}
                        />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">
                            {wf.name}
                          </div>
                          <div className="text-[12px] text-muted-foreground">
                            {wf.steps.filter((s) => s.status === "completed").length}/
                            {wf.steps.length} steps · {wf.agentId}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={
                            wf.status === "completed"
                              ? "success"
                              : wf.status === "failed"
                                ? "destructive"
                                : "outline"
                          }
                          className="text-[10px]"
                        >
                          {wf.status}
                        </Badge>
                        {expandedId === wf.id ? (
                          <ChevronDown size={14} className="text-muted-foreground" />
                        ) : (
                          <ChevronRight size={14} className="text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {expandedId === wf.id ? (
                      <div className="border-t border-border px-4 py-3 space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {(wf.status === "running" || wf.status === "pending") && (
                            <Button variant="outline" size="sm" onClick={() => handlePause(wf.id)}>
                              <Pause size={12} /> Pause
                            </Button>
                          )}
                          {wf.status === "paused" && (
                            <Button size="sm" onClick={() => handleResume(wf.id)}>
                              <Play size={12} /> Resume
                            </Button>
                          )}
                          {!["completed", "cancelled", "failed"].includes(wf.status) && (
                            <Button variant="destructive" size="sm" onClick={() => handleCancel(wf.id)}>
                              <XCircle size={12} /> Cancel
                            </Button>
                          )}
                        </div>

                        <div className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">
                          Created: {new Date(wf.createdAt).toLocaleString()} ·
                          Updated: {new Date(wf.updatedAt).toLocaleString()}
                        </div>

                        <div className="space-y-1">
                          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">
                            Steps
                          </div>
                          {wf.steps.map((step, idx) => (
                            <StepRow key={step.id} step={step} index={idx} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="architecture">
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="text-[13px] font-medium">Durable Execution Model</div>
                  <div className="text-[13px] text-muted-foreground space-y-2">
                    <p>
                      Each workflow is a durable execution run with named steps that persist
                      across gateway restarts. Steps execute in order, each targeting a specific
                      execution substrate.
                    </p>
                    <div className="flex items-center gap-2 text-[12px]">
                      <ArrowRight size={12} className="shrink-0" />
                      Step lifecycle: <InlineCode>pending</InlineCode> → <InlineCode>running</InlineCode> → <InlineCode>completed</InlineCode> | <InlineCode>failed</InlineCode>
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <ArrowRight size={12} className="shrink-0" />
                      Steps can be paused, resumed, or cancelled at any point
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <ArrowRight size={12} className="shrink-0" />
                      Steps requiring approval enter <InlineCode>waiting-approval</InlineCode> state
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="text-[13px] font-medium">Execution Substrates</div>
                  <div className="text-[13px] text-muted-foreground mb-1">
                    Each step in a workflow runs on one of these substrates, selected by the
                    execution router based on what the action requires.
                  </div>
                  <div className="space-y-2">
                    <SubstrateRow
                      name="API"
                      desc="Direct tool calls (filesystem, memory, task events). Fastest path."
                      status="live"
                    />
                    <SubstrateRow
                      name="Browser"
                      desc="Automated browser via Agent Browser (preferred when configured) or Playwright fallback. Supports background, record-on-complete, watch-live, hybrid."
                      status="live"
                    />
                    <SubstrateRow
                      name="Sandbox"
                      desc="Isolated execution for untrusted or generated code. Vercel Sandbox adapter."
                      status="scaffolded"
                    />
                    <SubstrateRow
                      name="Computer"
                      desc="Full persistent environment for long-lived apps/profiles. Agent Browser native mode or VPS."
                      status="planned"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="text-[13px] font-medium">Visibility Modes</div>
                  <div className="text-[13px] text-muted-foreground mb-1">
                    Browser and computer steps support configurable execution visibility.
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge variant="outline" className="text-[10px] w-36 justify-center shrink-0">background</Badge>
                      <span className="text-muted-foreground">No live view. No recording.</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge variant="outline" className="text-[10px] w-36 justify-center shrink-0">record-on-complete</Badge>
                      <span className="text-muted-foreground">Generate demo video + link on completion.</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge variant="outline" className="text-[10px] w-36 justify-center shrink-0">watch-live</Badge>
                      <span className="text-muted-foreground">Live stream viewer during execution.</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge variant="outline" className="text-[10px] w-36 justify-center shrink-0">hybrid</Badge>
                      <span className="text-muted-foreground">Live viewer + final recording saved.</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="text-[13px] font-medium">Storage & Adapters</div>
                  <div className="text-[13px] text-muted-foreground space-y-1.5">
                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge variant="secondary" className="text-[10px]">Local</Badge>
                      Disk-backed at <InlineCode>.claws/workflow-store.json</InlineCode>
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge variant="outline" className="text-[10px]">Hosted</Badge>
                      Vercel Workflow adapter (requires <InlineCode>VERCEL_PROJECT_ID</InlineCode> + <InlineCode>VERCEL_API_TOKEN</InlineCode>)
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge variant="outline" className="text-[10px]">Demos</Badge>
                      Saved to <InlineCode>assets/demos/YYYY-MM-DD/</InlineCode> when record mode completes
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="text-[13px] font-medium">API Routes</div>
                  <div className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)] space-y-1">
                    <div>GET  /api/workflows</div>
                    <div>POST /api/workflows</div>
                    <div>GET  /api/workflows/:id</div>
                    <div>POST /api/workflows/:id/advance</div>
                    <div>POST /api/workflows/:id/pause</div>
                    <div>POST /api/workflows/:id/resume</div>
                    <div>POST /api/workflows/:id/cancel</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </PageContent>
    </Shell>
  );
}

function SubstrateRow({
  name,
  desc,
  status,
}: {
  name: string;
  desc: string;
  status: "live" | "scaffolded" | "planned";
}) {
  const variant =
    status === "live" ? "success" : status === "scaffolded" ? "warning" : "neutral";
  return (
    <div className="flex items-start gap-2.5 rounded-md bg-surface-2 px-3 py-2.5">
      <StatusDot variant={variant} className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium">{name}</span>
          <Badge variant="outline" className="text-[10px]">
            {status}
          </Badge>
        </div>
        <div className="text-[12px] text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function StepRow({ step, index }: { step: WorkflowStep; index: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-surface-2 px-3 py-2">
      <span className="text-[11px] text-muted-foreground font-[family-name:var(--font-geist-mono)] w-4">
        {index + 1}
      </span>
      <StatusDot variant={statusToVariant[step.status] ?? "neutral"} />
      <span className="text-[13px] flex-1 truncate">{step.name}</span>
      <Badge variant="outline" className="text-[10px]">
        {step.status}
      </Badge>
      {step.completedAt && step.startedAt ? (
        <span className="text-[11px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">
          {((step.completedAt - step.startedAt) / 1000).toFixed(1)}s
        </span>
      ) : null}
    </div>
  );
}
