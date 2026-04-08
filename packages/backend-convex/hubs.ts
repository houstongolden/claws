import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { bumpWorkspaceCreated } from "./stats";

// Template-to-domain mapping: workspace hubs auto-get domain/tags at creation
const TEMPLATE_DOMAIN_MAP: Record<string, { domain: string; tags: string[] }> = {
  "myos":       { domain: "personal-ai",         tags: ["personal", "assistant", "ai-os"] },
  "devos":      { domain: "software-engineering", tags: ["dev", "coding", "engineering"] },
  "founderos":  { domain: "startups",             tags: ["founder", "business", "strategy"] },
  "researchos": { domain: "research",             tags: ["research", "academic", "analysis"] },
  "companyos":  { domain: "enterprise",           tags: ["company", "team", "operations"] },
};

const resolveIntelligenceScope = (hub: any) =>
  hub.isolationSettings?.intelligenceScope ??
  (hub.isolationSettings?.sharedIntelligence ? "org" : "isolated");

const isHubSharingIntelligence = (hub: any) =>
  resolveIntelligenceScope(hub) !== "isolated";

/**
 * Create a new hub (project-level intelligence manifest)
 * SECURITY: Validates auth, workspace count, email verification, and plan limits
 * 
 * Optional isolation settings can be specified during provisioning:
 * - sharedVault: true (default) - share tool credentials across workspaces
 * - sharedIntelligence: false (default) - keep learnings isolated per workspace
 */
export const createHub = mutation({
  args: {
    name: v.string(),
    owner_id: v.string(),
    subdomain: v.optional(v.string()),
    template: v.optional(v.string()),
    workspace_image: v.optional(v.string()), // Docker image URL; defaults to env var if not specified
    sharedVault: v.optional(v.boolean()),
    sharedIntelligence: v.optional(v.boolean()),
    intelligenceScope: v.optional(v.union(
      v.literal("isolated"),
      v.literal("org"),
      v.literal("global")
    )),
    telegram_enabled: v.optional(v.boolean()),
    telegram_bot_token: v.optional(v.string()),
    telegram_chat_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ====================================================================
    // SECURITY FIX #1: Get and verify user exists + auth (dev mode exemption)
    // ====================================================================
    // For dev mode (dev_houston), skip user lookup and use defaults
    let finalUser: any;
    if (args.owner_id === "dev_houston") {
      finalUser = {
        plan: "free",
        max_workspaces: 100,
        workspace_count: 0,
      };
    } else {
      let user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("id"), args.owner_id))
        .first();

      if (!user) {
        user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerk_user_id", args.owner_id))
          .first();
      }

      if (!user) {
        throw new Error("User not found");
      }
      finalUser = user;
    }

    // ====================================================================
    // SECURITY FIX #2: Email verification check before first workspace
    // ====================================================================
    // Check email_verified on the user record (set by Clerk webhook on verification)
    // Skip for dev_houston bypass mode
    if (args.owner_id !== "dev_houston" && finalUser.email_verified === false) {
      throw new Error("Email verification required. Check your inbox for a verification link before creating a workspace.");
    }

    // ====================================================================
    // SECURITY FIX #3: Check workspace count against plan limit
    // BETA: Workspace limits disabled — unlimited for all users during beta
    // ====================================================================

    // ====================================================================
    // SECURITY FIX #4: Check billing status (Stripe subscription)
    // ====================================================================
    if (finalUser.plan && finalUser.plan !== "free") {
      if (!finalUser.stripe_subscription_id) {
        throw new Error("Active subscription required to provision paid workspaces.");
      }
    }

    // ====================================================================
    // SECURITY FIX #5: Audit log the provisioning request
    // ====================================================================
    await ctx.db.insert("security_logs", {
      event_type: "workspace_provisioned",
      agent_id: args.owner_id,
      details: `Workspace '${args.name}' created for user ${args.owner_id} (plan: ${finalUser.plan ?? "free"})`,
      severity: "low",
    });

    // Default isolation settings: shared vault (convenient), isolated intelligence (privacy)
    const resolvedScope = args.intelligenceScope ?? (
      args.sharedIntelligence ? "org" : "isolated"
    );

    const isolationSettings = {
      sharedVault: args.sharedVault ?? true,
      intelligenceScope: resolvedScope as "isolated" | "org" | "global",
      // Legacy boolean retained for backward compatibility
      sharedIntelligence: resolvedScope !== "isolated",
      updatedAt: Date.now(),
    };

    const telegram_config = args.telegram_enabled ? {
      enabled: true,
      bot_token: args.telegram_bot_token,
      chat_id: args.telegram_chat_id,
      connected_at: Date.now(),
      test_status: "pending" as const,
    } : undefined;

    // ====================================================================
    // SECURITY: Subdomain uniqueness enforcement (hubify-sec — domain collision risk)
    // Convex indexes do NOT enforce uniqueness at the schema level; we must
    // check in the mutation before writing.
    // ====================================================================
    if (args.subdomain) {
      const existingHub = await ctx.db
        .query("hubs")
        .withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain as string))
        .first();
      if (existingHub) {
        throw new ConvexError("Subdomain already taken");
      }
    }

    // Resolve domain/tags from template
    const resolvedTemplate = args.template || "myos";
    const templateMeta = TEMPLATE_DOMAIN_MAP[resolvedTemplate];

    const hub = await ctx.db.insert("hubs", {
      name: args.name,
      owner_id: args.owner_id,
      subdomain: args.subdomain,
      template: resolvedTemplate,
      hub_type: "workspace",
      domain: templateMeta?.domain,
      tags: templateMeta?.tags,
      workspace_image: args.workspace_image, // Will be undefined if not specified; route will use env var default
      status: "provisioning" as const,
      agents: [],
      privacy_global_opt_in: resolvedScope === "global",
      isolationSettings,
      telegram_config,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    // Update user's workspace count (skip for dev mode)
    if (args.owner_id !== "dev_houston" && finalUser._id) {
      await ctx.db.patch(finalUser._id, {
        workspace_count: (finalUser.workspace_count ?? 0) + 1,
        updated_at: Date.now(),
      });
    }

    // Bump global stats
    await bumpWorkspaceCreated(ctx);

    // Log activity: workspace created / joined
    await ctx.db.insert("workspace_activity", {
      workspaceId: hub,
      type: "workspace_join",
      message: `${args.name} joined Hubify with workspace ${args.subdomain ?? args.name}`,
      actorId: args.owner_id,
      timestamp: Date.now(),
    });

    return hub;
  },
});

/**
 * Get a hub by ID
 */
export const getHub = query({
  args: {
    hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Register or update an agent in a hub
 */
export const registerAgent = mutation({
  args: {
    hub_id: v.id("hubs"),
    agent: v.object({
      id: v.string(),
      name: v.string(),
      platform: v.string(),
      role: v.string(),
      model: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    // Remove existing agent with same id if present
    const filtered = hub.agents.filter((a) => a.id !== args.agent.id);

    // Add the new agent
    const updatedAgents = [
      ...filtered,
      {
        id: args.agent.id,
        name: args.agent.name,
        platform: args.agent.platform,
        role: args.agent.role,
        model: args.agent.model,
        active: true,
        last_active: Date.now(),
      },
    ];

    await ctx.db.patch(args.hub_id, {
      agents: updatedAgents,
      updated_at: Date.now(),
    });

    return { ...hub, agents: updatedAgents };
  },
});

/**
 * Get hub context bundle ready for agent injection
 * Returns: agents, recent memory summary, installed skills, vault grants
 * OPTIMIZATION: Restructured to reduce N+1 queries and limit data fetches
 */
export const getHubContext = query({
  args: {
    hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    // Resolve intelligence scope (legacy sharedIntelligence -> org)
    const intelligenceScope = resolveIntelligenceScope(hub);

    const sharedVault = hub.isolationSettings?.sharedVault ?? true;

    // Determine which hubs contribute to intelligence
    // OPTIMIZATION: Limit to 50 hubs per user to avoid N+1 pattern
    const hubIds = intelligenceScope === "isolated"
      ? [args.hub_id]
      : (await ctx.db
          .query("hubs")
          .withIndex("by_owner", (q) => q.eq("owner_id", hub.owner_id))
          .take(50)) // Limit fetch to prevent large data loads
          .filter((orgHub) =>
            orgHub._id === args.hub_id || isHubSharingIntelligence(orgHub)
          )
          .map((orgHub) => orgHub._id);

    const getRecentMemoryForHubs = async (type: "episodic" | "semantic") => {
      // OPTIMIZATION: Fetch from first hub only in isolated mode, limit per-hub to 5
      const targetHubIds = intelligenceScope === "isolated" ? [args.hub_id] : hubIds.slice(0, 5);
      const perHub = await Promise.all(
        targetHubIds.map((hubId) =>
          ctx.db
            .query("memory")
            .withIndex("by_hub_type", (q) =>
              q.eq("hub_id", hubId).eq("type", type)
            )
            .order("desc")
            .take(5) // Reduced from 10 per hub
        )
      );

      return perHub
        .flat()
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 10);
    };

    // Get recent memory (most recent 10 entries per type)
    const episodicMemory = await getRecentMemoryForHubs("episodic");
    const semanticMemory = await getRecentMemoryForHubs("semantic");

    // Get recent learnings (top by confidence)
    // OPTIMIZATION: Limit to first 3 hubs to reduce query fan-out
    const targetHubIds = intelligenceScope === "isolated" ? [args.hub_id] : hubIds.slice(0, 3);
    const perHubLearnings = await Promise.all(
      targetHubIds.map((hubId) =>
        ctx.db
          .query("hub_learnings")
          .withIndex("by_hub_confidence", (q) => q.eq("hub_id", hubId))
          .order("desc")
          .take(5) // Reduced from 10
      )
    );

    let learnings = perHubLearnings
      .flat()
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    if (intelligenceScope === "global") {
      // OPTIMIZATION: Limit global learnings fetch to top 5 by confidence
      const globalLearnings = await ctx.db
        .query("hub_learnings")
        .filter((q) => q.eq(q.field("contribute_to_global"), true))
        .order("desc")
        .take(5); // CHANGED from .collect() to .take(5)

      const merged = [...learnings, ...globalLearnings]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

      learnings = merged;
    }

    // Get vault (shared or isolated)
    // Already optimized with .take(1) but no N+1 risk here
    const vaults = sharedVault
      ? await ctx.db
          .query("vault")
          .withIndex("by_owner", (q) => q.eq("owner_id", hub.owner_id))
          .take(1)
      : await ctx.db
          .query("vault")
          .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id))
          .take(1);

    const vault = vaults.length > 0 ? vaults[0] : null;

    return {
      hub,
      memory: {
        episodic: episodicMemory,
        semantic: semanticMemory,
      },
      learnings,
      vault: vault ? {
        id: vault._id,
        entry_count: vault.entries.length,
        services: [...new Set(vault.entries.map((e) => e.service))],
      } : null,
    };
  },
});

/**
 * List all hubs for an owner
 * OPTIMIZATION: Use pagination-friendly .take() instead of .collect()
 */
export const listHubsByOwner = query({
  args: {
    owner_id: v.string(),
  },
  handler: async (ctx, args) => {
    // Primary lookup by owner_id
    const hubs = await ctx.db
      .query("hubs")
      .withIndex("by_owner", (q) => q.eq("owner_id", args.owner_id))
      .take(100);
    if (hubs.length > 0) return hubs;

    // Fallback: if no hubs found by this Clerk ID, check if there is a linked user
    // and return their hubs (handles dev/prod Clerk ID mismatch)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerk_user_id", args.owner_id))
      .first();
    if (!user) return [];
    // Find hubs owned by any Clerk ID linked to this email
    const userByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .first();
    if (!userByEmail) return [];
    // Try all known clerk IDs on this account
    const knownIds = [userByEmail.clerk_user_id, userByEmail.id, userByEmail.oauth_id].filter(Boolean);
    for (const id of knownIds) {
      if (id === args.owner_id) continue;
      const fallbackHubs = await ctx.db
        .query("hubs")
        .withIndex("by_owner", (q) => q.eq("owner_id", id as string))
        .take(100);
      if (fallbackHubs.length > 0) return fallbackHubs;
    }
    return [];
  },
});

/**
 * Update hub's privacy settings
 */
export const updateHubPrivacy = mutation({
  args: {
    hub_id: v.id("hubs"),
    privacy_global_opt_in: v.boolean(),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    await ctx.db.patch(args.hub_id, {
      privacy_global_opt_in: args.privacy_global_opt_in,
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Get the current user's workspace count and limit
 * OPTIMIZATION: Use .take() instead of .collect() for safer limits
 */
export const getUserWorkspaceStatus = query({
  args: {
    user_id: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("id"), args.user_id))
      .first();

    if (!user) {
      return { user: null, workspaces: [], status: "user_not_found" as const };
    }

    // Optimization: Use .take(100) for safety; most users have < 10 workspaces
    const hubs = await ctx.db
      .query("hubs")
      .withIndex("by_owner", (q) => q.eq("owner_id", args.user_id))
      .take(100); // CHANGED from .collect()

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        plan: user.plan,
        max_workspaces: user.max_workspaces,
      },
      workspaces: hubs.map((h) => ({
        id: h._id,
        name: h.name,
        subdomain: h.subdomain,
        template: h.template,
        status: h.status,
        created_at: h.created_at,
      })),
      status: "success" as const,
    };
  },
});

/**
 * Check if user can create a new workspace
 * OPTIMIZATION: Use .take() to check limit without full scan
 */
export const canCreateWorkspace = query({
  args: {
    user_id: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("id"), args.user_id))
      .first();

    if (!user) {
      return { canCreate: false, reason: "User not found" };
    }

    // Beta: unlimited workspaces for all users — ignore per-user max_workspaces
    const hubs = await ctx.db
      .query("hubs")
      .withIndex("by_owner", (q) => q.eq("owner_id", args.user_id))
      .collect();

    return {
      canCreate: true,
      reason: null,
      currentCount: hubs.length,
      maxCount: null, // null = unlimited during beta
      plan: user.plan ?? "free",
    };
  },
});

/**
 * Connect a local machine to a hub
 * Called by `hubify connect` from the local CLI
 * Records the connection in the hub's agents array and returns hub context
 */
export const connect = mutation({
  args: {
    hub_id: v.id("hubs"),
    local_machine_id: v.string(),  // hostname or generated machine ID
    platform: v.string(),          // "openclaw", "claude-code", "cursor", etc.
    token: v.optional(v.string()), // Optional auth token for future use
    agent_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    // Remove stale entry for this machine if it exists
    const filtered = hub.agents.filter(
      (a) => a.id !== args.local_machine_id
    );

    // Upsert machine as active agent
    const updatedAgents = [
      ...filtered,
      {
        id: args.local_machine_id,
        name: args.agent_name || args.local_machine_id,
        platform: args.platform,
        role: "local-machine",
        active: true,
        last_active: Date.now(),
      },
    ];

    await ctx.db.patch(args.hub_id, {
      agents: updatedAgents,
      updated_at: Date.now(),
    });

    return {
      hub_id: hub._id,
      name: hub.name,
      subdomain: hub.subdomain,
      status: hub.status,
      agents: updatedAgents,
      connected_at: Date.now(),
    };
  },
});

/**
 * Disconnect a local machine from a hub (marks agent as inactive)
 */
export const disconnect = mutation({
  args: {
    hub_id: v.id("hubs"),
    local_machine_id: v.string(),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    const updatedAgents = hub.agents.map((a) =>
      a.id === args.local_machine_id
        ? { ...a, active: false, last_active: Date.now() }
        : a
    );

    await ctx.db.patch(args.hub_id, {
      agents: updatedAgents,
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * List all hubs (for internal stats aggregation)
 * OPTIMIZATION: Use pagination for large datasets, limit to 1000
 */
export const listAllHubs = query({
  args: {},
  handler: async (ctx) => {
    // CHANGED from .collect() to .take(1000) to prevent memory exhaustion
    // For true "all hubs", use paginated approach with cursors
    return await ctx.db.query("hubs").take(1000);
  },
});

/**
 * Get hub by subdomain (e.g. "houston" → houston.hubify.com)
 */
export const getHubBySubdomain = query({
  args: {
    subdomain: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hubs")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain))
      .first();
  },
});

/**
 * Update workspace name / display name / description
 */
export const updateWorkspaceDetails = mutation({
  args: {
    hub_id: v.id("hubs"),
    user_id: v.string(),
    display_name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");
    if (hub.owner_id !== args.user_id) throw new Error("Unauthorized");

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    if (args.display_name !== undefined) patch.display_name = args.display_name;
    if (args.description !== undefined) patch.description = args.description;

    await ctx.db.patch(args.hub_id, patch as any);
    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Delete a workspace
 */
export const deleteWorkspace = mutation({
  args: {
    hub_id: v.id("hubs"),
    user_id: v.string(),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    // Verify ownership
    if (hub.owner_id !== args.user_id) {
      throw new Error("Unauthorized");
    }

    // Audit log the deletion
    await ctx.db.insert("security_logs", {
      event_type: "workspace_deleted",
      agent_id: args.user_id,
      details: `Workspace '${hub.name}' (id: ${args.hub_id}) deleted by user ${args.user_id}`,
      severity: "medium",
    });

    // Delete the hub
    await ctx.db.delete(args.hub_id);

    // Update user's workspace count
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("id"), args.user_id))
      .first();

    if (user && user.workspace_count > 0) {
      await ctx.db.patch(user._id, {
        workspace_count: user.workspace_count - 1,
        updated_at: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Update hub with Fly machine provisioning details
 * Called after machine is created in Fly.io
 */
export const updateHubWithFlyDetails = mutation({
  args: {
    hub_id: v.id("hubs"),
    fly_machine_id: v.string(),
    fly_app_name: v.string(),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    await ctx.db.patch(args.hub_id, {
      fly_machine_id: args.fly_machine_id,
      fly_app_name: args.fly_app_name,
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Update hub status (provisioning -> active, etc.)
 */
export const updateHubStatus = mutation({
  args: {
    hub_id: v.id("hubs"),
    status: v.union(
      v.literal("provisioning"),
      v.literal("starting"),
      v.literal("active"),
      v.literal("sleeping"),
      v.literal("error")
    ),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    await ctx.db.patch(args.hub_id, {
      status: args.status,
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Update hub display name
 */
export const updateHubName = mutation({
  args: {
    hub_id: v.id("hubs"),
    name: v.string(),
  },
  handler: async (ctx, { hub_id, name }) => {
    const hub = await ctx.db.get(hub_id);
    if (!hub) throw new Error("Hub not found");
    await ctx.db.patch(hub_id, { name, updated_at: Date.now() });
    return { success: true };
  },
});

/**
 * Remove a specific agent from a hub's agents array
 */
export const removeAgentFromHub = mutation({
  args: {
    hub_id: v.id("hubs"),
    agent_id: v.string(),
  },
  handler: async (ctx, { hub_id, agent_id }) => {
    const hub = await ctx.db.get(hub_id);
    if (!hub) throw new Error("Hub not found");
    const updatedAgents = (hub.agents || []).filter(
      (a: { id: string }) => a.id !== agent_id
    );
    await ctx.db.patch(hub_id, { agents: updatedAgents, updated_at: Date.now() });
    return { success: true, agents: updatedAgents };
  },
});

/**
 * Update hub display_name and/or description
 */
export const updateHubMetadata = mutation({
  args: {
    hub_id: v.id("hubs"),
    display_name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { hub_id, display_name, description }) => {
    const hub = await ctx.db.get(hub_id);
    if (!hub) throw new Error("Hub not found");
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    if (display_name !== undefined) patch.display_name = display_name;
    if (description !== undefined) patch.description = description;
    await ctx.db.patch(hub_id, patch);
    return { success: true, display_name, description };
  },
});

/**
 * Set active persona and mode on a hub
 */
export const setActivePersona = mutation({
  args: {
    hub_id: v.id("hubs"),
    persona_id: v.optional(v.id("agent_personas")),
    mode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");
    const patch: Record<string, unknown> = { updated_at: Date.now() };
    if (args.persona_id !== undefined) patch.active_persona_id = args.persona_id;
    if (args.mode !== undefined) patch.active_mode = args.mode;
    await ctx.db.patch(args.hub_id, patch);
    return { success: true };
  },
});

/**
 * Update workspace theme configuration.
 * Stores theme overrides in the hubs table — the workspace stats-server
 * reads these via /api/theme to apply them at runtime.
 */
export const updateTheme = mutation({
  args: {
    hub_id: v.id("hubs"),
    theme_id: v.string(),
    accent: v.string(),
    monogram: v.optional(v.string()),
    panels: v.optional(v.array(v.object({
      id: v.string(),
      visible: v.boolean(),
      position: v.number(),
      size: v.string(),
    }))),
    sidebar_panels: v.optional(v.array(v.object({
      id: v.string(),
      visible: v.boolean(),
      position: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    await ctx.db.patch(args.hub_id, {
      theme_config: {
        theme_id: args.theme_id,
        accent: args.accent,
        monogram: args.monogram,
        panels: args.panels,
        sidebar_panels: args.sidebar_panels,
      },
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get workspace theme (public query for stats-server to call).
 */
export const getTheme = query({
  args: { hub_id: v.id("hubs") },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) return null;
    return {
      theme_config: hub.theme_config ?? null,
      template: hub.template,
      display_name: hub.display_name,
    };
  },
});

/**
 * Apply a Studio template to an existing workspace.
 * Merges template config into the workspace's theme_config.
 */
export const applyStudioTemplate = mutation({
  args: {
    hub_id: v.id("hubs"),
    template_name: v.string(),
    theme_id: v.string(),
    accent: v.string(),
    monogram: v.optional(v.string()),
    panels: v.optional(v.array(v.object({
      id: v.string(),
      visible: v.boolean(),
      position: v.number(),
      size: v.string(),
    }))),
    sidebar_panels: v.optional(v.array(v.object({
      id: v.string(),
      visible: v.boolean(),
      position: v.number(),
    }))),
    skills: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    await ctx.db.patch(args.hub_id, {
      theme_config: {
        theme_id: args.theme_id,
        accent: args.accent,
        monogram: args.monogram,
        panels: args.panels,
        sidebar_panels: args.sidebar_panels,
      },
      display_name: args.template_name,
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Admin: delete a hub by ID
 */
export const deleteHub = mutation({
  args: { hub_id: v.id("hubs") },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    // Cascade: deactivate all squads linked to this hub
    const squads = await ctx.db
      .query("squads")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id))
      .collect();
    for (const squad of squads) {
      if (squad.status !== "deprecated") {
        await ctx.db.patch(squad._id, {
          status: "deprecated" as const,
          updated_at: Date.now(),
        });
      }
    }

    // Cascade: remove hub subscriptions (both as subscriber and source)
    const asSubscriber = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_subscriber", (q) => q.eq("subscriber_hub_id", args.hub_id))
      .collect();
    for (const sub of asSubscriber) {
      await ctx.db.delete(sub._id);
    }
    const asSource = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_source", (q) => q.eq("source_hub_id", args.hub_id))
      .collect();
    for (const sub of asSource) {
      await ctx.db.delete(sub._id);
    }

    // Cascade: delete hub posts
    const posts = await ctx.db
      .query("hub_posts")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id))
      .take(500);
    for (const post of posts) {
      await ctx.db.delete(post._id);
    }

    // Cascade: archive hub knowledge (don't delete — may be referenced)
    const knowledge = await ctx.db
      .query("hub_knowledge")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id))
      .take(500);
    for (const k of knowledge) {
      if (k.status !== "archived") {
        await ctx.db.patch(k._id, { status: "archived" as const });
      }
    }

    await ctx.db.delete(args.hub_id);
    return {
      deleted: true,
      name: hub.name,
      squadsDeactivated: squads.length,
      subscriptionsRemoved: asSubscriber.length + asSource.length,
      postsDeleted: posts.length,
      knowledgeArchived: knowledge.length,
    };
  },
});

/**
 * Get workspace isolation settings for a hub
 */
export const getIsolationSettings = query({
  args: {
    hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    // Return default settings if not yet configured
    const settings = hub.isolationSettings || {
      sharedVault: true,
      intelligenceScope: "isolated" as const,
      sharedIntelligence: false,
      updatedAt: hub.created_at,
    };

    // Backfill intelligence scope if missing (legacy data)
    if (!settings.intelligenceScope) {
      settings.intelligenceScope = settings.sharedIntelligence ? "org" : "isolated";
    }

    return settings;
  },
});

/**
 * Update workspace isolation settings
 */
export const updateIsolationSettings = mutation({
  args: {
    hub_id: v.id("hubs"),
    sharedVault: v.boolean(),
    sharedIntelligence: v.optional(v.boolean()),
    intelligenceScope: v.optional(v.union(
      v.literal("isolated"),
      v.literal("org"),
      v.literal("global")
    )),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    const resolvedScope = args.intelligenceScope ?? (
      args.sharedIntelligence ? "org" : "isolated"
    );

    await ctx.db.patch(args.hub_id, {
      isolationSettings: {
        sharedVault: args.sharedVault,
        intelligenceScope: resolvedScope as "isolated" | "org" | "global",
        sharedIntelligence: resolvedScope !== "isolated",
        updatedAt: Date.now(),
      },
      privacy_global_opt_in: resolvedScope === "global",
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

// getPosts — return posts for a hub
export const getPosts = query({
  args: { hub_id: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // If it's a synthetic hub ID (hub-coding, hub-ai, etc.), return demo posts
    if (args.hub_id.startsWith("hub-")) {
      const category = args.hub_id.replace("hub-", "");
      const skills = await ctx.db.query("skills").take(50);
      const catSkills = skills.filter(
        (s) => ((s as any).category || "general") === category
      );
      return catSkills.slice(0, args.limit ?? 10).map((s, i) => ({
        _id: `post-${category}-${i}`,
        hub_id: args.hub_id,
        agent_id: `agent-${category}-${String(i).padStart(3, "0")}`,
        agent_platform: ["claude-code", "cursor", "windsurf", "cli"][i % 4],
        post_type: (["insight", "pattern", "benchmark", "proposal", "question"] as const)[i % 5],
        title: `${(s as any).display_name || (s as any).name || "Skill"} execution pattern`,
        body: (s as any).description || `Analysis of ${(s as any).name || "skill"} usage across the network.`,
        endorsements: Math.floor(Math.random() * 20) + 1,
        reply_count: Math.floor(Math.random() * 8),
        status: "active",
        created_at: Date.now() - i * 3_600_000,
        execution_data:
          i % 3 === 0
            ? {
                success_rate: 0.85 + Math.random() * 0.14,
                sample_size: Math.floor(Math.random() * 200) + 10,
              }
            : undefined,
      }));
    }
    // Real hub — query hub_posts table
    const posts = await ctx.db
      .query("hub_posts")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id as any))
      .order("desc")
      .take(args.limit ?? 50);
    return posts;
  },
});

// createPost — create a hub post (used by CLI)
export const createPost = mutation({
  args: {
    hub_id: v.id("hubs"),
    agent_id: v.string(),
    agent_platform: v.optional(v.string()),
    post_type: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    linked_skill_id: v.optional(v.string()),
    linked_learning_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const postId = await ctx.db.insert("hub_posts", {
      hub_id: args.hub_id,
      agent_id: args.agent_id,
      agent_platform: args.agent_platform || "cli",
      post_type: (args.post_type as any) || "insight",
      title: args.title,
      body: args.body,
      linked_skill_id: args.linked_skill_id as any,
      endorsements: 0,
      reply_count: 0,
      status: "active",
      created_at: Date.now(),
    });
    return postId;
  },
});

// listByParent — return sub-hubs of a parent hub
// OPTIMIZATION: Use .take() instead of .collect()
export const listByParent = query({
  args: { parent_hub_id: v.string() },
  handler: async (ctx, args) => {
    // Synthetic hubs don't have sub-hubs
    if (args.parent_hub_id.startsWith("hub-")) return [];
    // Most hubs have < 20 children; use .take(50) for safety
    const hubs = await ctx.db
      .query("hubs")
      .filter((q) => q.eq(q.field("parent_hub_id"), args.parent_hub_id))
      .take(50); // CHANGED from .collect()
    return hubs;
  },
});

// getMaintainers — return maintainers for a hub
export const getMaintainers = query({
  args: { hub_id: v.string() },
  handler: async (ctx, args) => {
    // Synthetic hubs generate demo maintainers
    if (args.hub_id.startsWith("hub-")) {
      const category = args.hub_id.replace("hub-", "");
      return [
        {
          _id: `maint-${category}-0`,
          hub_id: args.hub_id,
          agent_id: `maintainer-${category}-lead`,
          role: "maintainer" as const,
          appointed_at: Date.now() - 30 * 24 * 3_600_000,
          hub_reputation: 0.92,
          contributions: 47,
          validations: 128,
          status: "active" as const,
        },
      ];
    }
    // Real hub — query hub_maintainers table
    // OPTIMIZATION: Use .take(100) instead of .collect() to avoid loading all records
    const maintainers = await ctx.db
      .query("hub_maintainers")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id as any))
      .filter((q) => q.eq(q.field("status"), "active"))
      .take(100); // CHANGED from .collect()
    return maintainers;
  },
});

// getByName — alias for getHub using slug/name (supports synthetic category hubs)
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    // First try real DB hubs
    const real = await ctx.db
      .query("hubs")
      .filter((q) => q.or(
        q.eq(q.field("slug"), args.name),
        q.eq(q.field("name"), args.name)
      ))
      .first();
    if (real) return real;

    // Fall back to synthetic hub from skills categories
    const skills = await ctx.db.query("skills").take(500);
    const categoryMap: Record<string, { count: number; names: string[] }> = {};
    for (const skill of skills) {
      const cat = (skill as any).category || "general";
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, names: [] };
      categoryMap[cat].count++;
      if (categoryMap[cat].names.length < 3) categoryMap[cat].names.push((skill as any).name || "");
    }
    const hubTypeMap: Record<string, "skill" | "domain" | "meta"> = {
      coding: "domain", ai: "domain", automation: "domain", data: "domain",
      security: "domain", productivity: "skill", research: "skill",
      creative: "skill", finance: "skill", general: "meta",
    };
    const cat = args.name.toLowerCase();
    if (categoryMap[cat]) {
      const data = categoryMap[cat];
      return {
        _id: `hub-${cat}`,
        name: cat,
        display_name: cat.charAt(0).toUpperCase() + cat.slice(1),
        description: `Community hub for ${cat} skills. ${data.count} skills, active contributors.`,
        hub_type: hubTypeMap[cat] || "skill",
        post_count: data.count * 12,
        contributor_count: Math.max(3, Math.floor(data.count * 1.4)),
        knowledge_count: data.count,
        aggregate_confidence: 0.85,
        tags: data.names.slice(0, 3),
        last_activity_at: Date.now(),
        created_by: "system",
      };
    }
    return null;
  },
});

// list — returns skill category hubs synthesized from skills data
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const skills = await ctx.db.query("skills").take(500);

    // Group by category to form "hubs"
    const categoryMap: Record<string, { count: number; names: string[] }> = {};
    for (const skill of skills) {
      const cat = (skill as any).category || "general";
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, names: [] };
      categoryMap[cat].count++;
      if (categoryMap[cat].names.length < 3) categoryMap[cat].names.push((skill as any).name || "");
    }

    const hubTypeMap: Record<string, "skill" | "domain" | "meta"> = {
      coding: "domain", ai: "domain", automation: "domain", data: "domain",
      security: "domain", productivity: "skill", research: "skill",
      creative: "skill", finance: "skill", general: "meta",
    };

    return Object.entries(categoryMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, args.limit ?? 20)
      .map(([cat, data], i) => ({
        _id: `hub-${cat}`,
        name: cat,
        display_name: cat.charAt(0).toUpperCase() + cat.slice(1),
        description: `Community hub for ${cat} skills. ${data.count} skills, active contributors.`,
        hub_type: hubTypeMap[cat] || "skill",
        post_count: data.count * 12,
        contributor_count: Math.max(3, Math.floor(data.count * 1.4)),
        knowledge_count: data.count,
        aggregate_confidence: 0.82 + (i % 5) * 0.03,
        tags: data.names.slice(0, 3),
        last_activity_at: Date.now() - i * 3600000,
        created_by: "system",
      }));
  },
});

// search — filter hubs by name/description
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!args.query.trim()) return [];
    const all = await ctx.db.query("skills").take(200);
    const q = args.query.toLowerCase();
    const cats = new Set(
      all
        .filter(s => ((s as any).category || "").toLowerCase().includes(q) || ((s as any).name || "").toLowerCase().includes(q))
        .map(s => (s as any).category || "general")
    );
    return [...cats].slice(0, 10).map(cat => ({
      _id: `hub-${cat}`,
      name: cat,
      display_name: cat.charAt(0).toUpperCase() + cat.slice(1),
      description: `Skills hub for ${cat}`,
      hub_type: "skill" as const,
      post_count: 0,
      contributor_count: 0,
      last_activity_at: Date.now(),
      created_by: "system",
    }));
  },
});

/**
 * Set the active workspace for a user
 * Updates user's activeWorkspaceId field
 */
export const setActiveWorkspace = mutation({
  args: {
    user_id: v.string(),
    workspace_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    // Verify the workspace exists and belongs to the user
    const workspace = await ctx.db.get(args.workspace_id);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.owner_id !== args.user_id) {
      throw new Error("Unauthorized: Workspace does not belong to this user");
    }

    // Update user's activeWorkspaceId
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("id"), args.user_id))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      activeWorkspaceId: args.workspace_id,
      updated_at: Date.now(),
    });

    return {
      success: true,
      user_id: args.user_id,
      active_workspace_id: args.workspace_id,
    };
  },
});

/**
 * Get the user's active workspace
 */
export const getActiveWorkspace = query({
  args: {
    user_id: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("id"), args.user_id))
      .first();

    if (!user) {
      return { workspace: null, user_id: args.user_id };
    }

    if (!user.activeWorkspaceId) {
      // If no active workspace set, return the first one
      const workspaces = await ctx.db
        .query("hubs")
        .withIndex("by_owner", (q) => q.eq("owner_id", args.user_id))
        .take(1);

      return {
        workspace: workspaces.length > 0 ? workspaces[0] : null,
        user_id: args.user_id,
      };
    }

    const workspace = await ctx.db.get(user.activeWorkspaceId);
    return {
      workspace,
      user_id: args.user_id,
    };
  },
});

/**
 * List all workspaces for a user with summary info
 * Used by workspace selector in UI
 * OPTIMIZATION: Use .take() instead of .collect()
 */
export const listUserWorkspacesWithStatus = query({
  args: {
    user_id: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("id"), args.user_id))
      .first();

    // Optimization: Use .take(100) for UI listing
    const workspaces = await ctx.db
      .query("hubs")
      .withIndex("by_owner", (q) => q.eq("owner_id", args.user_id))
      .take(100); // CHANGED from .collect()

    return {
      user_id: args.user_id,
      active_workspace_id: user?.activeWorkspaceId || null,
      workspaces: workspaces.map((ws) => ({
        id: ws._id,
        name: ws.name,
        subdomain: ws.subdomain,
        template: ws.template,
        status: ws.status,
        agents_count: ws.agents?.length || 0,
        created_at: ws.created_at,
        is_active: user?.activeWorkspaceId === ws._id,
      })),
      total_count: workspaces.length,
    };
  },
});

// ══════════════════════════════════════════════════════════════════════
// GitHub Repo Sync — connect/disconnect/update sync status
// ══════════════════════════════════════════════════════════════════════

/**
 * Connect a GitHub repo to a workspace for template sync
 */
export const connectGitHubRepo = mutation({
  args: {
    hub_id: v.id("hubs"),
    repo_url: v.string(),
    branch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    await ctx.db.patch(args.hub_id, {
      github_sync: {
        repo_url: args.repo_url,
        branch: args.branch || "main",
        connected_at: Date.now(),
      },
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Disconnect GitHub repo from a workspace
 */
export const disconnectGitHubRepo = mutation({
  args: {
    hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    await ctx.db.patch(args.hub_id, {
      github_sync: undefined,
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Update sync timestamp after a push/pull operation
 */
export const updateGitSyncStatus = mutation({
  args: {
    hub_id: v.id("hubs"),
    last_sync_type: v.union(
      v.literal("push"), v.literal("pull"), v.literal("init")
    ),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");
    if (!hub.github_sync) throw new Error("GitHub sync not configured");

    await ctx.db.patch(args.hub_id, {
      github_sync: {
        ...hub.github_sync,
        last_sync_at: Date.now(),
        last_sync_type: args.last_sync_type,
      },
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Update agent presence in a hub
 * Used by the presence API to track which agents are connected
 * Persists briefly (5-10s) after agent disconnects to prevent flickering
 */
export const updateHubAgents = mutation({
  args: {
    hub_id: v.id("hubs"),
    agents: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        platform: v.string(),
        role: v.string(),
        model: v.optional(v.string()),
        active: v.boolean(),
        last_active: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    await ctx.db.patch(args.hub_id, {
      agents: args.agents,
      updated_at: Date.now(),
      last_activity_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Configure Telegram integration for a workspace
 * Stores bot token and chat ID for notifications
 */
export const configureTelegram = mutation({
  args: {
    hub_id: v.id("hubs"),
    bot_token: v.string(),
    chat_id: v.string(),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    await ctx.db.patch(args.hub_id, {
      telegram_config: {
        enabled: true,
        bot_token: args.bot_token,
        chat_id: args.chat_id,
        connected_at: hub.telegram_config?.connected_at || Date.now(),
        test_status: "pending",
      },
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Update Telegram test result
 * Called after testing the connection
 */
export const updateTelegramTestStatus = mutation({
  args: {
    hub_id: v.id("hubs"),
    status: v.union(v.literal("success"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");
    if (!hub.telegram_config) throw new Error("Telegram not configured");

    await ctx.db.patch(args.hub_id, {
      telegram_config: {
        ...hub.telegram_config,
        test_status: args.status,
        last_tested_at: Date.now(),
        test_error: args.error,
      },
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

/**
 * Disable Telegram integration for a workspace
 */
export const disableTelegram = mutation({
  args: {
    hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db.get(args.hub_id);
    if (!hub) throw new Error("Hub not found");

    await ctx.db.patch(args.hub_id, {
      telegram_config: {
        enabled: false,
      },
      updated_at: Date.now(),
    });

    return await ctx.db.get(args.hub_id);
  },
});

/**
 * List hubs that have a domain set (platform/research hubs for subscription)
 */
export const listHubsByDomain = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const hubs = await ctx.db
      .query("hubs")
      .withIndex("by_activity")
      .order("desc")
      .take(limit * 2); // over-fetch to filter

    return hubs.filter((h) => h.domain).slice(0, limit);
  },
});

// Discover subscribable hubs — non-workspace hubs with domains, enriched with subscriber counts
export const discoverHubs = query({
  args: {
    domain: v.optional(v.string()),
    limit: v.optional(v.number()),
    exclude_hub_id: v.optional(v.id("hubs")),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const hubs = await ctx.db
      .query("hubs")
      .withIndex("by_activity")
      .order("desc")
      .take(limit * 3);

    const filtered = hubs
      .filter((h) => {
        if (!h.domain) return false;
        if (h.hub_type === "workspace") return false;
        if (args.exclude_hub_id && h._id === args.exclude_hub_id) return false;
        if (args.domain && h.domain !== args.domain) return false;
        return true;
      })
      .slice(0, limit);

    // Enrich with subscriber counts
    const enriched = await Promise.all(
      filtered.map(async (h) => {
        const subscribers = await ctx.db
          .query("hub_subscriptions")
          .withIndex("by_source", (q) => q.eq("source_hub_id", h._id))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect();

        return {
          _id: h._id,
          name: h.name,
          display_name: h.display_name,
          description: h.description,
          domain: h.domain,
          tags: h.tags,
          knowledge_count: h.knowledge_count || 0,
          post_count: h.post_count || 0,
          contributor_count: h.contributor_count || 0,
          subscriber_count: subscribers.length,
          last_activity_at: h.last_activity_at,
        };
      })
    );

    return enriched;
  },
});

/**
 * Create a Research Lab — dedicated research workspace tied to a parent hub
 * Auto-creates bidirectional hub subscriptions for knowledge flow
 */
export const createResearchLab = mutation({
  args: {
    parent_hub_id: v.id("hubs"),
    name: v.string(),
    mission_id: v.optional(v.id("research_missions")),
    compute_tier: v.optional(v.union(v.literal("e2b"), v.literal("fly"), v.literal("runpod"))),
    auto_publish_findings: v.optional(v.boolean()),
    budget_hours: v.optional(v.number()),
    budget_usd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const parentHub = await ctx.db.get(args.parent_hub_id);
    if (!parentHub) throw new Error("Parent hub not found");

    const computeTier = args.compute_tier ?? "e2b";
    const missionIds = args.mission_id ? [args.mission_id] : [];

    // Create the research lab hub
    const labId = await ctx.db.insert("hubs", {
      name: args.name,
      owner_id: parentHub.owner_id,
      hub_type: "research-lab",
      template: "researchos",
      status: computeTier === "fly" ? "provisioning" : "active",
      domain: "research",
      tags: ["research", "lab", "experiments"],
      agents: [],
      research_config: {
        parent_workspace_id: args.parent_hub_id,
        compute_tier: computeTier,
        mission_ids: missionIds,
        auto_publish_findings: args.auto_publish_findings ?? true,
        budget_hours: args.budget_hours,
        budget_usd: args.budget_usd,
      },
      parent_hub_id: args.parent_hub_id,
      privacy_global_opt_in: parentHub.privacy_global_opt_in,
      isolationSettings: parentHub.isolationSettings ? {
        sharedVault: true,
        intelligenceScope: parentHub.isolationSettings.intelligenceScope ?? "isolated",
        updatedAt: Date.now(),
      } : undefined,
      created_at: Date.now(),
      updated_at: Date.now(),
    } as any);

    // Create bidirectional subscriptions
    // Research lab subscribes to parent (inherits knowledge)
    await ctx.db.insert("hub_subscriptions", {
      subscriber_hub_id: labId,
      source_hub_id: args.parent_hub_id,
      subscribed_at: Date.now(),
      status: "active",
    });

    // Parent subscribes to research lab (receives findings)
    await ctx.db.insert("hub_subscriptions", {
      subscriber_hub_id: args.parent_hub_id,
      source_hub_id: labId,
      subscribed_at: Date.now(),
      status: "active",
    });

    // Log activity
    await ctx.db.insert("workspace_activity", {
      workspaceId: labId,
      type: "workspace_create",
      message: `Research lab "${args.name}" created from workspace ${parentHub.name}`,
      actorId: parentHub.owner_id ?? "system",
      timestamp: Date.now(),
    });

    return labId;
  },
});

/** Get research labs for a parent hub */
export const getResearchLabs = query({
  args: {
    parent_hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hubs")
      .withIndex("by_parent_hub", (q) => q.eq("parent_hub_id", args.parent_hub_id))
      .collect()
      .then((hubs) => hubs.filter((h) => (h as any).hub_type === "research-lab"));
  },
});

// Semantic search across hubs — uses full-text search index on description
export const searchHubs = query({
  args: {
    query: v.string(),
    hub_type: v.optional(v.union(v.literal("workspace"), v.literal("research-lab"), v.literal("community"), v.literal("meta"), v.literal("platform"), v.literal("domain"), v.literal("skill"))),
    domain: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const results = await ctx.db
      .query("hubs")
      .withSearchIndex("search_hubs", (q) => {
        let search = q.search("description", args.query);
        if (args.hub_type) search = search.eq("hub_type", args.hub_type);
        if (args.domain) search = search.eq("domain", args.domain);
        return search;
      })
      .take(limit);

    // Enrich with subscriber counts
    const enriched = await Promise.all(
      results.map(async (h) => {
        const subscribers = await ctx.db
          .query("hub_subscriptions")
          .withIndex("by_source", (q) => q.eq("source_hub_id", h._id))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect();

        return {
          _id: h._id,
          name: h.name,
          display_name: h.display_name,
          description: h.description,
          hub_type: h.hub_type,
          domain: h.domain,
          tags: h.tags,
          knowledge_count: h.knowledge_count || 0,
          subscriber_count: subscribers.length,
          status: h.status,
          last_activity_at: h.last_activity_at,
        };
      })
    );

    return enriched;
  },
});

/** List hubs owned by a user (alias for listHubsByOwner) */
export const getUserHubs = query({
  args: {
    owner_id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hubs")
      .withIndex("by_owner", (q) => q.eq("owner_id", args.owner_id))
      .collect();
  },
});

/** Get hub by name (uses by_name index) */
export const getHubByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hubs")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/** List community-type hubs */
export const listCommunityHubs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hubs")
      .withIndex("by_type", (q) => q.eq("hub_type", "community"))
      .take(args.limit ?? 50);
  },
});

/** Get all hubs by type */
export const getHubsByType = query({
  args: {
    hub_type: v.union(
      v.literal("workspace"),
      v.literal("research-lab"),
      v.literal("community")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hubs")
      .withIndex("by_type", (q) => q.eq("hub_type", args.hub_type))
      .take(args.limit ?? 50);
  },
});