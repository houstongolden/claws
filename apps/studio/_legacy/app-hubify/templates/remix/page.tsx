"use client";

import { AppShell, ErrorBoundary } from "@/components/ui";
import Link from "next/link";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { VoiceConfigModal } from "@/components/template/VoiceConfigModal";
import { type AgentVoiceConfig, type BrandVoiceConfig } from "@/components/template/VoiceConfigPanel";
import { getTemplateBySlug, type Template } from "@/lib/template-data";
import type { Id } from "@/convex/_generated/dataModel";

const BASE_SKILLS = [
  "github",
  "strava",
  "telegram-topics",
  "tasks",
  "crm",
  "email-draft",
  "analytics",
  "code-review",
  "deploy",
  "git-sync",
  "arxiv",
  "perplexity",
  "knowledge-hub",
  "synthesis",
  "web-scraper",
  "content-gen",
  "image-gen",
  "scheduler",
  "vision",
  "health-sync",
  "xp-tracker",
  "quest-engine",
];

const BASE_TAGS = [
  "founder",
  "developer",
  "gtm",
  "sales",
  "marketing",
  "research",
  "knowledge",
  "project-management",
  "health",
  "fitness",
  "content",
  "creative",
  "automation",
];

function RemixTemplatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();

  const forkId = searchParams.get("forkId");
  const templateSlug = searchParams.get("template");

  // Look up the parent template from static data
  const parentTemplate: Template | undefined = templateSlug
    ? getTemplateBySlug(templateSlug)
    : undefined;

  // Load fork record from Convex if forkId is present
  const forkRecord = useQuery(
    api.templates.getFork,
    forkId ? { forkId: forkId as Id<"template_forks"> } : "skip"
  );

  // Build merged skills and tags lists
  const availableSkills = useMemo(() => {
    const parentSkills = parentTemplate?.skills || [];
    const combined = new Set([...parentSkills, ...BASE_SKILLS]);
    return Array.from(combined);
  }, [parentTemplate]);

  const commonTags = useMemo(() => {
    const parentTags = parentTemplate?.tags || [];
    const combined = new Set([...parentTags, ...BASE_TAGS]);
    return Array.from(combined);
  }, [parentTemplate]);

  // Pre-populate from parent template
  const [initialized, setInitialized] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [soulMd, setSoulMd] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [showVoiceConfig, setShowVoiceConfig] = useState(false);
  const [agentVoice, setAgentVoice] = useState<AgentVoiceConfig>({});
  const [brandVoice, setBrandVoice] = useState<BrandVoiceConfig>({});

  // Initialize form from parent template data (once)
  useEffect(() => {
    if (initialized) return;
    if (!parentTemplate) {
      // No parent template, set defaults
      setTemplateName(templateSlug ? `${templateSlug} Custom` : "My Template");
      setInitialized(true);
      return;
    }

    setTemplateName(`${parentTemplate.name} Custom`);
    setDescription(parentTemplate.description);
    setSelectedSkills([...parentTemplate.skills]);
    setTags([...parentTemplate.tags]);

    if (parentTemplate.agentVoice) {
      setAgentVoice(parentTemplate.agentVoice as AgentVoiceConfig);
    }
    if (parentTemplate.brandVoice) {
      setBrandVoice(parentTemplate.brandVoice as BrandVoiceConfig);
    }

    setInitialized(true);
  }, [parentTemplate, templateSlug, initialized]);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);

    try {
      if (!templateName.trim() || !description.trim()) {
        throw new Error("Template name and description are required");
      }

      const response = await fetch("/api/templates/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateName,
          description,
          skills: selectedSkills,
          tags,
          authorHandle: user?.username || user?.firstName || "user",
          forkId,
          soulMd,
          dashboardConfig: {
            sections: selectedSkills,
          },
          agentVoice: Object.keys(agentVoice).length > 0 ? agentVoice : undefined,
          brandVoice: Object.keys(brandVoice).length > 0 ? brandVoice : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to publish template");
      }

      const data = await response.json();
      const publishId = data.publishedId || data.submissionId || "unknown";
      setPublishSuccess(
        `Template submitted for review. ID: ${publishId}`
      );

      setTimeout(() => {
        router.push("/templates");
      }, 2000);
    } catch (error) {
      setPublishError(
        error instanceof Error ? error.message : "Failed to publish template"
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleVoiceSave = (newAgentVoice: AgentVoiceConfig, newBrandVoice: BrandVoiceConfig) => {
    setAgentVoice(newAgentVoice);
    setBrandVoice(newBrandVoice);
  };

  return (
    <AppShell>
      <ErrorBoundary componentName="RemixTemplate">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Link href="/templates" className="hover:text-text transition-colors">Templates</Link>
            {parentTemplate && (
              <>
                <span className="text-text-muted">&rsaquo;</span>
                <Link href={`/templates/${parentTemplate.slug}`} className="hover:text-text transition-colors">
                  {parentTemplate.name}
                </Link>
              </>
            )}
            <span className="text-text-muted">&rsaquo;</span>
            <span className="text-text">Remix</span>
          </div>

          {/* Header */}
          <div>
            <h1 className="text-3xl font-mono font-bold text-text">
              Remix & Publish
            </h1>
            {parentTemplate && (
              <p className="mt-2 text-sm text-text-secondary">
                Based on <span className="text-accent font-medium">{parentTemplate.name}</span>
                {forkRecord && (
                  <span className="text-text-muted ml-1">
                    — forked {new Date(forkRecord.forkedAt).toLocaleDateString()}
                  </span>
                )}
              </p>
            )}
            <p className="mt-1 text-text-secondary">
              Customize your template and publish it to the community gallery.
            </p>
          </div>

          {/* Parent template attribution */}
          {parentTemplate && (
            <div className="flex items-center gap-3 p-4 rounded border border-border bg-surface">
              <div
                className="w-10 h-10 rounded flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: `${parentTemplate.accent}20`, color: parentTemplate.accent }}
              >
                {parentTemplate.monogram}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">
                  Forked from {parentTemplate.name}
                </p>
                <p className="text-xs text-text-muted truncate">
                  {parentTemplate.skills.length} skills, {parentTemplate.tags.length} tags pre-loaded
                </p>
              </div>
              <Link
                href={`/templates/${parentTemplate.slug}`}
                className="text-xs text-accent hover:underline flex-shrink-0"
              >
                View original
              </Link>
            </div>
          )}

          {/* Form */}
          <div className="space-y-6">
            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., My Custom DevOS"
                className="w-full px-4 py-3 rounded bg-surface text-text placeholder:text-text-secondary border border-border focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your template in a few sentences..."
                rows={4}
                className="w-full px-4 py-3 rounded bg-surface text-text placeholder:text-text-secondary border border-border focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>

            {/* Skills Selection */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Pre-installed Skills
              </label>
              <p className="text-xs text-text-muted mb-3">
                {selectedSkills.length} selected
                {parentTemplate && parentTemplate.skills.length > 0 && (
                  <span> — {parentTemplate.skills.length} inherited from {parentTemplate.name}</span>
                )}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {availableSkills.map((skill) => {
                  const isParent = parentTemplate?.skills.includes(skill);
                  const isSelected = selectedSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-2 rounded text-sm transition-colors ${
                        isSelected
                          ? "bg-accent text-background"
                          : "bg-surface text-text-secondary hover:text-text border border-border"
                      }`}
                    >
                      {isParent && !isSelected && <span className="text-text-muted mr-1">+</span>}
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags Selection */}
            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Tags
              </label>
              <p className="text-xs text-text-muted mb-3">
                {tags.length} selected
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {commonTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-2 rounded text-sm transition-colors ${
                      tags.includes(tag)
                        ? "bg-accent text-background"
                        : "bg-surface text-text-secondary hover:text-text border border-border"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* SOUL.md Editor */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                SOUL.md (Agent Personality)
              </label>
              <textarea
                value={soulMd}
                onChange={(e) => setSoulMd(e.target.value)}
                placeholder="Define your agent's personality, values, and behavior..."
                rows={6}
                className="w-full px-4 py-3 rounded bg-surface text-text placeholder:text-text-secondary border border-border font-mono text-sm focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>

            {/* Agent & Brand Voice Configuration */}
            <div className="border border-border rounded p-6 bg-surface/50">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-text mb-1">
                    Agent & Brand Voice
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Configure how your agent communicates
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVoiceConfig(true)}
                  className="px-4 py-2 bg-accent text-background font-medium rounded hover:opacity-90 transition-opacity text-sm"
                >
                  Configure Voice
                </button>
              </div>

              {/* Voice Summary */}
              {(Object.keys(agentVoice).length > 0 || Object.keys(brandVoice).length > 0) && (
                <div className="space-y-3 pt-4 border-t border-border">
                  {agentVoice.tone && (
                    <div className="text-sm">
                      <span className="text-text-secondary">Agent Tone:</span>
                      <span className="text-text ml-2 font-medium capitalize">{agentVoice.tone}</span>
                    </div>
                  )}
                  {agentVoice.style && (
                    <div className="text-sm">
                      <span className="text-text-secondary">Style:</span>
                      <span className="text-text ml-2 font-medium capitalize">{agentVoice.style}</span>
                    </div>
                  )}
                  {agentVoice.personality && (
                    <div className="text-sm">
                      <span className="text-text-secondary">Personality:</span>
                      <span className="text-text ml-2 italic">&quot;{agentVoice.personality}&quot;</span>
                    </div>
                  )}
                  {brandVoice.companyValues && brandVoice.companyValues.length > 0 && (
                    <div className="text-sm">
                      <span className="text-text-secondary">Brand Values:</span>
                      <span className="text-text ml-2">{brandVoice.companyValues.join(", ")}</span>
                    </div>
                  )}
                  {brandVoice.targetAudience && (
                    <div className="text-sm">
                      <span className="text-text-secondary">Target Audience:</span>
                      <span className="text-text ml-2">{brandVoice.targetAudience}</span>
                    </div>
                  )}
                </div>
              )}

              {Object.keys(agentVoice).length === 0 && Object.keys(brandVoice).length === 0 && (
                <p className="text-sm text-text-secondary italic">
                  No voice configuration yet. Click &quot;Configure Voice&quot; to get started.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-4 pt-6">
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="px-6 py-3 rounded bg-accent text-background font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishing ? "Submitting..." : "Submit to Gallery"}
              </button>

              {publishError && (
                <p className="text-sm text-red-500">{publishError}</p>
              )}

              {publishSuccess && (
                <p className="text-sm text-green-500">{publishSuccess}</p>
              )}

              <p className="text-sm text-text-secondary">
                Submitted templates are reviewed before appearing in the gallery.
              </p>
            </div>
          </div>

          {/* Info Section */}
          <div className="border-t border-border pt-8">
            <h2 className="text-lg font-mono font-bold text-text mb-4">
              What Gets Published?
            </h2>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li className="flex gap-3">
                <span className="text-accent font-bold">+</span>
                <span>Your template name and description</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent font-bold">+</span>
                <span>Pre-installed skills list</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent font-bold">+</span>
                <span>Tags for discoverability</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent font-bold">+</span>
                <span>Your SOUL.md agent personality config</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent font-bold">+</span>
                <span>Agent and brand voice configuration</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <VoiceConfigModal
        isOpen={showVoiceConfig}
        onClose={() => setShowVoiceConfig(false)}
        onSave={handleVoiceSave}
        initialAgentVoice={agentVoice}
        initialBrandVoice={brandVoice}
        templateName={templateName}
      />
      </ErrorBoundary>
    </AppShell>
  );
}

export default function RemixTemplatePage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}><RemixTemplatePageInner /></Suspense>;
}
