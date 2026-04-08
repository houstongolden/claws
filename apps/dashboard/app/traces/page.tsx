"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  MessageSquare,
  Wrench,
  ShieldCheck,
  FolderKanban,
  Brain,
  FileText,
  Monitor,
  Box,
  Workflow,
  Play,
} from "lucide-react";
/* Shell aliased: SWC can throw "Unexpected token Shell" on <Shell> in this module */
import {
  Shell as TracesShell,
  PageHeader,
  PageContent,
  EmptyState,
} from "../../components/shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import {
  Toolbar,
  ToolbarLabel,
  ToolbarSeparator,
} from "../../components/ui/toolbar";
import { StatusDot } from "../../components/ui/status-dot";
import { getTracesPage, type TraceItem } from "../../lib/api";

const TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string }
> = {
  chat: { icon: <MessageSquare size={13} />, color: "text-blue-400" },
  "tool-call": { icon: <Wrench size={13} />, color: "text-muted-foreground" },
  "folder-policy-blocked": {
    icon: <ShieldCheck size={13} />,
    color: "text-warning",
  },
  "approval-required": {
    icon: <ShieldCheck size={13} />,
    color: "text-warning",
  },
  "project-create": {
    icon: <FolderKanban size={13} />,
    color: "text-success",
  },
  "task-create": {
    icon: <FileText size={13} />,
    color: "text-success",
  },
  "draft-create": { icon: <FileText size={13} />, color: "text-success" },
  "memory-flush": { icon: <Brain size={13} />, color: "text-blue-400" },
  "memory-promote": { icon: <Brain size={13} />, color: "text-blue-400" },
  "memory-proposal-created": { icon: <FileText size={13} />, color: "text-success" },
  "memory-promoted-to-durable": { icon: <FileText size={13} />, color: "text-success" },
  "memory-promote-failed": { icon: <Brain size={13} />, color: "text-destructive" },
  "memory-search": { icon: <Brain size={13} />, color: "text-muted-foreground" },
  "browser-navigate": { icon: <Monitor size={13} />, color: "text-blue-400" },
  "browser-screenshot": { icon: <Monitor size={13} />, color: "text-blue-400" },
  "browser-action": { icon: <Monitor size={13} />, color: "text-blue-400" },
  "sandbox-exec": { icon: <Box size={13} />, color: "text-yellow-400" },
  "workflow-start": { icon: <Workflow size={13} />, color: "text-success" },
  "workflow-step": { icon: <Play size={13} />, color: "text-muted-foreground" },
  "workflow-complete": { icon: <Workflow size={13} />, color: "text-success" },
  "workflow-fail": { icon: <Workflow size={13} />, color: "text-destructive" },
  "demo-save": { icon: <Play size={13} />, color: "text-blue-400" },
};

export default function TracesPage() {
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [limit, setLimit] = useState(120);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await getTracesPage({ limit, offset });
      setTraces(res.traces ?? []);
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
  }, [limit, offset]);

  const filtered = filterTraces(traces, query, typeFilter);
  const traceTypes = Array.from(new Set(traces.map((t) => t.type)));

  return (
    <TracesShell>
      <PageHeader
        title="Traces"
        description="Structured runtime ledger for model calls, tool executions, approvals, and durable work."
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />
      <PageContent>
        <div className="max-w-3xl space-y-4">
          <div className="rounded-2xl border border-border/80 bg-muted/15 p-5 text-[13px] text-muted-foreground leading-relaxed shadow-[var(--shadow-sm)]">
            <div className="font-semibold text-foreground mb-2 text-[14px] tracking-tight">Observability ledger</div>
            Traces record what Claws did—verify behavior, debug routing, and audit tool use. Filter by type or search summary and agent.
          </div>
          <div className="rounded-2xl border border-border/80 bg-surface-1 p-3 shadow-[var(--shadow-sm)]">
            <Toolbar className="gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search traces..."
                className="pl-8"
              />
            </div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-auto"
            >
              <option value="all">All types</option>
              {traceTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-auto"
            >
              <option value="50">50</option>
              <option value="120">120</option>
              <option value="250">250</option>
            </Select>
            <ToolbarSeparator />
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setOffset((c) => Math.max(0, c - limit))}
                aria-label="Previous page"
              >
                <ChevronLeft size={13} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setOffset((c) => c + limit)}
                disabled={traces.length < limit}
                aria-label="Next page"
              >
                <ChevronRight size={13} />
              </Button>
            </div>
            <ToolbarLabel>{filtered.length} events</ToolbarLabel>
            </Toolbar>

          {error ? (
            <div className="text-[13px] text-destructive bg-destructive/[0.07] border border-destructive/15 rounded-2xl px-4 py-3 shadow-[var(--shadow-sm)]">
              {error}
            </div>
          ) : null}

          {loading && traces.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
              <Loader2 size={14} className="animate-spin" />
              Loading...
            </div>
          ) : null}

          {filtered.length === 0 && !loading ? (
            <EmptyState
              icon={<Activity size={28} strokeWidth={1.2} />}
              title="No traces"
              description="Send a chat command or run a tool to start building the runtime ledger."
            />
          ) : null}

          {/* Timeline */}
          <div className="space-y-0">
            {filtered.map((trace) => {
              const config = TYPE_CONFIG[trace.type] ?? {
                icon: <Activity size={13} />,
                color: "text-muted-foreground",
              };
              const isExpanded = expandedId === trace.id;

              return (
                <button
                  key={trace.id}
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : trace.id)
                  }
                  className="w-full text-left group"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? "Collapse trace details" : "Expand trace details"}
                >
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-muted/25 motion-safe:transition-colors border border-transparent hover:border-border/40">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center pt-1 shrink-0">
                      <div className={config.color}>{config.icon}</div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium truncate">
                          {traceLabel(trace)}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-[family-name:var(--font-geist-mono)] whitespace-nowrap shrink-0">
                          {formatTime(trace.ts)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {trace.type}
                        </Badge>
                        {trace.data?.environment ? (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                          >
                            {String(trace.data.environment)}
                          </Badge>
                        ) : null}
                        {trace.data?.provider ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-[family-name:var(--font-geist-mono)]"
                          >
                            {String(trace.data.provider)}
                            {trace.data.mode ? ` · ${String(trace.data.mode)}` : ""}
                          </Badge>
                        ) : null}
                        {trace.data?.fallbackUsed ? (
                          <Badge variant="secondary" className="text-[9px]">
                            fallback
                          </Badge>
                        ) : null}
                        <span className="text-[11px] text-muted-foreground">
                          {trace.agentId}
                        </span>
                      </div>
                      {trace.summary !== traceLabel(trace) ? (
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          {trace.summary}
                        </div>
                      ) : null}

                      {isExpanded && trace.data ? (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void navigator.clipboard.writeText(trace.id);
                              }}
                              className="text-[11px] text-muted-foreground hover:text-foreground font-[family-name:var(--font-geist-mono)]"
                            >
                              Copy trace ID
                            </button>
                          </div>
                          <pre className="rounded-md border border-border bg-code-bg p-2.5 text-[11px] text-muted-foreground overflow-x-auto font-[family-name:var(--font-geist-mono)] leading-relaxed">
                            {JSON.stringify(trace.data, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        </div>
      </PageContent>
    </TracesShell>
  );
}

function traceLabel(trace: TraceItem): string {
  switch (trace.type) {
    case "tool-call":
      return `Tool call · ${String(trace.data?.toolName ?? trace.summary)}`;
    case "folder-policy-blocked":
      return `FOLDER.md blocked · ${String(trace.data?.code ?? trace.summary)}`;
    case "approval-required":
      return `Approval required · ${String(trace.data?.toolName ?? trace.summary)}`;
    case "project-create":
      return `Project created`;
    case "task-create":
      return `Task created`;
    case "draft-create":
      return `Draft created`;
    case "memory-search":
      return `Memory searched`;
    case "memory-flush":
      return `Memory flushed`;
    case "memory-proposal-created":
      return `Memory proposal created`;
    case "memory-promoted-to-durable":
      return `Promoted to MEMORY.md`;
    case "memory-promote-failed":
      return `Memory promote failed`;
    case "workflow-start":
      return `Workflow started`;
    case "workflow-complete":
      return `Workflow completed`;
    default:
      return trace.summary;
  }
}

function filterTraces(
  traces: TraceItem[],
  query: string,
  typeFilter: string
): TraceItem[] {
  const q = query.trim().toLowerCase();
  return traces.filter((trace) => {
    if (typeFilter !== "all" && trace.type !== typeFilter) return false;
    if (!q) return true;
    return `${trace.summary} ${trace.agentId} ${trace.type}`
      .toLowerCase()
      .includes(q);
  });
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
