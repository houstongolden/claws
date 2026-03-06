"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Settings,
  Loader2,
  RefreshCw,
  Save,
  Eye,
  Shield,
  Cpu,
  Globe,
  Wrench,
  Monitor,
  Play,
  Box,
  Layers,
  ArrowRight,
  Workflow,
  Activity,
  Bot,
  Zap,
  ShieldCheck,
} from "lucide-react";
import {
  Shell,
  PageHeader,
  PageContent,
  PageSection,
} from "../../components/shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { InlineCode } from "../../components/ui/code-block";
import { StatusDot } from "../../components/ui/status-dot";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import { getStatus, getViewState, setViewState } from "../../lib/api";

const AVAILABLE_VIEWS = [
  "founder",
  "agency",
  "developer",
  "creator",
  "personal",
  "fitness",
];

const ENV_VARS = [
  {
    key: "AI_GATEWAY_API_KEY",
    desc: "Primary API key for Vercel AI Gateway routing",
    sensitive: true,
    group: "AI",
  },
  {
    key: "OPENAI_API_KEY",
    desc: "Fallback key for direct OpenAI routing",
    sensitive: true,
    group: "AI",
  },
  {
    key: "ANTHROPIC_API_KEY",
    desc: "Fallback key for direct Anthropic routing",
    sensitive: true,
    group: "AI",
  },
  {
    key: "AI_MODEL",
    desc: "Model name (default: gpt-4o-mini)",
    sensitive: false,
    group: "AI",
  },
  {
    key: "AI_GATEWAY_URL",
    desc: "Custom AI Gateway URL (optional)",
    sensitive: false,
    group: "AI",
  },
  {
    key: "CLAWS_PORT",
    desc: "Gateway port (default: 4317)",
    sensitive: false,
    group: "Runtime",
  },
  {
    key: "CLAWS_DEFAULT_VIEW",
    desc: "Default primary view (default: founder)",
    sensitive: false,
    group: "Runtime",
  },
  {
    key: "CLAWS_BROWSER_PROVIDER",
    desc: "Browser provider (agent-browser | playwright | native)",
    sensitive: false,
    group: "Execution",
  },
  {
    key: "CLAWS_BROWSER_DEFAULT_MODE",
    desc: "Default visibility mode (background | record-on-complete | watch-live | hybrid)",
    sensitive: false,
    group: "Execution",
  },
  {
    key: "CLAWS_SANDBOX_ENABLED",
    desc: "Enable sandbox execution (true | false)",
    sensitive: false,
    group: "Execution",
  },
  {
    key: "CLAWS_SANDBOX_PROVIDER",
    desc: "Sandbox provider (vercel | local | none)",
    sensitive: false,
    group: "Execution",
  },
  {
    key: "VERCEL_PROJECT_ID",
    desc: "Vercel project ID for workflow/sandbox adapters",
    sensitive: false,
    group: "Hosting",
  },
  {
    key: "VERCEL_API_TOKEN",
    desc: "Vercel API token for hosted adapters",
    sensitive: true,
    group: "Hosting",
  },
];

type ExecutionSubstrate = {
  browser: {
    provider: string;
    defaultMode: string;
    availableProviders: string[];
    availableModes: string[];
    preferredAgentBrowser?: boolean;
  };
  sandbox: {
    enabled: boolean;
    provider: string;
  };
  computer: {
    available: boolean;
    note: string;
  };
  routerOrder: string[];
};

type StatusData = {
  gateway?: string;
  workspaceRoot?: string;
  mode?: string;
  ai?: {
    enabled: boolean;
    model: string;
    streaming: boolean;
    provider?: string | null;
    gatewayUrl?: string | null;
  };
  execution?: ExecutionSubstrate;
  toolsByEnvironment?: Record<string, string[]>;
  workflows?: { count: number; persistence: string };
  tenants?: { count: number; multiTenantEnabled: boolean };
  approvals?: { pending: number };
  traces?: { count: number };
  registeredTools?: string[];
};

type ViewState = {
  primary: string;
  overlays: string[];
};

export default function SettingsPage() {
  const [gs, setGs] = useState<StatusData | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [primary, setPrimary] = useState("");
  const [overlays, setOverlays] = useState<string[]>([]);
  const [settingsTab, setSettingsTab] = useState("views");

  async function load() {
    try {
      setLoading(true);
      const [statusRes, viewRes] = await Promise.all([
        getStatus().catch(() => null),
        getViewState().catch(() => null),
      ]);
      if (statusRes) setGs((statusRes.status ?? null) as StatusData | null);
      if (viewRes?.state) {
        const v = viewRes.state as ViewState;
        setView(v);
        setPrimary(v.primary);
        setOverlays(v.overlays);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveViewState() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await setViewState({
        primary,
        overlays,
      });
      setSuccess("View state saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function toggleOverlay(mode: string) {
    setOverlays((current) =>
      current.includes(mode)
        ? current.filter((m) => m !== mode)
        : [...current, mode]
    );
  }

  return (
    <Shell>
      <PageHeader
        title="Settings"
        description="Defaults and runtime state for views, approvals, AI, and execution environments."
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />
      <PageContent>
        <PageSection>
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

          {success ? (
            <div className="text-[13px] text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">
              {success}
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-surface-1 p-4 mb-6">
            <div className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Runtime surfaces
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/workflows" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-foreground hover:bg-surface-2 no-underline">
                <Workflow size={14} /> Workflows
              </Link>
              <Link href="/proactivity" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-foreground hover:bg-surface-2 no-underline">
                <Zap size={14} /> Proactivity
              </Link>
              <Link href="/approvals" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-foreground hover:bg-surface-2 no-underline">
                <ShieldCheck size={14} /> Approvals
              </Link>
              <Link href="/traces" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-foreground hover:bg-surface-2 no-underline">
                <Activity size={14} /> Traces
              </Link>
              <Link href="/agents" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-foreground hover:bg-surface-2 no-underline">
                <Bot size={14} /> Agents
              </Link>
            </div>
          </div>

          <Tabs value={settingsTab} onValueChange={setSettingsTab}>
            <TabsList>
              <TabsTrigger value="views">
                <Eye size={12} />
                Views
              </TabsTrigger>
              <TabsTrigger value="runtime">
                <Cpu size={12} />
                Runtime
              </TabsTrigger>
              <TabsTrigger value="ai">
                <Globe size={12} />
                AI Config
              </TabsTrigger>
              <TabsTrigger value="execution">
                <Layers size={12} />
                Execution
              </TabsTrigger>
              <TabsTrigger value="env">
                <Wrench size={12} />
                Environment
              </TabsTrigger>
            </TabsList>

            {/* Views Tab */}
            <TabsContent value="views">
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
                  <div className="font-medium text-foreground mb-1">
                    Session & view preferences
                  </div>
                  Defaults flow from runtime into the workspace and then into each chat thread.
                  What you save here updates the current dashboard thread&apos;s view stack and
                  helps explain why a different lead agent may answer in Session.
                </div>
                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-4">
                  <div>
                    <div className="text-[13px] font-medium mb-2">Primary View</div>
                    <div className="text-[12px] text-muted-foreground mb-2">
                      The primary view chooses the lead agent, the dominant lens over the
                      workspace, and the default tool policy for this thread.
                    </div>
                    <Select
                      value={primary}
                      onChange={(e) => setPrimary(e.target.value)}
                      className="w-48"
                    >
                      {AVAILABLE_VIEWS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <div className="text-[13px] font-medium mb-2">View Overlays</div>
                    <div className="text-[12px] text-muted-foreground mb-2">
                      Overlays compose additional lenses without replacing the primary owner.
                      The union of active views expands context while the strictest tool policy still wins.
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_VIEWS.filter((v) => v !== primary).map(
                        (mode) => {
                          const active = overlays.includes(mode);
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => toggleOverlay(mode)}
                              className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                                active
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
                              }`}
                            >
                              {mode}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={saveViewState}
                    disabled={saving}
                    size="sm"
                  >
                    {saving ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    Save view stack
                  </Button>
                </div>

                <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
                  <div className="font-medium text-foreground mb-1">
                    About views
                  </div>
                  Each view is a composable overlay that influences routing, panels, tool
                  policy, and scaffolding defaults. Claws treats the current thread as
                  primary view + overlays, not as a single fixed mode.
                </div>
              </div>
            </TabsContent>

            {/* Runtime Tab */}
            <TabsContent value="runtime">
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
                  Runtime status reflects the current gateway session, not a hosted control plane.
                  This page is intentionally honest about what is live, local, and still scaffolded.
                </div>
                <div className="rounded-lg border border-border bg-surface-1 divide-y divide-border overflow-hidden">
                  <SettingsRow
                    label="Gateway"
                    value={gs?.gateway ?? "unknown"}
                    variant={gs?.gateway === "online" ? "success" : "error"}
                  />
                  <SettingsRow
                    label="Workspace"
                    value={gs?.workspaceRoot ?? "unknown"}
                  />
                  <SettingsRow
                    label="Mode"
                    value={gs?.mode ?? "unknown"}
                  />
                  <SettingsRow
                    label="Registered tools"
                    value={`${gs?.registeredTools?.length ?? 0} tools`}
                  />
                  <SettingsRow
                    label="Workflows"
                    value={`${gs?.workflows?.count ?? 0} runs (${gs?.workflows?.persistence ?? "unknown"})`}
                  />
                  <SettingsRow
                    label="Pending approvals"
                    value={String(gs?.approvals?.pending ?? 0)}
                    variant={
                      (gs?.approvals?.pending ?? 0) > 0
                        ? "warning"
                        : "neutral"
                    }
                  />
                  <SettingsRow
                    label="Trace count"
                    value={String(gs?.traces?.count ?? 0)}
                  />
                  <SettingsRow
                    label="Multi-tenant"
                    value={
                      gs?.tenants?.multiTenantEnabled
                        ? `${gs.tenants.count} tenant(s)`
                        : "Disabled"
                    }
                  />
                </div>
              </div>
            </TabsContent>

            {/* AI Config Tab */}
            <TabsContent value="ai">
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
                  AI config controls how Claws reasons and streams responses. If no provider key is
                  present, the product still works in local-first fallback mode with narrower command handling.
                </div>
                <div className="rounded-lg border border-border bg-surface-1 divide-y divide-border overflow-hidden">
                  <SettingsRow
                    label="AI enabled"
                    value={gs?.ai?.enabled ? "Yes" : "No"}
                    variant={gs?.ai?.enabled ? "success" : "neutral"}
                  />
                  <SettingsRow
                    label="Provider"
                    value={gs?.ai?.provider ?? "Not configured"}
                  />
                  <SettingsRow
                    label="Model"
                    value={gs?.ai?.model ?? "Not set"}
                  />
                  <SettingsRow
                    label="Streaming"
                    value={gs?.ai?.streaming ? "Enabled" : "Disabled"}
                    variant={gs?.ai?.streaming ? "success" : "neutral"}
                  />
                  <SettingsRow
                    label="AI Gateway URL"
                    value={
                      gs?.ai?.gatewayUrl ?? "Default (provider direct)"
                    }
                  />
                </div>

                {!gs?.ai?.enabled ? (
                  <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
                    <div className="font-medium text-foreground mb-1">
                      Enable AI
                    </div>
                    Set <InlineCode>AI_GATEWAY_API_KEY</InlineCode> in{" "}
                    <InlineCode>.env.local</InlineCode> (preferred), or use{" "}
                    <InlineCode>OPENAI_API_KEY</InlineCode> /{" "}
                    <InlineCode>ANTHROPIC_API_KEY</InlineCode> as direct-provider
                    fallbacks. Restart the gateway after updating env vars.
                  </div>
                ) : null}
              </div>
            </TabsContent>

            {/* Execution Substrates Tab */}
            <TabsContent value="execution">
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
                  Claws does not jump straight to browser or sandbox work. The runtime prefers API
                  and workspace tools first, then escalates only when UI interaction or isolated execution
                  is actually needed.
                </div>
                {/* Execution router order */}
                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="text-[13px] font-medium">Execution Router</div>
                  <div className="text-[12px] text-muted-foreground mb-2">
                    When an agent needs to take action, the runtime picks the lightest
                    substrate that can satisfy the request. Tools are routed in this order:
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(gs?.execution?.routerOrder ?? ["api", "browser", "sandbox", "computer"]).map(
                      (env, i, arr) => (
                        <span key={env} className="flex items-center gap-1.5">
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-[family-name:var(--font-geist-mono)]"
                          >
                            {env}
                          </Badge>
                          {i < arr.length - 1 && (
                            <ArrowRight size={10} className="text-muted-foreground" />
                          )}
                        </span>
                      )
                    )}
                  </div>
                  {gs?.toolsByEnvironment ? (
                    <div className="mt-3 space-y-2">
                      {Object.entries(gs.toolsByEnvironment).map(([env, tools]) => (
                        <div key={env} className="flex items-start gap-2">
                          <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 w-20 justify-center">
                            {env}
                          </Badge>
                          <div className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)] flex flex-wrap gap-x-2 gap-y-0.5">
                            {(tools as string[]).map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Browser substrate */}
                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Monitor size={14} className="text-muted-foreground" />
                    <div className="text-[13px] font-medium">Browser Automation</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-2 divide-y divide-border overflow-hidden">
                    <SettingsRow
                      label="Configured provider"
                      value={gs?.execution?.browser?.provider ?? "playwright"}
                      variant={
                        gs?.execution?.browser?.provider === "agent-browser"
                          ? "info"
                          : gs?.execution?.browser?.provider === "playwright"
                            ? "success"
                            : "neutral"
                      }
                    />
                    {gs?.execution?.browser?.preferredAgentBrowser ? (
                      <SettingsRow
                        label="Agent Browser preferred"
                        value="Yes (fallback: Playwright)"
                        variant="info"
                      />
                    ) : null}
                    <SettingsRow
                      label="Default visibility"
                      value={gs?.execution?.browser?.defaultMode ?? "record-on-complete"}
                    />
                    <SettingsRow
                      label="Available providers"
                      value={(gs?.execution?.browser?.availableProviders ?? []).join(", ")}
                    />
                  </div>
                  <div className="text-[12px] text-muted-foreground space-y-1">
                    <div className="font-medium text-foreground">Visibility modes</div>
                    <div className="flex items-start gap-1.5">
                      <Play size={10} className="shrink-0 mt-0.5" />
                      <span><strong className="text-foreground">background</strong> — no live view, no recording</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Play size={10} className="shrink-0 mt-0.5" />
                      <span><strong className="text-foreground">record-on-complete</strong> — generate demo video + link when done</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Play size={10} className="shrink-0 mt-0.5" />
                      <span><strong className="text-foreground">watch-live</strong> — live stream viewer during execution</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Play size={10} className="shrink-0 mt-0.5" />
                      <span><strong className="text-foreground">hybrid</strong> — live viewer + final recording saved</span>
                    </div>
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Set <InlineCode>CLAWS_BROWSER_PROVIDER=agent-browser</InlineCode> to prefer Agent Browser; execution falls back to Playwright if the SDK is not installed or the adapter is stubbed. Playwright path is fully implemented for navigate, screenshot, click, type, extract.
                  </div>
                </div>

                {/* Sandbox substrate */}
                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Box size={14} className="text-muted-foreground" />
                    <div className="text-[13px] font-medium">Sandbox Execution</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-2 divide-y divide-border overflow-hidden">
                    <SettingsRow
                      label="Enabled"
                      value={gs?.execution?.sandbox?.enabled ? "Yes" : "No"}
                      variant={gs?.execution?.sandbox?.enabled ? "success" : "neutral"}
                    />
                    <SettingsRow
                      label="Provider"
                      value={gs?.execution?.sandbox?.provider ?? "none"}
                      variant={gs?.execution?.sandbox?.provider === "vercel" ? "success" : "neutral"}
                    />
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Sandbox isolates untrusted or generated code execution. Set{" "}
                    <InlineCode>CLAWS_SANDBOX_ENABLED=true</InlineCode> and{" "}
                    <InlineCode>CLAWS_SANDBOX_PROVIDER=vercel</InlineCode> to use Vercel Sandbox.
                  </div>
                </div>

                {/* Computer-use substrate */}
                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-muted-foreground" />
                    <div className="text-[13px] font-medium">Computer Use</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-2 divide-y divide-border overflow-hidden">
                    <SettingsRow
                      label="Available"
                      value={gs?.execution?.computer?.available ? "Yes" : "No"}
                      variant={gs?.execution?.computer?.available ? "success" : "neutral"}
                    />
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {gs?.execution?.computer?.note ??
                      "Full computer-use requires Agent Browser native mode or a persistent VPS."}
                  </div>
                </div>

                {/* Workflow/durable substrate */}
                <div className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-muted-foreground" />
                    <div className="text-[13px] font-medium">Durable Execution</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-2 divide-y divide-border overflow-hidden">
                    <SettingsRow
                      label="Engine"
                      value="Local workflow engine"
                      variant="success"
                    />
                    <SettingsRow
                      label="Persistence"
                      value={gs?.workflows?.persistence ?? "disk-backed"}
                    />
                    <SettingsRow
                      label="Active runs"
                      value={String(gs?.workflows?.count ?? 0)}
                    />
                    <SettingsRow
                      label="Hosted adapter"
                      value="Scaffolded"
                      variant="neutral"
                    />
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Workflows persist to <InlineCode>.claws/workflow-store.json</InlineCode>.
                    For hosted deployment, Vercel workflow wiring is prepared but not yet fully live.
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Environment Tab */}
            <TabsContent value="env">
              <div className="space-y-4">
                {["AI", "Runtime", "Execution", "Hosting"].map((group) => {
                  const vars = ENV_VARS.filter((v) => v.group === group);
                  return (
                    <div key={group}>
                      <div className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                        {group}
                      </div>
                      <div className="rounded-lg border border-border bg-surface-1 divide-y divide-border overflow-hidden">
                        {vars.map((v) => (
                          <div
                            key={v.key}
                            className="px-4 py-2.5 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-[13px] font-[family-name:var(--font-geist-mono)]">
                                {v.key}
                              </div>
                              <div className="text-[12px] text-muted-foreground">
                                {v.desc}
                              </div>
                            </div>
                            {v.sensitive ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] shrink-0"
                              >
                                <Shield size={9} />
                                sensitive
                              </Badge>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
                  Environment variables are set in{" "}
                  <InlineCode>.env.local</InlineCode> at the workspace root.
                  Changes take effect on gateway restart and may be overridden by per-thread state where supported.
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </PageSection>
      </PageContent>
    </Shell>
  );
}

function SettingsRow({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "success" | "error" | "warning" | "info" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {variant ? <StatusDot variant={variant} /> : null}
        <span className="text-[13px] font-[family-name:var(--font-geist-mono)] truncate max-w-[300px]">
          {value}
        </span>
      </div>
    </div>
  );
}
