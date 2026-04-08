// @ts-nocheck
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType =
  | "workspace_join"
  | "workspace_create"
  | "profile_update"
  | "agent_run"
  | "skill_install"
  | "deploy"
  | "connect"
  | "login"
  | "generic";

// ─── Query: live feed (last 50, newest first) ─────────────────────────────────

export const getFeed = query({
  args: {
    workspaceId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);

    if (args.workspaceId) {
      // Workspace-scoped feed
      return await ctx.db
        .query("workspace_activity")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(limit);
    }

    // Global platform feed (newest first)
    return await ctx.db
      .query("workspace_activity")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

// ─── Mutation: write an activity event ───────────────────────────────────────

export const logActivity = mutation({
  args: {
    workspaceId: v.optional(v.string()),
    type: v.union(
      v.literal("workspace_join"),
      v.literal("workspace_create"),
      v.literal("profile_update"),
      v.literal("agent_run"),
      v.literal("skill_install"),
      v.literal("deploy"),
      v.literal("connect"),
      v.literal("login"),
      v.literal("generic")
    ),
    message: v.string(),
    actorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workspace_activity", {
      workspaceId: args.workspaceId,
      type: args.type,
      message: args.message,
      actorId: args.actorId,
      timestamp: Date.now(),
    });
  },
});
