"use client";

import { useEffect, useState } from "react";

/* ───── Types (mirrored from @claws/runtime-db session-events) ───── */

type AgentStatus = "idle" | "working" | "blocked" | "done" | "error";

interface AgentNode {
  id: string;
  parent?: string;
  status: AgentStatus;
  task?: string;
  currentTool?: string;
  spawnedAt: string;
  lastUpdatedAt: string;
  children: string[];
}

interface AgentTree {
  nodes: Record<string, AgentNode>;
  rootIds: string[];
}

interface CostSummary {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byAgent: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
  eventCount: number;
}

interface PendingApproval {
  approvalId: string;
  agent: string;
  reason: string;
  tool?: string;
}

interface SessionSummary {
  id: string;
  sizeBytes: number;
}

/* ───── Component ───── */

export function AgentTreeExplorer() {
  const [gatewayUrl, setGatewayUrl] = useState<string>("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tree, setTree] = useState<AgentTree | null>(null);
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);

  // Resolve gateway URL
  useEffect(() => {
    setGatewayUrl(
      process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL ?? "http://localhost:4317"
    );
  }, []);

  // Poll session list
  useEffect(() => {
    if (!gatewayUrl) return;
    let cancelled = false;

    async function fetchSessions() {
      try {
        const res = await fetch(`${gatewayUrl}/api/sessions`, {
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { sessions: SessionSummary[] };
        if (!cancelled) {
          setSessions(data.sessions ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "fetch failed");
        }
      }
    }

    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [gatewayUrl]);

  // Poll tree for selected session
  useEffect(() => {
    if (!gatewayUrl || !selectedId) {
      setTree(null);
      setCost(null);
      setPending([]);
      return;
    }
    let cancelled = false;

    async function fetchTree() {
      setLoading(true);
      try {
        const res = await fetch(
          `${gatewayUrl}/api/sessions/${selectedId}/tree`,
          {
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          tree: AgentTree;
          cost: CostSummary;
          pendingApprovals: PendingApproval[];
        };
        if (!cancelled) {
          setTree(data.tree);
          setCost(data.cost);
          setPending(data.pendingApprovals ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "tree fetch failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTree();
    const interval = setInterval(fetchTree, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [gatewayUrl, selectedId]);

  async function createDemo() {
    if (!gatewayUrl) return;
    setCreatingDemo(true);
    try {
      const res = await fetch(`${gatewayUrl}/api/sessions/demo`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sessionId: string };
      setSelectedId(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "demo create failed");
    } finally {
      setCreatingDemo(false);
    }
  }

  return (
    <section className="mb-16">
      <div className="mb-4 flex items-center justify-between">
        <div
          className="mono text-[10px] uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          // agent-tree-explorer
        </div>
        <button
          type="button"
          onClick={createDemo}
          disabled={creatingDemo || !gatewayUrl}
          className="mono rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-surface-3)",
          }}
        >
          {creatingDemo ? "creating..." : "+ demo session"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {/* Session list */}
        <div
          className="rounded-md border p-3"
          style={{
            borderColor: "var(--color-surface-3)",
            background: "var(--color-surface-1)",
          }}
        >
          <div
            className="mono mb-3 text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            sessions ({sessions.length})
          </div>
          {sessions.length === 0 ? (
            <div
              className="mono text-[11px]"
              style={{ color: "var(--color-text-ghost)" }}
            >
              no sessions. click &quot;demo session&quot; above.
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => {
                const isSelected = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className="mono w-full rounded px-2 py-1.5 text-left text-[11px] transition-colors"
                    style={{
                      background: isSelected
                        ? "var(--color-surface-3)"
                        : "transparent",
                      color: isSelected
                        ? "var(--color-text-primary)"
                        : "var(--color-text-secondary)",
                      borderLeft: isSelected
                        ? "2px solid var(--color-brand)"
                        : "2px solid transparent",
                    }}
                  >
                    <div className="truncate">{s.id.slice(0, 8)}</div>
                    <div
                      className="text-[9px]"
                      style={{ color: "var(--color-text-ghost)" }}
                    >
                      {s.sizeBytes} B
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tree view */}
        <div
          className="rounded-md border p-4"
          style={{
            borderColor: "var(--color-surface-3)",
            background: "var(--color-surface-1)",
            minHeight: 320,
          }}
        >
          {!selectedId && (
            <div
              className="mono flex h-full items-center justify-center text-[12px]"
              style={{ color: "var(--color-text-ghost)" }}
            >
              // select a session to view its agent tree
            </div>
          )}

          {selectedId && tree && (
            <>
              <div
                className="mono mb-4 flex items-center gap-3 text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                <span>session: {selectedId.slice(0, 8)}</span>
                {loading && (
                  <span style={{ color: "var(--color-text-ghost)" }}>
                    · refreshing...
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                {tree.rootIds.map((rootId) => (
                  <TreeNode
                    key={rootId}
                    nodes={tree.nodes}
                    nodeId={rootId}
                    depth={0}
                  />
                ))}
              </div>

              {cost && cost.eventCount > 0 && (
                <div
                  className="mt-6 border-t pt-4"
                  style={{ borderColor: "var(--color-surface-3)" }}
                >
                  <div
                    className="mono mb-2 text-[10px] uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    cost
                  </div>
                  <div
                    className="mono text-[12px]"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    <span style={{ color: "var(--color-brand)" }}>
                      ${cost.total.toFixed(4)}
                    </span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {" "}
                      · {cost.inputTokens} in / {cost.outputTokens} out tokens
                      · {cost.eventCount} ledger entries
                    </span>
                  </div>
                </div>
              )}

              {pending.length > 0 && (
                <div
                  className="mt-4 border-t pt-4"
                  style={{ borderColor: "var(--color-surface-3)" }}
                >
                  <div
                    className="mono mb-2 text-[10px] uppercase tracking-wider"
                    style={{ color: "var(--color-warning)" }}
                  >
                    pending approvals ({pending.length})
                  </div>
                  <div className="space-y-1">
                    {pending.map((a) => (
                      <div
                        key={a.approvalId}
                        className="mono rounded px-2 py-1.5 text-[11px]"
                        style={{
                          background: "var(--color-surface-2)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)",
                        }}
                      >
                        <span style={{ color: "var(--color-warning)" }}>
                          {a.agent}
                        </span>
                        <span style={{ color: "var(--color-text-muted)" }}>
                          {" "}
                          · {a.reason}
                        </span>
                        {a.tool && (
                          <span style={{ color: "var(--color-text-ghost)" }}>
                            {" "}
                            ({a.tool})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div
          className="mono mt-3 text-[10px]"
          style={{ color: "var(--color-error)" }}
        >
          // error: {error}
        </div>
      )}
    </section>
  );
}

function TreeNode({
  nodes,
  nodeId,
  depth,
}: {
  nodes: Record<string, AgentNode>;
  nodeId: string;
  depth: number;
}) {
  const node = nodes[nodeId];
  if (!node) return null;

  return (
    <div>
      <div
        className="mono flex items-center gap-2 py-1 text-[12px]"
        style={{
          paddingLeft: depth * 20,
          color: "var(--color-text-primary)",
        }}
      >
        {depth > 0 && (
          <span style={{ color: "var(--color-text-ghost)" }}>└─</span>
        )}
        <span
          className="agent-dot"
          data-state={node.status}
          aria-label={node.status}
        />
        <span className="font-semibold">{node.id}</span>
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ color: statusColor(node.status) }}
        >
          [{node.status}]
        </span>
        {node.currentTool && (
          <span
            className="text-[11px]"
            style={{ color: "var(--color-info)" }}
          >
            → {node.currentTool}
          </span>
        )}
        {node.task && (
          <span
            className="text-[11px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            · {node.task}
          </span>
        )}
      </div>
      {node.children.map((childId) => (
        <TreeNode
          key={childId}
          nodes={nodes}
          nodeId={childId}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function statusColor(status: AgentStatus): string {
  switch (status) {
    case "working":
      return "var(--color-info)";
    case "blocked":
      return "var(--color-warning)";
    case "done":
      return "var(--color-success)";
    case "error":
      return "var(--color-error)";
    default:
      return "var(--color-text-muted)";
  }
}
