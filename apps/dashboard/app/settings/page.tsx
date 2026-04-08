"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Settings,
  Loader2,
  RotateCw,
  Save,
  Eye,
  EyeOff,
  Cpu,
  Globe,
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
  Key,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Code,
  LayoutGrid,
  Cloud,
  CloudOff,
  ArrowDownCircle,
  Palette,
  Terminal,
} from "lucide-react";
import {
  Shell,
  PageHeader,
  PageContent,
} from "../../components/shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { InlineCode } from "../../components/ui/code-block";
import { StatusDot } from "../../components/ui/status-dot";
import {
  getStatus,
  getViewState,
  setViewState,
  getEnvVars,
  getRawEnvFile,
  saveEnvFile,
  restartGateway,
  getSystemInfo,
  setCloudSync,
  openCli,
  type EnvVar,
  type SystemInfo,
} from "../../lib/api";
import {
  getApiKeys,
  setApiKey,
  INTEGRATIONS,
  getFaviconUrl,
  type IntegrationId,
} from "../../lib/api-keys";
import { cn } from "../../lib/utils";

const AVAILABLE_VIEWS = ["founder", "agency", "developer", "creator", "personal", "fitness"];

type SettingsSection = "views" | "runtime" | "ai" | "execution" | "environment" | "sync" | "dashboard" | "about";

const SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: "views", label: "Views", icon: Eye },
  { id: "runtime", label: "Runtime", icon: Cpu },
  { id: "ai", label: "AI Config", icon: Globe },
  { id: "execution", label: "Execution", icon: Layers },
  { id: "environment", label: "Environment & Keys", icon: Key },
  { id: "sync", label: "Cloud Sync", icon: Cloud },
  { id: "dashboard", label: "Dashboard & Updates", icon: Palette },
  { id: "about", label: "About", icon: Settings },
];

type ExecutionSubstrate = {
  browser: { provider: string; defaultMode: string; availableProviders: string[]; availableModes: string[]; preferredAgentBrowser?: boolean };
  sandbox: { enabled: boolean; provider: string };
  computer: { available: boolean; note: string };
  routerOrder: string[];
};

type StatusData = {
  gateway?: string;
  workspaceRoot?: string;
  mode?: string;
  ai?: { enabled: boolean; model: string; streaming: boolean; provider?: string | null; gatewayUrl?: string | null };
  execution?: ExecutionSubstrate;
  toolsByEnvironment?: Record<string, string[]>;
  workflows?: { count: number; persistence: string };
  tenants?: { count: number; multiTenantEnabled: boolean };
  approvals?: { pending: number };
  traces?: { count: number };
  registeredTools?: string[];
};

type ViewState = { primary: string; overlays: string[] };

export default function SettingsPage() {
  const [gs, setGs] = useState<StatusData | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [primary, setPrimary] = useState("");
  const [overlays, setOverlays] = useState<string[]>([]);
  const [section, setSection] = useState<SettingsSection>("views");
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [rawMode, setRawMode] = useState(false);
  const [rawEnvText, setRawEnvText] = useState("");
  const [apiKeys, setApiKeysState] = useState<Record<string, string>>({});
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<string, string>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [savingEnv, setSavingEnv] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [envDirty, setEnvDirty] = useState(false);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [syncToggling, setSyncToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, viewRes, sysRes] = await Promise.all([
        getStatus().catch(() => null),
        getViewState().catch(() => null),
        getSystemInfo().catch(() => null),
      ]);
      if (statusRes) setGs((statusRes.status ?? null) as StatusData | null);
      if (viewRes?.state) {
        const v = viewRes.state as ViewState;
        setView(v);
        setPrimary(v.primary);
        setOverlays(v.overlays);
      }
      if (sysRes?.ok) setSysInfo(sysRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEnv = useCallback(async () => {
    setEnvLoading(true);
    try {
      const [envRes, rawRes] = await Promise.all([
        getEnvVars().catch(() => ({ vars: [] as EnvVar[] })),
        getRawEnvFile().catch(() => ({ content: "" })),
      ]);
      setEnvVars(envRes.vars ?? []);
      setRawEnvText(rawRes.content ?? "");
      setEnvDirty(false);
    } catch {
      setEnvVars([]);
    } finally {
      setEnvLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (section === "environment") {
      loadEnv();
      setApiKeysState(getApiKeys());
    }
  }, [section, loadEnv]);

  async function saveViewState() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await setViewState({ primary, overlays });
      setSuccess("View state saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function toggleOverlay(mode: string) {
    setOverlays((cur) => cur.includes(mode) ? cur.filter((m) => m !== mode) : [...cur, mode]);
  }

  function handleSaveApiKey(provider: IntegrationId, value: string) {
    setApiKey(provider, value);
    setApiKeysState(getApiKeys());
    setApiKeyDrafts((d) => ({ ...d, [provider]: "" }));
    setSuccess(`Saved ${INTEGRATIONS.find((i) => i.id === provider)?.name ?? provider}.`);
    setError(null);
  }

  async function handleTestConnection(provider: IntegrationId) {
    const key = apiKeyDrafts[provider]?.trim() || apiKeys[provider]?.trim();
    if (!key) {
      setTestResult((r) => ({ ...r, [provider]: { ok: false, error: "No key to test" } }));
      return;
    }
    setTestingKey(provider);
    setTestResult((r) => ({ ...r, [provider]: undefined! }));
    try {
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setTestResult((r) => ({ ...r, [provider]: { ok: !!data.ok, error: data.error } }));
    } catch (err) {
      setTestResult((r) => ({ ...r, [provider]: { ok: false, error: err instanceof Error ? err.message : "Request failed" } }));
    } finally {
      setTestingKey(null);
    }
  }

  function toggleReveal(key: string) {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function copyValue(key: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <Shell>
      <PageHeader
        title="Settings"
        description="Configure views, runtime, AI, execution, and environment."
        actions={
          <Button variant="outline" size="sm" onClick={async () => {
            setRestarting(true);
            setError(null);
            try {
              await restartGateway();
              setSuccess("Gateway restarting…");
              setTimeout(async () => {
                await load();
                if (section === "environment") await loadEnv();
                setRestarting(false);
                setSuccess("Gateway restarted.");
              }, 3000);
            } catch {
              setRestarting(false);
              setError("Could not reach gateway for restart.");
              setTimeout(() => { load(); if (section === "environment") loadEnv(); }, 3000);
            }
          }} disabled={restarting}>
            {restarting ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
            Restart Gateway
          </Button>
        }
      />
      <PageContent className="!p-0 sm:!px-5 md:!px-8">
        <div className="flex flex-col lg:flex-row gap-0 min-h-[600px] lg:items-start">
          {/* Vertical sidebar nav */}
          <nav className="shrink-0 w-full lg:w-56 border-b lg:border-b-0 lg:border-r border-border/60 lg:pr-6 space-y-0.5 sticky top-0 self-start py-4 px-5 lg:px-0 lg:py-6 bg-muted/20 lg:bg-transparent">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] text-left motion-safe:transition-colors",
                    section === s.id
                      ? "bg-foreground text-background font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon size={14} className="shrink-0" />
                  {s.label}
                </button>
              );
            })}
            <div className="pt-3 mt-3 border-t border-border space-y-0.5">
              <Link href="/workflows" className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors no-underline">
                <Workflow size={12} />Workflows
              </Link>
              <Link href="/proactivity" className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors no-underline">
                <Zap size={12} />Proactivity
              </Link>
              <Link href="/approvals" className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors no-underline">
                <ShieldCheck size={12} />Approvals
              </Link>
              <Link href="/traces" className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors no-underline">
                <Activity size={12} />Traces
              </Link>
              <Link href="/agents" className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors no-underline">
                <Bot size={12} />Agents
              </Link>
            </div>
          </nav>

          {/* Main content area */}
          <div className="flex-1 min-w-0 px-5 py-6 sm:px-8 lg:pl-10 lg:pr-8 space-y-5 max-w-3xl">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </div>
            ) : null}

            {error ? (
              <div className="text-[13px] text-destructive bg-destructive/[0.07] border border-destructive/15 rounded-2xl px-4 py-3 shadow-[var(--shadow-sm)] leading-relaxed">{error}</div>
            ) : null}

            {success ? (
              <div className="text-[13px] text-success bg-success/[0.08] border border-success/20 rounded-2xl px-4 py-3 shadow-[var(--shadow-sm)]">{success}</div>
            ) : null}

            {/* Views */}
            {section === "views" ? (
              <div className="space-y-4">
                <SectionHeading title="Views" description="Session & view preferences. Defaults flow from runtime into each chat thread." />
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-4">
                  <div>
                    <div className="text-[13px] font-medium mb-2">Primary View</div>
                    <div className="text-[12px] text-muted-foreground mb-2">
                      The primary view chooses the lead agent, the dominant lens, and the default tool policy.
                    </div>
                    <Select value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-48">
                      {AVAILABLE_VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </Select>
                  </div>
                  <div>
                    <div className="text-[13px] font-medium mb-2">View Overlays</div>
                    <div className="text-[12px] text-muted-foreground mb-2">
                      Overlays compose additional lenses without replacing the primary owner.
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_VIEWS.filter((v) => v !== primary).map((mode) => {
                        const active = overlays.includes(mode);
                        return (
                          <button key={mode} type="button" onClick={() => toggleOverlay(mode)}
                            className={cn("rounded-md border px-2.5 py-1 text-[12px] transition-colors",
                              active ? "bg-primary text-primary-foreground border-primary" : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
                            )}>
                            {mode}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button onClick={saveViewState} disabled={saving} size="sm">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Save view stack
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Runtime */}
            {section === "runtime" ? (
              <div className="space-y-4">
                <SectionHeading title="Runtime" description="Current gateway session status. Live local state, not a hosted control plane." />
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] divide-y divide-border overflow-hidden">
                  <SettingsRow label="Gateway" value={gs?.gateway ?? "unknown"} variant={gs?.gateway === "online" ? "success" : "error"} />
                  <SettingsRow label="Workspace" value={gs?.workspaceRoot ?? "unknown"} />
                  <SettingsRow label="Mode" value={gs?.mode ?? "unknown"} />
                  <SettingsRow label="Registered tools" value={`${gs?.registeredTools?.length ?? 0} tools`} />
                  <SettingsRow label="Workflows" value={`${gs?.workflows?.count ?? 0} runs (${gs?.workflows?.persistence ?? "unknown"})`} />
                  <SettingsRow label="Pending approvals" value={String(gs?.approvals?.pending ?? 0)} variant={(gs?.approvals?.pending ?? 0) > 0 ? "warning" : "neutral"} />
                  <SettingsRow label="Trace count" value={String(gs?.traces?.count ?? 0)} />
                  <SettingsRow label="Multi-tenant" value={gs?.tenants?.multiTenantEnabled ? `${gs.tenants.count} tenant(s)` : "Disabled"} />
                </div>
              </div>
            ) : null}

            {/* AI Config */}
            {section === "ai" ? (
              <div className="space-y-4">
                <SectionHeading title="AI Config" description="How Claws reasons and streams responses. No provider key = local-first fallback mode." />
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] divide-y divide-border overflow-hidden">
                  <SettingsRow label="AI enabled" value={gs?.ai?.enabled ? "Yes" : "No"} variant={gs?.ai?.enabled ? "success" : "neutral"} />
                  <SettingsRow label="Provider" value={gs?.ai?.provider ?? "Not configured"} />
                  <SettingsRow label="Model" value={gs?.ai?.model ?? "Not set"} />
                  <SettingsRow label="Streaming" value={gs?.ai?.streaming ? "Enabled" : "Disabled"} variant={gs?.ai?.streaming ? "success" : "neutral"} />
                  <SettingsRow label="AI Gateway URL" value={gs?.ai?.gatewayUrl ?? "Default (provider direct)"} />
                </div>
                {!gs?.ai?.enabled ? (
                  <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 text-[13px] text-muted-foreground">
                    <div className="font-medium text-foreground mb-1">Enable AI</div>
                    Set <InlineCode>OPENROUTER_API_KEY</InlineCode> (recommended to avoid Anthropic-only billing), or <InlineCode>AI_GATEWAY_API_KEY</InlineCode>, <InlineCode>OPENAI_API_KEY</InlineCode>, or <InlineCode>ANTHROPIC_API_KEY</InlineCode> in <InlineCode>.env.local</InlineCode>. Priority: Gateway → OpenRouter → OpenAI → Anthropic. Restart the gateway after updating.
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Execution */}
            {section === "execution" ? (
              <div className="space-y-4">
                <SectionHeading title="Execution Substrates" description="The runtime picks the lightest substrate that can satisfy each request." />
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-3">
                  <div className="text-[13px] font-medium">Execution Router Order</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(gs?.execution?.routerOrder ?? ["api", "browser", "sandbox", "computer"]).map((env, i, arr) => (
                      <span key={env} className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[11px] font-[family-name:var(--font-geist-mono)]">{env}</Badge>
                        {i < arr.length - 1 && <ArrowRight size={10} className="text-muted-foreground" />}
                      </span>
                    ))}
                  </div>
                  {gs?.toolsByEnvironment ? (
                    <div className="mt-3 space-y-2">
                      {Object.entries(gs.toolsByEnvironment).map(([env, tools]) => (
                        <div key={env} className="flex items-start gap-2">
                          <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 w-20 justify-center">{env}</Badge>
                          <div className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)] flex flex-wrap gap-x-2 gap-y-0.5">
                            {(tools as string[]).map((t) => <span key={t}>{t}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-3">
                  <div className="flex items-center gap-2"><Monitor size={14} className="text-muted-foreground" /><div className="text-[13px] font-medium">Browser Automation</div></div>
                  <div className="rounded-2xl border border-border/80 bg-surface-2 shadow-[var(--shadow-sm)] divide-y divide-border overflow-hidden">
                    <SettingsRow label="Provider" value={gs?.execution?.browser?.provider ?? "playwright"} variant={gs?.execution?.browser?.provider === "agent-browser" ? "info" : "success"} />
                    <SettingsRow label="Default visibility" value={gs?.execution?.browser?.defaultMode ?? "record-on-complete"} />
                    <SettingsRow label="Available" value={(gs?.execution?.browser?.availableProviders ?? []).join(", ")} />
                  </div>
                </div>

                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-3">
                  <div className="flex items-center gap-2"><Box size={14} className="text-muted-foreground" /><div className="text-[13px] font-medium">Sandbox Execution</div></div>
                  <div className="rounded-2xl border border-border/80 bg-surface-2 shadow-[var(--shadow-sm)] divide-y divide-border overflow-hidden">
                    <SettingsRow label="Enabled" value={gs?.execution?.sandbox?.enabled ? "Yes" : "No"} variant={gs?.execution?.sandbox?.enabled ? "success" : "neutral"} />
                    <SettingsRow label="Provider" value={gs?.execution?.sandbox?.provider ?? "none"} />
                  </div>
                </div>

                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-3">
                  <div className="flex items-center gap-2"><Cpu size={14} className="text-muted-foreground" /><div className="text-[13px] font-medium">Computer Use</div></div>
                  <div className="rounded-2xl border border-border/80 bg-surface-2 shadow-[var(--shadow-sm)] divide-y divide-border overflow-hidden">
                    <SettingsRow label="Available" value={gs?.execution?.computer?.available ? "Yes" : "No"} variant={gs?.execution?.computer?.available ? "success" : "neutral"} />
                  </div>
                  <div className="text-[12px] text-muted-foreground">{gs?.execution?.computer?.note ?? "Full computer-use requires Agent Browser native mode or a persistent VPS."}</div>
                </div>
              </div>
            ) : null}

            {/* Environment & Keys (consolidated) */}
            {section === "environment" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <SectionHeading title="Environment & API Keys" description="Variables from .env.local — the gateway reads these on startup." />
                  <div className="flex items-center bg-muted/40 rounded-lg p-0.5 shrink-0">
                    <button type="button" onClick={() => setRawMode(false)}
                      className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-all",
                        !rawMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}>
                      <LayoutGrid size={12} /> UI
                    </button>
                    <button type="button" onClick={() => setRawMode(true)}
                      className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-all",
                        rawMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}>
                      <Code size={12} /> Raw
                    </button>
                  </div>
                </div>

                {envLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-[13px]"><Loader2 size={14} className="animate-spin" /> Loading environment…</div>
                ) : rawMode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] text-muted-foreground">
                        Edit env vars below. Save to write to <InlineCode>.env.local</InlineCode> — the gateway will restart automatically.
                      </div>
                      <Button size="sm" onClick={async () => {
                        setSavingEnv(true);
                        setError(null);
                        try {
                          await saveEnvFile(rawEnvText);
                          setEnvDirty(false);
                          setSuccess("Saved .env.local — restarting gateway…");
                          try { await restartGateway(); } catch {}
                          setTimeout(async () => {
                            await load();
                            await loadEnv();
                            setSuccess("Gateway restarted with new config.");
                          }, 3000);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Save failed");
                        } finally {
                          setSavingEnv(false);
                        }
                      }} disabled={savingEnv || !envDirty}>
                        {savingEnv ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save & Restart
                      </Button>
                    </div>
                    <textarea
                      value={rawEnvText}
                      onChange={(e) => { setRawEnvText(e.target.value); setEnvDirty(true); }}
                      className="w-full min-h-[400px] rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 text-[13px] font-[family-name:var(--font-geist-mono)] text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                      spellCheck={false}
                    />
                    {envDirty ? <div className="text-[11px] text-amber-600 dark:text-amber-400">Unsaved changes</div> : null}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* AI Provider Status banner */}
                    {gs?.ai ? (
                      <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4">
                        <div className="text-[13px] font-medium text-foreground mb-2">AI Provider Status</div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                          <span className="flex items-center gap-1.5">
                            <StatusDot variant={gs.ai.enabled ? "success" : "error"} />
                            {gs.ai.enabled ? "AI enabled" : "AI not configured"}
                          </span>
                          {gs.ai.provider ? <span className="text-foreground font-[family-name:var(--font-geist-mono)]">Provider: {gs.ai.provider}</span> : null}
                          {gs.ai.model ? <span className="text-muted-foreground font-[family-name:var(--font-geist-mono)]">Model: {gs.ai.model}</span> : null}
                        </div>
                      </div>
                    ) : null}

                    {/* Env vars grouped */}
                    {["AI", "Runtime", "Execution", "Hosting", "Integrations"].map((group) => {
                      const vars = envVars.filter((v) => v.group === group);
                      if (vars.length === 0) return null;
                      return (
                        <div key={group}>
                          <div className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground mb-2">{group}</div>
                          <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] divide-y divide-border overflow-hidden">
                            {vars.map((v) => (
                              <div key={v.key} className="px-4 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-[13px] font-[family-name:var(--font-geist-mono)] font-medium text-foreground">{v.key}</div>
                                  <div className="text-[12px] text-muted-foreground mt-0.5">{v.desc}</div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {v.isSet ? (
                                    <>
                                      <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-foreground max-w-[200px] truncate">
                                        {v.sensitive && !revealedKeys.has(v.key)
                                          ? "••••••••••••"
                                          : v.redacted ?? ""}
                                      </span>
                                      {v.sensitive ? (
                                        <button type="button" onClick={() => toggleReveal(v.key)}
                                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title={revealedKeys.has(v.key) ? "Hide" : "Reveal"}>
                                          {revealedKeys.has(v.key) ? <EyeOff size={13} /> : <Eye size={13} />}
                                        </button>
                                      ) : null}
                                      {v.redacted ? (
                                        <button type="button" onClick={() => copyValue(v.key, v.redacted!)}
                                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Copy">
                                          {copiedKey === v.key ? <Check size={13} /> : <Copy size={13} />}
                                        </button>
                                      ) : null}
                                      <StatusDot variant="success" />
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-[12px] text-muted-foreground italic">not set</span>
                                      <StatusDot variant="neutral" />
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Integration cards for testing */}
                    <div>
                      <div className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Test & Override Keys</div>
                      <div className="text-[12px] text-muted-foreground mb-3">
                        Keys below are saved to browser localStorage for testing. For the gateway to use them, add to <InlineCode>.env.local</InlineCode> and restart.
                      </div>
                      <div className="space-y-3">
                        {INTEGRATIONS.map((int) => {
                          const draft = apiKeyDrafts[int.id] ?? "";
                          const saved = apiKeys[int.id] ?? "";
                          const envVar = envVars.find((v) => v.key === int.envKey);
                          const isConfigured = envVar?.isSet ?? false;
                          const testRes = testResult[int.id];
                          const isTesting = testingKey === int.id;
                          return (
                            <div key={int.id} className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-3">
                              <div className="flex items-center gap-3">
                                <img src={getFaviconUrl(int.domain)} alt="" width={20} height={20} className="rounded shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-foreground">{int.name}</div>
                                  <div className="text-[11px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">{int.envKey}</div>
                                </div>
                                {isConfigured ? (
                                  <Badge variant="outline" className="text-[10px] shrink-0"><CheckCircle2 size={10} className="mr-1" />configured</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">not set</Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  type="password"
                                  placeholder={saved ? "•••••••• (saved locally)" : isConfigured ? "•••••••• (in .env.local)" : "API key"}
                                  value={draft}
                                  onChange={(e) => setApiKeyDrafts((d) => ({ ...d, [int.id]: e.target.value }))}
                                  className="max-w-xs font-[family-name:var(--font-geist-mono)] text-[13px]"
                                  autoComplete="off"
                                />
                                <Button size="sm" onClick={() => handleSaveApiKey(int.id, draft || saved)} disabled={!(draft || saved)}>
                                  <Save size={13} /> Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleTestConnection(int.id)} disabled={isTesting || (!(draft || saved) && !isConfigured)}>
                                  {isTesting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                                  Test
                                </Button>
                                {testRes !== undefined ? (
                                  testRes.ok ? (
                                    <span className="inline-flex items-center gap-1 text-[12px] text-success"><CheckCircle2 size={14} />Connected</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[12px] text-destructive" title={testRes.error}><XCircle size={14} />Failed</span>
                                  )
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Cloud Sync */}
            {section === "sync" ? (
              <div className="space-y-4">
                <SectionHeading title="Cloud Sync" description="Optionally sync workspace context, sessions, and memory to the cloud." />
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {sysInfo?.cloudSync?.enabled ? <Cloud size={18} className="text-primary" /> : <CloudOff size={18} className="text-muted-foreground" />}
                      <div>
                        <div className="text-[13px] font-medium text-foreground">{sysInfo?.cloudSync?.enabled ? "Cloud sync is enabled" : "Cloud sync is disabled"}</div>
                        <div className="text-[12px] text-muted-foreground mt-0.5">
                          {sysInfo?.cloudSync?.enabled
                            ? "Workspace context and session history will be synced when a cloud backend is connected."
                            : "All data stays on your local machine only. Enable anytime to start syncing."}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant={sysInfo?.cloudSync?.enabled ? "outline" : "default"} disabled={syncToggling} onClick={async () => {
                      setSyncToggling(true);
                      try {
                        const next = !sysInfo?.cloudSync?.enabled;
                        await setCloudSync(next);
                        await load();
                        setSuccess(next ? "Cloud sync enabled." : "Cloud sync disabled — local-only mode.");
                      } catch { setError("Failed to toggle sync."); }
                      finally { setSyncToggling(false); }
                    }}>
                      {syncToggling ? <Loader2 size={13} className="animate-spin" /> : null}
                      {sysInfo?.cloudSync?.enabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                  {sysInfo?.cloudSync?.enabled ? (
                    <div className="rounded-2xl border border-border/80 bg-surface-2 shadow-[var(--shadow-sm)] divide-y divide-border overflow-hidden">
                      <SettingsRow label="Status" value={sysInfo.cloudSync.status} variant={sysInfo.cloudSync.status === "idle" ? "success" : sysInfo.cloudSync.status === "syncing" ? "info" : "neutral"} />
                      <SettingsRow label="Last synced" value={sysInfo.cloudSync.lastSynced ?? "Never"} />
                    </div>
                  ) : null}
                </div>
                <div className="rounded-lg border border-dashed border-border bg-surface-1/50 p-4 text-[12px] text-muted-foreground space-y-2">
                  <div className="font-medium text-foreground">What gets synced?</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Session history and conversation threads</li>
                    <li>Memory blocks and learned preferences</li>
                    <li>Task state and project metadata</li>
                    <li>Workspace context (not source code or secrets)</li>
                  </ul>
                  <div className="text-[11px] text-muted-foreground/70 pt-1">API keys and <InlineCode>.env.local</InlineCode> are never synced. Source code stays local unless you explicitly push via git.</div>
                </div>
              </div>
            ) : null}

            {/* Dashboard & Updates */}
            {section === "dashboard" ? (
              <div className="space-y-4">
                <SectionHeading title="Dashboard & Updates" description="Manage your dashboard template and check for Claws updates." />

                {/* Version + Updates */}
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <ArrowDownCircle size={18} className={sysInfo?.updateAvailable ? "text-primary" : "text-muted-foreground"} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground">
                        Claws v{sysInfo?.version ?? "0.1.0"}
                        {sysInfo?.updateAvailable ? <span className="ml-2 text-primary text-[12px]">→ v{sysInfo.latestVersion} available</span> : null}
                      </div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">
                        {sysInfo?.updateAvailable
                          ? "A new version of Claws is available. Update via CLI or package manager."
                          : "You're on the latest version."}
                      </div>
                    </div>
                  </div>
                  {sysInfo?.updateAvailable ? (
                    <div className="rounded-2xl border border-border/80 bg-surface-2 shadow-[var(--shadow-sm)] p-3 space-y-2">
                      <div className="text-[12px] font-medium text-foreground">Update instructions</div>
                      <div className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)] bg-muted/30 rounded-md px-3 py-2 select-all">
                        pnpm update @claws-so/cli @claws-so/create
                      </div>
                      <div className="text-[11px] text-muted-foreground">Or run <InlineCode>claws doctor</InlineCode> after updating to verify your installation.</div>
                    </div>
                  ) : null}
                </div>

                {/* Custom dashboard template */}
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Palette size={18} className={sysInfo?.dashboard?.isCustom ? "text-emerald-500" : "text-muted-foreground"} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground">
                        {sysInfo?.dashboard?.isCustom ? "Custom Dashboard" : "Default Dashboard"}
                      </div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">
                        {sysInfo?.dashboard?.isCustom
                          ? "You've customized the dashboard UI. Your changes are preserved as a custom template and will never be overwritten by updates."
                          : "Using the default Claws dashboard template. Any edits you make to the dashboard code will be saved as a custom template."}
                      </div>
                    </div>
                    {sysInfo?.dashboard?.isCustom ? (
                      <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                    ) : null}
                  </div>
                  {sysInfo?.dashboard?.isCustom ? (
                    <div className="rounded-lg border border-dashed border-border bg-surface-2 p-3 space-y-2">
                      <div className="text-[12px] font-medium text-foreground">Template management</div>
                      <div className="text-[12px] text-muted-foreground">
                        Your custom dashboard lives alongside the default. You can switch between them anytime without losing work.
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" disabled>
                          <Palette size={13} /> Switch to Default
                        </Button>
                        <Button size="sm" variant="outline" disabled>
                          Export Custom Template
                        </Button>
                      </div>
                      <div className="text-[10px] text-muted-foreground/60">Template switching will be available in a future release.</div>
                    </div>
                  ) : null}
                </div>

                {/* Open CLI */}
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Terminal size={18} className="text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground">CLI / TUI</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">
                        Open the Claws terminal interface to work alongside the dashboard. Jump between UI and CLI seamlessly.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { openCli("tui").catch(() => {}); setSuccess("Opening TUI in a new terminal…"); }}>
                      <Terminal size={13} /> Open TUI
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { openCli("chat").catch(() => {}); setSuccess("Opening CLI Chat…"); }}>
                      <Terminal size={13} /> CLI Chat
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* About */}
            {section === "about" ? (
              <div className="space-y-4">
                <SectionHeading title="About Claws" description="Local-first AI agent OS." />
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-3 text-[13px] text-muted-foreground">
                  <div className="text-foreground font-medium">Claws v{sysInfo?.version ?? "0.1.0"}</div>
                  <p>A local-first AI workspace for building, shipping, and managing projects. Claws runs your gateway locally, keeps data on your machine, and uses AI providers through your own API keys.</p>
                  <p>Each view is a composable overlay that influences routing, panels, tool policy, and scaffolding defaults. The runtime treats the current thread as primary view + overlays, not a single fixed mode.</p>
                  <div className="flex gap-3 pt-2">
                    <Link href="/" className="text-[12px] text-primary hover:underline no-underline">Go to Chat</Link>
                    <Link href="/home" className="text-[12px] text-primary hover:underline no-underline">Home</Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </PageContent>
    </Shell>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-1">
      <h2 className="text-[16px] font-semibold text-foreground tracking-tight">{title}</h2>
      <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function SettingsRow({ label, value, variant }: { label: string; value: string; variant?: "success" | "error" | "warning" | "info" | "neutral" }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {variant ? <StatusDot variant={variant} /> : null}
        <span className="text-[13px] font-[family-name:var(--font-geist-mono)] truncate max-w-[300px]">{value}</span>
      </div>
    </div>
  );
}
