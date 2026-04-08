"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { AppShell, ErrorBoundary } from "@/components/ui";

const TONE_OPTIONS = ["formal", "casual", "professional", "friendly", "technical", "creative"];
const STYLE_OPTIONS = ["verbose", "concise", "structured", "narrative"];
const PROFESSIONALISM_OPTIONS = ["corporate", "startup", "casual", "academic"];
const CATEGORY_OPTIONS = ["personal", "developer", "research", "business", "creative", "community"];
const PLATFORM_OPTIONS = ["claude", "cursor", "windsurf", "copilot", "custom"];
const MEMORY_TYPE_OPTIONS = ["episodic", "semantic", "procedural"];
const WIDGET_TYPE_OPTIONS = [
  "workspace-status",
  "active-research",
  "intel-feed",
  "subscription-feed",
  "skill-stats",
  "squad-status",
];
const WIDGET_SIZE_OPTIONS = ["sm", "md", "lg", "full"] as const;
const ACTION_TYPE_OPTIONS = ["explore_skill", "run_experiment", "configure_agent", "join_hub", "custom"] as const;

type AgentConfig = {
  name: string;
  platform: string;
  role: string;
  model: string;
  auto_register: boolean;
};

type MemorySeed = {
  memory_type: string;
  key: string;
  content: string;
};

type DashboardWidget = {
  widget_type: string;
  position: number;
  size: "sm" | "md" | "lg" | "full";
};

type SquadPack = {
  pack_id: string;
  pack_name: string;
  auto_deploy: boolean;
};

type LearningStep = {
  step: number;
  title: string;
  description: string;
  action_type: typeof ACTION_TYPE_OPTIONS[number];
  action_target: string;
};

function PublishContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams?.get("draft");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    longDescription: "",
    tags: "",
    skills: "",
    bestFor: "",
    category: "" as string,
    soulMd: "",
    tone: "professional",
    style: "concise",
    professionalism: "startup",
    personality: "",
    companyValues: "",
    targetAudience: "",
    githubEnabled: false,
    telegramEnabled: false,
    hubSubscriptions: "",
  });
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [memorySeeds, setMemorySeeds] = useState<MemorySeed[]>([]);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([]);
  const [squadPacks, setSquadPacks] = useState<SquadPack[]>([]);
  const [learningPath, setLearningPath] = useState<LearningStep[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const createPublished = useMutation(api.templates.createPublished);

  const draftTemplate = useQuery(
    api.templates.getBySlug,
    draftId ? { slug: draftId } : "skip"
  );

  useEffect(() => {
    if (draftTemplate && !draftLoaded) {
      setForm((prev) => ({
        ...prev,
        name: draftTemplate.name || prev.name,
        slug: draftTemplate.slug || prev.slug,
        description: draftTemplate.description || prev.description,
        longDescription: draftTemplate.longDescription || prev.longDescription,
        tags: (draftTemplate.tags || []).join(", "),
        skills: (draftTemplate.preInstalledSkills || []).join(", "),
        bestFor: draftTemplate.bestFor || prev.bestFor,
        soulMd: draftTemplate.soulMd || prev.soulMd,
      }));
      setDraftLoaded(true);
    }
  }, [draftTemplate, draftLoaded]);

  const updateField = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "name" && typeof value === "string") {
      setForm((prev) => ({
        ...prev,
        [key]: value,
        slug: value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      }));
    }
  };

  const resetForm = () => {
    setForm({
      name: "", slug: "", description: "", longDescription: "", tags: "", skills: "",
      bestFor: "", category: "", soulMd: "", tone: "professional", style: "concise",
      professionalism: "startup", personality: "", companyValues: "", targetAudience: "",
      githubEnabled: false, telegramEnabled: false, hubSubscriptions: "",
    });
    setAgents([]);
    setMemorySeeds([]);
    setDashboardWidgets([]);
    setSquadPacks([]);
    setLearningPath([]);
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validation per step
  const canProceedFromStep = (s: number): boolean => {
    switch (s) {
      case 0: return !!(form.name.trim() && form.slug.trim() && form.description.trim());
      default: return true; // Other steps are optional
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.slug.trim() || !form.description.trim()) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createPublished({
        slug: form.slug,
        name: form.name,
        description: form.description,
        longDescription: form.longDescription || form.description,
        icon: form.name[0]?.toUpperCase() || "T",
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        preInstalledSkills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        bestFor: form.bestFor || form.description,
        category: form.category ? (form.category as any) : undefined,
        soulMd: form.soulMd || undefined,
        agentVoice: {
          tone: form.tone as any,
          style: form.style as any,
          professionalism: form.professionalism as any,
          personality: form.personality || undefined,
        },
        brandVoice: {
          companyValues: form.companyValues ? form.companyValues.split(",").map((v) => v.trim()) : undefined,
          targetAudience: form.targetAudience || undefined,
        },
        agentsConfig: agents.length > 0
          ? agents.map((a) => ({
              name: a.name,
              platform: a.platform,
              role: a.role,
              model: a.model || undefined,
              auto_register: a.auto_register,
            }))
          : undefined,
        memorySeed: memorySeeds.length > 0 ? memorySeeds : undefined,
        dashboardWidgets: dashboardWidgets.length > 0 ? dashboardWidgets : undefined,
        squadPacks: squadPacks.length > 0 ? squadPacks : undefined,
        integrations: (form.githubEnabled || form.telegramEnabled || form.hubSubscriptions)
          ? {
              github_enabled: form.githubEnabled || undefined,
              telegram_enabled: form.telegramEnabled || undefined,
              hub_subscriptions: form.hubSubscriptions
                ? form.hubSubscriptions.split(",").map((s) => s.trim()).filter(Boolean)
                : undefined,
            }
          : undefined,
        learningPath: learningPath.length > 0
          ? learningPath.map((lp) => ({
              step: lp.step,
              title: lp.title,
              description: lp.description,
              action_type: lp.action_type as any,
              action_target: lp.action_target || undefined,
            }))
          : undefined,
      });
      setSubmitted(true);
    } catch (e: any) {
      console.error(e);
      setSubmitError(e?.message || "Failed to publish template. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <h2 className="text-2xl font-bold text-text">Template Published</h2>
        <p className="text-text-muted">
          Your template <span className="text-accent">{form.name}</span> is now live in the gallery.
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={() => router.push("/templates")} className="px-4 py-2 rounded-lg bg-accent text-background font-medium">
            View Gallery
          </button>
          <button
            onClick={() => { setSubmitted(false); setStep(0); resetForm(); }}
            className="px-4 py-2 rounded-lg bg-surface text-text"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  const steps = [
    { title: "Basics", desc: "Name and describe" },
    { title: "Skills", desc: "Pre-installed skills" },
    { title: "Agents & Soul", desc: "Voice and agents" },
    { title: "Configuration", desc: "Memory, widgets, squads" },
    { title: "Integrations", desc: "Services and audience" },
    { title: "Learning Path", desc: "Onboarding steps" },
    { title: "Review", desc: "Publish to gallery" },
  ];

  const inputClass = "w-full bg-surface border border-border-subtle rounded-lg px-4 py-2.5 text-text placeholder:text-text-text-muted focus:outline-none focus:border-accent/30 transition-colors";
  const selectClass = "w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text";
  const labelClass = "block text-sm font-medium text-text-muted mb-1";
  const addBtnClass = "px-3 py-1.5 rounded-lg bg-accent/20 text-accent text-sm font-medium";
  const removeBtnClass = "px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-text">Publish a Template</h1>
        <p className="text-text-muted">Create a community OS template with bundled skills, agents, and configuration.</p>
      </div>

      {/* Step indicator */}
      <div className="grid grid-cols-7 gap-1.5">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`p-2 rounded-lg text-xs text-left transition-colors ${
              i === step ? "bg-accent/20 border border-accent/40" : "bg-surface"
            }`}
          >
            <div className={`font-medium truncate ${i === step ? "text-accent" : "text-text"}`}>{s.title}</div>
            <div className="text-[10px] text-text-muted truncate">{s.desc}</div>
          </button>
        ))}
      </div>

      {/* Step 0: Basics */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Template Name</label>
            <input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. Research OS, Content Creator, Sales Agent"
              className={inputClass}
            />
            {form.slug && <p className="text-xs text-text-muted mt-1">Slug: {form.slug}</p>}
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
              className={selectClass}
            >
              <option value="">Select a category...</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Short Description</label>
            <input
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="One-line description of what this template does"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Long Description</label>
            <textarea
              value={form.longDescription}
              onChange={(e) => updateField("longDescription", e.target.value)}
              placeholder="Detailed description, use cases, what makes this template special..."
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div>
            <label className={labelClass}>Tags (comma-separated)</label>
            <input
              value={form.tags}
              onChange={(e) => updateField("tags", e.target.value)}
              placeholder="research, data, productivity"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Best For</label>
            <input
              value={form.bestFor}
              onChange={(e) => updateField("bestFor", e.target.value)}
              placeholder="Researchers, content creators, sales teams..."
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Step 1: Skills */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Pre-installed Skills (comma-separated)</label>
            <textarea
              value={form.skills}
              onChange={(e) => updateField("skills", e.target.value)}
              placeholder="deploy-vercel, github-pr-review, typescript-patterns, api-error-handling"
              rows={6}
              className={`${inputClass} resize-none font-mono text-sm`}
            />
            <p className="text-xs text-text-muted mt-1">
              These skills will be auto-installed when someone uses your template.
              Browse available skills at <a href="/skills" className="text-accent hover:underline">/skills</a>.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Agents & Soul */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className={labelClass}>SOUL.md (Agent Personality)</label>
            <textarea
              value={form.soulMd}
              onChange={(e) => updateField("soulMd", e.target.value)}
              placeholder="# Agent Soul&#10;&#10;You are a research assistant focused on...&#10;&#10;## Personality&#10;- Thorough and methodical&#10;- Citation-oriented"
              rows={8}
              className={`${inputClass} resize-none font-mono text-sm`}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Tone</label>
              <select value={form.tone} onChange={(e) => updateField("tone", e.target.value)} className={selectClass}>
                {TONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Style</label>
              <select value={form.style} onChange={(e) => updateField("style", e.target.value)} className={selectClass}>
                {STYLE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Professionalism</label>
              <select value={form.professionalism} onChange={(e) => updateField("professionalism", e.target.value)} className={selectClass}>
                {PROFESSIONALISM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Agent Configurations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-muted">Agent Configurations</label>
              <button
                onClick={() => setAgents([...agents, { name: "", platform: "claude", role: "", model: "", auto_register: true }])}
                className={addBtnClass}
              >
                Add Agent
              </button>
            </div>
            {agents.length === 0 && (
              <p className="text-xs text-text-muted">No agents configured. Add agents that will be pre-registered with this template.</p>
            )}
            {agents.map((agent, idx) => (
              <div key={idx} className="bg-surface rounded-lg p-4 space-y-3 border border-border-subtle/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted font-medium">Agent {idx + 1}</span>
                  <button onClick={() => setAgents(agents.filter((_, i) => i !== idx))} className={removeBtnClass}>
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-0.5">Name</label>
                    <input
                      value={agent.name}
                      onChange={(e) => {
                        const updated = [...agents];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setAgents(updated);
                      }}
                      placeholder="e.g. Research Agent"
                      className={`${inputClass} text-sm`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-0.5">Platform</label>
                    <select
                      value={agent.platform}
                      onChange={(e) => {
                        const updated = [...agents];
                        updated[idx] = { ...updated[idx], platform: e.target.value };
                        setAgents(updated);
                      }}
                      className={`${selectClass} text-sm`}
                    >
                      {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-0.5">Role</label>
                    <input
                      value={agent.role}
                      onChange={(e) => {
                        const updated = [...agents];
                        updated[idx] = { ...updated[idx], role: e.target.value };
                        setAgents(updated);
                      }}
                      placeholder="e.g. researcher, reviewer"
                      className={`${inputClass} text-sm`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-0.5">Model (optional)</label>
                    <input
                      value={agent.model}
                      onChange={(e) => {
                        const updated = [...agents];
                        updated[idx] = { ...updated[idx], model: e.target.value };
                        setAgents(updated);
                      }}
                      placeholder="e.g. claude-3-opus"
                      className={`${inputClass} text-sm`}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agent.auto_register}
                    onChange={(e) => {
                      const updated = [...agents];
                      updated[idx] = { ...updated[idx], auto_register: e.target.checked };
                      setAgents(updated);
                    }}
                    className="rounded border-border-subtle"
                  />
                  Auto-register on workspace creation
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Configuration */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Memory Seeds */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-muted">Memory Seeds</label>
              <button
                onClick={() => setMemorySeeds([...memorySeeds, { memory_type: "semantic", key: "", content: "" }])}
                className={addBtnClass}
              >
                Add Memory
              </button>
            </div>
            {memorySeeds.length === 0 && (
              <p className="text-xs text-text-muted">No memory seeds. These pre-populate the agent memory on first boot.</p>
            )}
            {memorySeeds.map((mem, idx) => (
              <div key={idx} className="bg-surface rounded-lg p-4 space-y-3 border border-border-subtle/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted font-medium">Memory {idx + 1}</span>
                  <button onClick={() => setMemorySeeds(memorySeeds.filter((_, i) => i !== idx))} className={removeBtnClass}>
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-0.5">Type</label>
                    <select
                      value={mem.memory_type}
                      onChange={(e) => {
                        const updated = [...memorySeeds];
                        updated[idx] = { ...updated[idx], memory_type: e.target.value };
                        setMemorySeeds(updated);
                      }}
                      className={`${selectClass} text-sm`}
                    >
                      {MEMORY_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-0.5">Key</label>
                    <input
                      value={mem.key}
                      onChange={(e) => {
                        const updated = [...memorySeeds];
                        updated[idx] = { ...updated[idx], key: e.target.value };
                        setMemorySeeds(updated);
                      }}
                      placeholder="e.g. preferred_language"
                      className={`${inputClass} text-sm`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-0.5">Content</label>
                  <textarea
                    value={mem.content}
                    onChange={(e) => {
                      const updated = [...memorySeeds];
                      updated[idx] = { ...updated[idx], content: e.target.value };
                      setMemorySeeds(updated);
                    }}
                    placeholder="Memory content..."
                    rows={2}
                    className={`${inputClass} resize-none text-sm`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Dashboard Widgets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-muted">Dashboard Widgets</label>
              <button
                onClick={() =>
                  setDashboardWidgets([
                    ...dashboardWidgets,
                    { widget_type: "workspace-status", position: dashboardWidgets.length + 1, size: "md" },
                  ])
                }
                className={addBtnClass}
              >
                Add Widget
              </button>
            </div>
            {dashboardWidgets.length === 0 && (
              <p className="text-xs text-text-muted">No widgets configured. These define the default workspace dashboard layout.</p>
            )}
            {dashboardWidgets.map((widget, idx) => (
              <div key={idx} className="bg-surface rounded-lg p-3 border border-border-subtle/50 flex items-center gap-3">
                <span className="text-xs text-text-muted w-6 text-center">{idx + 1}</span>
                <select
                  value={widget.widget_type}
                  onChange={(e) => {
                    const updated = [...dashboardWidgets];
                    updated[idx] = { ...updated[idx], widget_type: e.target.value };
                    setDashboardWidgets(updated);
                  }}
                  className={`${selectClass} text-sm flex-1`}
                >
                  {WIDGET_TYPE_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
                <select
                  value={widget.size}
                  onChange={(e) => {
                    const updated = [...dashboardWidgets];
                    updated[idx] = { ...updated[idx], size: e.target.value as any };
                    setDashboardWidgets(updated);
                  }}
                  className={`${selectClass} text-sm w-24`}
                >
                  {WIDGET_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => {
                  const updated = dashboardWidgets.filter((_, i) => i !== idx).map((w, i) => ({ ...w, position: i + 1 }));
                  setDashboardWidgets(updated);
                }} className={removeBtnClass}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Squad Packs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-muted">Squad Packs</label>
              <button
                onClick={() => setSquadPacks([...squadPacks, { pack_id: "", pack_name: "", auto_deploy: true }])}
                className={addBtnClass}
              >
                Add Pack
              </button>
            </div>
            {squadPacks.length === 0 && (
              <p className="text-xs text-text-muted">No squad packs. These agent squads deploy automatically on workspace creation.</p>
            )}
            {squadPacks.map((pack, idx) => (
              <div key={idx} className="bg-surface rounded-lg p-3 border border-border-subtle/50 flex items-center gap-3">
                <input
                  value={pack.pack_id}
                  onChange={(e) => {
                    const updated = [...squadPacks];
                    updated[idx] = { ...updated[idx], pack_id: e.target.value };
                    setSquadPacks(updated);
                  }}
                  placeholder="Pack ID"
                  className={`${inputClass} text-sm flex-1`}
                />
                <input
                  value={pack.pack_name}
                  onChange={(e) => {
                    const updated = [...squadPacks];
                    updated[idx] = { ...updated[idx], pack_name: e.target.value };
                    setSquadPacks(updated);
                  }}
                  placeholder="Pack Name"
                  className={`${inputClass} text-sm flex-1`}
                />
                <label className="flex items-center gap-1 text-xs text-text-muted whitespace-nowrap cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pack.auto_deploy}
                    onChange={(e) => {
                      const updated = [...squadPacks];
                      updated[idx] = { ...updated[idx], auto_deploy: e.target.checked };
                      setSquadPacks(updated);
                    }}
                    className="rounded border-border-subtle"
                  />
                  Auto-deploy
                </label>
                <button onClick={() => setSquadPacks(squadPacks.filter((_, i) => i !== idx))} className={removeBtnClass}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Integrations */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input
                type="checkbox"
                checked={form.githubEnabled}
                onChange={(e) => updateField("githubEnabled", e.target.checked)}
                className="rounded border-border-subtle"
              />
              GitHub Integration
            </label>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input
                type="checkbox"
                checked={form.telegramEnabled}
                onChange={(e) => updateField("telegramEnabled", e.target.checked)}
                className="rounded border-border-subtle"
              />
              Telegram Integration
            </label>
          </div>
          <div>
            <label className={labelClass}>Hub Subscriptions (comma-separated)</label>
            <input
              value={form.hubSubscriptions}
              onChange={(e) => updateField("hubSubscriptions", e.target.value)}
              placeholder="ai-research, open-source, typescript"
              className={inputClass}
            />
            <p className="text-xs text-text-muted mt-1">Intelligence hubs this workspace will auto-subscribe to.</p>
          </div>
          <div>
            <label className={labelClass}>Target Audience</label>
            <input
              value={form.targetAudience}
              onChange={(e) => updateField("targetAudience", e.target.value)}
              placeholder="Software engineers, researchers, founders..."
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Company Values (comma-separated)</label>
            <input
              value={form.companyValues}
              onChange={(e) => updateField("companyValues", e.target.value)}
              placeholder="innovation, transparency, quality"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Step 5: Learning Path */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-muted">Onboarding Steps</label>
              <p className="text-xs text-text-muted">Guide new users through setting up their workspace.</p>
            </div>
            <button
              onClick={() =>
                setLearningPath([
                  ...learningPath,
                  {
                    step: learningPath.length + 1,
                    title: "",
                    description: "",
                    action_type: "explore_skill",
                    action_target: "",
                  },
                ])
              }
              className={addBtnClass}
            >
              Add Step
            </button>
          </div>
          {learningPath.length === 0 && (
            <p className="text-xs text-text-muted">No learning path defined. Users will start with a blank onboarding experience.</p>
          )}
          {learningPath.map((lp, idx) => (
            <div key={idx} className="bg-surface rounded-lg p-4 space-y-3 border border-border-subtle/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-medium">Step {idx + 1}</span>
                <button
                  onClick={() => {
                    const updated = learningPath.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 }));
                    setLearningPath(updated);
                  }}
                  className={removeBtnClass}
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-0.5">Title</label>
                  <input
                    value={lp.title}
                    onChange={(e) => {
                      const updated = [...learningPath];
                      updated[idx] = { ...updated[idx], title: e.target.value };
                      setLearningPath(updated);
                    }}
                    placeholder="e.g. Explore your first skill"
                    className={`${inputClass} text-sm`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-0.5">Action Type</label>
                  <select
                    value={lp.action_type}
                    onChange={(e) => {
                      const updated = [...learningPath];
                      updated[idx] = { ...updated[idx], action_type: e.target.value as any };
                      setLearningPath(updated);
                    }}
                    className={`${selectClass} text-sm`}
                  >
                    {ACTION_TYPE_OPTIONS.map((a) => (
                      <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-0.5">Description</label>
                <textarea
                  value={lp.description}
                  onChange={(e) => {
                    const updated = [...learningPath];
                    updated[idx] = { ...updated[idx], description: e.target.value };
                    setLearningPath(updated);
                  }}
                  placeholder="What the user should do in this step..."
                  rows={2}
                  className={`${inputClass} resize-none text-sm`}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-0.5">Action Target (optional)</label>
                <input
                  value={lp.action_target}
                  onChange={(e) => {
                    const updated = [...learningPath];
                    updated[idx] = { ...updated[idx], action_target: e.target.value };
                    setLearningPath(updated);
                  }}
                  placeholder="e.g. skill slug, hub name, or URL"
                  className={`${inputClass} text-sm`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 6: Review */}
      {step === 6 && (
        <div className="space-y-4">
          <div className="bg-surface rounded-lg p-6 space-y-4">
            <h3 className="font-bold text-lg text-text">{form.name || "Untitled Template"}</h3>
            <p className="text-sm text-text-muted">{form.description}</p>
            {form.category && (
              <div className="text-xs text-text-muted">
                Category: <span className="text-text">{form.category}</span>
              </div>
            )}
            {form.tags && (
              <div className="flex flex-wrap gap-1">
                {form.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-surface/50 rounded">{tag}</span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              {form.skills && (
                <div className="bg-surface/50 rounded-lg p-3">
                  <div className="text-text-muted">Skills</div>
                  <div className="text-text font-medium">{form.skills.split(",").filter(Boolean).length} pre-installed</div>
                </div>
              )}
              {agents.length > 0 && (
                <div className="bg-surface/50 rounded-lg p-3">
                  <div className="text-text-muted">Agents</div>
                  <div className="text-text font-medium">{agents.length} configured</div>
                </div>
              )}
              {memorySeeds.length > 0 && (
                <div className="bg-surface/50 rounded-lg p-3">
                  <div className="text-text-muted">Memory Seeds</div>
                  <div className="text-text font-medium">{memorySeeds.length} entries</div>
                </div>
              )}
              {dashboardWidgets.length > 0 && (
                <div className="bg-surface/50 rounded-lg p-3">
                  <div className="text-text-muted">Dashboard Widgets</div>
                  <div className="text-text font-medium">{dashboardWidgets.length} widgets</div>
                </div>
              )}
              {squadPacks.length > 0 && (
                <div className="bg-surface/50 rounded-lg p-3">
                  <div className="text-text-muted">Squad Packs</div>
                  <div className="text-text font-medium">{squadPacks.length} packs</div>
                </div>
              )}
              {learningPath.length > 0 && (
                <div className="bg-surface/50 rounded-lg p-3">
                  <div className="text-text-muted">Learning Path</div>
                  <div className="text-text font-medium">{learningPath.length} steps</div>
                </div>
              )}
              {(form.githubEnabled || form.telegramEnabled) && (
                <div className="bg-surface/50 rounded-lg p-3">
                  <div className="text-text-muted">Integrations</div>
                  <div className="text-text font-medium">
                    {[form.githubEnabled && "GitHub", form.telegramEnabled && "Telegram"].filter(Boolean).join(", ")}
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-text-muted">
              Voice: {form.tone} / {form.style} / {form.professionalism}
            </div>
          </div>

          {submitError && (
            <div className="mb-3 p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-sm text-red-400">
              {submitError}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !form.name.trim() || !form.slug.trim() || !form.description.trim()}
            className="w-full py-3 rounded-lg bg-accent text-background font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Publishing..." : "Publish Template"}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="px-4 py-2 rounded-lg bg-surface text-text disabled:opacity-30"
        >
          Back
        </button>
        {step < 6 && (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceedFromStep(step)}
            className="px-4 py-2 rounded-lg bg-accent/20 text-accent font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

export default function PublishTemplatePage() {
  return (
    <AppShell>
      <ErrorBoundary componentName="PublishTemplate">
      <Suspense fallback={<div className="p-8 text-center text-text-muted">Loading...</div>}>
      <div className="p-6 md:p-8">
        <PublishContent />
      </div>
      </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
