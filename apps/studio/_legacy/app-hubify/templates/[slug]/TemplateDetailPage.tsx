"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AppShell, ErrorBoundary } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { TemplateIcon } from "@/components/template/TemplateIcon";
import { getOtherTemplates, type Template } from "@/lib/template-data";
import { csrfFetch } from "@/lib/csrf-client";

type ForkModalState = {
  isOpen: boolean;
  forkId: string | null;
};

export function TemplateDetailPage({ template }: { template: Template }) {
  const [activeSection, setActiveSection] = useState(template.sections[0]?.title || "");
  const [isForking, setIsForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);
  const [forkModal, setForkModal] = useState<ForkModalState>({ isOpen: false, forkId: null });
  const { user, isLoaded: isUserLoaded } = useUser();
  const router = useRouter();

  const currentSection = template.sections.find((s) => s.title === activeSection) || template.sections[0];
  const deployHref = user
    ? `/workspaces/new?template=${template.slug}`
    : `/signup?template=${template.slug}`;

  const handleFork = async () => {
    if (!user) {
      router.push(`/signup?action=fork&template=${template.slug}`);
      return;
    }

    setIsForking(true);
    setForkError(null);
    try {
      const res = await csrfFetch("/api/templates/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateSlug: template.slug }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to fork template. Please try again." }));
        throw new Error(err.error || "Failed to fork");
      }

      const data = await res.json();
      // Show modal instead of immediately redirecting
      setForkModal({ isOpen: true, forkId: data.forkId });
    } catch (error) {
      console.error("Fork error:", error);
      setForkError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setIsForking(false);
    }
  };

  const handleCustomizeFirst = () => {
    if (!forkModal.forkId) return;
    setForkModal({ isOpen: false, forkId: null });
    router.push(`/templates/remix?forkId=${forkModal.forkId}&template=${template.slug}`);
  };

  const handleDeployNow = () => {
    if (!forkModal.forkId) return;
    setForkModal({ isOpen: false, forkId: null });
    router.push(`/workspaces/new?template=${template.slug}&forkId=${forkModal.forkId}`);
  };

  if (!isUserLoaded) {
    return (
      <AppShell>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <Skeleton variant="text" className="h-4 w-48 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            <div className="space-y-4">
              <Skeleton variant="text" className="h-6 w-32" />
              <Skeleton variant="text" className="h-12 w-3/4" />
              <Skeleton variant="text" className="h-5 w-1/2" />
              <Skeleton variant="text" className="h-4 w-full" />
              <Skeleton variant="text" className="h-4 w-5/6" />
              <div className="flex gap-4 pt-4">
                <Skeleton className="h-10 w-24 rounded" />
                <Skeleton className="h-10 w-24 rounded" />
                <Skeleton className="h-10 w-24 rounded" />
              </div>
            </div>
            <Skeleton variant="card" className="h-80 rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-48 rounded" />
            ))}
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <>
      {/* Fork destination modal */}
      {forkModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setForkModal({ isOpen: false, forkId: null })}
          />
          {/* Modal */}
          <div className="relative z-10 w-full max-w-sm mx-4 rounded border border-border bg-surface p-6 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <TemplateIcon monogram={template.monogram} accent={template.accent} size="sm" />
              <h2 className="text-base font-mono font-bold text-text">Fork created</h2>
            </div>
            <p className="text-sm text-text-secondary mb-6">
              What would you like to do with your fork of <span className="text-text font-medium">{template.name}</span>?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleCustomizeFirst}
                className="w-full flex flex-col items-start gap-0.5 px-4 py-3 rounded border border-border bg-background hover:border-accent/40 transition-colors text-left"
              >
                <span className="text-sm font-semibold text-text">Customize first</span>
                <span className="text-xs text-text-secondary">Edit name, skills, and agent voice before deploying</span>
              </button>
              <button
                onClick={handleDeployNow}
                className="w-full flex flex-col items-start gap-0.5 px-4 py-3 rounded font-semibold transition-all hover:brightness-110 text-left"
                style={{ background: template.accent, color: "#0A0908" }}
              >
                <span className="text-sm font-semibold">Deploy now</span>
                <span className="text-xs opacity-70">Launch a workspace immediately with this template</span>
              </button>
            </div>
            <button
              onClick={() => setForkModal({ isOpen: false, forkId: null })}
              className="mt-4 w-full text-center text-xs text-text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    <AppShell>
      <ErrorBoundary componentName="Template Detail">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">

        {/* -- Breadcrumb -- */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-8">
          <Link href="/templates" className="hover:text-text transition-colors">Templates</Link>
          <span className="text-text-muted">&rsaquo;</span>
          <span className="text-text">{template.name}</span>
        </div>

        {/* -- Hero -- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 items-start">
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border mb-5"
              style={{ background: `${template.accent}12`, borderColor: `${template.accent}30`, color: template.accent }}>
              <TemplateIcon monogram={template.monogram} accent={template.accent} size="sm" />
              AI OS Template
            </div>

            <h1 className="text-4xl sm:text-5xl font-mono font-bold text-text mb-3 leading-tight">
              {template.name}
            </h1>
            <p className="text-xl font-medium mb-4" style={{ color: template.accent }}>
              {template.tagline}
            </p>
            <p className="text-text-secondary text-base leading-relaxed mb-8">
              {template.longDescription}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap gap-6 mb-8 text-sm">
              {[
                { label: "Setup time", value: template.setupTime },
                { label: "Best for", value: template.bestFor.split(",")[0] },
                { label: "Agent", value: template.agentName },
                { label: "Installs", value: template.installs.toLocaleString() },
                ...(template.forks !== undefined && template.forks > 0
                  ? [{ label: "Forks", value: template.forks.toLocaleString() }]
                  : []),
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-text-muted text-xs uppercase tracking-wide">{m.label}</p>
                  <p className="text-text font-medium mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={deployHref}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded font-semibold text-sm transition-all hover:brightness-110"
                style={{ background: template.accent, color: "#0A0908" }}
              >
                Deploy {template.name} →
              </Link>
              <Link
                href={`/demo/${template.slug}`}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded font-semibold text-sm border border-border text-text transition-colors"
              >
                Live Demo
              </Link>
              <button
                onClick={handleFork}
                disabled={isForking}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded font-semibold text-sm border border-border text-text-secondary hover:text-text hover:border-accent/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isForking ? "Forking..." : "Fork & Customize"}
              </button>
            </div>

            {/* Fork error message */}
            {forkError && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded border border-red-500/20 bg-red-500/5 text-sm text-red-400">
                <span>Fork failed: {forkError}</span>
                <button
                  onClick={() => setForkError(null)}
                  className="ml-auto text-xs text-text-muted hover:text-text transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Preview card */}
          <div className="rounded border border-border-subtle overflow-hidden"
            style={{ background: "#0D0C0A" }}>
            {/* Mock OS chrome */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: template.accent }} />
                <span className="text-xs font-medium text-text-muted">{template.agentName} · online</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: `${template.accent}20`, color: template.accent }}>
                {template.name}
              </span>
            </div>

            {/* Sidebar + content mock */}
            <div className="flex h-72">
              {/* Sidebar */}
              <div className="w-36 border-r border-border-subtle/50 py-3 px-2 space-y-0.5 flex-shrink-0">
                {template.sections.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => setActiveSection(s.title)}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-all"
                    style={{
                      background: activeSection === s.title ? `${template.accent}18` : "transparent",
                      color: activeSection === s.title ? template.accent : "rgba(255,255,255,0.4)",
                      borderLeft: activeSection === s.title ? `2px solid ${template.accent}` : "2px solid transparent",
                    }}
                  >
                    <span className="text-xs">{s.icon}</span>
                    {s.title}
                  </button>
                ))}
              </div>

              {/* Content pane */}
              <div className="flex-1 p-4 overflow-hidden">
                {currentSection && (
                  <div key={currentSection.title} className="h-full animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">{currentSection.icon}</span>
                      <h3 className="text-sm font-bold text-text">{currentSection.title}</h3>
                    </div>
                    <p className="text-xs text-text-tertiary leading-relaxed mb-4">{currentSection.description}</p>
                    <div className="space-y-1.5">
                      {currentSection.features.map((f, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: template.accent }} />
                          <p className="text-[11px] text-text-secondary">{f}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer bar */}
            <div className="px-4 py-2.5 border-t border-border-subtle/50 flex items-center justify-between">
              <span className="text-[10px] text-text-muted">{template.installs.toLocaleString()} installations</span>
              <Link href={`/demo/${template.slug}`}
                className="text-[10px] font-medium transition-colors"
                style={{ color: template.accent }}>
                Open full demo →
              </Link>
            </div>
          </div>
        </div>

        {/* -- Features & Capabilities -- */}
        <div className="mb-16">
          <h2 className="text-2xl font-mono font-bold text-text mb-2">Features & Capabilities</h2>
          <p className="text-text-secondary mb-8">Every page, feature, and capability in {template.name}.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {template.sections.map((section) => (
              <div key={section.title}
                className="rounded border border-border bg-surface p-5 transition-colors group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded flex items-center justify-center text-lg"
                    style={{ background: `${template.accent}12`, border: `1px solid ${template.accent}25` }}>
                    {section.icon}
                  </div>
                  <h3 className="text-sm font-bold text-text group-hover:text-accent transition-colors">{section.title}</h3>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mb-4">{section.description}</p>
                <ul className="space-y-1.5">
                  {section.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                      <span className="mt-1 flex-shrink-0 text-[8px]" style={{ color: template.accent }}>&#9670;</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* -- Agent & Brand Voice -- */}
        {(template.agentVoice || template.brandVoice) && (
          <div className="mb-16 rounded border border-border bg-surface p-6">
            <h2 className="text-lg font-mono font-bold text-text mb-4">Agent & Brand Voice</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {template.agentVoice && (
                <div>
                  <h3 className="text-sm font-semibold text-text mb-3">Agent Voice</h3>
                  <div className="space-y-2 text-sm">
                    {template.agentVoice.tone && (
                      <div>
                        <span className="text-text-secondary">Tone:</span>
                        <span className="text-text ml-2 capitalize font-medium">{template.agentVoice.tone}</span>
                      </div>
                    )}
                    {template.agentVoice.style && (
                      <div>
                        <span className="text-text-secondary">Style:</span>
                        <span className="text-text ml-2 capitalize font-medium">{template.agentVoice.style}</span>
                      </div>
                    )}
                    {template.agentVoice.professionalism && (
                      <div>
                        <span className="text-text-secondary">Professionalism:</span>
                        <span className="text-text ml-2 capitalize font-medium">{template.agentVoice.professionalism}</span>
                      </div>
                    )}
                    {template.agentVoice.personality && (
                      <div>
                        <span className="text-text-secondary">Personality:</span>
                        <p className="text-text mt-1 italic text-xs">"{template.agentVoice.personality}"</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {template.brandVoice && (
                <div>
                  <h3 className="text-sm font-semibold text-text mb-3">Brand Voice</h3>
                  <div className="space-y-2 text-sm">
                    {template.brandVoice.companyValues && template.brandVoice.companyValues.length > 0 && (
                      <div>
                        <span className="text-text-secondary">Values:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {template.brandVoice.companyValues.map((value) => (
                            <span key={value} className="px-2 py-1 bg-accent/10 text-accent rounded text-xs font-medium">
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {template.brandVoice.targetAudience && (
                      <div>
                        <span className="text-text-secondary">Target Audience:</span>
                        <p className="text-text mt-1 text-xs">{template.brandVoice.targetAudience}</p>
                      </div>
                    )}
                    {template.brandVoice.communicationStyle && (
                      <div>
                        <span className="text-text-secondary">Communication Style:</span>
                        <p className="text-text mt-1 text-xs">{template.brandVoice.communicationStyle}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -- Skills + Stack -- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Pre-installed skills */}
          <div className="rounded border border-border bg-surface p-6">
            <h3 className="text-base font-bold text-text mb-1">Pre-installed skills</h3>
            <p className="text-xs text-text-secondary mb-4">
              {template.skills.length > 0
                ? `${template.skills.length} skills ship with ${template.name} — ready to use immediately.`
                : "No skills pre-installed — you build your own stack from scratch."}
            </p>
            {template.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {template.skills.map((skill) => (
                  <span key={skill}
                    className="px-3 py-1.5 rounded text-xs font-medium border"
                    style={{ background: `${template.accent}10`, borderColor: `${template.accent}25`, color: template.accent }}>
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded bg-muted border border-border-subtle">
                <TemplateIcon monogram={template.monogram} accent={template.accent} size="sm" />
                <p className="text-xs text-text-secondary">Browse 150+ skills and install only what you need.</p>
              </div>
            )}
          </div>

          {/* Tech stack */}
          <div className="rounded border border-border bg-surface p-6">
            <h3 className="text-base font-bold text-text mb-1">Tech stack</h3>
            <p className="text-xs text-text-secondary mb-4">Everything powering {template.name} under the hood.</p>
            <div className="space-y-2">
              {template.stack.map((tech) => (
                <div key={tech} className="flex items-center gap-3 p-2.5 rounded bg-muted">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: template.accent }} />
                  <span className="text-xs text-text font-medium">{tech}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* -- What's Included + Community Stats -- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* What's Included */}
          <div className="rounded border border-border-subtle/50 bg-surface/50 p-4">
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
              What&apos;s Included
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Skills</span>
                <span className="text-text font-medium">{(template as any).preInstalledSkills?.length ?? template.skills?.length ?? 0}</span>
              </div>
              {(template as any).squadPacks && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Squad Packs</span>
                  <span className="text-text font-medium">{(template as any).squadPacks.length}</span>
                </div>
              )}
              {(template as any).agentsConfig && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Agents</span>
                  <span className="text-text font-medium">{(template as any).agentsConfig.length}</span>
                </div>
              )}
              {(template as any).memorySeed && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Memory Seeds</span>
                  <span className="text-text font-medium">{(template as any).memorySeed.length}</span>
                </div>
              )}
              {(template as any).learningPath && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Learning Path Steps</span>
                  <span className="text-text font-medium">{(template as any).learningPath.length}</span>
                </div>
              )}
              {(template as any).dashboardWidgets && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Dashboard Widgets</span>
                  <span className="text-text font-medium">{(template as any).dashboardWidgets.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Community */}
          <div className="rounded border border-border-subtle/50 bg-surface/50 p-4">
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
              Community
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Installs</span>
                <span className="text-text font-medium">{template.installs ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Forks</span>
                <span className="text-text font-medium">{template.forks ?? 0}</span>
              </div>
              {(template as any).communityRating && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Rating</span>
                  <span className="text-text font-medium">{(template as any).communityRating.toFixed(1)}/5</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* -- Tags -- */}
        <div className="mb-12">
          <div className="flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full text-xs text-text-muted bg-muted border border-border-subtle">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* -- Other templates -- */}
        <div className="border-t border-border pt-12">
          <h2 className="text-xl font-mono font-bold text-text mb-6">Explore other templates</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {getOtherTemplates(template.slug).map((t) => (
              <Link key={t.slug} href={`/templates/${t.slug}`}
                className="flex flex-col items-center gap-2 p-4 rounded border border-border bg-surface hover:bg-elevated transition-all text-center group">
                <TemplateIcon monogram={t.monogram} accent={t.accent} size="sm" />
                <span className="text-xs font-medium text-text-secondary group-hover:text-text transition-colors">{t.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* -- Final CTA -- */}
        <div className="mt-16 rounded border p-10 text-center"
          style={{ background: `${template.accent}08`, borderColor: `${template.accent}20` }}>
          <div className="flex justify-center mb-4">
            <TemplateIcon monogram={template.monogram} accent={template.accent} size="xl" />
          </div>
          <h2 className="text-2xl font-mono font-bold text-text mb-3">Ready to deploy {template.name}?</h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">
            {template.setupTime} setup. Your agent starts working immediately.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/demo/${template.slug}`}
              className="px-6 py-3 rounded font-semibold text-sm border border-border text-text transition-colors"
            >
              Try the demo first
            </Link>
            <Link
              href={deployHref}
              className="px-6 py-3 rounded font-semibold text-sm transition-all hover:brightness-110"
              style={{ background: template.accent, color: "#0A0908" }}
            >
              Deploy {template.name} →
            </Link>
          </div>
        </div>

      </main>
      </ErrorBoundary>
    </AppShell>
    </>
  );
}
