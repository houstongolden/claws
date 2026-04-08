// @ts-nocheck
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { bumpHubLearningAdded } from "./stats";

/**
 * Add a new learning
 */
export const addLearning = mutation({
  args: {
    hub_id: v.id("hubs"),
    agent_id: v.string(),
    platform: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    confidence: v.number(),
    contribute_to_global: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (args.confidence < 0 || args.confidence > 1) {
      throw new Error("Confidence must be between 0 and 1");
    }

    const learning = await ctx.db.insert("hub_learnings", {
      hub_id: args.hub_id,
      agent_id: args.agent_id,
      platform: args.platform,
      content: args.content,
      tags: args.tags,
      confidence: args.confidence,
      contribute_to_global: args.contribute_to_global,
      validated_by: [],
      contradiction_count: 0,
      created_at: Date.now(),
    });

    // Update global stats
    await bumpHubLearningAdded(ctx);

    return learning;
  },
});

/**
 * Get learnings for a hub, sorted by confidence descending
 */
export const getLearnings = query({
  args: {
    hub_id: v.id("hubs"),
    limit: v.optional(v.number()),
    min_confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const minConfidence = args.min_confidence || 0;

    const learnings = await ctx.db
      .query("hub_learnings")
      .withIndex("by_hub_confidence", (q) =>
        q.eq("hub_id", args.hub_id)
      )
      .order("desc")
      .collect();

    return learnings
      .filter((l) => l.confidence >= minConfidence)
      .slice(0, limit);
  },
});

/**
 * Get learnings by agent
 */
export const getLearningsByAgent = query({
  args: {
    hub_id: v.id("hubs"),
    agent_id: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    return await ctx.db
      .query("hub_learnings")
      .withIndex("by_agent", (q) =>
        q.eq("agent_id", args.agent_id)
      )
      .order("desc")
      .take(limit);
  },
});

/**
 * Get a single learning by ID
 */
export const getLearning = query({
  args: {
    learning_id: v.id("hub_learnings"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.learning_id);
  },
});

/**
 * Validate a learning (add agent to validated_by)
 */
export const validateLearning = mutation({
  args: {
    learning_id: v.id("hub_learnings"),
    agent_id: v.string(),
  },
  handler: async (ctx, args) => {
    const learning = await ctx.db.get(args.learning_id);
    if (!learning) throw new Error("Learning not found");

    // Check if already validated by this agent
    if (!learning.validated_by.includes(args.agent_id)) {
      learning.validated_by.push(args.agent_id);
    }

    await ctx.db.patch(args.learning_id, {
      validated_by: learning.validated_by,
    });

    return await ctx.db.get(args.learning_id);
  },
});

/**
 * Mark a contradiction for a learning
 */
export const markContradiction = mutation({
  args: {
    learning_id: v.id("hub_learnings"),
  },
  handler: async (ctx, args) => {
    const learning = await ctx.db.get(args.learning_id);
    if (!learning) throw new Error("Learning not found");

    await ctx.db.patch(args.learning_id, {
      contradiction_count: learning.contradiction_count + 1,
    });

    return await ctx.db.get(args.learning_id);
  },
});

/**
 * Search learnings by tag or content
 */
export const searchLearnings = query({
  args: {
    hub_id: v.id("hubs"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const queryLower = args.query.toLowerCase();

    const learnings = await ctx.db
      .query("hub_learnings")
      .withIndex("by_hub_confidence", (q) =>
        q.eq("hub_id", args.hub_id)
      )
      .collect();

    const scored = learnings
      .map((l) => {
        const contentMatch = l.content.toLowerCase().includes(queryLower)
          ? 2
          : 0;
        const tagMatch = l.tags.filter((t) =>
          t.toLowerCase().includes(queryLower)
        ).length;
        return {
          learning: l,
          score: contentMatch + tagMatch + l.confidence,
        };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => s.learning);
  },
});

/**
 * Get global learnings (opt-in only)
 */
export const getGlobalLearnings = query({
  args: {
    limit: v.optional(v.number()),
    min_confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const minConfidence = args.min_confidence || 0.7;

    // Query all hubs that have opted into global contribution
    const allLearnings = await ctx.db
      .query("hub_learnings")
      .collect();

    // Filter for high-confidence, global-opt-in learnings
    const scored = allLearnings
      .filter((l) => l.contribute_to_global && l.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);

    return scored;
  },
});
