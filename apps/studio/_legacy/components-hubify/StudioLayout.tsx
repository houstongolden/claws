"use client";

import { useState, useCallback, useRef, useEffect } from "react";
// useUser removed — user/theme now in template sidebar, not Studio chrome
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  createBlankTemplate,
  ACCENT_PRESETS,
  type StudioTemplate,
  type PanelConfig,
} from "@/lib/studio/template-config";
import { PreviewRenderer, DeviceSizeToggle } from "./PreviewRenderer";
import { VibeCoder } from "./VibeCoder";
import { DeployModal } from "./DeployModal";
import { THEMES } from "@/lib/studio/themes";
import Link from "next/link";

type DeviceSize = "phone" | "tablet" | "desktop";
type ConfigTab = "theme" | "layout" | "agent" | "skills" | "code";

interface StudioLayoutProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionId: any;
  userId: string;
  initialFiles?: { path: string; content: string }[];
  initialTitle?: string;
  initialSkills?: string[];
  initialGenerations?: { prompt: string; timestamp: number; filesGenerated: string[] }[];
  autoGeneratePrompt?: string;
}

function filesToTemplate(files: { path: string; content: string }[], title: string, skills: string[]): StudioTemplate {
  // Try TEMPLATE.json first
  const templateJson = files.find((f) => f.path === "TEMPLATE.json");
  if (templateJson) {
    try { return { ...createBlankTemplate(), ...JSON.parse(templateJson.content) }; } catch { /* fall through */ }
  }
  const t = createBlankTemplate();
  t.name = title;
  t.slug = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  t.skills = skills;
  const soulFile = files.find((f) => f.path === "SOUL.md");
  if (soulFile) {
    for (const line of soulFile.content.split("\n")) {
      if (line.startsWith("# ")) { t.agentName = line.replace(/^#\s+/, "").trim(); break; }
    }
    t.personality = soulFile.content;
  }
  return t;
}

export function StudioLayout({
  sessionId, userId, initialFiles, initialTitle = "Untitled Template",
  initialSkills = [], initialGenerations = [], autoGeneratePrompt,
}: StudioLayoutProps) {
  const [template, setTemplate] = useState<StudioTemplate>(() => {
    if (initialFiles?.length) return filesToTemplate(initialFiles, initialTitle, initialSkills);
    const t = createBlankTemplate(); t.name = initialTitle; return t;
  });

  const [activeTab, setActiveTab] = useState<ConfigTab>("theme");
  const [showConfig, setShowConfig] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deviceSize, setDeviceSize] = useState<DeviceSize>("desktop");
  const [showDeploy, setShowDeploy] = useState(false);
  const [generations, setGenerations] = useState(initialGenerations);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [copied, setCopied] = useState(false);

  const saveSession = useMutation(api.studioSessions.save);
  const addGeneration = useMutation(api.studioSessions.addGeneration);
  const setShareIdMutation = useMutation(api.studioSessions.setShareId);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const update = useCallback((patch: Partial<StudioTemplate>) => {
    setTemplate((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const templateToFiles = useCallback((t: StudioTemplate) => [
    { path: "SOUL.md", content: t.personality || `# ${t.agentName}\n\n## Personality\n\n## Greeting\n${t.greeting}` },
    { path: "TEMPLATE.json", content: JSON.stringify(t, null, 2) },
  ], []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await saveSession({ id: sessionId, files: templateToFiles(template), title: template.name, selectedSkills: template.skills });
      setDirty(false);
    } catch (err) { console.error("[studio] Save failed:", err); }
    finally { setSaving(false); }
  }, [sessionId, template, templateToFiles, saveSession]);

  useEffect(() => {
    if (!dirty) return;
    autoSaveRef.current = setTimeout(save, 30000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [dirty, save]);

  const handleFilesGenerated = useCallback((files: { path: string; content: string }[]) => {
    const templateJson = files.find((f) => f.path === "TEMPLATE.json");
    if (templateJson) {
      try { setTemplate((prev) => ({ ...prev, ...JSON.parse(templateJson.content) })); setDirty(true); return; } catch { /* */ }
    }
    setTemplate(filesToTemplate(files, template.name, template.skills));
    setDirty(true);
  }, [template.name, template.skills]);

  const handleGenerationComplete = useCallback(async (gen: { prompt: string; timestamp: number; filesGenerated: string[] }) => {
    setGenerations((prev) => [...prev, gen]);
    try { await addGeneration({ id: sessionId, prompt: gen.prompt, model: "openrouter", filesGenerated: gen.filesGenerated }); } catch { /* */ }
  }, [sessionId, addGeneration]);

  const handleShare = useCallback(async () => {
    const shareId = crypto.randomUUID().slice(0, 8);
    try {
      await save();
      await setShareIdMutation({ id: sessionId, shareId });
      const url = `${window.location.origin}/studio/preview/${shareId}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error("[studio] Share failed:", err); }
  }, [sessionId, save, setShareIdMutation]);

  const tabs: { key: ConfigTab; label: string }[] = [
    { key: "theme", label: "Theme" },
    { key: "layout", label: "Layout" },
    { key: "agent", label: "Agent" },
    { key: "skills", label: "Skills" },
    { key: "code", label: "JSON" },
  ];

  const btnCls = "px-2 py-1 text-[11px] text-text-secondary hover:text-text transition-colors";

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-2 px-3 h-10 border-b border-border shrink-0">
        <Link href="/studio" className="text-text-secondary hover:text-text text-xs">&larr;</Link>
        <span className="text-border">/</span>
        {editingTitle ? (
          <input autoFocus value={template.name}
            onChange={(e) => update({ name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
            className="bg-transparent text-xs font-medium text-text outline-none border-b border-accent w-40" />
        ) : (
          <button onClick={() => setEditingTitle(true)} className="text-xs font-medium text-text hover:text-accent transition-colors truncate max-w-[200px]">
            {template.name || "Untitled"}
          </button>
        )}
        {saving ? <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> : dirty ? <div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> : <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}

        <div className="flex-1" />

        <button onClick={save} disabled={!dirty} className={`${btnCls} disabled:opacity-30`}>Save</button>
        <button onClick={handleShare} className={btnCls}>{copied ? "Copied" : "Share"}</button>
        <button onClick={async () => { await save(); window.location.href = `/templates/publish?studioSession=${sessionId}`; }} className={btnCls}>Publish</button>
        <button onClick={() => setShowDeploy(true)} className="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all hover:brightness-110" style={{ background: "#D4A574", color: "#0A0908" }}>Deploy</button>
        <div className="w-px h-4 bg-border mx-1" />
        <button onClick={() => setShowConfig(!showConfig)} className={`${btnCls} ${showConfig ? '' : 'opacity-60'}`} title="Toggle config panel">
          {showConfig ? "Hide Config" : "Show Config"}
        </button>
      </div>

      {/* ── Main Area ── */}
      <div className="flex-1 flex min-h-0">

        {/* ── LEFT: AI Chat ── */}
        <div className="w-[280px] border-r border-border flex flex-col shrink-0">
          <div className="flex-1 min-h-0">
            <VibeCoder
              onFilesGenerated={handleFilesGenerated}
              currentFiles={templateToFiles(template)}
              generations={generations}
              onGenerationComplete={handleGenerationComplete}
              autoPrompt={autoGeneratePrompt}
            />
          </div>
        </div>

        {/* ── CENTER: Preview ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 h-9 border-b border-border shrink-0">
            <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">Preview</span>
            <DeviceSizeToggle size={deviceSize} onChange={setDeviceSize} />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <PreviewRenderer template={template} deviceSize={deviceSize} />
          </div>
        </div>

        {/* ── RIGHT: Config Panel (collapsible) ── */}
        {showConfig && (
          <div className="w-[260px] border-l border-border flex flex-col shrink-0">
            <div className="flex border-b border-border shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2 text-[9px] font-medium uppercase tracking-wider transition-colors ${
                    activeTab === tab.key ? "text-accent border-b border-accent" : "text-text-secondary hover:text-text"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {activeTab === "theme" && <ThemeTab template={template} update={update} />}
              {activeTab === "layout" && <LayoutTab template={template} update={update} />}
              {activeTab === "agent" && <AgentTab template={template} update={update} />}
              {activeTab === "skills" && <SkillsTab template={template} update={update} />}
              {activeTab === "code" && <CodeTab template={template} update={update} />}
            </div>
          </div>
        )}
      </div>

      <DeployModal open={showDeploy} onClose={() => setShowDeploy(false)} title={template.name} files={templateToFiles(template)} template={template} />
    </div>
  );
}

// ── Config Tabs ──

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[9px] font-medium text-text-secondary uppercase tracking-wider mb-1">{label}</div>{children}</div>;
}

const inputCls = "w-full bg-surface-muted text-text text-xs rounded-md px-2.5 py-1.5 outline-none border border-border focus:border-accent placeholder:text-text-secondary";

function ThemeTab({ template, update }: { template: StudioTemplate; update: (p: Partial<StudioTemplate>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Name">
        <input value={template.name} onChange={(e) => update({ name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} className={inputCls} />
      </Field>
      <Field label="Tagline">
        <input value={template.tagline} onChange={(e) => update({ tagline: e.target.value })} placeholder="One-line description" className={inputCls} />
      </Field>
      <div className="flex gap-3">
        <Field label="Icon">
          <input value={template.monogram} onChange={(e) => update({ monogram: e.target.value.slice(0, 2) })} maxLength={2} className="w-12 bg-surface-muted text-text text-xs rounded-md px-2 py-1.5 outline-none border border-border text-center font-bold" />
        </Field>
        <Field label="Category">
          <select value={template.category} onChange={(e) => update({ category: e.target.value as StudioTemplate["category"] })} className="bg-surface-muted text-text text-xs rounded-md px-2 py-1.5 outline-none border border-border">
            {["personal", "developer", "research", "business", "creative", "community", "custom"].map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Accent">
        <div className="flex flex-wrap gap-1.5">
          {ACCENT_PRESETS.map((c) => (
            <button key={c.value} onClick={() => update({ accent: c.value })}
              className={`w-6 h-6 rounded-md transition-all ${template.accent === c.value ? "ring-2 ring-white/30 scale-110" : "hover:scale-105"}`}
              style={{ background: c.value }} title={c.name} />
          ))}
          <input type="color" value={template.accent} onChange={(e) => update({ accent: e.target.value })} className="w-6 h-6 rounded-md cursor-pointer border-0 p-0" />
        </div>
      </Field>
      <Field label="Dashboard Theme">
        <div className="grid grid-cols-2 gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => update({ themeId: t.id })}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all ${
                template.themeId === t.id ? "ring-1 ring-accent" : "hover:bg-surface-muted"
              }`}
              style={template.themeId === t.id ? { background: `${template.accent}10` } : undefined}
            >
              <div className="flex gap-px rounded overflow-hidden shrink-0" style={{ width: 16, height: 12 }}>
                <div style={{ flex: 1, background: t.colors.sidebar }} />
                <div style={{ flex: 2, background: t.colors.bg }} />
              </div>
              <span className={`text-[10px] ${template.themeId === t.id ? "text-text" : "text-text-secondary"}`}>
                {t.name}
              </span>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function LayoutTab({ template, update }: { template: StudioTemplate; update: (p: Partial<StudioTemplate>) => void }) {
  const toggle = (panels: PanelConfig[], id: string, field: "panels" | "sidebarPanels") => {
    update({ [field]: panels.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p)) });
  };
  return (
    <div className="space-y-4">
      <Field label="Dashboard Panels">
        <div className="space-y-0.5">
          {template.panels.map((p) => (
            <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-muted cursor-pointer">
              <input type="checkbox" checked={p.visible} onChange={() => toggle(template.panels, p.id, "panels")} style={{ accentColor: template.accent }} />
              <span className="text-[11px] text-text flex-1">{p.label}</span>
              <select value={p.size} onChange={(e) => update({ panels: template.panels.map((x) => x.id === p.id ? { ...x, size: e.target.value as PanelConfig["size"] } : x) })}
                className="bg-transparent text-[9px] text-text-secondary outline-none">
                <option value="sm">S</option><option value="md">M</option><option value="lg">L</option>
              </select>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Sidebar">
        <div className="space-y-0.5">
          {template.sidebarPanels.map((p) => (
            <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-muted cursor-pointer">
              <input type="checkbox" checked={p.visible} onChange={() => toggle(template.sidebarPanels, p.id, "sidebarPanels")} style={{ accentColor: template.accent }} />
              <span className="text-[11px] text-text">{p.label}</span>
            </label>
          ))}
        </div>
      </Field>
    </div>
  );
}

function AgentTab({ template, update }: { template: StudioTemplate; update: (p: Partial<StudioTemplate>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Agent Name">
        <input value={template.agentName} onChange={(e) => update({ agentName: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Greeting">
        <textarea value={template.greeting} onChange={(e) => update({ greeting: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
      </Field>
      <div className="flex gap-3">
        <div className="flex-1"><Field label="Tone">
          <select value={template.voice.tone} onChange={(e) => update({ voice: { ...template.voice, tone: e.target.value as StudioTemplate["voice"]["tone"] } })} className={inputCls}>
            {["formal", "casual", "professional", "friendly", "technical", "creative"].map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </Field></div>
        <div className="flex-1"><Field label="Style">
          <select value={template.voice.style} onChange={(e) => update({ voice: { ...template.voice, style: e.target.value as StudioTemplate["voice"]["style"] } })} className={inputCls}>
            {["verbose", "concise", "structured", "narrative"].map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </Field></div>
      </div>
      <Field label="Personality">
        <textarea value={template.personality} onChange={(e) => update({ personality: e.target.value })} rows={8}
          placeholder="Describe personality, expertise, communication style..."
          className={`${inputCls} font-mono text-[11px] resize-none`} />
      </Field>
    </div>
  );
}

function SkillsTab({ template, update }: { template: StudioTemplate; update: (p: Partial<StudioTemplate>) => void }) {
  const SKILLS = [
    "general-assistant", "email-drafter", "code-reviewer", "web-scraper", "data-analyzer",
    "content-summarizer", "rss-reader", "social-poster", "file-manager", "task-tracker",
    "note-taker", "calendar-sync", "health-tracker", "mood-logger", "workout-planner",
    "flashcard-maker", "quiz-generator", "report-writer", "image-analyzer", "sentiment-analyzer",
  ];
  const [search, setSearch] = useState("");
  const filtered = search ? SKILLS.filter((s) => s.includes(search.toLowerCase())) : SKILLS;
  const toggle = (skill: string) => {
    update({ skills: template.skills.includes(skill) ? template.skills.filter((s) => s !== skill) : [...template.skills, skill] });
  };
  return (
    <div className="space-y-2">
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className={inputCls} />
      <div className="text-[9px] text-text-secondary">{template.skills.length} selected</div>
      <div className="space-y-0.5">
        {filtered.map((skill) => (
          <label key={skill} className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-surface-muted cursor-pointer">
            <input type="checkbox" checked={template.skills.includes(skill)} onChange={() => toggle(skill)} style={{ accentColor: template.accent }} />
            <span className={`text-[11px] ${template.skills.includes(skill) ? "text-text" : "text-text-secondary"}`}>{skill}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CodeTab({ template, update }: { template: StudioTemplate; update: (p: Partial<StudioTemplate>) => void }) {
  const [raw, setRaw] = useState(() => JSON.stringify(template, null, 2));
  const [err, setErr] = useState(false);
  useEffect(() => { setRaw(JSON.stringify(template, null, 2)); }, [template]);
  return (
    <div className="space-y-2">
      <div className="text-[9px] text-text-secondary">
        Template JSON {err && <span className="text-red-400">- invalid</span>}
      </div>
      <textarea value={raw} onChange={(e) => {
        setRaw(e.target.value);
        try { update(JSON.parse(e.target.value)); setErr(false); } catch { setErr(true); }
      }} rows={35} className="w-full bg-surface-muted text-[10px] text-text font-mono rounded-md px-2.5 py-1.5 outline-none border border-border resize-none" spellCheck={false} />
    </div>
  );
}
