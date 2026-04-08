// @ts-nocheck — Schema type instantiation exceeds depth limit with 97+ tables
// This is a known Convex limitation; runtime validation still works correctly.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Queries ──

export const list = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("studio_sessions")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .order("desc")
      .take(args.limit ?? 20);
    return sessions;
  },
});

export const get = query({
  args: { id: v.id("studio_sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByShareId = query({
  args: { shareId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("studio_sessions")
      .withIndex("by_share_id", (q) => q.eq("share_id", args.shareId))
      .first();
    return session;
  },
});

// ── Mutations ──

export const create = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    files: v.array(v.object({ path: v.string(), content: v.string() })),
    forkedFrom: v.optional(v.string()),
    selectedSkills: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("studio_sessions", {
      user_id: args.userId,
      title: args.title,
      files: args.files,
      forked_from: args.forkedFrom,
      selected_skills: args.selectedSkills ?? [],
      generations: [],
      status: "draft",
      created_at: now,
      updated_at: now,
    });
    return id;
  },
});

export const save = mutation({
  args: {
    id: v.id("studio_sessions"),
    files: v.array(v.object({ path: v.string(), content: v.string() })),
    title: v.optional(v.string()),
    selectedSkills: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      files: args.files,
      updated_at: Date.now(),
    };
    if (args.title !== undefined) updates.title = args.title;
    if (args.selectedSkills !== undefined) updates.selected_skills = args.selectedSkills;
    await ctx.db.patch(args.id, updates);
  },
});

export const addGeneration = mutation({
  args: {
    id: v.id("studio_sessions"),
    prompt: v.string(),
    model: v.string(),
    filesGenerated: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found");

    const generations = session.generations ?? [];
    generations.push({
      prompt: args.prompt,
      model: args.model,
      files_generated: args.filesGenerated,
      timestamp: Date.now(),
    });

    await ctx.db.patch(args.id, {
      generations,
      updated_at: Date.now(),
    });
  },
});

export const setShareId = mutation({
  args: {
    id: v.id("studio_sessions"),
    shareId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      share_id: args.shareId,
      updated_at: Date.now(),
    });
    return args.shareId;
  },
});

export const remove = mutation({
  args: { id: v.id("studio_sessions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
