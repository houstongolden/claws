"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, CheckCircle, FileText, ListChecks, Loader2, ShieldAlert, Wrench } from "lucide-react";
import { cn } from "../lib/utils";
import { getLiveState, type SessionLiveState } from "../lib/api";

type Props = {
  chatId: string | undefined;
  threadId: string | undefined;
  /** Refreshed after send or when streaming completes */
  refreshTrigger?: number;
  className?: string;
};

export function LiveStateBar({ chatId, threadId, refreshTrigger = 0, className }: Props) {
  const [state, setState] = useState<SessionLiveState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!chatId) {
      setState(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getLiveState(chatId, threadId);
      setState(res.state ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load live state");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [chatId, threadId]);

  useEffect(() => {
    fetchState();
  }, [fetchState, refreshTrigger]);

  if (!chatId || (loading && !state)) {
    return null;
  }

  const tools = state?.recentTools ?? [];
  const toolNames = [...new Set(tools.map((t) => t.toolName))].slice(0, 4);
  const approvals = state?.pendingApprovals ?? [];
  const workflows = state?.activeWorkflows ?? [];
  const queued = [...(state?.extractedTasks ?? []).map((t) => t.title), ...(state?.proposedNextActions ?? [])].slice(0, 3);
  const saved = state?.memoryCandidates?.length ?? 0;
  const files = state?.filesTouched ?? [];

  const workingOn = state?.currentGoal ?? state?.activeSubtask;
  const hasAny =
    workingOn ||
    toolNames.length > 0 ||
    approvals.length > 0 ||
    workflows.length > 0 ||
    queued.length > 0 ||
    saved > 0 ||
    files.length > 0;

  if (!hasAny && !state && !error) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground",
        className
      )}
      role="status"
      aria-label="Session live state"
    >
      {loading && (
        <span className="flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" />
          Updating…
        </span>
      )}
      {error && (
        <span className="text-destructive">{error}</span>
      )}
      {workingOn && (
        <span className="flex items-center gap-1.5">
          <Activity size={12} className="shrink-0 text-muted-foreground/80" />
          <span className="truncate max-w-[180px]" title={workingOn}>
            {workingOn}
          </span>
        </span>
      )}
      {toolNames.length > 0 && (
        <span className="flex items-center gap-1.5">
          <Wrench size={12} className="shrink-0" />
          <span>{toolNames.join(", ")}</span>
        </span>
      )}
      {approvals.length > 0 && (
        <Link
          href="/approvals"
          className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400"
        >
          <ShieldAlert size={12} className="shrink-0" />
          <span>Approval for {approvals[0].toolName}</span>
          {approvals.length > 1 && <span>+{approvals.length - 1}</span>}
        </Link>
      )}
      {workflows.length > 0 && (
        <Link
          href="/workflows"
          className="flex items-center gap-1.5 hover:text-foreground"
        >
          <Activity size={12} className="shrink-0" />
          <span>{workflows[0].name}</span>
          {workflows.length > 1 && <span>+{workflows.length - 1}</span>}
        </Link>
      )}
      {queued.length > 0 && (
        <span className="flex items-center gap-1.5" title={queued.join("\n")}>
          <ListChecks size={12} className="shrink-0" />
          <span>Queued: {queued.length}</span>
        </span>
      )}
      {saved > 0 && (
        <span className="flex items-center gap-1.5">
          <CheckCircle size={12} className="shrink-0" />
          <span>{saved} note{saved !== 1 ? "s" : ""} to memory</span>
        </span>
      )}
      {files.length > 0 && (
        <span className="flex items-center gap-1.5 truncate max-w-[160px]" title={files.slice(0, 5).join("\n")}>
          <FileText size={12} className="shrink-0" />
          <span>{files.length} file{files.length !== 1 ? "s" : ""} touched</span>
        </span>
      )}
    </div>
  );
}
