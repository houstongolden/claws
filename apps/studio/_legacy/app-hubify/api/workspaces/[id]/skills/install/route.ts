import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
import { recordAuditEvent } from "@/lib/audit";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(CONVEX_URL);
}

/**
 * POST /api/workspaces/[id]/skills/install
 * 
 * Installs a skill into a workspace.
 * 
 * Request body:
 * {
 *   "skillId": "string",       // Skill identifier (e.g., "github" or "full-skill-name")
 *   "skillName": "string",     // Human-readable skill name
 *   "skillVersion": "string"   // Semantic version (e.g., "1.0.0")
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // --- SECURITY: Verify user is authenticated ---
    const { userId } = await getAuthUser();
    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const workspaceId = params.id;
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { skillId, skillName, skillVersion } = body;

    if (!skillId || !skillName) {
      return NextResponse.json(
        { error: "skillId and skillName are required" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // --- Verify user owns the workspace ---
    let workspace;
    try {
      workspace = await convex.query(api.hubs.getHubById, {
        hub_id: workspaceId as any,
      });
    } catch (e) {
      console.warn("[skills] Workspace lookup failed:", e);
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (!workspace || workspace.owner_id !== userId) {
      return NextResponse.json(
        { error: "You do not have permission to modify this workspace" },
        { status: 403 }
      );
    }

    // --- Record skill installation ---
    try {
      await convex.mutation(api.workspaceActivity.recordSkillInstall, {
        hub_id: workspaceId as any,
        skillId,
        skillName,
        skillVersion: skillVersion || "unknown",
        installedBy: userId,
      });
    } catch (e) {
      console.warn("[skills] Failed to record skill install:", e);
      // Non-fatal — continue
    }

    // Record audit event (fire-and-forget)
    recordAuditEvent({
      user_id: userId,
      action: "skill_installed",
      target_type: "skill",
      target_id: skillId,
      metadata: { skillName, skillVersion: skillVersion || "unknown", workspaceId },
    });

    // --- Return success with progress tracking info ---
    return NextResponse.json(
      {
        success: true,
        skillId,
        skillName,
        workspaceId,
        installStatus: "installing",
        message: `Installing ${skillName}...`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[skills/install] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to install skill" },
      { status: 500 }
    );
  }
}
