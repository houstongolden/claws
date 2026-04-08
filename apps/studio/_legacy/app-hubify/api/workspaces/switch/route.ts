import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(CONVEX_URL);
}

/**
 * POST /api/workspaces/switch — Set active workspace for user
 * 
 * Request body:
 * {
 *   workspace_id: "workspace_123"
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   user_id: "user_123",
 *   active_workspace_id: "workspace_123"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthUser();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workspace_id } = body;

    if (!workspace_id) {
      return NextResponse.json(
        { error: "workspace_id is required" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // Call Convex mutation to set active workspace
    const result = await convex.mutation(api.hubs.setActiveWorkspace, {
      user_id: userId,
      workspace_id: workspace_id,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const errorMsg = String(error);
    console.error("[switch-workspace] Error:", errorMsg);

    if (errorMsg.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized: Cannot switch to that workspace" },
        { status: 403 }
      );
    }

    if (errorMsg.includes("not found")) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to switch workspace" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workspaces/switch — Get active workspace for user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuthUser();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User not authenticated" },
        { status: 401 }
      );
    }

    const convex = getConvexClient();

    // Query active workspace
    const result = await convex.query(api.hubs.getActiveWorkspace, {
      user_id: userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[get-active-workspace] Error:", error);
    return NextResponse.json(
      { error: "Failed to get active workspace" },
      { status: 500 }
    );
  }
}
