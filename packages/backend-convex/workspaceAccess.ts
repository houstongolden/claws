import { query } from "./_generated/server";
import { v } from "convex/values";
import { getUserRoleInWorkspace, canView } from "./permissions";

/**
 * Get workspace with permission check
 * Only returns if user has at least viewer access
 */
export const getWorkspaceWithAccess = query({
  args: {
    workspace_id: v.id("workspaces"),
    user_id: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get user's role in workspace
    const userRole = await getUserRoleInWorkspace(
      ctx,
      args.workspace_id,
      args.user_id
    );

    // Check permission
    if (!canView(userRole)) {
      throw new Error("PERMISSION_DENIED: You do not have access to this workspace");
    }

    // Return workspace details
    const workspace = await ctx.db.get(args.workspace_id);
    if (!workspace) {
      throw new Error("WORKSPACE_NOT_FOUND");
    }

    return {
      id: workspace._id,
      username: workspace.username,
      subdomain: workspace.subdomain,
      status: workspace.status,
      plan: workspace.plan,
      region: workspace.region,
      user_id: workspace.user_id,
      created_at: workspace.created_at,
      updated_at: workspace.updated_at,
    };
  },
});

/**
 * Get list of workspaces accessible to user
 */
export const getAccessibleWorkspaces = query({
  args: {
    user_id: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get all workspace memberships for this user
    const memberships = await ctx.db
      .query("workspace_members")
      .withIndex("by_user", (q) => q.eq("user_id", args.user_id))
      .collect();

    const workspaces = [];

    for (const membership of memberships) {
      const workspace = await ctx.db.get(membership.workspace_id);
      if (workspace) {
        workspaces.push({
          id: workspace._id,
          username: workspace.username,
          subdomain: workspace.subdomain,
          status: workspace.status,
          plan: workspace.plan,
          role: membership.role,
          created_at: workspace.created_at,
          member_since: membership.added_at,
        });
      }
    }

    return workspaces;
  },
});
