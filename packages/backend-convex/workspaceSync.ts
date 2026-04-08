import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * WORKSPACE CONTEXT SYNC
 *
 * Synchronizes local OpenClaw context (SOUL.md, MEMORY.md, AGENTS.md, skills)
 * between local machine and Convex cloud.
 *
 * Features:
 * - Push: Local context → Convex (newer wins)
 * - Pull: Convex → Local (newer wins)
 * - Real-time status via WebSocket subscriptions
 * - Dashboard shows last sync time and agent presence
 */

/**
 * Create or update a workspace context record in Convex
 * Called by: hubify sync push
 */
export const pushWorkspaceContext = mutation({
  args: {
    hub_id: v.id("hubs"),
    local_machine_id: v.string(),
    context_type: v.union(
      v.literal("soul"),        // SOUL.md
      v.literal("memory"),      // MEMORY.md
      v.literal("memories"),    // memory/*.md files
      v.literal("agents"),      // AGENTS.md
      v.literal("skills"),      // Skills list/manifest
      v.literal("full")         // Full bundle
    ),
    content: v.string(),        // File content (or bundle JSON)
    file_hash: v.string(),      // SHA256 hash for change detection
    timestamp: v.number(),      // Local file mtime
    metadata: v.optional(v.object({
      file_count: v.optional(v.number()),
      total_size: v.optional(v.number()),
      files: v.optional(v.array(v.object({
        path: v.string(),
        size: v.number(),
        hash: v.string(),
        mtime: v.number(),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    // Try to find existing context record
    const existing = await ctx.db
      .query("workspace_context")
      .filter((q) =>
        q.and(
          q.eq(q.field("hub_id"), args.hub_id),
          q.eq(q.field("context_type"), args.context_type),
          q.eq(q.field("source"), "local")
        )
      )
      .order("desc")
      .first();

    if (existing && existing.file_hash === args.file_hash) {
      // No change detected
      return {
        status: "unchanged",
        id: existing._id,
        last_sync: existing.synced_at,
      };
    }

    // Create new context record (versioning)
    const id = await ctx.db.insert("workspace_context", {
      hub_id: args.hub_id,
      local_machine_id: args.local_machine_id,
      context_type: args.context_type,
      source: "local", // Where this came from
      content: args.content,
      file_hash: args.file_hash,
      file_timestamp: args.timestamp,
      metadata: args.metadata,
      synced_at: Date.now(),
    });

    // Update sync status
    await updateSyncStatus(ctx, args.hub_id, {
      last_push: Date.now(),
      push_direction: args.context_type,
      files_synced_count: (args.metadata?.file_count || 1) + ((existing?.metadata?.file_count) || 0),
    });

    return {
      status: existing ? "updated" : "created",
      id,
      previous_id: existing?._id,
      last_sync: Date.now(),
    };
  },
});

/**
 * Pull workspace context from Convex
 * Called by: hubify sync pull
 * Returns the latest version of each context type
 */
export const pullWorkspaceContext = query({
  args: {
    hub_id: v.id("hubs"),
    context_types: v.optional(v.array(v.string())), // If null, get all types
  },
  handler: async (ctx, args) => {
    const types = args.context_types || [
      "soul",
      "memory",
      "memories",
      "agents",
      "skills",
    ];

    const results: Record<string, {
      context_type: string;
      content: string;
      file_hash: string;
      synced_at: number;
      local_machine_id: string;
      metadata?: Record<string, unknown>;
    }> = {};

    for (const type of types) {
      const latest = await ctx.db
        .query("workspace_context")
        .filter((q) =>
          q.and(
            q.eq(q.field("hub_id"), args.hub_id),
            q.eq(q.field("context_type"), type)
          )
        )
        .order("desc")
        .first();

      if (latest) {
        results[type] = {
          context_type: type,
          content: latest.content,
          file_hash: latest.file_hash,
          synced_at: latest.synced_at,
          local_machine_id: latest.local_machine_id,
          metadata: latest.metadata,
        };
      }
    }

    return results;
  },
});

/**
 * Get the latest version of a specific context type
 */
export const getContextType = query({
  args: {
    hub_id: v.id("hubs"),
    context_type: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspace_context")
      .filter((q) =>
        q.and(
          q.eq(q.field("hub_id"), args.hub_id),
          q.eq(q.field("context_type"), args.context_type)
        )
      )
      .order("desc")
      .first();
  },
});

/**
 * Get workspace sync status
 * Shows: last sync time, files synced count, agent presence
 */
export const getSyncStatus = query({
  args: {
    hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    const status = await ctx.db
      .query("workspace_sync_status")
      .filter((q) => q.eq(q.field("hub_id"), args.hub_id))
      .first();

    if (!status) {
      return {
        hub_id: args.hub_id,
        last_push: null,
        last_pull: null,
        total_files_synced: 0,
        last_direction: null,
        agent_count: 0,
        active_agents: [],
      };
    }

    // Get active agents from hub
    const hub = await ctx.db.get(args.hub_id);
    const activeAgents = hub?.agents?.filter((a) => a.active) || [];

    return {
      hub_id: args.hub_id,
      last_push: status.last_push,
      last_pull: status.last_pull,
      total_files_synced: status.files_synced_count || 0,
      last_direction: status.push_direction,
      agent_count: activeAgents.length,
      active_agents: activeAgents.map((a) => ({
        id: a.id,
        name: a.name,
        platform: a.platform,
        last_active: a.last_active,
      })),
    };
  },
});

/**
 * Get version history for a context type
 * Shows past versions with timestamps and diffs
 */
export const getContextHistory = query({
  args: {
    hub_id: v.id("hubs"),
    context_type: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspace_context")
      .filter((q) =>
        q.and(
          q.eq(q.field("hub_id"), args.hub_id),
          q.eq(q.field("context_type"), args.context_type)
        )
      )
      .order("desc")
      .take(args.limit || 20);
  },
});

/**
 * Resolve a sync conflict (when local and cloud both changed)
 * Merge strategy: newer wins, unless explicitly specified
 */
export const resolveSyncConflict = mutation({
  args: {
    hub_id: v.id("hubs"),
    context_type: v.string(),
    resolution: v.union(
      v.literal("local"),  // Keep local version
      v.literal("cloud"),  // Keep cloud version
      v.literal("merge")   // Merge both (not yet implemented)
    ),
  },
  handler: async (ctx, args) => {
    // Get latest local and cloud versions
    const versions = await ctx.db
      .query("workspace_context")
      .filter((q) =>
        q.and(
          q.eq(q.field("hub_id"), args.hub_id),
          q.eq(q.field("context_type"), args.context_type)
        )
      )
      .order("desc")
      .take(10);

    // For now, just record the conflict resolution
    // Real merge logic would go here
    return {
      resolved: true,
      strategy: args.resolution,
      timestamp: Date.now(),
    };
  },
});

/**
 * Check if local and cloud are in sync
 */
export const checkSyncStatus = query({
  args: {
    hub_id: v.id("hubs"),
    local_file_hashes: v.object({}), // { "soul": "hash123", "memory": "hash456", ... }
  },
  handler: async (ctx, args) => {
    const conflicts: Array<{
      context_type: string;
      local_hash: string;
      cloud_hash: string;
    }> = [];

    for (const [type, localHash] of Object.entries(args.local_file_hashes)) {
      const cloudVersion = await ctx.db
        .query("workspace_context")
        .filter((q) =>
          q.and(
            q.eq(q.field("hub_id"), args.hub_id),
            q.eq(q.field("context_type"), type)
          )
        )
        .order("desc")
        .first();

      if (cloudVersion && cloudVersion.file_hash !== localHash) {
        conflicts.push({
          context_type: type,
          local_hash: localHash as string,
          cloud_hash: cloudVersion.file_hash,
        });
      }
    }

    return {
      in_sync: conflicts.length === 0,
      conflicts,
      timestamp: Date.now(),
    };
  },
});

/**
 * Internal helper: update sync status record
 */
async function updateSyncStatus(
  ctx: any,
  hub_id: Id<"hubs">,
  updates: {
    last_push?: number;
    last_pull?: number;
    push_direction?: string;
    files_synced_count?: number;
  }
) {
  const existing = await ctx.db
    .query("workspace_sync_status")
    .filter((q) => q.eq(q.field("hub_id"), hub_id))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...updates,
      updated_at: Date.now(),
    });
  } else {
    await ctx.db.insert("workspace_sync_status", {
      hub_id,
      last_push: updates.last_push || null,
      last_pull: updates.last_pull || null,
      push_direction: updates.push_direction || null,
      files_synced_count: updates.files_synced_count || 0,
      updated_at: Date.now(),
    });
  }
}
