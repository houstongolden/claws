"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { AppShell, ErrorBoundary } from "@/components/ui";

type PublishType = "agent" | "skill" | "squad" | "template";

function AgentPublishForm() {
  const { user } = useUser();
  const createPersona = useMutation(api.agentPersonas.create);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    display_name: "",
    description: "",
    role: "",
    persona_md: "",
    domains: "",
    use_cases: "",
    category: "general",
    bundled_skills: "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError("");
    try {
      const slug = form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      await createPersona({
        name: slug,
        display_name: form.display_name || form.name,
        description: form.description,
        persona_md: form.persona_md || `# ${form.display_name || form.name}\n\n${form.description}`,
        role: form.role || "assistant",
        domains: form.domains.split(",").map((d) => d.trim()).filter(Boolean),
        personality_type: [],
        use_cases: form.use_cases.split(",").map((u) => u.trim()).filter(Boolean),
        bundled_skills: form.bundled_skills.split(",").map((s) => s.trim()).filter(Boolean),
        author_type: "community",
        author_user_id: user.id,
        author_username: user.username || user.firstName || "anonymous",
        compatible_templates: ["myos", "devos", "founderos", "researchos"],
        category: form.category,
        tags: form.domains.split(",").map((d) => d.trim()).filter(Boolean).slice(0, 5),
        status: "active",
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to publish");
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-4">--</div>
        <h2 className="text-lg font-mono font-bold text-text">Agent Published</h2>
        <p className="text-sm text-text-secondary mt-2">
          Your agent persona is now live on the Store for anyone to install.
        </p>
        <div className="flex justify-center gap-3 mt-6">
          <Link href="/store" className="px-4 py-2 rounded bg-accent text-background text-sm font-medium hover:bg-accent/90 transition-colors">
            Back to Store
          </Link>
          <button
            onClick={() => { setSuccess(false); setForm({ name: "", display_name: "", description: "", role: "", persona_md: "", domains: "", use_cases: "", category: "general", bundled_skills: "" }); }}
            className="px-4 py-2 rounded border border-border-subtle text-sm font-medium text-text-secondary hover:text-text transition-colors"
          >
            Publish Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-[13px] font-medium text-text mb-1.5">Name</label>
          <input id="name" required value={form.name} onChange={set("name")} placeholder="e.g. Research Assistant" className="w-full bg-surface/50 border border-border-subtle/50 rounded px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/30" />
          <div className="text-[10px] text-text-tertiary mt-1">Slug: {form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "..."}</div>
        </div>
        <div>
          <label htmlFor="display_name" className="block text-[13px] font-medium text-text mb-1.5">Display Name</label>
          <input id="display_name" value={form.display_name} onChange={set("display_name")} placeholder="e.g. Atlas" className="w-full bg-surface/50 border border-border-subtle/50 rounded px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/30" />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-[13px] font-medium text-text mb-1.5">Description</label>
        <textarea id="description" required rows={2} value={form.description} onChange={set("description")} placeholder="What does this agent do? What's it great at?" className="w-full bg-surface/50 border border-border-subtle/50 rounded px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/30 resize-none" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="role" className="block text-[13px] font-medium text-text mb-1.5">Role</label>
          <input id="role" value={form.role} onChange={set("role")} placeholder="e.g. research-assistant, dev-ops, founder-os" className="w-full bg-surface/50 border border-border-subtle/50 rounded px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/30" />
        </div>
        <div>
          <label htmlFor="category" className="block text-[13px] font-medium text-text mb-1.5">Category</label>
          <select id="category" value={form.category} onChange={set("category")} className="w-full bg-surface/50 border border-border-subtle/50 rounded px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-accent/30">
            <option value="general">General</option>
            <option value="personal">Personal</option>
            <option value="engineering">Engineering</option>
            <option value="research">Research</option>
            <option value="business">Business</option>
            <option value="creative">Creative</option>
            <option value="data">Data</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="domains" className="block text-[13px] font-medium text-text mb-1.5">Domains <span className="text-text-muted font-normal">(comma separated)</span></label>
        <input id="domains" value={form.domains} onChange={set("domains")} placeholder="e.g. productivity, fitness, engineering" className="w-full bg-surface/50 border border-border-subtle/50 rounded px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/30" />
      </div>

      <div>
        <label htmlFor="use_cases" className="block text-[13px] font-medium text-text mb-1.5">Use Cases <span className="text-text-muted font-normal">(comma separated)</span></label>
        <input id="use_cases" value={form.use_cases} onChange={set("use_cases")} placeholder="e.g. morning-briefs, code-review, email-triage" className="w-full bg-surface/50 border border-border-subtle/50 rounded px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/30" />
      </div>

      <div>
        <label htmlFor="bundled_skills" className="block text-[13px] font-medium text-text mb-1.5">Bundled Skills <span className="text-text-muted font-normal">(comma separated, optional)</span></label>
        <input id="bundled_skills" value={form.bundled_skills} onChange={set("bundled_skills")} placeholder="e.g. morning-brief, web-research, email-draft" className="w-full bg-surface/50 border border-border-subtle/50 rounded px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/30" />
      </div>

      <div>
        <label htmlFor="persona_md" className="block text-[13px] font-medium text-text mb-1.5">Persona Markdown <span className="text-text-muted font-normal">(SOUL.md content)</span></label>
        <textarea id="persona_md" rows={8} value={form.persona_md} onChange={set("persona_md")} placeholder="# Agent Name&#10;&#10;You are...&#10;&#10;## Personality&#10;- ...&#10;&#10;## Core Behaviors&#10;- ..." className="w-full bg-surface/50 border border-border-subtle/50 rounded px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/30 resize-y font-mono text-[12px]" />
      </div>

      {error && (
        <div className="rounded border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">{error}</div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Link href="/store" className="text-[13px] text-text-muted hover:text-text transition-colors">Cancel</Link>
        <button
          type="submit"
          disabled={submitting || !form.name || !form.description}
          className="px-6 py-2.5 rounded bg-accent text-background text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Publishing..." : "Publish Agent"}
        </button>
      </div>
    </form>
  );
}

function PublishContent() {
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") as PublishType) || "agent";
  const [type, setType] = useState<PublishType>(initialType);
  const { user } = useUser();

  if (!user) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-mono font-bold text-text">Sign in to publish</h2>
        <p className="text-sm text-text-secondary mt-2">
          You need to be signed in to publish agents, skills, squads, or templates to the Store.
        </p>
      </div>
    );
  }

  const types: { id: PublishType; label: string; desc: string; redirect?: string }[] = [
    { id: "agent", label: "Agent Persona", desc: "Publish your agent's personality and behaviors" },
    { id: "skill", label: "Skill", desc: "Coming soon — skills auto-publish from the CLI" },
    { id: "squad", label: "Squad Pack", desc: "Create a multi-agent team template", redirect: "/squads/create" },
    { id: "template", label: "OS Template", desc: "Bundle your workspace into a shareable template", redirect: "/templates/publish" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-mono font-bold text-text">Publish to Store</h1>
        <p className="text-sm text-text-secondary mt-1">
          Share your work with the Hubify community. Everything you publish is open source.
        </p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              if (t.redirect) {
                window.location.href = t.redirect;
                return;
              }
              setType(t.id);
            }}
            className={`p-3 rounded border text-left transition-all ${
              type === t.id
                ? "border-accent/30 bg-accent/5"
                : "border-border-subtle/50 bg-surface/50 hover:border-border-subtle"
            }`}
          >
            <div className="text-[13px] font-medium text-text">{t.label}</div>
            <div className="text-[11px] text-text-muted mt-0.5">{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Forms */}
      {type === "agent" && <AgentPublishForm />}
      {type === "skill" && (
        <div className="text-center py-12 rounded border border-border-subtle/50 bg-surface/50">
          <p className="text-sm text-text-secondary">Skills are published through the Hubify CLI.</p>
          <p className="text-xs text-text-tertiary mt-1">
            Run <code className="px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-accent font-mono text-[11px]">hubify skill publish</code> from your workspace.
          </p>
        </div>
      )}
    </div>
  );
}

export default function PublishPage() {
  return (
    <AppShell>
      <ErrorBoundary componentName="Publish">
        <div className="p-5 md:p-8">
          <PublishContent />
        </div>
      </ErrorBoundary>
    </AppShell>
  );
}
