import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
import {
  checkMachineRateLimit,
  recordMachineAttempt,
  getMachineProvisionUsage,
} from "@/lib/machine-rate-limit";

const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_MACHINES_API = "https://api.machines.dev/v1";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(CONVEX_URL);
}

async function flyCreate(path: string, body: any) {
  const res = await fetch(`${FLY_MACHINES_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    throw new Error(`Fly API error (${res.status}): ${error}`);
  }
  return res.json();
}

/**
 * POST /api/workspaces/[id]/machines
 *
 * Create a new machine for a workspace.
 *
 * Request body:
 *   {
 *     appName: string,           // e.g. hubify-ws-houston
 *     config: MachineConfig      // Fly machine config
 *   }
 *
 * Returns:
 *   { id, appName, status: "provisioning", message }
 *
 * Rate limits:
 *   - 3 machines per workspace per hour (returns 429)
 *   - Gracefully degrades if rate limit service down
 *
 * SECURITY: Requires Clerk authentication + hub ownership verification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Verify user is authenticated via Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User not authenticated" },
        { status: 401 }
      );
    }

    const { id: workspaceId } = await params;
    const body = await request.json();
    const { appName, config } = body;

    if (!appName || !config) {
      return NextResponse.json(
        { error: "Missing appName or config in request body" },
        { status: 400 }
      );
    }

    // SECURITY: Verify user owns this workspace
    try {
      const convex = getConvexClient();
      const hub = await convex.query(api.hubs.getHub, {
        hub_id: workspaceId as any,
      });

      if (!hub) {
        return NextResponse.json(
          { error: "Workspace not found" },
          { status: 404 }
        );
      }

      if (hub.owner_id !== userId) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to modify this workspace" },
          { status: 403 }
        );
      }
    } catch (err) {
      console.error("[machines POST] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // RATE LIMITING: Check if workspace exceeded 3 machines per hour
    // ────────────────────────────────────────────────────────────────────────
    let rateLimitResult;
    try {
      rateLimitResult = await checkMachineRateLimit(workspaceId);
    } catch (err) {
      // Fail open if rate limit service is down (graceful degradation)
      console.warn("[machines POST] Rate limit check failed, failing open:", err);
      rateLimitResult = { allowed: true, remaining: 3 };
    }

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: rateLimitResult.message,
          retryAfter: rateLimitResult.retryAfterSeconds,
        },
        { status: 429 }
      );

      // Set standard Retry-After header
      if (rateLimitResult.retryAfterSeconds) {
        response.headers.set(
          "Retry-After",
          String(rateLimitResult.retryAfterSeconds)
        );
      }

      return response;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Create machine on Fly
    // ────────────────────────────────────────────────────────────────────────

    if (!FLY_API_TOKEN) {
      return NextResponse.json(
        {
          error: "Fly API token not configured",
          message: "[DEV] FLY_API_TOKEN missing",
        },
        { status: 500 }
      );
    }

    let machineId: string;
    try {
      const machine = await flyCreate(`/apps/${appName}/machines`, config);
      machineId = machine.id;
      console.log(
        `[machines POST] Created machine ${machineId} for workspace ${workspaceId}`
      );
    } catch (err) {
      console.error("[machines POST] Fly creation failed:", err);
      return NextResponse.json(
        {
          error: "Failed to create machine",
          message: err instanceof Error ? err.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // Record successful attempt for rate limiting
    // ────────────────────────────────────────────────────────────────────────
    try {
      await recordMachineAttempt(workspaceId);
    } catch (err) {
      // Fail open if recording fails (still allow the machine creation)
      console.warn("[machines POST] Failed to record rate limit attempt:", err);
    }

    // Get updated usage info
    let usage;
    try {
      usage = await getMachineProvisionUsage(workspaceId);
    } catch (err) {
      usage = { attemptsLastHour: 1, maxPerHour: 3, remaining: 2 };
    }

    return NextResponse.json(
      {
        id: machineId,
        appName,
        status: "provisioning",
        message: "Machine provisioning started",
        rateLimit: {
          remaining: usage.remaining,
          maxPerHour: usage.maxPerHour,
          resetIn: "~1 hour",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[machines POST] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to provision machine" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workspaces/[id]/machines
 *
 * Get machine provisioning usage/quota info for a workspace.
 * Useful for frontend to show rate limit status before attempting POST.
 *
 * Returns:
 *   { attemptsLastHour, maxPerHour, remaining }
 *
 * SECURITY: Requires Clerk authentication + hub ownership verification
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Verify user is authenticated via Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User not authenticated" },
        { status: 401 }
      );
    }

    const { id: workspaceId } = await params;

    // SECURITY: Verify user owns this workspace
    try {
      const convex = getConvexClient();
      const hub = await convex.query(api.hubs.getHub, {
        hub_id: workspaceId as any,
      });

      if (!hub) {
        return NextResponse.json(
          { error: "Workspace not found" },
          { status: 404 }
        );
      }

      if (hub.owner_id !== userId) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to access this workspace" },
          { status: 403 }
        );
      }
    } catch (err) {
      console.error("[machines GET] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    // Get usage info
    let usage;
    try {
      usage = await getMachineProvisionUsage(workspaceId);
    } catch (err) {
      console.warn("[machines GET] Failed to get usage:", err);
      usage = { attemptsLastHour: 0, maxPerHour: 3, remaining: 3 };
    }

    return NextResponse.json(usage);
  } catch (error) {
    console.error("[machines GET] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to fetch machine quota" },
      { status: 500 }
    );
  }
}
