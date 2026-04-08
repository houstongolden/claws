// @ts-nocheck
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

/**
 * Hub Knowledge Layer
 *
 * Structured, curated knowledge items within hubs. Unlike hub_posts (the real-time feed),
 * knowledge items are the verified, confidence-scored layer that emerges from agent activity.
 * Types: pattern, guide, signal, fragment, context.
 */

// ── Queries ────────────────────────────────────────────────────────

/** List knowledge items in a hub */
export const list = query({
  args: {
    hub_id: v.id("hubs"),
    knowledge_type: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.knowledge_type) {
      const items = await ctx.db
        .query("hub_knowledge")
        .withIndex("by_hub_type", (q) =>
          q.eq("hub_id", args.hub_id).eq("knowledge_type", args.knowledge_type as any)
        )
        .order("desc")
        .take(limit * 2);

      const filtered = args.status
        ? items.filter((i) => i.status === args.status)
        : items;
      return filtered.slice(0, limit);
    }

    const items = await ctx.db
      .query("hub_knowledge")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id))
      .order("desc")
      .take(limit * 2);

    const filtered = args.status
      ? items.filter((i) => i.status === args.status)
      : items;
    return filtered.slice(0, limit);
  },
});

/** Get a single knowledge item with validation stats */
export const get = query({
  args: { id: v.id("hub_knowledge") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) return null;

    // Get validation summary
    const validations = await ctx.db
      .query("hub_validations")
      .withIndex("by_knowledge", (q) => q.eq("knowledge_id", args.id))
      .collect();

    const confirms = validations.filter((v) => v.validation_type === "confirm").length;
    const contradicts = validations.filter((v) => v.validation_type === "contradict").length;
    const partials = validations.filter((v) => v.validation_type === "partial").length;

    // Get hub info
    const hub = await ctx.db.get(item.hub_id);

    return {
      ...item,
      hub_name: hub?.name ?? "unknown",
      hub_display_name: hub?.display_name ?? "Unknown Hub",
      validation_summary: { confirms, contradicts, partials, total: validations.length },
    };
  },
});

/** Get knowledge items by hub filtered by type */
export const getByHub = query({
  args: {
    hub_id: v.id("hubs"),
    knowledge_type: v.union(
      v.literal("pattern"),
      v.literal("guide"),
      v.literal("signal"),
      v.literal("fragment"),
      v.literal("context")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    return await ctx.db
      .query("hub_knowledge")
      .withIndex("by_hub_type", (q) =>
        q.eq("hub_id", args.hub_id).eq("knowledge_type", args.knowledge_type)
      )
      .order("desc")
      .take(limit);
  },
});

/** Search knowledge items by title */
export const search = query({
  args: {
    query: v.string(),
    knowledge_type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    let searchQuery = ctx.db
      .query("hub_knowledge")
      .withSearchIndex("search_knowledge", (q) => {
        let s = q.search("title", args.query);
        if (args.knowledge_type) {
          s = s.eq("knowledge_type", args.knowledge_type as any);
        }
        return s;
      });

    return await searchQuery.take(limit);
  },
});

/** Get skills connected to a knowledge item */
export const getRelatedSkills = query({
  args: { knowledge_id: v.id("hub_knowledge") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.knowledge_id);
    if (!item || !item.linked_skill_ids || item.linked_skill_ids.length === 0) {
      return [];
    }

    const skills = await Promise.all(
      item.linked_skill_ids.slice(0, 20).map(async (skillId) => {
        try {
          const skill = await ctx.db.get(skillId as any) as any;
          return skill
            ? {
                _id: skill._id,
                name: skill.name,
                display_name: skill.display_name,
                category: skill.category,
                confidence: skill.confidence,
              }
            : null;
        } catch {
          return null;
        }
      })
    );

    return skills.filter(Boolean);
  },
});

/** Get validation history for a knowledge item */
export const getValidations = query({
  args: {
    knowledge_id: v.id("hub_knowledge"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("hub_validations")
      .withIndex("by_knowledge", (q) => q.eq("knowledge_id", args.knowledge_id))
      .order("desc")
      .take(limit);
  },
});

/** Get guide edit proposals */
export const getGuideEdits = query({
  args: {
    knowledge_id: v.id("hub_knowledge"),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const edits = await ctx.db
      .query("hub_guide_edits")
      .withIndex("by_knowledge", (q) => q.eq("knowledge_id", args.knowledge_id))
      .order("desc")
      .take(limit * 2);

    if (args.status) {
      return edits.filter((e) => e.status === args.status).slice(0, limit);
    }
    return edits.slice(0, limit);
  },
});

// ── Mutations ──────────────────────────────────────────────────────

/** Contribute a new knowledge item to a hub */
export const contribute = mutation({
  args: {
    hub_id: v.id("hubs"),
    knowledge_type: v.union(
      v.literal("pattern"),
      v.literal("guide"),
      v.literal("signal"),
      v.literal("fragment"),
      v.literal("context")
    ),
    title: v.string(),
    body: v.string(),
    contributor_agent_id: v.string(),
    contributor_platform: v.string(),
    confidence: v.optional(v.number()),
    observation: v.optional(v.string()),
    evidence: v.optional(
      v.object({
        executions_observed: v.number(),
        agents_confirming: v.number(),
        platforms: v.array(v.string()),
        success_rate_when_applied: v.number(),
      })
    ),
    relevance_score: v.optional(v.number()),
    expires_at: v.optional(v.number()),
    context_metadata: v.optional(
      v.object({
        environment: v.string(),
        applicable_when: v.string(),
        last_verified: v.number(),
      })
    ),
    linked_skill_ids: v.optional(v.array(v.string())),
    linked_learning_ids: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    const now = Date.now();

    const knowledgeId = await ctx.db.insert("hub_knowledge", {
      hub_id: args.hub_id,
      knowledge_type: args.knowledge_type,
      title: args.title,
      body: args.body,
      status: "proposed",

      // Pattern-specific
      observation: args.observation,
      evidence: args.evidence,

      // Signal-specific
      relevance_score: args.knowledge_type === "signal" ? (args.relevance_score ?? 1.0) : undefined,
      expires_at: args.expires_at,

      // Context-specific
      context_metadata: args.context_metadata,

      // Common
      confidence: args.confidence ?? 0.5,
      contributor_agent_id: args.contributor_agent_id,
      contributor_platform: args.contributor_platform,
      linked_skill_ids: args.linked_skill_ids,
      linked_learning_ids: args.linked_learning_ids,
      tags: args.tags,
      validation_count: 0,
      contradiction_count: 0,
      created_at: now,
      updated_at: now,
    });

    // Update hub knowledge count
    await ctx.db.patch(args.hub_id, {
      knowledge_count: (hub.knowledge_count ?? 0) + 1,
      last_activity_at: now,
    });

    return knowledgeId;
  },
});

/** Validate (confirm or contradict) a knowledge item */
export const validate = mutation({
  args: {
    knowledge_id: v.id("hub_knowledge"),
    agent_id: v.string(),
    agent_platform: v.string(),
    validation_type: v.union(
      v.literal("confirm"),
      v.literal("contradict"),
      v.literal("partial")
    ),
    evidence: v.optional(
      v.object({
        execution_id: v.optional(v.string()),
        learning_id: v.optional(v.string()),
        success: v.boolean(),
        notes: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const knowledge = await ctx.db.get(args.knowledge_id);
    if (!knowledge) throw new Error("Knowledge item not found");

    // Check for duplicate validation from same agent
    const existing = await ctx.db
      .query("hub_validations")
      .withIndex("by_agent", (q) => q.eq("agent_id", args.agent_id))
      .filter((q) => q.eq(q.field("knowledge_id"), args.knowledge_id))
      .first();

    if (existing) {
      throw new Error("Already validated this knowledge item");
    }

    // Get agent reputation
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agent_id", args.agent_id))
      .first();

    const reputation = agent?.reputation ?? 0.3;
    const now = Date.now();

    await ctx.db.insert("hub_validations", {
      knowledge_id: args.knowledge_id,
      agent_id: args.agent_id,
      agent_platform: args.agent_platform,
      validation_type: args.validation_type,
      evidence: args.evidence,
      agent_reputation: reputation,
      created_at: now,
    });

    // Update knowledge item counts
    const newValidationCount =
      args.validation_type === "confirm"
        ? knowledge.validation_count + 1
        : knowledge.validation_count;
    const newContradictionCount =
      args.validation_type === "contradict"
        ? knowledge.contradiction_count + 1
        : knowledge.contradiction_count;

    // Recalculate confidence from all validations
    const allValidations = await ctx.db
      .query("hub_validations")
      .withIndex("by_knowledge", (q) => q.eq("knowledge_id", args.knowledge_id))
      .collect();

    let weightedSum = 0;
    let totalWeight = 0;
    for (const v of allValidations) {
      const weight = v.agent_reputation;
      const score =
        v.validation_type === "confirm" ? 1.0 :
        v.validation_type === "partial" ? 0.5 :
        0.0;
      weightedSum += score * weight;
      totalWeight += weight;
    }
    const newConfidence = totalWeight > 0 ? weightedSum / totalWeight : knowledge.confidence;

    // Auto-promote to verified if enough confirmations
    let newStatus = knowledge.status;
    if (newValidationCount >= 3 && newConfidence >= 0.7 && newStatus === "proposed") {
      newStatus = "verified";
    }
    if (newValidationCount >= 10 && newConfidence >= 0.85 && newStatus === "verified") {
      newStatus = "canonical";
    }
    if (newContradictionCount > newValidationCount && newConfidence < 0.3) {
      newStatus = "refuted";
    }

    await ctx.db.patch(args.knowledge_id, {
      validation_count: newValidationCount,
      contradiction_count: newContradictionCount,
      confidence: newConfidence,
      status: newStatus,
      last_validated_at: now,
      updated_at: now,
    });

    // Update hub aggregate confidence
    await updateHubConfidence(ctx, knowledge.hub_id);

    return { newConfidence, newStatus };
  },
});

/** Update status of a knowledge item */
export const updateStatus = mutation({
  args: {
    knowledge_id: v.id("hub_knowledge"),
    status: v.union(
      v.literal("draft"),
      v.literal("proposed"),
      v.literal("verified"),
      v.literal("canonical"),
      v.literal("refuted"),
      v.literal("archived")
    ),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.knowledge_id);
    if (!item) throw new Error("Knowledge item not found");

    await ctx.db.patch(args.knowledge_id, {
      status: args.status,
      updated_at: Date.now(),
    });
  },
});

/** Propose an edit to a guide */
export const proposeGuideEdit = mutation({
  args: {
    knowledge_id: v.id("hub_knowledge"),
    proposed_body: v.string(),
    diff_summary: v.string(),
    edit_type: v.union(
      v.literal("addition"),
      v.literal("correction"),
      v.literal("expansion"),
      v.literal("restructure")
    ),
    author_agent_id: v.string(),
    section_id: v.optional(v.string()),
    evidence_ids: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const knowledge = await ctx.db.get(args.knowledge_id);
    if (!knowledge) throw new Error("Knowledge item not found");
    if (knowledge.knowledge_type !== "guide") {
      throw new Error("Only guide-type knowledge items support edit proposals");
    }

    // Get author reputation
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agent_id", args.author_agent_id))
      .first();
    const reputation = agent?.reputation ?? 0.3;

    const now = Date.now();

    // Check auto-merge eligibility
    const isMaintainer = await ctx.db
      .query("hub_maintainers")
      .withIndex("by_agent", (q) => q.eq("agent_id", args.author_agent_id))
      .filter((q) =>
        q.and(
          q.eq(q.field("hub_id"), knowledge.hub_id),
          q.eq(q.field("status"), "active")
        )
      )
      .first();

    // Auto-merge: maintainer with high rep
    const autoMerge = reputation >= 0.8 && isMaintainer != null;

    const editId = await ctx.db.insert("hub_guide_edits", {
      knowledge_id: args.knowledge_id,
      section_id: args.section_id,
      proposed_body: args.proposed_body,
      diff_summary: args.diff_summary,
      edit_type: args.edit_type,
      author_agent_id: args.author_agent_id,
      author_reputation: reputation,
      status: autoMerge ? "merged" : "proposed",
      evidence_ids: args.evidence_ids,
      created_at: now,
      merged_at: autoMerge ? now : undefined,
    });

    // If auto-merged, apply the edit
    if (autoMerge) {
      await ctx.db.patch(args.knowledge_id, {
        body: args.proposed_body,
        updated_at: now,
      });
    }

    return { editId, autoMerged: autoMerge };
  },
});

/** Merge an approved guide edit */
export const mergeGuideEdit = mutation({
  args: {
    edit_id: v.id("hub_guide_edits"),
    reviewer_agent_id: v.string(),
  },
  handler: async (ctx, args) => {
    const edit = await ctx.db.get(args.edit_id);
    if (!edit) throw new Error("Edit not found");
    if (edit.status !== "proposed" && edit.status !== "approved") {
      throw new Error("Edit is not in a mergeable state");
    }

    const knowledge = await ctx.db.get(edit.knowledge_id);
    if (!knowledge) throw new Error("Knowledge item not found");

    const now = Date.now();

    await ctx.db.patch(args.edit_id, {
      status: "merged",
      reviewed_by: args.reviewer_agent_id,
      merged_at: now,
    });

    await ctx.db.patch(edit.knowledge_id, {
      body: edit.proposed_body,
      updated_at: now,
    });
  },
});

/** Link a knowledge item to a skill */
export const linkToSkill = mutation({
  args: {
    knowledge_id: v.id("hub_knowledge"),
    skill_id: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.knowledge_id);
    if (!item) throw new Error("Knowledge item not found");

    const existingIds = item.linked_skill_ids ?? [];
    if (existingIds.includes(args.skill_id)) return;

    await ctx.db.patch(args.knowledge_id, {
      linked_skill_ids: [...existingIds, args.skill_id],
      updated_at: Date.now(),
    });
  },
});

/** Promote a hub post to a knowledge item */
export const promotePost = mutation({
  args: {
    post_id: v.id("hub_posts"),
    knowledge_type: v.union(
      v.literal("pattern"),
      v.literal("guide"),
      v.literal("signal"),
      v.literal("fragment")
    ),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.post_id);
    if (!post) throw new Error("Post not found");

    const now = Date.now();

    const knowledgeId = await ctx.db.insert("hub_knowledge", {
      hub_id: post.hub_id,
      knowledge_type: args.knowledge_type,
      title: post.title,
      body: post.body,
      status: "proposed",
      confidence: 0.5,
      contributor_agent_id: post.agent_id,
      contributor_platform: post.agent_platform,
      linked_skill_ids: post.linked_skill_id ? [post.linked_skill_id as string] : undefined,
      linked_learning_ids: post.linked_learning_id ? [post.linked_learning_id as string] : undefined,
      validation_count: 0,
      contradiction_count: 0,
      created_at: now,
      updated_at: now,
    });

    // Mark post as promoted
    await ctx.db.patch(args.post_id, { status: "promoted" });

    // Update hub knowledge count
    const hub = await ctx.db.get(post.hub_id);
    if (hub) {
      await ctx.db.patch(post.hub_id, {
        knowledge_count: (hub.knowledge_count ?? 0) + 1,
        last_activity_at: now,
      });
    }

    return knowledgeId;
  },
});

// ── Internal Mutations (for crons & system use) ─────────────────

/** Auto-validate knowledge from execution results */
export const autoValidateFromExecution = internalMutation({
  args: {
    skill_id: v.id("skills"),
    agent_id: v.string(),
    agent_platform: v.string(),
    success: v.boolean(),
    learning_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find knowledge items linked to this skill
    const allKnowledge = await ctx.db
      .query("hub_knowledge")
      .withIndex("by_status", (q) => q.eq("status", "verified"))
      .take(200);

    const relevant = allKnowledge.filter(
      (k) =>
        k.linked_skill_ids?.includes(args.skill_id as string) &&
        (k.knowledge_type === "pattern" || k.knowledge_type === "guide")
    );

    if (relevant.length === 0) return { validated: 0 };

    // Get agent reputation
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agent_id", args.agent_id))
      .first();
    const reputation = agent?.reputation ?? 0.3;

    let validated = 0;
    const now = Date.now();

    for (const knowledge of relevant.slice(0, 5)) {
      // Check if already validated by this agent
      const existing = await ctx.db
        .query("hub_validations")
        .withIndex("by_agent", (q) => q.eq("agent_id", args.agent_id))
        .filter((q) => q.eq(q.field("knowledge_id"), knowledge._id))
        .first();

      if (existing) continue;

      const validationType = args.success ? "confirm" : "contradict";

      await ctx.db.insert("hub_validations", {
        knowledge_id: knowledge._id,
        agent_id: args.agent_id,
        agent_platform: args.agent_platform,
        validation_type: validationType,
        evidence: {
          learning_id: args.learning_id,
          success: args.success,
          notes: `Auto-validated from execution of ${args.skill_id}`,
        },
        agent_reputation: reputation,
        created_at: now,
      });

      // Update counts
      const patch: Record<string, any> = {
        last_validated_at: now,
        updated_at: now,
      };
      if (validationType === "confirm") {
        patch.validation_count = knowledge.validation_count + 1;
      } else {
        patch.contradiction_count = knowledge.contradiction_count + 1;
      }
      await ctx.db.patch(knowledge._id, patch);

      validated++;
    }

    return { validated };
  },
});

/** Decay signal relevance scores (called by cron) */
export const decaySignals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const signals = await ctx.db
      .query("hub_knowledge")
      .withIndex("by_type", (q) => q.eq("knowledge_type", "signal"))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "verified"),
          q.eq(q.field("status"), "proposed")
        )
      )
      .take(200);

    let decayed = 0;
    let archived = 0;
    const now = Date.now();
    const DECAY_FACTOR = 0.95; // Per day

    for (const signal of signals) {
      const currentRelevance = signal.relevance_score ?? 1.0;
      const newRelevance = currentRelevance * DECAY_FACTOR;

      if (newRelevance < 0.1) {
        await ctx.db.patch(signal._id, {
          status: "archived",
          relevance_score: newRelevance,
          updated_at: now,
        });
        archived++;
      } else {
        await ctx.db.patch(signal._id, {
          relevance_score: newRelevance,
          updated_at: now,
        });
        decayed++;
      }
    }

    return { decayed, archived };
  },
});

/** Suggest fragment absorption into guides (called by cron) */
export const suggestFragmentAbsorption = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fragments = await ctx.db
      .query("hub_knowledge")
      .withIndex("by_type", (q) => q.eq("knowledge_type", "fragment"))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "archived"),
          q.gte(q.field("reference_count"), 5)
        )
      )
      .take(50);

    let suggested = 0;
    const now = Date.now();

    for (const fragment of fragments) {
      if (fragment.absorbed_into) continue;

      // Find guides in the same hub
      const guides = await ctx.db
        .query("hub_knowledge")
        .withIndex("by_hub_type", (q) =>
          q.eq("hub_id", fragment.hub_id).eq("knowledge_type", "guide")
        )
        .filter((q) => q.neq(q.field("status"), "archived"))
        .take(5);

      if (guides.length === 0) continue;

      // Create an edit proposal for the most relevant guide
      const guide = guides[0];
      await ctx.db.insert("hub_guide_edits", {
        knowledge_id: guide._id,
        proposed_body: guide.body + `\n\n## ${fragment.title}\n\n${fragment.body}`,
        diff_summary: `Absorb fragment: ${fragment.title} (referenced ${fragment.reference_count ?? 0} times)`,
        edit_type: "expansion",
        author_agent_id: "system-absorption",
        author_reputation: 1.0,
        status: "proposed",
        created_at: now,
      });

      suggested++;
    }

    return { suggested };
  },
});

/** Flag stale guide sections (called by cron) */
export const flagStaleGuides = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const guides = await ctx.db
      .query("hub_knowledge")
      .withIndex("by_type", (q) => q.eq("knowledge_type", "guide"))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "archived"),
          q.or(
            q.eq(q.field("last_validated_at"), undefined),
            q.lt(q.field("last_validated_at"), thirtyDaysAgo)
          )
        )
      )
      .take(100);

    let flagged = 0;
    const now = Date.now();

    for (const guide of guides) {
      if (!guide.last_validated_at || guide.last_validated_at < thirtyDaysAgo) {
        await ctx.db.patch(guide._id, {
          stale_sections: ["entire-guide"],
          updated_at: now,
        });
        flagged++;
      }
    }

    return { flagged };
  },
});

/** Check and auto-promote maintainers (called by cron) */
export const checkMaintainerEligibility = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find agents with significant hub contributions
    const recentKnowledge = await ctx.db
      .query("hub_knowledge")
      .withIndex("by_status", (q) => q.eq("status", "verified"))
      .take(500);

    // Group contributions by hub and agent
    const hubAgentContributions: Map<string, Map<string, number>> = new Map();

    for (const item of recentKnowledge) {
      const hubId = item.hub_id as string;
      if (!hubAgentContributions.has(hubId)) {
        hubAgentContributions.set(hubId, new Map());
      }
      const agentMap = hubAgentContributions.get(hubId)!;
      const current = agentMap.get(item.contributor_agent_id) ?? 0;
      agentMap.set(item.contributor_agent_id, current + 1);
    }

    let promoted = 0;
    const now = Date.now();

    for (const [hubId, agentMap] of hubAgentContributions) {
      for (const [agentId, contributions] of agentMap) {
        if (contributions < 10) continue;

        // Check agent reputation
        const agent = await ctx.db
          .query("agents")
          .withIndex("by_agent_id", (q) => q.eq("agent_id", agentId))
          .first();

        if (!agent || agent.reputation < 0.7) continue;

        // Check if already a maintainer
        const existing = await ctx.db
          .query("hub_maintainers")
          .withIndex("by_agent", (q) => q.eq("agent_id", agentId))
          .filter((q) => q.eq(q.field("hub_id"), hubId as any))
          .first();

        if (existing) continue;

        // Auto-promote
        await ctx.db.insert("hub_maintainers", {
          hub_id: hubId as any,
          agent_id: agentId,
          role: "maintainer",
          appointed_at: now,
          appointed_by: "system",
          hub_reputation: agent.reputation,
          contributions,
          validations: 0,
          status: "active",
        });

        // Update hub maintainer list
        const hub = await ctx.db.get(hubId as any) as any;
        if (hub) {
          const existingMaintainers = hub.maintainer_agent_ids ?? [];
          if (!existingMaintainers.includes(agentId)) {
            await ctx.db.patch(hubId as any, {
              maintainer_agent_ids: [...existingMaintainers, agentId],
            });
          }
        }

        promoted++;
      }
    }

    return { promoted };
  },
});

/** Auto-create a signal in the matching hub when a learning is submitted */
export const createSignalFromLearning = internalMutation({
  args: {
    skill_id: v.id("skills"),
    learning_summary: v.string(),
    agent_id: v.string(),
    agent_platform: v.string(),
    learning_id: v.string(),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Find the skill to get its category/tags
    const skill = await ctx.db.get(args.skill_id);
    if (!skill) return;

    // Find a hub that matches the skill category
    const categoryHub = await ctx.db
      .query("hubs")
      .withIndex("by_name", (q) => q.eq("name", skill.category))
      .first();

    if (!categoryHub) return;

    // Create a signal knowledge item
    await ctx.db.insert("hub_knowledge", {
      hub_id: categoryHub._id,
      knowledge_type: "signal",
      title: `${skill.display_name || skill.name}: ${args.success ? "Success" : "Issue"} Report`,
      body: args.learning_summary,
      status: "proposed",
      confidence: args.success ? 0.5 : 0.3,
      contributor_agent_id: args.agent_id,
      contributor_platform: args.agent_platform,
      linked_skill_ids: [args.skill_id as string],
      linked_learning_ids: [args.learning_id],
      relevance_score: 1.0,
      validation_count: 0,
      contradiction_count: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    // Update hub knowledge count
    await ctx.db.patch(categoryHub._id, {
      knowledge_count: (categoryHub.knowledge_count ?? 0) + 1,
      last_activity_at: Date.now(),
    });
  },
});

/** Unified cross-type search: skills, knowledge, souls, workflows */
export const searchAll = query({
  args: {
    query: v.string(),
    types: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const types = args.types ?? ["skill", "knowledge", "soul", "workflow"];
    const results: {
      id: string;
      type: string;
      title: string;
      description: string;
      confidence?: number;
    }[] = [];

    // Search knowledge items
    if (types.includes("knowledge")) {
      const knowledgeResults = await ctx.db
        .query("hub_knowledge")
        .withSearchIndex("search_knowledge", (q) => q.search("title", args.query))
        .take(limit);

      for (const k of knowledgeResults) {
        results.push({
          id: k._id,
          type: "knowledge",
          title: k.title,
          description: k.body.slice(0, 200),
          confidence: k.confidence,
        });
      }
    }

    // Search skills
    if (types.includes("skill")) {
      try {
        const skillResults = await ctx.db
          .query("skills")
          .withSearchIndex("search_skills", (q) => q.search("description", args.query))
          .take(limit);

        for (const s of skillResults) {
          results.push({
            id: s._id,
            type: "skill",
            title: s.display_name || s.name,
            description: s.description?.slice(0, 200) ?? "",
            confidence: s.confidence,
          });
        }
      } catch {
        // search index may not exist
      }
    }

    // Search souls
    if (types.includes("soul")) {
      try {
        const soulResults = await ctx.db
          .query("souls")
          .withSearchIndex("search_souls", (q) => q.search("description", args.query))
          .take(limit);

        for (const s of soulResults) {
          results.push({
            id: s._id,
            type: "soul",
            title: s.name,
            description: s.description?.slice(0, 200) ?? "",
          });
        }
      } catch {
        // search index may not exist
      }
    }

    // Search workflows
    if (types.includes("workflow")) {
      try {
        const workflowResults = await ctx.db
          .query("workflows")
          .withSearchIndex("search_workflows", (q) => q.search("description", args.query))
          .take(limit);

        for (const w of workflowResults) {
          results.push({
            id: w._id,
            type: "workflow",
            title: w.name,
            description: w.description?.slice(0, 200) ?? "",
          });
        }
      } catch {
        // search index may not exist
      }
    }

    return results.slice(0, limit);
  },
});

// ── Helpers ────────────────────────────────────────────────────────

/** Recompute hub aggregate confidence */
async function updateHubConfidence(ctx: any, hubId: any) {
  const knowledge = await ctx.db
    .query("hub_knowledge")
    .withIndex("by_hub", (q: any) => q.eq("hub_id", hubId))
    .filter((q: any) =>
      q.and(
        q.neq(q.field("status"), "archived"),
        q.neq(q.field("status"), "refuted")
      )
    )
    .collect();

  if (knowledge.length === 0) return;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const k of knowledge) {
    const weight = k.validation_count + 1; // +1 to count initial contribution
    weightedSum += k.confidence * weight;
    totalWeight += weight;
  }

  const aggregateConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  await ctx.db.patch(hubId, {
    aggregate_confidence: aggregateConfidence,
    knowledge_count: knowledge.length,
  });
}
