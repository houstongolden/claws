"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { AppShell, ErrorBoundary } from "@/components/ui";
import { formatNumber, timeAgo } from "@/lib/format-utils";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded border border-border-subtle/50 bg-surface/50 p-4 text-center">
      <div className="text-xl font-mono font-bold text-text tabular-nums">{value}</div>
      <div className="text-[11px] text-text-muted mt-1 tracking-wide">{label}</div>
      {sub && <div className="text-[10px] text-text-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Publish CTA banner per tab ──
function PublishBanner({ tab, user }: { tab: Tab; user: any }) {
  const config: Record<Tab, { title: string; desc: string; href: string; cta: string } | null> = {
    agents: {
      title: "Share your agent persona",
      desc: "Publish your agent's personality, skills, and behaviors for others to install.",
      href: "/store/publish?type=agent",
      cta: "Publish Agent",
    },
    skills: {
      title: "Contribute a skill",
      desc: "Skills improve from real execution data. Publish yours and watch it evolve.",
      href: "/store/publish?type=skill",
      cta: "Publish Skill",
    },
    squads: {
      title: "Share your squad",
      desc: "Turn your multi-agent team into a deployable pack anyone can use.",
      href: "/squads/create",
      cta: "Create Squad Pack",
    },
    templates: {
      title: "Publish your OS template",
      desc: "Export your workspace setup as a template — skills, soul, agents, and config bundled.",
      href: "/templates/publish",
      cta: "Publish Template",
    },
    collective: null,
  };

  const c = config[tab];
  if (!c || !user) return null;

  return (
    <div className="rounded border border-accent/20 bg-accent/5 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{c.title}</div>
        <div className="text-[12px] text-text-secondary mt-0.5">{c.desc}</div>
      </div>
      <Link
        href={c.href}
        className="shrink-0 px-4 py-2 rounded bg-accent text-background text-[13px] font-medium hover:bg-accent/90 transition-colors"
      >
        {c.cta}
      </Link>
    </div>
  );
}

// ── Persona card (richer) ──
function PersonaCard({ persona }: { persona: any }) {
  const isOfficial = persona.author_type === "hubify";
  return (
    <Link
      href={`/agents/${persona.name}`}
      className="group block rounded border border-border-subtle/50 bg-surface/50 p-5 hover:bg-surface hover:border-border-subtle transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded bg-accent/10 flex items-center justify-center text-base font-bold text-accent shrink-0">
          {(persona.display_name || persona.name || "?")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-text truncate group-hover:text-accent transition-colors">
              {persona.display_name}
            </span>
            {isOfficial && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold uppercase tracking-wider">
                Official
              </span>
            )}
            {persona.verified && !isOfficial && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                Verified
              </span>
            )}
          </div>
          <div className="text-[12px] text-text-muted mt-0.5">{persona.role?.replace(/-/g, " ")}</div>
        </div>
      </div>

      <p className="text-[13px] text-text-secondary mt-3 line-clamp-2 leading-relaxed">{persona.description}</p>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-text-muted">
        {persona.run_count > 0 && <span className="tabular-nums">{formatNumber(persona.run_count)} runs</span>}
        {persona.installs > 0 && <span className="tabular-nums">{formatNumber(persona.installs)} installs</span>}
        {persona.rating > 0 && (
          <span className="text-accent tabular-nums">
            {"★".repeat(Math.round(persona.rating))} {persona.rating.toFixed(1)}
          </span>
        )}
        {persona.upvotes > 0 && <span className="tabular-nums">↑ {formatNumber(persona.upvotes)}</span>}
        {persona.contributions > 0 && (
          <span className="tabular-nums">{formatNumber(persona.contributions)} contributions</span>
        )}
      </div>

      {/* Domains/templates */}
      {persona.domains && persona.domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {persona.domains.slice(0, 4).map((d: string) => (
            <span
              key={d}
              className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border-subtle text-text-muted"
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {persona.author_username && !isOfficial && (
        <div className="text-[11px] text-text-tertiary mt-2">by @{persona.author_username}</div>
      )}
    </Link>
  );
}

function SkillCard({ skill }: { skill: any }) {
  return (
    <Link
      href={`/skills/${skill.name}`}
      className="group block rounded border border-border-subtle/50 bg-surface/50 p-4 hover:bg-surface hover:border-border-subtle transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text truncate group-hover:text-accent transition-colors">
            {skill.display_name || skill.name}
          </h3>
          {skill.description && (
            <p className="text-[13px] text-text-secondary mt-1 line-clamp-2 leading-relaxed">{skill.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted">
            {skill.category && (
              <span className="px-2 py-0.5 rounded-full bg-surface border border-border-subtle">{skill.category}</span>
            )}
            {skill.executions > 0 && <span className="tabular-nums">{formatNumber(skill.executions)} runs</span>}
            {skill.unique_agents > 0 && <span className="tabular-nums">{skill.unique_agents} agents</span>}
          </div>
        </div>
        {skill.confidence !== undefined && skill.confidence > 0 && (
          <div className="ml-3 text-sm font-mono text-accent font-bold tabular-nums">
            {Math.round(skill.confidence * 100)}%
          </div>
        )}
      </div>
    </Link>
  );
}

function SquadCard({ pack }: { pack: any }) {
  return (
    <Link
      href={`/squads/${pack.name}`}
      className="group block rounded border border-border-subtle/50 bg-surface/50 p-5 hover:bg-surface hover:border-border-subtle transition-all"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-[15px] font-semibold text-text group-hover:text-accent transition-colors">
          {pack.display_name || pack.name}
        </h3>
        {pack.is_official && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold uppercase tracking-wider shrink-0">
            Official
          </span>
        )}
      </div>
      <p className="text-[13px] text-text-secondary mt-1.5 line-clamp-2 leading-relaxed">{pack.description}</p>

      {/* Agent roster preview */}
      {pack.members && pack.members.length > 0 && (
        <div className="flex items-center gap-2 mt-3">
          <div className="flex -space-x-1.5">
            {pack.members.slice(0, 5).map((m: any, i: number) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-accent/10 border border-background flex items-center justify-center text-[9px] font-bold text-accent"
                title={m.role}
              >
                {(m.role || "?")[0].toUpperCase()}
              </div>
            ))}
          </div>
          <span className="text-[11px] text-text-muted">{pack.members.length} agents</span>
        </div>
      )}

      <div className="flex items-center gap-3 mt-3 text-[11px] text-text-muted">
        {pack.times_deployed > 0 && <span className="tabular-nums">{formatNumber(pack.times_deployed)} deployments</span>}
        {pack.category && (
          <span className="px-2 py-0.5 rounded-full bg-surface border border-border-subtle">{pack.category}</span>
        )}
        {pack.communication_style && <span>{pack.communication_style}</span>}
      </div>
    </Link>
  );
}

function TemplateCard({ template }: { template: any }) {
  return (
    <Link
      href={`/templates/${template.slug || template._id}`}
      className="group block rounded border border-border-subtle/50 bg-surface/50 p-5 hover:bg-surface hover:border-border-subtle transition-all"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-[15px] font-semibold text-text truncate group-hover:text-accent transition-colors">
          {template.name}
        </h3>
        {template.authorHandle && (
          <span className="text-[10px] text-text-tertiary shrink-0">by @{template.authorHandle}</span>
        )}
      </div>
      {template.description && (
        <p className="text-[13px] text-text-secondary mt-1.5 line-clamp-2 leading-relaxed">{template.description}</p>
      )}

      {/* What's included */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {template.preInstalledSkills && template.preInstalledSkills.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border-subtle text-text-muted">
            {template.preInstalledSkills.length} skills
          </span>
        )}
        {template.squadPacks && template.squadPacks.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border-subtle text-text-muted">
            {template.squadPacks.length} squads
          </span>
        )}
        {template.category && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border-subtle text-text-muted">
            {template.category}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3 text-[11px] text-text-muted">
        {template.installs > 0 && <span className="tabular-nums">{formatNumber(template.installs)} installs</span>}
        {template.forks > 0 && <span className="tabular-nums">{formatNumber(template.forks)} forks</span>}
        {template.parent_author_username && (
          <span className="text-text-tertiary">forked from @{template.parent_author_username}</span>
        )}
      </div>
    </Link>
  );
}

function StoreStats({ stats: globalStats }: { stats: any }) {
  const s = globalStats as any;
  const items: { label: string; value: string | number; sub?: string }[] = [];
  if (s.totalSkills > 0) items.push({ label: "Skills", value: formatNumber(s.totalSkills), sub: "self-evolving" });
  if (s.totalLearnings > 0) items.push({ label: "Learnings", value: formatNumber(s.totalLearnings), sub: "from real runs" });
  if (s.activeAgents > 0) items.push({ label: "Active Agents", value: formatNumber(s.activeAgents) });
  if (s.totalExecutions > 0) items.push({ label: "Executions", value: formatNumber(s.totalExecutions), sub: "and counting" });
  if (items.length === 0) return null;
  const cols = items.length >= 4 ? "sm:grid-cols-4" : items.length === 3 ? "sm:grid-cols-3" : "";
  return (
    <div className={`grid grid-cols-2 ${cols} gap-3`}>
      {items.map((st) => <StatCard key={st.label} {...st} />)}
    </div>
  );
}

type Tab = "agents" | "skills" | "squads" | "templates" | "collective";

function StoreContent() {
  const [tab, setTab] = useState<Tab>("agents");
  const [search, setSearch] = useState("");
  const [validating, setValidating] = useState<string | null>(null);
  const { user } = useUser();

  const globalStats = useQuery(api.stats.getMaterializedGlobalStats);

  // Agents (personas) tab — show all active personas
  const personas = useQuery(
    api.agentPersonas.list,
    tab === "agents" ? { status: "active", limit: 50 } : "skip"
  );

  // Skills tab
  const topSkills = useQuery(
    api.skills.listTopSkills,
    tab === "skills" ? { limit: 30 } : "skip"
  );
  const searchResults = useQuery(
    api.skills.search,
    tab === "skills" && search.length >= 2 ? { query: search, limit: 30 } : "skip"
  );

  // Squads tab
  const squadPacks = useQuery(
    api.squadPacks.listPacks,
    tab === "squads" ? { status: "published", limit: 30 } : "skip"
  );

  // Templates tab
  const templates = useQuery(
    api.templates.listPublished,
    tab === "templates" ? {} : "skip"
  );

  // Collective tab
  const collectiveInsights = useQuery(
    api.collective.getTrending,
    tab === "collective" ? { limit: 30 } : "skip"
  );
  const validateInsight = useMutation(api.collective.validateInsight);

  const displaySkills = search.length >= 2 ? (searchResults ?? []) : (topSkills ?? []);

  // Count items per tab
  const personaCount = personas !== undefined ? (personas as any[]).length : undefined;
  const skillCount = (globalStats as any)?.totalSkills;
  const squadCount = squadPacks !== undefined ? (squadPacks as any[]).length : undefined;
  const templateCount = templates !== undefined ? (templates as any[]).length : undefined;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "agents", label: "Agents", count: personaCount },
    { id: "skills", label: "Skills", count: skillCount },
    { id: "squads", label: "Squads", count: squadCount },
    { id: "templates", label: "Templates", count: templateCount },
    { id: "collective", label: "Collective" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold text-text">Store</h1>
          <p className="text-sm text-text-secondary mt-1">
            Discover agents, skills, squads, and OS templates built by the community. Everything is free and open source.
          </p>
        </div>
        {user && (
          <div className="shrink-0 flex gap-2">
            <Link
              href="/templates/publish"
              className="px-3.5 py-2 rounded border border-border-subtle text-[13px] font-medium text-text-secondary hover:text-text hover:border-accent/30 transition-colors"
            >
              Publish
            </Link>
          </div>
        )}
      </div>

      {/* Stats */}
      {globalStats === undefined ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[72px] rounded bg-surface animate-shimmer border border-border-subtle" />
          ))}
        </div>
      ) : globalStats ? (
        <StoreStats stats={globalStats} />
      ) : null}

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search agents, skills, squads, templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface/50 border border-border-subtle/50 rounded px-4 py-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/30 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-subtle/50 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[13px] font-medium transition-colors relative whitespace-nowrap ${
              tab === t.id
                ? "text-text"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 text-[11px] text-text-tertiary tabular-nums">{t.count}</span>
            )}
            {tab === t.id && (
              <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-accent rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Publish CTA */}
      <PublishBanner tab={tab} user={user} />

      {/* Agents Tab */}
      {tab === "agents" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {personas === undefined ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 rounded bg-surface animate-shimmer border border-border-subtle" />
            ))
          ) : (personas as any[]).length === 0 ? (
            <div className="col-span-2 text-center py-16">
              <div className="text-sm font-mono text-text-muted mb-3">--</div>
              <p className="text-sm text-text-secondary">No agent personas published yet.</p>
              <p className="text-xs text-text-tertiary mt-1">
                Publish your agent&apos;s personality, skills, and behaviors for others to install.
              </p>
              {user && (
                <Link
                  href="/store/publish?type=agent"
                  className="mt-4 inline-block px-4 py-2 rounded bg-accent text-background text-[13px] font-medium hover:bg-accent/90 transition-colors"
                >
                  Publish First Agent
                </Link>
              )}
            </div>
          ) : (
            (personas as any[]).map((persona: any) => (
              <PersonaCard key={persona._id} persona={persona} />
            ))
          )}
        </div>
      )}

      {/* Skills Tab */}
      {tab === "skills" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {topSkills === undefined && search.length < 2 ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded bg-surface animate-shimmer border border-border-subtle" />
            ))
          ) : displaySkills.length === 0 ? (
            <div className="col-span-2 text-center py-16">
              <p className="text-sm text-text-secondary">
                {search.length >= 2 ? "No skills match your search." : "No skills published yet."}
              </p>
            </div>
          ) : (
            displaySkills.map((skill: any) => (
              <SkillCard key={skill._id || skill.name} skill={skill} />
            ))
          )}
        </div>
      )}

      {/* Squads Tab */}
      {tab === "squads" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {squadPacks === undefined ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded bg-surface animate-shimmer border border-border-subtle" />
            ))
          ) : (squadPacks as any[]).length === 0 ? (
            <div className="col-span-2 text-center py-16">
              <div className="text-sm font-mono text-text-muted mb-3">--</div>
              <p className="text-sm text-text-secondary">No squad packs published yet.</p>
              <p className="text-xs text-text-tertiary mt-1">
                Create a multi-agent team and share it as a deployable pack.
              </p>
              {user && (
                <Link
                  href="/squads/create"
                  className="mt-4 inline-block px-4 py-2 rounded bg-accent text-background text-[13px] font-medium hover:bg-accent/90 transition-colors"
                >
                  Create Squad Pack
                </Link>
              )}
            </div>
          ) : (
            (squadPacks as any[]).map((pack: any) => (
              <SquadCard key={pack._id} pack={pack} />
            ))
          )}
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates === undefined ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded bg-surface animate-shimmer border border-border-subtle" />
            ))
          ) : (templates as any[]).length === 0 ? (
            <div className="col-span-2 text-center py-16">
              <div className="text-sm font-mono text-text-muted mb-3">--</div>
              <p className="text-sm text-text-secondary">No community templates published yet.</p>
              <p className="text-xs text-text-tertiary mt-1">
                Export your workspace as a template — skills, soul, agents, and config bundled together.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <Link
                  href="/templates/publish"
                  className="px-4 py-2 rounded bg-accent text-background text-[13px] font-medium hover:bg-accent/90 transition-colors"
                >
                  Publish Template
                </Link>
                <Link
                  href="/templates"
                  className="px-4 py-2 rounded border border-border-subtle text-[13px] font-medium text-text-secondary hover:text-text transition-colors"
                >
                  Browse Built-in
                </Link>
              </div>
            </div>
          ) : (
            (templates as any[]).map((template: any) => (
              <TemplateCard key={template._id} template={template} />
            ))
          )}
        </div>
      )}

      {/* Collective Tab */}
      {tab === "collective" && (
        <div className="space-y-3">
          <div className="rounded border border-border-subtle/50 bg-surface/30 p-4">
            <p className="text-[13px] text-text-secondary">
              The collective intelligence layer aggregates learnings, patterns, and insights shared by agents across all workspaces.
              Validated insights get applied automatically.
            </p>
          </div>
          {collectiveInsights === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded bg-surface animate-shimmer border border-border-subtle" />
              ))}
            </div>
          ) : collectiveInsights.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-sm font-mono text-text-muted mb-3">--</div>
              <p className="text-sm text-text-secondary">No collective insights yet.</p>
              <p className="text-xs text-text-tertiary mt-1">
                Insights are shared automatically from workspace agents. Deploy a workspace to start contributing.
              </p>
            </div>
          ) : (
            collectiveInsights.map((insight: any) => (
              <div key={insight._id} className="p-4 rounded border border-border-subtle/50 bg-surface/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium uppercase tracking-wider">
                    {insight.type?.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-text-tertiary tabular-nums">
                    {((insight.confidence ?? 0) * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-text mb-1">{insight.title}</h3>
                <p className="text-[13px] text-text-tertiary line-clamp-2 leading-relaxed">{insight.content}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-4 text-[11px] text-text-tertiary">
                    <span className="tabular-nums">{insight.validations ?? 0} validations</span>
                    <span className="tabular-nums">{insight.applications ?? 0} applications</span>
                    {insight.created_at && <span>{timeAgo(insight.created_at)}</span>}
                  </div>
                  {user && (
                    <button
                      onClick={async () => {
                        setValidating(insight._id);
                        try {
                          await validateInsight({
                            insight_id: insight._id,
                            agent_id: user.id,
                            action: "validated",
                          });
                        } catch {}
                        setValidating(null);
                      }}
                      disabled={validating === insight._id}
                      className="text-[11px] text-accent hover:text-accent/80 font-medium transition-colors disabled:opacity-50"
                    >
                      {validating === insight._id ? "Validating..." : "Validate"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col items-center gap-3 pt-6 border-t border-border-subtle/50">
        <div className="flex gap-6 text-[13px] text-text-muted">
          <Link href="/templates" className="hover:text-text transition-colors">Templates</Link>
          <Link href="/agents" className="hover:text-text transition-colors">Agents</Link>
          <Link href="/community" className="hover:text-text transition-colors">Community</Link>
          <Link href="/labs" className="hover:text-text transition-colors">Labs</Link>
        </div>
        <p className="text-[11px] text-text-tertiary">
          Everything on the Hubify Store is open source and community-driven.
        </p>
      </div>
    </div>
  );
}

export default function StorePage() {
  return (
    <AppShell>
      <ErrorBoundary componentName="Store">
        <div className="p-5 md:p-8">
          <StoreContent />
        </div>
      </ErrorBoundary>
    </AppShell>
  );
}
