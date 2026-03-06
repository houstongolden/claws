"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  FileText,
  ListChecks,
  Loader2,
  RefreshCw,
  Activity,
  Brain,
  ShieldCheck,
  ChevronLeft,
} from "lucide-react";
import {
  Shell,
  PageHeader,
  PageContent,
  EmptyState,
} from "../../../components/shell";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { InlineCode } from "../../../components/ui/code-block";
import {
  getProject,
  getTracesPage,
  getTaskEventsPage,
  getApprovals,
  runTool,
  type ProjectInfo,
  type TraceItem,
} from "../../../lib/api";

type TaskEventRecord = Record<string, unknown>;
type ApprovalItem = {
  id: string;
  agentId: string;
  toolName: string;
  args?: Record<string, unknown>;
  reason?: string;
};

function traceRelatedToProject(
  trace: TraceItem,
  projectPath: string,
  projectName: string,
  slug: string
): boolean {
  const pathLower = projectPath.toLowerCase();
  const nameLower = projectName.toLowerCase();
  const slugLower = slug.toLowerCase();
  const data = trace.data as Record<string, unknown> | undefined;
  const args = data?.args as Record<string, unknown> | undefined;
  const argPath = typeof args?.path === "string" ? args.path.toLowerCase() : "";
  const dataPath = typeof data?.path === "string" ? data.path.toLowerCase() : "";
  const dataSlug = typeof data?.slug === "string" ? data.slug.toLowerCase() : "";
  const summary = (trace.summary ?? "").toLowerCase();
  return (
    argPath.includes(pathLower) ||
    dataPath.includes(pathLower) ||
    dataSlug === slugLower ||
    summary.includes(pathLower) ||
    summary.includes(nameLower) ||
    summary.includes(slugLower)
  );
}

function taskEventRelatedToProject(ev: TaskEventRecord, projectPath: string, slug: string): boolean {
  const proj = ev.project as Record<string, unknown> | undefined;
  if (!proj) return false;
  const pPath = typeof proj.path === "string" ? proj.path : "";
  const pSlug = typeof proj.slug === "string" ? proj.slug : "";
  return pPath === projectPath || pSlug === slug;
}

function approvalRelatedToProject(approval: ApprovalItem, projectPath: string): boolean {
  const path = approval.args?.path;
  if (typeof path !== "string") return false;
  return path.toLowerCase().includes(projectPath.toLowerCase());
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 86_400_000) return d.toLocaleTimeString();
  return d.toLocaleDateString();
}

export default function ProjectSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectMd, setProjectMd] = useState<string | null>(null);
  const [tasksMd, setTasksMd] = useState<string | null>(null);
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [taskEvents, setTaskEvents] = useState<TaskEventRecord[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [memoryHits, setMemoryHits] = useState<Array<{ text: string; source?: string }>>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(true);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const res = await getProject(slug);
      if (!res.ok || !res.project) {
        setNotFound(true);
        setProject(null);
        return;
      }
      setProject(res.project);
    } catch {
      setNotFound(true);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (!project) return;
    setFilesLoading(true);
    (async () => {
      try {
        const [projRes, tasksRes] = await Promise.all([
          runTool("fs.read", { path: `${project.path}/project.md` }),
          project.hasTasksMd
            ? runTool("fs.read", { path: `${project.path}/tasks.md` })
            : Promise.resolve(null),
        ]);
        if (projRes.ok && projRes.result && typeof projRes.result === "object") {
          setProjectMd(String((projRes.result as Record<string, unknown>).content ?? ""));
        } else {
          setProjectMd("(could not load)");
        }
        if (tasksRes?.ok && tasksRes.result && typeof tasksRes.result === "object") {
          setTasksMd(String((tasksRes.result as Record<string, unknown>).content ?? ""));
        } else if (project.hasTasksMd) {
          setTasksMd("(could not load)");
        } else {
          setTasksMd(null);
        }
      } catch {
        setProjectMd("(error loading)");
        setTasksMd(project.hasTasksMd ? "(error loading)" : null);
      } finally {
        setFilesLoading(false);
      }
    })();
  }, [project]);

  useEffect(() => {
    if (!project) return;
    setRelatedLoading(true);
    (async () => {
      try {
        const [tracesRes, eventsRes, approvalsRes, memoryRes] = await Promise.all([
          getTracesPage({ limit: 200, offset: 0 }),
          getTaskEventsPage({ limit: 100, offset: 0 }),
          getApprovals(),
          runTool("memory.search", { query: project.name, limit: 10 }),
        ]);
        const allTraces = (tracesRes.traces ?? []) as TraceItem[];
        const relatedTraces = allTraces.filter((t) =>
          traceRelatedToProject(t, project.path, project.name, project.slug)
        );
        setTraces(relatedTraces);

        const allEvents = eventsRes.events ?? [];
        const relatedEvents = allEvents.filter((ev) =>
          taskEventRelatedToProject(ev, project.path, project.slug)
        );
        setTaskEvents(relatedEvents);

        const allApprovals = (approvalsRes.approvals ?? []) as ApprovalItem[];
        const relatedApprovals = allApprovals.filter((a) => approvalRelatedToProject(a, project.path));
        setApprovals(relatedApprovals);

        if (memoryRes.ok && memoryRes.result && typeof memoryRes.result === "object") {
          const result = memoryRes.result as Record<string, unknown>;
          const results = result.results;
          const list = Array.isArray(results)
            ? results.map((r: unknown) => {
                const o = r as Record<string, unknown>;
                return {
                  text: String(o.excerpt ?? o.text ?? ""),
                  source: o.path as string | undefined,
                };
              })
            : [];
          setMemoryHits(list);
        } else {
          setMemoryHits([]);
        }
      } catch {
        setTraces([]);
        setTaskEvents([]);
        setApprovals([]);
        setMemoryHits([]);
      } finally {
        setRelatedLoading(false);
      }
    })();
  }, [project]);

  if (loading || (!project && !notFound)) {
    return (
      <Shell>
        <PageContent>
          <div className="flex items-center gap-2 text-muted-foreground text-[13px] py-8">
            <Loader2 size={14} className="animate-spin" />
            Loading project…
          </div>
        </PageContent>
      </Shell>
    );
  }

  if (notFound || !project) {
    return (
      <Shell>
        <PageHeader
          title="Project not found"
          description={`No project with slug "${slug}" in workspace.`}
        />
        <PageContent>
          <EmptyState
            icon={<FolderKanban size={28} strokeWidth={1.2} />}
            title="Project not found"
            description="Projects are folders under projects/ with a project.md. Check the slug or go back to the list."
            action={
              <Link href="/projects">
                <Button size="sm" variant="outline">
                  <ChevronLeft size={13} />
                  Back to Projects
                </Button>
              </Link>
            }
          />
        </PageContent>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        title={project.name}
        description={project.path}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => loadProject()}>
              <RefreshCw size={13} />
              Refresh
            </Button>
            <Link href="/projects">
              <Button variant="ghost" size="sm">
                <ChevronLeft size={13} />
                All projects
              </Button>
            </Link>
          </div>
        }
      />
      <PageContent>
        <div className="max-w-3xl space-y-6">
          <div className="flex flex-wrap gap-2">
            {project.hasProjectMd ? (
              <Badge variant="outline" className="text-[10px] gap-1">
                <FileText size={9} />
                project.md
              </Badge>
            ) : null}
            {project.hasTasksMd ? (
              <Badge variant="outline" className="text-[10px] gap-1">
                <ListChecks size={9} />
                tasks.md
              </Badge>
            ) : null}
            {project.status ? (
              <Badge variant="secondary" className="text-[10px]">
                {project.status}
              </Badge>
            ) : null}
          </div>

          {error ? (
            <div className="text-[13px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}

          {/* Canonical files */}
          <section className="rounded-lg border border-border bg-surface-1 overflow-hidden">
            <div className="border-b border-border bg-surface-2 px-4 py-2.5 text-[12px] font-medium uppercase tracking-widest text-muted-foreground">
              Canonical files
            </div>
            <div className="p-4 space-y-6">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">
                  project.md
                </div>
                {filesLoading ? (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <pre className="rounded-md border border-border bg-background p-3 text-[12px] text-muted-foreground whitespace-pre-wrap font-[family-name:var(--font-geist-mono)] max-h-[280px] overflow-y-auto">
                    {projectMd ?? "(empty)"}
                  </pre>
                )}
              </div>
              {project.hasTasksMd ? (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                      tasks.md
                    </span>
                    <Link href="/tasks" className="text-[12px] text-muted-foreground hover:text-foreground no-underline">
                      View in Tasks
                    </Link>
                  </div>
                  {filesLoading ? (
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                      Loading…
                    </div>
                  ) : (
                    <pre className="rounded-md border border-border bg-background p-3 text-[12px] text-muted-foreground whitespace-pre-wrap font-[family-name:var(--font-geist-mono)] max-h-[240px] overflow-y-auto">
                      {tasksMd ?? "(empty)"}
                    </pre>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          {/* Related traces */}
          <section className="rounded-lg border border-border bg-surface-1 overflow-hidden">
            <div className="border-b border-border bg-surface-2 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground">
                Related traces
              </span>
              <Link href="/traces" className="text-[12px] text-muted-foreground hover:text-foreground no-underline">
                All traces
              </Link>
            </div>
            <div className="p-4">
              {relatedLoading ? (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  Loading…
                </div>
              ) : traces.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No traces yet for this project. Activity in <InlineCode>{project.path}</InlineCode> will appear here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {traces.slice(0, 15).map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-[13px]">
                      <Activity size={12} className="text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground font-[family-name:var(--font-geist-mono)] text-[11px]">
                        {formatTime(t.ts)}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {t.type}
                      </Badge>
                      <span className="truncate">{t.summary}</span>
                    </li>
                  ))}
                  {traces.length > 15 ? (
                    <li className="text-[12px] text-muted-foreground">
                      +{traces.length - 15} more — <Link href="/traces" className="underline">view all</Link>
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          </section>

          {/* Related task events */}
          <section className="rounded-lg border border-border bg-surface-1 overflow-hidden">
            <div className="border-b border-border bg-surface-2 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground">
                Task activity
              </span>
              <Link href="/tasks" className="text-[12px] text-muted-foreground hover:text-foreground no-underline">
                Tasks
              </Link>
            </div>
            <div className="p-4">
              {relatedLoading ? (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  Loading…
                </div>
              ) : taskEvents.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No task events linked to this project yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {taskEvents.slice(0, 10).map((ev: TaskEventRecord, i) => (
                    <li key={i} className="flex items-center gap-2 text-[13px]">
                      <Badge variant="outline" className="text-[10px]">
                        {String(ev.type ?? ev.event ?? "event")}
                      </Badge>
                      {ev.note ? <span className="truncate">{String(ev.note)}</span> : null}
                      {ev.ts ? (
                        <span className="text-[11px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">
                          {String(ev.ts).slice(0, 19)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {taskEvents.length > 10 ? (
                    <li className="text-[12px] text-muted-foreground">+{taskEvents.length - 10} more</li>
                  ) : null}
                </ul>
              )}
            </div>
          </section>

          {/* Related memory */}
          <section className="rounded-lg border border-border bg-surface-1 overflow-hidden">
            <div className="border-b border-border bg-surface-2 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground">
                Related memory
              </span>
              <Link href="/memory" className="text-[12px] text-muted-foreground hover:text-foreground no-underline">
                Memory
              </Link>
            </div>
            <div className="p-4">
              {relatedLoading ? (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  Loading…
                </div>
              ) : memoryHits.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No memory entries matched &quot;{project.name}&quot;.
                </p>
              ) : (
                <ul className="space-y-2">
                  {memoryHits.map((entry, i) => (
                    <li key={i} className="flex gap-2 text-[13px]">
                      <Brain size={12} className="text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-foreground line-clamp-2">{entry.text}</p>
                        {entry.source ? (
                          <span className="text-[11px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">
                            {entry.source}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Related approvals */}
          {approvals.length > 0 ? (
            <section className="rounded-lg border border-border bg-surface-1 overflow-hidden">
              <div className="border-b border-border bg-surface-2 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground">
                  Pending approvals (this project)
                </span>
                <Link
                  href="/approvals"
                  className="text-[12px] text-muted-foreground hover:text-foreground no-underline"
                >
                  Approvals
                </Link>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {approvals.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-[13px]">
                      <ShieldCheck size={12} className="text-warning shrink-0" />
                      <Badge variant="secondary" className="text-[10px]">
                        {a.toolName}
                      </Badge>
                      {a.reason ? <span className="truncate">{a.reason}</span> : null}
                      <Link href="/approvals" className="text-[12px] underline">
                        Resolve
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
            This view is grounded in workspace files: <InlineCode>project.md</InlineCode> and{" "}
            <InlineCode>tasks.md</InlineCode> under <InlineCode>{project.path}</InlineCode>. Traces, task events, and
            memory are filtered by project path or name.
          </div>
        </div>
      </PageContent>
    </Shell>
  );
}
