"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Shield,
  Wrench,
  Eye,
  Loader2,
  RefreshCw,
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
import { StatusDot } from "../../components/ui/status-dot";
import { Toolbar, ToolbarLabel, ToolbarSeparator } from "../../components/ui/toolbar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { getStatus } from "../../lib/api";

type AgentInfo = {
  id: string;
  description: string;
  modes: string[];
};

type StatusData = {
  gateway?: string;
  ai?: { enabled: boolean; model: string; streaming: boolean };
  agents?: AgentInfo[];
  registeredTools?: string[];
  toolsByEnvironment?: Record<string, string[]>;
  workspaceRoot?: string;
  approvals?: { pending: number };
};

export default function AgentsPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("roster");

  async function load() {
    try {
      const res = await getStatus();
      setStatus((res.status ?? null) as StatusData | null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const agents = status?.agents ?? [];
  const tools = status?.registeredTools ?? [];

  return (
    <Shell>
      <PageHeader
        title="Agents"
        description="Multi-agent orchestration, routing responsibilities, and tool surfaces derived from runtime state."
        actions={
          <Toolbar>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw size={13} />
              Refresh
            </Button>
            <ToolbarSeparator />
            <ToolbarLabel>
              <StatusDot
                variant={status?.ai?.enabled ? "success" : "neutral"}
              />
              AI {status?.ai?.enabled ? `on (${status.ai.model})` : "off"}
            </ToolbarLabel>
          </Toolbar>
        }
      />
      <PageContent>
        <div className="max-w-3xl space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
              <Loader2 size={14} className="animate-spin" />
              Loading...
            </div>
          ) : null}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="roster">
                Agent Roster ({agents.length})
              </TabsTrigger>
              <TabsTrigger value="tools">
                Tool Registry ({tools.length})
              </TabsTrigger>
              <TabsTrigger value="routing">Routing</TabsTrigger>
            </TabsList>

            <TabsContent value="roster">
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-surface-1 p-4">
                  <div className="text-[13px] font-medium text-foreground">
                    Roles & scopes
                  </div>
                  <div className="mt-1.5 text-[13px] text-muted-foreground">
                    Claws routes each message through an orchestrator, then hands execution to
                    the lead agent for the active view stack. Each agent has a <strong>role</strong> (orchestrator vs lead)
                    and <strong>views</strong> it can lead. Tool access is determined by the execution router and tool registry.
                  </div>
                </div>
                {agents.length === 0 && !loading ? (
                  <EmptyState
                    icon={<Bot size={28} strokeWidth={1.2} />}
                    title="No agents registered"
                    description="Start the gateway to see the agent roster and routing."
                  />
                ) : null}

                {agents.map((agent) => {
                  const isOrchestrator = agent.modes.length > 1;
                  return (
                    <div
                      key={agent.id}
                      className="rounded-lg border border-border bg-surface-1 overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-2">
                        <div className="h-8 w-8 rounded-md bg-background flex items-center justify-center text-muted-foreground shrink-0">
                          {isOrchestrator ? (
                            <Shield size={16} strokeWidth={1.4} />
                          ) : (
                            <Bot size={16} strokeWidth={1.4} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold">
                            {agent.id}
                          </div>
                          <div className="text-[12px] text-muted-foreground">
                            {agent.description}
                          </div>
                        </div>
                        <Badge
                          variant={isOrchestrator ? "default" : "secondary"}
                          className="text-[10px] shrink-0"
                        >
                          {isOrchestrator ? "orchestrator" : "lead"}
                        </Badge>
                      </div>

                      <div className="px-4 py-3">
                        <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">
                          Leads views
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {agent.modes.map((mode) => (
                            <Badge
                              key={mode}
                              variant="outline"
                              className="text-[10px]"
                            >
                              <Eye size={9} />
                              {mode}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 text-[12px] text-muted-foreground">
                          {isOrchestrator
                            ? "Handles routing, approvals, scheduling, and memory flush decisions."
                            : "Owns execution for these views when they are active in the stack."}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="tools">
              <div className="space-y-3">
                {status?.toolsByEnvironment ? (
                  <div className="rounded-lg border border-border bg-surface-1 p-4">
                    <div className="text-[13px] font-medium text-foreground">
                      Tool environments
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(status.toolsByEnvironment).map(([env, names]) => (
                        <Badge key={env} variant="outline" className="text-[10px]">
                          {env} · {names.length}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-lg border border-border bg-surface-1 divide-y divide-border overflow-hidden">
                  {tools.length === 0 ? (
                    <EmptyState
                      icon={<Wrench size={28} strokeWidth={1.2} />}
                      title="No tools registered"
                      description="Start the gateway to see available tools and environments."
                    />
                  ) : null}
                  {groupToolsByPrefix(tools).map(([prefix, names]) => (
                    <div key={prefix} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench
                          size={13}
                          className="text-muted-foreground shrink-0"
                        />
                        <span className="text-[13px] font-medium">
                          {prefix}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {names.length}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {names.map((name) => (
                          <Badge
                            key={name}
                            variant="outline"
                            className="text-[10px] font-[family-name:var(--font-geist-mono)]"
                          >
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="routing">
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="text-[13px] font-medium">Message Routing</div>
                  <div className="text-[13px] text-muted-foreground space-y-2">
                    <div className="flex items-center gap-2 text-[12px]">
                      <ArrowRight size={12} className="shrink-0" />
                      Each view has a designated lead agent
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <ArrowRight size={12} className="shrink-0" />
                      Primary view determines the routing target
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <ArrowRight size={12} className="shrink-0" />
                      Overlays add context and panel visibility, but the primary view still owns routing
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <ArrowRight size={12} className="shrink-0" />
                      Tool policy is determined by the union of active views (restrictive wins)
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="text-[13px] font-medium">Tool Execution Policy</div>
                  <div className="text-[13px] text-muted-foreground space-y-2">
                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge variant="success" className="text-[10px]">low</Badge>
                      Automatic execution — no approval needed
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge variant="warning" className="text-[10px]">medium</Badge>
                      Context-dependent — may require approval
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge variant="destructive" className="text-[10px]">high</Badge>
                      Requires smart approval unless an existing trust grant covers the action
                    </div>
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

function groupToolsByPrefix(tools: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const tool of tools) {
    const dot = tool.indexOf(".");
    const prefix = dot > -1 ? tool.slice(0, dot) : "other";
    const list = groups.get(prefix) ?? [];
    list.push(tool);
    groups.set(prefix, list);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}
