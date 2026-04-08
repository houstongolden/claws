import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * TEMPLATES - Public gallery and publishing
 */

/**
 * List all published templates (for gallery)
 */
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("status"), "published"))
      .collect();

    return templates.map((t) => ({
      id: t._id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      longDescription: t.longDescription,
      icon: t.icon,
      tags: t.tags,
      preInstalledSkills: t.preInstalledSkills,
      bestFor: t.bestFor,
      installs: t.installs,
      trending: (t as any).trending,
    }));
  },
});

/**
 * Get a single template by slug
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const template = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("slug"), slug))
      .first();

    if (!template) return null;

    return {
      id: template._id,
      slug: template.slug,
      name: template.name,
      description: template.description,
      longDescription: template.longDescription,
      icon: template.icon,
      tags: template.tags,
      preInstalledSkills: template.preInstalledSkills,
      bestFor: template.bestFor,
      installs: template.installs,
      author: template.author,
      soulMd: template.soulMd,
      dashboardConfig: template.dashboardConfig,
      agentVoice: template.agentVoice,
      brandVoice: template.brandVoice,
    };
  },
});

/**
 * Create or update a published template
 * (Typically called by admin after review)
 */
export const createPublished = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    longDescription: v.string(),
    icon: v.string(),
    tags: v.array(v.string()),
    preInstalledSkills: v.array(v.string()),
    bestFor: v.string(),
    author: v.optional(v.string()),
    authorHandle: v.optional(v.string()),
    soulMd: v.optional(v.string()),
    dashboardConfig: v.optional(
      v.object({
        sections: v.optional(v.array(v.string())),
        layout: v.optional(v.string()),
      })
    ),
    agentVoice: v.optional(
      v.object({
        tone: v.optional(v.union(
          v.literal("formal"),
          v.literal("casual"),
          v.literal("professional"),
          v.literal("friendly"),
          v.literal("technical"),
          v.literal("creative")
        )),
        style: v.optional(v.union(
          v.literal("verbose"),
          v.literal("concise"),
          v.literal("structured"),
          v.literal("narrative")
        )),
        professionalism: v.optional(v.union(
          v.literal("corporate"),
          v.literal("startup"),
          v.literal("casual"),
          v.literal("academic")
        )),
        personality: v.optional(v.string()),
      })
    ),
    brandVoice: v.optional(
      v.object({
        companyValues: v.optional(v.array(v.string())),
        communicationStyle: v.optional(v.string()),
        targetAudience: v.optional(v.string()),
        voiceGuidelines: v.optional(v.string()),
        examples: v.optional(v.array(v.object({
          context: v.string(),
          goodExample: v.string(),
          explanation: v.string(),
        }))),
      })
    ),
    squadPacks: v.optional(v.array(v.object({
      pack_id: v.string(),
      pack_name: v.string(),
      auto_deploy: v.boolean(),
    }))),
    agentsConfig: v.optional(v.array(v.object({
      name: v.string(),
      platform: v.string(),
      role: v.string(),
      model: v.optional(v.string()),
      auto_register: v.boolean(),
    }))),
    memorySeed: v.optional(v.array(v.object({
      memory_type: v.string(),
      key: v.string(),
      content: v.string(),
    }))),
    dashboardWidgets: v.optional(v.array(v.object({
      widget_type: v.string(),
      position: v.number(),
      size: v.union(v.literal("sm"), v.literal("md"), v.literal("lg"), v.literal("full")),
      config: v.optional(v.any()),
    }))),
    integrations: v.optional(v.object({
      github_enabled: v.optional(v.boolean()),
      telegram_enabled: v.optional(v.boolean()),
      hub_subscriptions: v.optional(v.array(v.string())),
    })),
    learningPath: v.optional(v.array(v.object({
      step: v.number(),
      title: v.string(),
      description: v.string(),
      action_type: v.union(
        v.literal("explore_skill"),
        v.literal("run_experiment"),
        v.literal("configure_agent"),
        v.literal("join_hub"),
        v.literal("custom")
      ),
      action_target: v.optional(v.string()),
      completed_check: v.optional(v.string()),
    }))),
    category: v.optional(v.union(
      v.literal("personal"),
      v.literal("developer"),
      v.literal("research"),
      v.literal("business"),
      v.literal("creative"),
      v.literal("community")
    )),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .first();

    const now = Date.now();

    if (existing) {
      // Update
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        longDescription: args.longDescription,
        icon: args.icon,
        tags: args.tags,
        preInstalledSkills: args.preInstalledSkills,
        bestFor: args.bestFor,
        author: args.author,
        authorHandle: args.authorHandle,
        soulMd: args.soulMd,
        dashboardConfig: args.dashboardConfig,
        agentVoice: args.agentVoice,
        brandVoice: args.brandVoice,
        squadPacks: args.squadPacks,
        agentsConfig: args.agentsConfig,
        memorySeed: args.memorySeed,
        dashboardWidgets: args.dashboardWidgets,
        integrations: args.integrations,
        learningPath: args.learningPath,
        category: args.category,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create
      const id = await ctx.db.insert("templates", {
        slug: args.slug,
        name: args.name,
        description: args.description,
        longDescription: args.longDescription,
        icon: args.icon,
        tags: args.tags,
        preInstalledSkills: args.preInstalledSkills,
        bestFor: args.bestFor,
        status: "published",
        author: args.author,
        authorHandle: args.authorHandle,
        soulMd: args.soulMd,
        dashboardConfig: args.dashboardConfig,
        agentVoice: args.agentVoice,
        brandVoice: args.brandVoice,
        squadPacks: args.squadPacks,
        agentsConfig: args.agentsConfig,
        memorySeed: args.memorySeed,
        dashboardWidgets: args.dashboardWidgets,
        integrations: args.integrations,
        learningPath: args.learningPath,
        category: args.category,
        installs: 0,
        forks: 0,
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      });
      return id;
    }
  },
});

/**
 * Increment install count for a template
 */
export const incrementInstalls = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const template = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("slug"), slug))
      .first();

    if (template) {
      await ctx.db.patch(template._id, {
        installs: template.installs + 1,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Create a fork record (when user clicks "Fork this template")
 */
export const recordFork = mutation({
  args: {
    templateSlug: v.string(),
    templateId: v.id("templates"),
    workspaceId: v.string(),
    workspaceName: v.string(),
  },
  handler: async (ctx, args) => {
    const forkId = await ctx.db.insert("template_forks", {
      templateSlug: args.templateSlug,
      templateId: args.templateId,
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName,
      remixState: "initial",
      forkedAt: Date.now(),
      lastModifiedAt: Date.now(),
    });

    // Increment fork count on template
    const template = await ctx.db.get(args.templateId);
    if (template) {
      await ctx.db.patch(args.templateId, {
        forks: template.forks + 1,
        updatedAt: Date.now(),
      });
    }

    return forkId;
  },
});

/**
 * Update fork customizations
 */
export const updateForkCustomizations = mutation({
  args: {
    forkId: v.id("template_forks"),
    soulMdEdited: v.optional(v.boolean()),
    skillsAdded: v.optional(v.array(v.string())),
    skillsRemoved: v.optional(v.array(v.string())),
    dashboardCustomized: v.optional(v.boolean()),
    remixState: v.optional(v.union(
      v.literal("initial"),
      v.literal("editing"),
      v.literal("ready_to_publish")
    )),
  },
  handler: async (ctx, args) => {
    const fork = await ctx.db.get(args.forkId);
    if (!fork) throw new Error("Fork not found");

    const customizations = fork.customizations || {};

    if (args.soulMdEdited !== undefined) {
      customizations.soulMdEdited = args.soulMdEdited;
    }
    if (args.skillsAdded !== undefined) {
      customizations.skillsAdded = args.skillsAdded;
    }
    if (args.skillsRemoved !== undefined) {
      customizations.skillsRemoved = args.skillsRemoved;
    }
    if (args.dashboardCustomized !== undefined) {
      customizations.dashboardCustomized = args.dashboardCustomized;
    }

    await ctx.db.patch(args.forkId, {
      customizations,
      remixState: args.remixState || fork.remixState,
      lastModifiedAt: Date.now(),
    });
  },
});

/**
 * Link a published template back to its fork record
 */
export const linkForkToPublished = mutation({
  args: {
    forkId: v.id("template_forks"),
    publishedTemplateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    const fork = await ctx.db.get(args.forkId);
    if (!fork) throw new Error("Fork not found");

    await ctx.db.patch(args.forkId, {
      publishedTemplateId: args.publishedTemplateId,
      remixState: "ready_to_publish",
      lastModifiedAt: Date.now(),
      publishedAt: Date.now(),
    });
  },
});

/**
 * Submit a forked template for publishing review
 */
export const submitForReview = mutation({
  args: {
    forkId: v.id("template_forks"),
    templateName: v.string(),
    description: v.string(),
    authorHandle: v.string(),
    skills: v.array(v.string()),
    tags: v.array(v.string()),
    soulMd: v.optional(v.string()),
    dashboardConfig: v.optional(
      v.object({
        sections: v.optional(v.array(v.string())),
        layout: v.optional(v.string()),
      })
    ),
    agentVoice: v.optional(
      v.object({
        tone: v.optional(v.union(
          v.literal("formal"),
          v.literal("casual"),
          v.literal("professional"),
          v.literal("friendly"),
          v.literal("technical"),
          v.literal("creative")
        )),
        style: v.optional(v.union(
          v.literal("verbose"),
          v.literal("concise"),
          v.literal("structured"),
          v.literal("narrative")
        )),
        professionalism: v.optional(v.union(
          v.literal("corporate"),
          v.literal("startup"),
          v.literal("casual"),
          v.literal("academic")
        )),
        personality: v.optional(v.string()),
      })
    ),
    brandVoice: v.optional(
      v.object({
        companyValues: v.optional(v.array(v.string())),
        communicationStyle: v.optional(v.string()),
        targetAudience: v.optional(v.string()),
        voiceGuidelines: v.optional(v.string()),
        examples: v.optional(v.array(v.object({
          context: v.string(),
          goodExample: v.string(),
          explanation: v.string(),
        }))),
      })
    ),
  },
  handler: async (ctx, args) => {
    const submissionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const submission = await ctx.db.insert("template_submissions", {
      submissionId,
      templateName: args.templateName,
      description: args.description,
      authorHandle: args.authorHandle,
      skills: args.skills,
      tags: args.tags,
      soulMd: args.soulMd,
      dashboardConfig: args.dashboardConfig,
      agentVoice: args.agentVoice,
      brandVoice: args.brandVoice,
      status: "pending_review",
      fromForkId: args.forkId,
      submittedAt: Date.now(),
    });

    // Update fork state
    await ctx.db.patch(args.forkId, {
      remixState: "ready_to_publish",
      lastModifiedAt: Date.now(),
    });

    return {
      submissionId,
      status: "pending_review",
      submittedAt: new Date().toISOString(),
    };
  },
});

/**
 * List submissions (for moderation/admin dashboard)
 */
export const listSubmissions = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    let query = ctx.db.query("template_submissions");

    if (status) {
      query = query.filter((q) => q.eq(q.field("status"), status));
    }

    return await query.collect();
  },
});

/**
 * Approve a submission and publish it
 */
export const approveSubmission = mutation({
  args: {
    submissionId: v.string(),
    slug: v.string(),
    reviewedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db
      .query("template_submissions")
      .filter((q) => q.eq(q.field("submissionId"), args.submissionId))
      .first();

    if (!submission) throw new Error("Submission not found");

    // Create published template
    const publishedId = await ctx.db.insert("templates", {
      slug: args.slug,
      name: submission.templateName,
      description: submission.description,
      longDescription: submission.description, // Use description for long form too
      icon: "📦", // Default icon
      tags: submission.tags,
      preInstalledSkills: submission.skills,
      bestFor: submission.templateName,
      status: "published",
      author: submission.authorHandle,
      authorHandle: submission.authorHandle,
      soulMd: submission.soulMd,
      dashboardConfig: submission.dashboardConfig,
      agentVoice: submission.agentVoice,
      brandVoice: submission.brandVoice,
      installs: 0,
      forks: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      publishedAt: Date.now(),
    });

    // Update submission
    await ctx.db.patch(submission._id, {
      status: "approved",
      publishedTemplateId: publishedId,
      reviewedBy: args.reviewedBy,
      reviewedAt: Date.now(),
    });

    // Update fork if exists
    if (submission.fromForkId) {
      await ctx.db.patch(submission.fromForkId, {
        publishedTemplateId: publishedId,
        publishedAt: Date.now(),
      });
    }

    return publishedId;
  },
});

/**
 * Get a single fork record by ID
 */
export const getFork = query({
  args: { forkId: v.id("template_forks") },
  handler: async (ctx, { forkId }) => {
    const fork = await ctx.db.get(forkId);
    if (!fork) return null;
    return fork;
  },
});

/**
 * Get all forks for a user (by workspaceId pattern)
 */
export const getUserForks = query({
  args: { workspaceId: v.string() },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query("template_forks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

/**
 * Get all forks of a specific template
 */
export const getForksOfTemplate = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    return await ctx.db
      .query("template_forks")
      .withIndex("by_template", (q) => q.eq("templateId", templateId))
      .collect();
  },
});

/**
 * Increment fork count on a template (standalone, without creating a fork record)
 */
export const incrementForks = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const template = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("slug"), slug))
      .first();

    if (template) {
      await ctx.db.patch(template._id, {
        forks: template.forks + 1,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Create a fork record without deploying a workspace.
 * Used when a user wants to customize + publish without spinning up infra.
 */
export const createForkWithoutWorkspace = mutation({
  args: {
    templateSlug: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the template in Convex DB first
    const template = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("slug"), args.templateSlug))
      .first();

    // If template exists in DB, use it; otherwise create a placeholder
    let templateId;
    if (template) {
      templateId = template._id;
      // Increment fork count
      await ctx.db.patch(template._id, {
        forks: template.forks + 1,
        updatedAt: Date.now(),
      });
    } else {
      // Create a minimal template record for static templates
      const now = Date.now();
      templateId = await ctx.db.insert("templates", {
        slug: args.templateSlug,
        name: args.templateSlug,
        description: "",
        longDescription: "",
        icon: "",
        tags: [],
        preInstalledSkills: [],
        bestFor: "",
        status: "draft",
        installs: 0,
        forks: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    const forkId = await ctx.db.insert("template_forks", {
      templateSlug: args.templateSlug,
      templateId,
      workspaceId: `fork-${args.userId}`,
      workspaceName: `${args.templateSlug}-fork`,
      remixState: "initial",
      forkedAt: Date.now(),
      lastModifiedAt: Date.now(),
    });

    return { forkId, templateSlug: args.templateSlug };
  },
});

/**
 * Reject a submission
 */
export const rejectSubmission = mutation({
  args: {
    submissionId: v.string(),
    reviewNotes: v.string(),
    reviewedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db
      .query("template_submissions")
      .filter((q) => q.eq(q.field("submissionId"), args.submissionId))
      .first();

    if (!submission) throw new Error("Submission not found");

    await ctx.db.patch(submission._id, {
      status: "rejected",
      reviewNotes: args.reviewNotes,
      reviewedBy: args.reviewedBy,
      reviewedAt: Date.now(),
    });
  },
});

/** Deploy template as a full OS bundle — creates hub with squad packs, agents, memory seeds, subscriptions */
export const deployBundle = mutation({
  args: {
    template_id: v.id("templates"),
    hub_id: v.id("hubs"),
    user_id: v.string(),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.template_id);
    if (!template) throw new Error("Template not found");

    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    const results = {
      squads_deployed: 0,
      agents_registered: 0,
      memories_seeded: 0,
      subscriptions_created: 0,
      widgets_configured: false,
    };

    // 1. Deploy squad packs
    const squadPacks = (template as any).squadPacks;
    if (squadPacks && Array.isArray(squadPacks)) {
      for (const pack of squadPacks) {
        if (pack.auto_deploy) {
          // Find the pack and deploy
          const squadPack = await ctx.db
            .query("squad_packs")
            .filter((q) => q.eq(q.field("name"), pack.pack_name))
            .first();

          if (squadPack) {
            // Create squad from pack
            const agents = hub.agents ?? [];
            await ctx.db.insert("squads", {
              name: `${pack.pack_name} Squad`,
              description: `Auto-deployed from template ${template.name}`,
              hub_id: args.hub_id,
              pack_id: squadPack._id,
              agents: agents.map((a: any) => ({
                agent_id: a.id,
                role: a.role || "member",
              })),
              status: "active",
              created_at: Date.now(),
              updated_at: Date.now(),
            } as any);
            results.squads_deployed++;
          }
        }
      }
    }

    // 2. Register agents
    const agentsConfig = (template as any).agentsConfig;
    if (agentsConfig && Array.isArray(agentsConfig)) {
      const existingAgents = hub.agents ?? [];
      for (const agentConfig of agentsConfig) {
        if (agentConfig.auto_register) {
          existingAgents.push({
            id: `template-${agentConfig.name.toLowerCase().replace(/\s+/g, "-")}`,
            name: agentConfig.name,
            platform: agentConfig.platform,
            role: agentConfig.role,
            model: agentConfig.model,
            active: true,
            last_active: Date.now(),
          });
          results.agents_registered++;
        }
      }
      await ctx.db.patch(args.hub_id, { agents: existingAgents });
    }

    // 3. Seed memory entries
    const memorySeed = (template as any).memorySeed;
    if (memorySeed && Array.isArray(memorySeed)) {
      for (const seed of memorySeed) {
        await ctx.db.insert("memory", {
          hub_id: args.hub_id,
          agent_id: "system",
          platform: "hubify",
          type: (seed.memory_type === "episodic" || seed.memory_type === "semantic" || seed.memory_type === "procedural")
            ? seed.memory_type
            : "semantic",
          content: `[${seed.key}] ${seed.content}`,
          tags: [seed.key, "template-seed"],
          created_at: Date.now(),
          updated_at: Date.now(),
        });
        results.memories_seeded++;
      }
    }

    // 4. Auto-subscribe to recommended hubs
    const integrations = (template as any).integrations;
    if (integrations?.hub_subscriptions && Array.isArray(integrations.hub_subscriptions)) {
      for (const hubName of integrations.hub_subscriptions) {
        const sourceHub = await ctx.db
          .query("hubs")
          .withIndex("by_name", (q) => q.eq("name", hubName))
          .first();

        if (sourceHub) {
          // Check if subscription exists
          const existing = await ctx.db
            .query("hub_subscriptions")
            .withIndex("by_pair", (q) =>
              q.eq("subscriber_hub_id", args.hub_id).eq("source_hub_id", sourceHub._id)
            )
            .first();

          if (!existing) {
            await ctx.db.insert("hub_subscriptions", {
              subscriber_hub_id: args.hub_id,
              source_hub_id: sourceHub._id,
              subscribed_at: Date.now(),
              status: "active",
            });
            results.subscriptions_created++;
          }
        }
      }
    }

    // 5. Mark widget config as applied
    const dashboardWidgets = (template as any).dashboardWidgets;
    if (dashboardWidgets && Array.isArray(dashboardWidgets)) {
      results.widgets_configured = true;
    }

    // Update template install count
    await ctx.db.patch(args.template_id, {
      installs: (template.installs ?? 0) + 1,
      updatedAt: Date.now(),
    });

    return results;
  },
});
