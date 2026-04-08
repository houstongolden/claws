// @ts-nocheck
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Record a commit from a workspace (called by stats-server fire-and-forget)
export const recordCommit = mutation({
  args: {
    hub_id: v.string(),
    sha: v.string(),
    short_sha: v.string(),
    message: v.string(),
    author: v.string(),
    files_changed: v.number(),
    commit_type: v.union(
      v.literal("initial"),
      v.literal("manual"),
      v.literal("auto"),
      v.literal("rollback"),
      v.literal("export")
    ),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Deduplicate by SHA
    const existing = await ctx.db
      .query("workspace_commits")
      .withIndex("by_sha", (q) => q.eq("sha", args.sha))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("workspace_commits", args);
  },
});

// List commits for a hub, paginated, newest first
export const listCommits = query({
  args: {
    hub_id: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const commits = await ctx.db
      .query("workspace_commits")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id))
      .order("desc")
      .take(limit);
    return commits;
  },
});

// Get a single commit by SHA
export const getCommit = query({
  args: { sha: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspace_commits")
      .withIndex("by_sha", (q) => q.eq("sha", args.sha))
      .first();
  },
});

// Get total commit count for a hub
export const getCommitCount = query({
  args: { hub_id: v.string() },
  handler: async (ctx, args) => {
    const commits = await ctx.db
      .query("workspace_commits")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id))
      .collect();
    return commits.length;
  },
});
