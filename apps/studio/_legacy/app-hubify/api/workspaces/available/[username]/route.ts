import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
import { apiError, apiServerError } from "@/lib/api-errors";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(CONVEX_URL);
}

function validateUsername(username: string): boolean {
  return /^[a-z0-9-]{3,20}$/.test(username);
}

/**
 * GET /api/workspaces/available/[username] - Check if a workspace username is available
 * Returns: { available: boolean, username: string, reason?: string }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = rawUsername?.toLowerCase();

    if (!username) {
      return apiError('Username is required', 400, 'BAD_REQUEST');
    }

    // Validate format
    if (!validateUsername(username)) {
      return NextResponse.json(
        { 
          available: false, 
          username,
          reason: "Invalid format: 3–20 characters, lowercase letters, numbers, and hyphens only"
        },
        { status: 200 }
      );
    }

    // Check Convex if this subdomain is taken
    const convex = getConvexClient();
    
    try {
      // Query Convex to check if workspace with this subdomain exists
      const result = await convex.query(api.workspaces.checkSubdomain, {
        subdomain: username,
      });

      return NextResponse.json({
        available: result.available,
        username,
        reason: result.reason,
      });
    } catch (convexError: any) {
      // If the Convex query doesn't exist yet, return available=true
      // This is a graceful fallback during development
      console.warn("Convex query error (falling back):", convexError.message);
      return NextResponse.json({
        available: true,
        username,
      });
    }
  } catch (error) {
    console.error("Error checking username availability:", error);
    return apiServerError('Failed to check username availability — please try again');
  }
}
