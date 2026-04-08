// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================================
// Queries - Fetch workspace events
// ============================================================================

/** Get workspace by machine ID (useful for page routing context). */
export const getByMachineId = query({
  args: { machine_id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .filter((q) => q.eq(q.field("fly_machine_id"), args.machine_id))
      .first();
  },
});

/** Get recent workspace events for a specific workspace. */
export const getRecentEvents = query({
  args: {
    workspace_id: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    return await ctx.db
      .query("workspace_events")
      .withIndex("by_workspace_created", (q) =>
        q.eq("workspace_id", args.workspace_id)
      )
      .order("desc")
      .take(limit);
  },
});

/** Get workspace events by type. */
export const getEventsByType = query({
  args: {
    workspace_id: v.id("workspaces"),
    type: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    return await ctx.db
      .query("workspace_events")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .order("desc")
      .take(limit);
  },
});

// ============================================================================
// Mutations - Create workspace events
// ============================================================================

/** Log a workspace event. */
export const logEvent = mutation({
  args: {
    workspace_id: v.id("workspaces"),
    type: v.union(
      v.literal("machine_started"),
      v.literal("machine_stopped"),
      v.literal("machine_starting"),
      v.literal("openclaw_online"),
      v.literal("openclaw_offline"),
      v.literal("terminal_online"),
      v.literal("terminal_offline"),
      v.literal("status_check"),
      v.literal("custom")
    ),
    message: v.string(),
    icon: v.optional(v.string()),
    machine_id: v.optional(v.string()),
    user_id: v.optional(v.string()),
    agent_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workspace_events", {
      workspace_id: args.workspace_id,
      type: args.type,
      message: args.message,
      icon: args.icon,
      machine_id: args.machine_id,
      user_id: args.user_id,
      agent_id: args.agent_id,
      created_at: Date.now(),
    });
  },
});

/** Clear all events for a workspace. */
export const clearEvents = mutation({
  args: {
    workspace_id: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("workspace_events")
      .withIndex("by_workspace", (q) =>
        q.eq("workspace_id", args.workspace_id)
      )
      .collect();

    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    return { deleted: events.length };
  },
});
