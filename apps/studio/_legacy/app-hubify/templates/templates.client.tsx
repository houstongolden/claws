"use client";

import { AppShell, EmptyState, ErrorBoundary } from "@/components/ui";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Layout } from "@/components/ui/Icons";
import { TEMPLATES, CATEGORY_LABELS, type Template, type TemplateCategory } from "@/lib/template-data";
import { TemplateIcon } from "@/components/template/TemplateIcon";
import { TemplatePreviewModal } from "@/components/template/TemplatePreviewModal";

type FilterType = "all" | TemplateCategory;
type TemplateWithMeta = Template & { isCommunity?: boolean };

export default function TemplatesClientPage() {
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Fetch live templates from Convex (published only)
  const convexTemplates = useQuery(api.templates.listPublished);

  // Merge built-in templates (first) with community templates from Convex
  const templates = useMemo<(Template & { isCommunity?: boolean })[]>(() => {
    const builtIn: (Template & { isCommunity?: boolean })[] = TEMPLATES.map((t) => ({
      ...t,
      isCommunity: false,
    }));

    if (!convexTemplates || convexTemplates.length === 0) return builtIn;

    const builtInSlugs = new Set(TEMPLATES.map((t) => t.slug));

    const community: (Template & { isCommunity?: boolean })[] = convexTemplates
      .filter((ct: any) => !builtInSlugs.has(ct.slug))
      .map((ct: any) => ({
        id: ct.id as string,
        slug: ct.slug,
        name: ct.name,
        tagline: ct.description,
        description: ct.description,
        longDescription: ct.longDescription ?? ct.description,
        monogram: ct.name.slice(0, 2).toUpperCase(),
        accent: "#D4A574",
        category: "custom" as const,
        agentName: "Agent",
        installs: ct.installs ?? 0,
        tags: ct.tags ?? [],
        bestFor: ct.bestFor ?? "",
        trending: ct.trending ?? false,
        sections: [],
        skills: ct.preInstalledSkills ?? [],
        stack: [],
        setupTime: "~5 minutes",
        complexity: "Community",
        isCommunity: true,
      }));

    return [...builtIn, ...community];
  }, [convexTemplates]);

  const myos = templates.find((t) => t.id === "myos")!;
  const otherTemplates = templates.filter((t) => t.id !== "myos");

  // Filter templates (excluding MyOS which is in hero)
  const filteredTemplates = (otherTemplates as TemplateWithMeta[]).filter((template) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesSearch =
        template.name.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q) ||
        template.tags.some((tag) => tag.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    if (selectedFilter !== "all" && template.category !== selectedFilter) {
      return false;
    }
    return true;
  });

  const isFiltering = search.trim() !== "" || selectedFilter !== "all";

  const handleOpenPreview = (template: Template) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    // Clear template after animation
    setTimeout(() => setPreviewTemplate(null), 300);
  };

  return (
    <ErrorBoundary componentName="Template Gallery">
    <>
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          isOpen={isPreviewOpen}
          onClose={handleClosePreview}
        />
      )}

      <AppShell>


      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
        <div className="space-y-8">

          {/* Hero Section */}
          <div className="flex items-start justify-between gap-4">
            <div>
            <h1 className="text-lg font-mono font-medium text-text">
              Templates
            </h1>
            <p className="text-[13px] text-text-secondary mt-0.5">
              Pre-configured AI operating systems. Deploy in 90 seconds.
            </p>
            </div>
            <Link
              href="/templates/publish"
              className="shrink-0 hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-accent text-background font-mono text-[12px] font-medium hover:bg-accent/90 transition-colors"
            >
              Publish Template
            </Link>
          </div>

          {/* MyOS Spotlight — hidden when searching/filtering */}
          {!isFiltering && myos && (
            <div className="rounded border border-border bg-surface overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Left: Info */}
                <div className="p-8 lg:p-10 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-4">
                    <TemplateIcon monogram={myos.monogram} accent={myos.accent} size="lg" />
                    <div>
                      <h2 className="text-xl font-mono font-medium text-text">{myos.name}</h2>
                      <p className="text-sm" style={{ color: myos.accent }}>{myos.agentName} agent</p>
                    </div>
                  </div>
                  <p className="text-text-secondary mb-2">{myos.description}</p>
                  <p className="text-sm text-text-secondary mb-6">{myos.longDescription}</p>
                  <div className="flex items-center gap-3 text-xs text-text-muted mb-6">
                    <span>{myos.skills.length} skills</span>
                    <span className="text-border">|</span>
                    <span>{myos.setupTime} setup</span>
                    <span className="text-border">|</span>
                    <span>{myos.installs.toLocaleString()} installs</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href={`/templates/${myos.slug}`}
                      className="px-5 py-2.5 min-h-[44px] rounded text-sm font-mono font-medium border border-border text-text transition-colors duration-150 text-center flex items-center justify-center"
                    >
                      View Details
                    </Link>
                    <Link
                      href={`/signup?template=${myos.slug}`}
                      className="px-5 py-2.5 min-h-[44px] rounded text-sm font-mono font-medium transition-all hover:brightness-110 text-center flex items-center justify-center"
                      style={{ background: myos.accent, color: "#0A0908" }}
                    >
                      Deploy MyOS
                    </Link>
                  </div>
                </div>

                {/* Right: Mini OS preview */}
                <div className="hidden lg:block border-l border-border">
                  <div className="h-full flex flex-col" style={{ background: "#0D0C0A" }}>
                    {/* Chrome bar */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: myos.accent }} />
                        <span className="text-[11px] font-medium text-text-muted">{myos.agentName} · online</span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded font-medium"
                        style={{ background: `${myos.accent}20`, color: myos.accent }}>
                        {myos.name}
                      </span>
                    </div>

                    {/* Sidebar + terminal mock */}
                    <div className="flex flex-1 min-h-0">
                      <div className="w-32 border-r border-border-subtle/50 py-3 px-2 space-y-0.5">
                        {myos.sections.slice(0, 5).map((s, i) => (
                          <div
                            key={s.title}
                            className="flex items-center gap-2 px-2 py-1.5 rounded text-[10px]"
                            style={{
                              background: i === 0 ? `${myos.accent}18` : "transparent",
                              color: i === 0 ? myos.accent : "rgba(255,255,255,0.35)",
                              borderLeft: i === 0 ? `2px solid ${myos.accent}` : "2px solid transparent",
                            }}
                          >
                            <span className="text-[10px]">{s.icon}</span>
                            {s.title}
                          </div>
                        ))}
                      </div>
                      <div className="flex-1 p-4 font-mono text-[11px] space-y-1 overflow-hidden">
                        <div className="text-text-muted text-[10px] mb-3">-- MyOS Terminal --</div>
                        <div style={{ color: myos.accent }}>$ myos start</div>
                        <div className="text-green-400/70 pl-2">&#10003; Loading MyOS v2.1...</div>
                        <div className="text-green-400/70 pl-2">&#10003; Strava connected</div>
                        <div className="text-green-400/70 pl-2">&#10003; GitHub authenticated</div>
                        <div className="text-text-tertiary pl-2">Myo is online</div>
                        <div className="mt-2" style={{ color: myos.accent }}>$ myos brief</div>
                        <div className="text-text-tertiary pl-2">2 meetings today</div>
                        <div className="text-text-tertiary pl-2">2 urgent emails</div>
                        <div className="text-text-tertiary pl-2">PR #47 needs review</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search & Category Filters */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                aria-label="Search templates"
                className="w-full md:max-w-md px-3 py-2 rounded bg-surface text-text placeholder:text-text-secondary border border-border font-mono text-[13px]"
              />
              <div className="text-sm text-text-secondary">
                {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Category Filters */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
              {(["all", ...Object.keys(CATEGORY_LABELS)] as (FilterType)[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedFilter(cat)}
                  className={`px-3 py-1.5 rounded text-[11px] font-mono font-medium transition-colors shrink-0 ${
                    selectedFilter === cat
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : "text-text-tertiary hover:text-text-secondary border border-transparent hover:border-border-subtle"
                  }`}
                >
                  {cat === "all" ? "All Templates" : CATEGORY_LABELS[cat as TemplateCategory] ?? cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Template Cards Grid */}
          {filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-slide-up">
              {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} isCommunity={template.isCommunity} onPreview={handleOpenPreview} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Layout className="w-8 h-8" />}
              title="No templates found"
              description="Try adjusting your search or filter to find a template that matches your needs."
              actions={[
                { label: "Clear filters", onClick: () => { setSearch(""); setSelectedFilter("all"); } },
                { label: "Publish your own", href: "/templates/publish" },
              ]}
            />
          )}
        </div>
      </main>
    </AppShell>
    </>
    </ErrorBoundary>
  );
}

function TemplateCard({ template, isCommunity, onPreview }: { template: Template; isCommunity?: boolean; onPreview: (template: Template) => void }) {
  const [showSkills, setShowSkills] = useState(false);

  return (
    <div className="group rounded border border-border bg-surface transition-all duration-200 overflow-hidden flex flex-col cursor-pointer" onClick={() => onPreview(template)}>
      {/* Accent top bar */}
      <div className="h-1" style={{ background: template.accent }} />

      <div className="p-5 flex-1 flex flex-col">
        {/* Header: Icon + Name + Trending + Community */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <TemplateIcon monogram={template.monogram} accent={template.accent} size="sm" />
            <div>
              <h3 className="text-sm font-mono font-medium text-text group-hover:text-accent transition-colors">
                {template.name}
              </h3>
              <p className="text-xs text-text-muted">{template.agentName} agent</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-shrink-0">
            {isCommunity && (
              <span className="text-[10px] font-medium text-text-muted border border-border rounded px-1.5 py-0.5">
                Community
              </span>
            )}
            {template.trending && (
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: template.accent }}
                title="Trending"
              />
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-text-secondary mb-4 flex-1">
          {template.description}
        </p>

        {/* What's included expansion */}
        {template.skills.length > 0 && (
          <div className="mb-4">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSkills(!showSkills); }}
              className="text-xs font-medium transition-colors hover:text-text"
              style={{ color: template.accent }}
            >
              {showSkills ? "Hide" : "What's included"} ({template.skills.length} skills)
            </button>
            {showSkills && (
              <div className="mt-2 space-y-1">
                {template.skills.map((skill) => (
                  <div key={skill} className="flex items-center gap-2 text-xs text-text-muted">
                    <span style={{ color: template.accent }}>+</span>
                    <span>{skill}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-3 text-xs text-text-muted mb-4">
          <span>{template.skills.length} skills</span>
          <span className="text-border">·</span>
          <span>{template.setupTime.replace("~", "")}</span>
          {template.installs > 0 && (
            <>
              <span className="text-border">·</span>
              <span>{template.installs.toLocaleString()} installs</span>
            </>
          )}
          {template.forks !== undefined && template.forks > 0 && (
            <>
              <span className="text-border">·</span>
              <span>{template.forks.toLocaleString()} forks</span>
            </>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          <Link
            href={`/templates/${template.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 px-3 py-2 min-h-[44px] rounded text-[13px] font-mono font-medium text-center border border-border text-text-secondary hover:text-text transition-colors duration-150 flex items-center justify-center"
          >
            View Details
          </Link>
          <Link
            href={`/studio/new?fork=${encodeURIComponent(template.slug)}`}
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-2 min-h-[44px] rounded text-[13px] font-mono font-medium text-center border border-border text-text-secondary hover:text-accent transition-colors duration-150 flex items-center justify-center"
            title="Remix in Studio"
          >
            Remix
          </Link>
          <Link
            href={`/signup?template=${template.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 px-3 py-2 min-h-[44px] rounded text-[13px] font-mono font-medium text-center transition-all hover:brightness-110 flex items-center justify-center"
            style={{ background: template.accent, color: "#0A0908" }}
          >
            Deploy
          </Link>
        </div>
      </div>
    </div>
  );
}
