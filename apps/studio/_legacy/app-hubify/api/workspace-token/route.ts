import { getAuthUser, getDevUser } from "@/lib/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
const auth = getAuthUser;
const currentUser = getDevUser;
import { SignJWT } from "jose"
import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-response";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(CONVEX_URL);
}

function getSecret() {
  const rawSecret = process.env.WORKSPACE_JWT_SECRET?.trim();
  if (!rawSecret) {
    throw new Error('WORKSPACE_JWT_SECRET must be set in environment variables. This is required for workspace token generation.');
  }
  return new TextEncoder().encode(rawSecret);
}

/**
 * GET /api/workspace-token?workspace={username}
 *
 * Issues a JWT for accessing a specific workspace (username.hubify.com).
 * The JWT `username` field MUST match the container's HUBIFY_USERNAME env var
 * (set during provisioning from the hub `name` field).
 *
 * If ?workspace is not specified, defaults to the user's first hub.
 *
 * SECURITY: The token is scoped to a specific workspace — the stats-server
 * inside the container validates that token.username === HUBIFY_USERNAME.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json(apiError("UNAUTHORIZED", "unauthorized"), { status: 401 })
  }

  // Get full user profile for email
  const user = await currentUser()

  const email = (user as any)?.primaryEmailAddress?.emailAddress || (user?.emailAddresses?.[0]?.emailAddress) || ""

  if (!email) {
    return NextResponse.json(
      apiError("EMAIL_REQUIRED", "Unable to determine user email for verification."),
      { status: 400 }
    )
  }

  const convex = getConvexClient()
  const provisionCheck = await convex.query(api.waitlist.canProvisionWorkspace, { email })

  if (!provisionCheck.can_provision) {
    return NextResponse.json(
      apiError(
        "EMAIL_VERIFICATION_REQUIRED",
        provisionCheck.message || "Email verification required.",
        {
          reason: provisionCheck.reason,
          verification_pending: provisionCheck.verification_pending || false,
        }
      ),
      { status: 403 }
    )
  }

  // Resolve workspace username from Convex hubs
  // The workspace container's HUBIFY_USERNAME is set to the hub's `name` field,
  // NOT the Clerk profile username (which could be a GitHub handle or email prefix).
  const requestedWorkspace = request.nextUrl.searchParams.get("workspace");
  let workspaceUsername: string;

  try {
    const hubs = await convex.query(api.hubs.listHubsByOwner, { owner_id: userId });

    if (!hubs || hubs.length === 0) {
      return NextResponse.json(
        apiError("WORKSPACE_NOT_FOUND", "No workspaces found. Please create a workspace first."),
        { status: 404 }
      );
    }

    if (requestedWorkspace) {
      // Find the specific hub matching the requested workspace name
      const hub = hubs.find((h: any) => h.name === requestedWorkspace);
      if (!hub) {
        return NextResponse.json(
          apiError(
            "WORKSPACE_NOT_FOUND",
            `Workspace "${requestedWorkspace}" not found or not owned by you.`
          ),
          { status: 404 }
        );
      }
      workspaceUsername = hub.name;
    } else {
      // Default to first hub
      workspaceUsername = (hubs[0] as any).name;
    }
  } catch (err) {
    console.error("[workspace-token] Failed to lookup hubs:", err);
    return NextResponse.json(
      apiError(
        "HUB_LOOKUP_FAILED",
        "Unable to verify workspace ownership. Please try again."
      ),
      { status: 503 }
    );
  }

  const token = await new SignJWT({
    username: workspaceUsername,
    sub: userId,
    email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret())

  const res = NextResponse.json({ ok: true, username: workspaceUsername })

  // Set cookie valid for *.hubify.com (and localhost for dev)
  const isProduction = process.env.NODE_ENV === "production"
  res.cookies.set("hubify_ws_token", token, {
    domain: isProduction ? ".hubify.com" : undefined,
    httpOnly: true,
    secure: isProduction,
    maxAge: 86400,
    sameSite: "lax",
    path: "/",
  })

  return res
}
