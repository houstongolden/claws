"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Loader2,
  RefreshCw,
  Clock,
  Info,
} from "lucide-react";
import {
  Shell,
  PageHeader,
  PageContent,
  EmptyState,
} from "../../components/shell";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { CodeBlock } from "../../components/ui/code-block";
import { Toolbar, ToolbarLabel } from "../../components/ui/toolbar";
import { StatusDot } from "../../components/ui/status-dot";
import {
  getApprovals,
  resolveApproval,
  type ApprovalItem,
} from "../../lib/api";
import { readSessionMeta } from "../../lib/session";

const GRANT_DESCRIPTIONS: Record<string, { label: string; desc: string; icon: React.ReactNode }> = {
  once: {
    label: "Approve once",
    desc: "Allow this single invocation only. The next call will require approval again.",
    icon: <ShieldCheck size={12} />,
  },
  session: {
    label: "Allow session",
    desc: "Trust this agent for the current session. Expires when the gateway restarts.",
    icon: <Clock size={12} />,
  },
  "24h": {
    label: "Allow 24h",
    desc: "Grant this tool permission for 24 hours, then require approval again.",
    icon: <Clock size={12} />,
  },
  tool: {
    label: "Always allow",
    desc: "Permanently trust this tool. It will never require approval again.",
    icon: <ShieldCheck size={12} />,
  },
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await getApprovals();
      setApprovals(res.approvals ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 2500);
    return () => clearInterval(interval);
  }, []);

  async function handleResolve(
    approval: ApprovalItem,
    decision: "approved" | "denied",
    grantMode?: "once" | "session" | "24h" | "tool"
  ) {
    try {
      setResolvingId(approval.id);

      let grant:
        | {
            expiresAt?: number;
            scope:
              | { type: "once"; toolName: string }
              | { type: "tool"; toolName: string }
              | { type: "agent"; agentId: string }
              | { type: "view"; view: string }
              | {
                  type: "session";
                  sessionKey: {
                    workspaceId: string;
                    agentId: string;
                    channel: string;
                    chatId: string;
                    threadId?: string;
                  };
                };
            note?: string;
          }
        | undefined;

      if (decision === "approved" && grantMode) {
        if (grantMode === "once") {
          grant = { scope: { type: "once", toolName: approval.toolName } };
        }
        if (grantMode === "tool") {
          grant = {
            scope: { type: "tool", toolName: approval.toolName },
            note: "Always allow this tool",
          };
        }
        if (grantMode === "24h") {
          grant = {
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            scope: { type: "tool", toolName: approval.toolName },
            note: "Allow tool for 24h",
          };
        }
        if (grantMode === "session") {
          const session = readSessionMeta();
          grant = {
            scope: session
              ? {
                  type: "session",
                  sessionKey: {
                    workspaceId: session.workspaceId,
                    agentId: approval.agentId,
                    channel: session.channel,
                    chatId: session.chatId,
                    threadId: session.threadId,
                  },
                }
              : { type: "agent", agentId: approval.agentId },
            note: session
              ? "Allow this tool request within the current session"
              : "Session key unavailable; falling back to agent scope",
          };
        }
      }

      await resolveApproval({ requestId: approval.id, decision, grant });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Approvals"
        description="Review and grant trust for high-risk tool calls"
        actions={
          <Toolbar>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw size={13} />
              Refresh
            </Button>
            <ToolbarLabel>
              {approvals.length === 0 ? "No pending" : `${approvals.length} pending`}
            </ToolbarLabel>
          </Toolbar>
        }
      />
      <PageContent>
        <div className="max-w-2xl space-y-4">
          <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground space-y-2">
            <div className="font-medium text-foreground">What happens when you approve</div>
            <p>You choose a grant: <strong>Approve once</strong> (this call only), <strong>Allow session</strong> (this agent for this session), <strong>Allow 24h</strong>, or <strong>Always allow</strong> this tool. The tool run then proceeds with the same arguments; future runs may require approval again depending on the grant.</p>
            <div className="font-medium text-foreground pt-1">What happens when you deny</div>
            <p>The tool call is blocked. The agent receives an error and can retry with a different approach or ask the user to approve.</p>
          </div>
          {loading && approvals.length === 0 ? (
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

          {approvals.length === 0 && !loading ? (
            <EmptyState
              icon={<ShieldCheck size={28} strokeWidth={1.2} />}
              title="No pending approvals"
              description="High-risk tool calls (fs.write, sandbox.exec, etc.) will appear here for review before they execute."
            />
          ) : null}

          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="rounded-lg border border-border bg-surface-1 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert size={14} className="text-warning shrink-0" />
                  <span className="text-[13px] font-semibold truncate">
                    {approval.toolName}
                  </span>
                </div>
                <RiskBadge risk={approval.risk} />
              </div>

              {/* Context */}
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                  <span>
                    Agent: <span className="text-foreground">{approval.agentId}</span>
                  </span>
                  <span>
                    Env: <span className="text-foreground">{approval.environment}</span>
                  </span>
                </div>

                {approval.reason ? (
                  <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    {approval.reason}
                  </div>
                ) : null}

                <CodeBlock>
                  {JSON.stringify(approval.args ?? {}, null, 2)}
                </CodeBlock>

                {/* Grant actions with explanations */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Grant options
                  </div>

                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {(["once", "session", "24h", "tool"] as const).map(
                      (mode) => {
                        const info = GRANT_DESCRIPTIONS[mode];
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              handleResolve(approval, "approved", mode)
                            }
                            disabled={resolvingId === approval.id}
                            className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-left hover:bg-surface-2 transition-colors disabled:opacity-50"
                          >
                            <div className="text-success mt-0.5 shrink-0">
                              {info.icon}
                            </div>
                            <div>
                              <div className="text-[12px] font-medium text-foreground">
                                {info.label}
                              </div>
                              <div className="text-[11px] text-muted-foreground leading-tight">
                                {info.desc}
                              </div>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleResolve(approval, "denied")}
                    disabled={resolvingId === approval.id}
                    className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-left hover:bg-destructive/10 transition-colors disabled:opacity-50 w-full"
                  >
                    <ShieldX size={12} className="text-destructive shrink-0" />
                    <div>
                      <span className="text-[12px] font-medium text-destructive">
                        Deny
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-2">
                        Block this tool call. The agent will be notified.
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PageContent>
    </Shell>
  );
}

function RiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
  const variant =
    risk === "high"
      ? "destructive"
      : risk === "medium"
        ? "warning"
        : "success";
  return (
    <Badge variant={variant} className="text-[10px]">
      {risk} risk
    </Badge>
  );
}
