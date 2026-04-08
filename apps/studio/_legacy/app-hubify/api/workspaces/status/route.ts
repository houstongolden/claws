import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
const auth = getAuthUser;
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
import { apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api-errors";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(CONVEX_URL);
}

/**
 * GET /api/workspaces/status?user_id=xxx
 * Returns user's workspace list and subscription status
 * 
 * Uses real Convex query: api.hubs.getUserWorkspaceStatus
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify user is authenticated via Clerk
    const { userId } = await auth();
    if (!userId) {
      return apiUnauthorized();
    }

    const requested_user_id = request.nextUrl.searchParams.get("user_id");

    // SECURITY: Only allow users to query their own workspace status
    if (requested_user_id && requested_user_id !== userId) {
      return apiForbidden('You can only access your own workspace status');
    }

    // Use authenticated userId if not explicitly requested
    const user_id = requested_user_id || userId;

    // Query real Convex data
    const convex = getConvexClient();
    const result = await convex.query(api.hubs.getUserWorkspaceStatus, {
      user_id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[workspace-status] Error:", error);
    return apiServerError('Failed to load workspace status — please refresh and try again');
  }
}
