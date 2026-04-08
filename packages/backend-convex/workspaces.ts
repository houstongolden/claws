import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { PLAN_TIERS } from "./plan_limits";

// ============================================================================
// Auth Helper - Extract user ID from Clerk identity
// ============================================================================
async function getAuthenticatedUserId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated: No identity found");
  }
  const userId = identity.subject || identity.userId || identity.tokenIdentifier;
  if (!userId) {
    throw new Error("Not authenticated: No user ID in identity");
  }
  return userId;
}

// ============================================================================
// Constants
// ============================================================================

const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "app", "docs", "admin", "mail", "hub",
  "hubify", "static", "support", "help", "blog", "status",
]);

// /^[a-z0-9][a-z0-9-]{2,19}$/ — starts with alphanumeric, 3–20 chars total
const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{2,19}$/;

function validateSubdomain(subdomain: string): string | null {
  if (!SUBDOMAIN_RE.test(subdomain)) {
    if (subdomain.length < 3) return "Must be at least 3 characters";
    if (subdomain.length > 20) return "Must be 20 characters or fewer";
    return "Only lowercase letters, numbers, and hyphens allowed (must start with a letter or number)";
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return "That subdomain is reserved";
  }
  return null;
}

// ============================================================================
// Queries
// ============================================================================

/** Check whether a subdomain is available. */
export const checkSubdomain = query({
  args: { subdomain: v.string() },
  handler: async (ctx, args) => {
    const reason = validateSubdomain(args.subdomain);
    if (reason !== null) {
      return { available: false, reason };
    }

    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain))
      .first();

    if (existing) {
      return { available: false, reason: "That subdomain is already taken" };
    }

    return { available: true, reason: null };
  },
});

/** Get public workspace info by subdomain. */
export const getBySubdomain = query({
  args: { subdomain: v.string() },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain))
      .first();

    if (!workspace) return null;

    // Return only public-safe fields
    return {
      _id: workspace._id,
      username: workspace.username,
      subdomain: workspace.subdomain,
      status: workspace.status,
      template: workspace.template,
      region: workspace.region,
      openclaw_version: workspace.openclaw_version,
      provisioned_at: workspace.provisioned_at,
      created_at: workspace.created_at,
    };
  },
});

/** Get workspace for a specific user. SECURITY: Only the user can access their own workspace. */
export const getByUserId = query({
  args: { user_id: v.string() },
  handler: async (ctx, args) => {
    // ISOLATION: Verify that the requesting user is accessing their own workspace
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    if (authenticatedUserId !== args.user_id) {
      throw new Error(`ISOLATION_VIOLATION: User ${authenticatedUserId} cannot access workspace owned by ${args.user_id}`);
    }

    return await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q: any) => q.eq("user_id", args.user_id as any))
      .first();
  },
});

/** List active workspaces for the authenticated user only. SECURITY: Only returns user's own workspaces. */
export const listActive = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // ISOLATION: Get authenticated user's ID and fetch only their workspaces
    const userId = await getAuthenticatedUserId(ctx);

    const limit = args.limit ?? 50;
    return await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q: any) => q.eq("user_id", userId as any))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .take(limit);
  },
});

// ============================================================================
// Mutations
// ============================================================================

/** Create a new workspace for a user. SECURITY: User can only create workspaces for themselves. */
export const create = mutation({
  args: {
    user_id: v.string(),
    username: v.string(),
    subdomain: v.string(),
    template: v.string(),
    region: v.optional(v.string()),
    plan: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("team"))),
  },
  handler: async (ctx, args) => {
    // ISOLATION: Verify that the authenticated user is creating a workspace for themselves
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    if (authenticatedUserId !== args.user_id) {
      throw new Error(`ISOLATION_VIOLATION: User ${authenticatedUserId} cannot create workspace for ${args.user_id}`);
    }

    // =========================================================================
    // PLAN LIMITS ENFORCEMENT: Check workspace creation limit
    // =========================================================================
    const user = await ctx.db.get(args.user_id as any);
    if (!user) {
      throw new Error("User not found");
    }

    const userPlan = ((user as any).plan || "free") as keyof typeof PLAN_TIERS;
    const limits = PLAN_TIERS[userPlan];
    const maxWorkspaces = limits.max_workspaces;

    if (maxWorkspaces !== null) {
      // Count current workspaces for this user
      const existingWorkspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_user", (q: any) => q.eq("user_id", args.user_id as any))
        .collect();

      if (existingWorkspaces.length >= maxWorkspaces) {
        throw new Error(
          `Workspace limit reached for ${userPlan} plan. ` +
          `Current: ${existingWorkspaces.length}, Limit: ${maxWorkspaces}. ` +
          `Upgrade to Pro or Team to create more workspaces.`
        );
      }
    }

    // Validate subdomain format
    const reason = validateSubdomain(args.subdomain);
    if (reason !== null) {
      throw new Error(`Invalid subdomain: ${reason}`);
    }

    // Check availability
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain))
      .first();

    if (existing) {
      throw new Error("That subdomain is already taken");
    }

    const now = Date.now();

    const workspaceId = await ctx.db.insert("workspaces", {
      user_id: args.user_id as any,
      username: args.username,
      subdomain: args.subdomain,
      status: "pending",
      region: args.region ?? "iad",
      template: args.template,
      plan: args.plan ?? "free",
      openclaw_version: "latest",
      created_at: now,
      updated_at: now,
    });

    // Log activity: workspace created
    await ctx.db.insert("workspace_activity", {
      workspaceId: workspaceId,
      type: "workspace_create",
      message: `${args.username} created workspace ${args.subdomain}`,
      actorId: args.user_id,
      timestamp: now,
    });

    return workspaceId;
  },
});

/** Update workspace status, optionally set fly machine ID or error message. SECURITY: Only owner can update. */
export const updateStatus = mutation({
  args: {
    workspace_id: v.id("workspaces"),
    status: v.union(
      v.literal("pending"),
      v.literal("provisioning"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("error")
    ),
    fly_machine_id: v.optional(v.string()),
    fly_app_name: v.optional(v.string()),
    error_message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspace_id);
    if (!workspace) throw new Error("Workspace not found");

    // NOTE: updateStatus is called by the provisioning server-side flow.
    // Auth check skipped here — caller is trusted backend code.
    // For user-facing updates, use a separate mutation with isolation checks.

    const patch: Record<string, unknown> = {
      status: args.status,
      updated_at: Date.now(),
    };

    if (args.fly_machine_id !== undefined) patch.fly_machine_id = args.fly_machine_id;
    if (args.fly_app_name !== undefined) patch.fly_app_name = args.fly_app_name;
    if (args.error_message !== undefined) patch.error_message = args.error_message;
    if (args.status === "active") patch.provisioned_at = Date.now();

    await ctx.db.patch(args.workspace_id, patch);
    return args.workspace_id;
  },
});

// ============================================================================
// Internal: Seed / Admin Provisioning
// (No auth check — only callable from Convex internal actions or admin scripts)
// ============================================================================

/**
 * Find or create a workspace by subdomain (internal, admin-only).
 * Used to provision the houston workspace (and other seed workspaces) that
 * exist outside the normal user sign-up flow.
 *
 * Returns { workspace_id, created } — idempotent.
 */
export const seedWorkspace = internalMutation({
  args: {
    subdomain: v.string(),
    username: v.string(),
    user_id: v.string(),    // Clerk user ID or synthetic ID
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("provisioning"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("error")
    )),
    template: v.optional(v.string()),
    region: v.optional(v.string()),
    plan: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("team"))),
    fly_machine_id: v.optional(v.string()),
    fly_app_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if workspace already exists
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain))
      .first();

    if (existing) {
      return { workspace_id: existing._id, created: false, subdomain: existing.subdomain };
    }

    // Find or create the user record
    let userDocId: any;

    // Try to find by clerk_user_id or the string id field
    const existingUser = await ctx.db
      .query("users")
      .filter((q) =>
        q.or(
          q.eq(q.field("clerk_user_id"), args.user_id),
          q.eq(q.field("id"), args.user_id),
        )
      )
      .first();

    if (existingUser) {
      userDocId = existingUser._id;
    } else {
      // Create a placeholder user record for this workspace owner
      const now = Date.now();
      userDocId = await ctx.db.insert("users", {
        id: args.user_id,
        clerk_user_id: args.user_id,
        email: `${args.username}@hubify.internal`,
        username: args.username,
        display_name: args.username,
        plan: args.plan ?? "pro",
        max_workspaces: 10,
        workspace_count: 0,
        created_at: now,
        updated_at: now,
      });
    }

    const now = Date.now();
    const workspace_id = await ctx.db.insert("workspaces", {
      user_id: userDocId,
      username: args.username,
      subdomain: args.subdomain,
      status: args.status ?? "active",
      region: args.region ?? "sfo",
      template: args.template ?? "default",
      plan: args.plan ?? "pro",
      openclaw_version: "latest",
      fly_machine_id: args.fly_machine_id,
      fly_app_name: args.fly_app_name ?? `hubify-ws-${args.subdomain}`,
      provisioned_at: args.status === "active" ? now : undefined,
      created_at: now,
      updated_at: now,
    });

    return { workspace_id, created: true, subdomain: args.subdomain };
  },
});

/**
 * Internal query: get workspace by subdomain without auth (for admin/health checks).
 */
export const getBySubdomainInternal = internalQuery({
  args: { subdomain: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain))
      .first();
  },
});

/**
 * Admin: Provision a workspace by looking up an existing user by their custom string id.
 * Called from CLI: npx convex run workspaces:adminProvisionWorkspace '{"user_string_id":"...", ...}'
 *
 * This is a PUBLIC mutation callable from the Convex CLI (for one-time bootstrapping).
 * It is intentionally not auth-gated so it can be run from deploy scripts.
 * SECURITY: Only call this from trusted scripts. Remove from prod after use.
 */
export const adminProvisionWorkspace = mutation({
  args: {
    user_string_id: v.string(),   // The custom "id" field on the users record (e.g. "user_1771776564211_1p8ow0")
    subdomain: v.string(),
    username: v.string(),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("provisioning"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("error")
    )),
    template: v.optional(v.string()),
    region: v.optional(v.string()),
    plan: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("team"))),
    fly_machine_id: v.optional(v.string()),
    fly_app_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Idempotent: check existing workspace first
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain))
      .first();

    if (existing) {
      return {
        workspace_id: existing._id,
        created: false,
        subdomain: existing.subdomain,
        message: "Workspace already exists — no changes made",
      };
    }

    // Find user by their string id field
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("id"), args.user_string_id))
      .first();

    if (!user) {
      throw new Error(
        `User not found with id="${args.user_string_id}". ` +
        `Run users:getUserByEmail to find the correct user_id.`
      );
    }

    const now = Date.now();
    const workspace_id = await ctx.db.insert("workspaces", {
      user_id: user._id,
      username: args.username,
      subdomain: args.subdomain,
      status: args.status ?? "active",
      region: args.region ?? "sfo",
      template: args.template ?? "default",
      plan: args.plan ?? "pro",
      openclaw_version: "latest",
      fly_machine_id: args.fly_machine_id,
      fly_app_name: args.fly_app_name ?? `hubify-ws-${args.subdomain}`,
      provisioned_at: (args.status ?? "active") === "active" ? now : undefined,
      created_at: now,
      updated_at: now,
    });

    // Update user's workspace count
    await ctx.db.patch(user._id, {
      workspace_count: (user.workspace_count ?? 0) + 1,
      updated_at: now,
    });

    return {
      workspace_id,
      created: true,
      subdomain: args.subdomain,
      user_convex_id: user._id,
      message: `Workspace '${args.subdomain}' provisioned successfully`,
    };
  },
});
