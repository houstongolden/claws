import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
import { apiError } from "@/lib/api-response";
import { recordAuditEvent } from "@/lib/audit";
import { z } from "zod";

// Validation schema for workspace metadata updates
const UpdateWorkspaceMetadataSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(100, "Name must be 100 characters or less")
    .optional(),
  subdomain: z
    .string()
    .min(3, "Subdomain must be at least 3 characters")
    .max(30, "Subdomain must be 30 characters or less")
    .regex(
      /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/,
      "Subdomain must be lowercase letters, numbers, and hyphens only (no leading/trailing hyphens)"
    )
    .optional()
    .nullable(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable(),
});

const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_MACHINES_API = "https://api.machines.dev/v1";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(CONVEX_URL);
}

async function flyGet(path: string) {
  const res = await fetch(`${FLY_MACHINES_API}${path}`, {
    headers: { Authorization: `Bearer ${FLY_API_TOKEN}` },
    next: { revalidate: 0 }, // always fresh
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * GET /api/workspaces/[id]
 *
 * Query params:
 *   ?app = Fly app name (e.g. hubify-ws-houston)
 *   ?hub_id = Convex hub ID (optional, for status sync)
 *
 * Returns:
 *   { id, status, workspaceUrl, appName, hubId }
 *
 * Status values:
 *   provisioning | starting | active | stopped | error
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
        apiError("UNAUTHORIZED", "Unauthorized: User not authenticated"),
        { status: 401 }
      );
    }

    const { id: machineId } = await params;
    const appName = request.nextUrl.searchParams.get("app") ?? "";
    const hubId = request.nextUrl.searchParams.get("hub_id");

    // SECURITY: Verify user owns the hub (if provided)
    if (hubId) {
      try {
        const convex = getConvexClient();
        const hub = await convex.query(api.hubs.getHub, {
          hub_id: hubId as any,
        });

        if (!hub) {
          return NextResponse.json(
            apiError("HUB_NOT_FOUND", "Hub not found"),
            { status: 404 }
          );
        }

        if (hub.owner_id !== userId) {
          return NextResponse.json(
            apiError(
              "FORBIDDEN",
              "Forbidden: You do not have permission to access this workspace"
            ),
            { status: 403 }
          );
        }
      } catch (hubCheckErr) {
        console.error("[workspace GET] Hub ownership check failed:", hubCheckErr);
        return NextResponse.json(
          apiError("HUB_OWNERSHIP_CHECK_FAILED", "Failed to verify hub ownership"),
          { status: 500 }
        );
      }
    }

    // If no Fly token, simulate progression for dev
    if (!FLY_API_TOKEN) {
      return NextResponse.json({
        id: machineId,
        appName: appName || "hubify-ws-dev",
        status: "provisioning",
        workspaceUrl: null,
        message: "[DEV] No FLY_API_TOKEN — status simulated",
      });
    }

    if (!appName) {
      return NextResponse.json(
        apiError("MISSING_APP_PARAM", "Missing ?app query param"),
        { status: 400 }
      );
    }

    // Fetch machine state from Fly
    const machine = await flyGet(`/apps/${appName}/machines/${machineId}`);

    if (!machine) {
      // Check if app exists but has NO machines — this means provisioning failed silently
      const appMachines = await flyGet(`/apps/${appName}/machines`);
      if (Array.isArray(appMachines) && appMachines.length === 0) {
        return NextResponse.json({
          id: machineId,
          appName,
          status: "error",
          error: "Machine provisioning failed — no machines found in app. Please try again.",
          workspaceUrl: null,
        });
      }
      // Machine not found yet — still provisioning
      return NextResponse.json({
        id: machineId,
        appName,
        status: "provisioning",
        workspaceUrl: null,
      });
    }

    const flyState = machine.state as string; // created | starting | started | stopped | failed
    const statusMap: Record<string, string> = {
      created: "provisioning",
      starting: "starting",
      started: "started", // "started" means Fly machine is up, but gateway may not be ready yet
      stopped: "stopped",
      failed: "error",
      destroying: "stopped",
      destroyed: "stopped",
    };
    let status = statusMap[flyState] ?? flyState;

    // When machine is "started", verify the gateway is actually ready
    // nginx boots fast but the OpenClaw gateway takes ~45s
    // Check /health (proxies to gateway:3000) not /__health (static nginx 200)
    if (status === "started") {
      try {
        const gatewayHealthUrl = `https://${appName}.fly.dev/health`;
        const healthRes = await fetch(gatewayHealthUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (healthRes.ok) {
          status = "active";
        }
        // If gateway health fails, stay as "started" (provisioning page keeps polling)
      } catch {
        // Timeout or network error — gateway not ready yet
      }
    }

    // Derive the workspace URL from the hub's subdomain (e.g. houston.hubify.com)
    // Fall back to Fly dev URL if hub lookup fails
    let workspaceUrl: string | null = null;
    if (status === "active") {
      if (hubId) {
        try {
          const convex = getConvexClient();
          const hub = await convex.query(api.hubs.getHub, { hub_id: hubId as any });
          if (hub?.subdomain) {
            workspaceUrl = `https://${hub.subdomain}`;
          }
        } catch {
          // Fall through to default
        }
      }
      if (!workspaceUrl) {
        workspaceUrl = `https://${appName}.fly.dev`;
      }
    }

    // If hub_id provided and status changed to active, update Convex
    if (hubId && status === "active") {
      try {
        const convex = getConvexClient();
        await convex.mutation(api.hubs.updateHubStatus, {
          hub_id: hubId as any,
          status: "active" as const,
        });
        console.log(`[convex] Hub ${hubId} status updated to active`);
      } catch (e) {
        console.warn("[convex] Failed to sync hub status:", e);
        // Non-fatal
      }
    }

    return NextResponse.json({
      id: machineId,
      appName,
      hubId,
      flyState,
      status,
      workspaceUrl,
      privateIp: machine.private_ip,
      region: machine.region,
      updatedAt: machine.updated_at,
    });
  } catch (error) {
    console.error("[workspace status] Error:", error);
    return NextResponse.json(
      apiError("WORKSPACE_STATUS_FETCH_FAILED", "Failed to fetch workspace status"),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspaces/[id]
 * Update workspace metadata (name, subdomain, description)
 *
 * SECURITY: Requires Clerk authentication + hub ownership verification
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Verify user is authenticated via Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        apiError("UNAUTHORIZED", "Unauthorized: User not authenticated"),
        { status: 401 }
      );
    }

    const { id: workspaceId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        apiError("INVALID_JSON", "Invalid JSON body"),
        { status: 400 }
      );
    }

    // Validate request body
    const validation = UpdateWorkspaceMetadataSchema.safeParse(body);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const err of validation.error.errors) {
        errors[err.path.join(".")] = err.message;
      }
      return NextResponse.json(
        apiError("VALIDATION_ERROR", "Invalid workspace metadata", errors),
        { status: 400 }
      );
    }
    const validatedBody = validation.data;

    // Verify user owns this workspace
    try {
      const convex = getConvexClient();
      const hub = await convex.query(api.hubs.getHub, {
        hub_id: workspaceId as any,
      });

      if (!hub) {
        return NextResponse.json(
          apiError("WORKSPACE_NOT_FOUND", "Workspace not found"),
          { status: 404 }
        );
      }

      if (hub.owner_id !== userId) {
        return NextResponse.json(
          apiError(
            "FORBIDDEN",
            "Forbidden: You do not have permission to update this workspace"
          ),
          { status: 403 }
        );
      }
    } catch (err) {
      console.error("[workspace PUT] Convex query failed:", err);
      return NextResponse.json(
        apiError("WORKSPACE_OWNERSHIP_CHECK_FAILED", "Failed to verify workspace ownership"),
        { status: 500 }
      );
    }

    // Update metadata in Convex
    try {
      const convex = getConvexClient();
      const updated = await convex.mutation(api.hubs.updateHubMetadata, {
        hub_id: workspaceId as any,
        display_name: validatedBody.name,
        description: validatedBody.description ?? undefined,
        subdomain: validatedBody.subdomain ?? undefined,
      });

      return NextResponse.json(updated);
    } catch (err) {
      console.error("[workspace PUT] Convex mutation failed:", err);
      return NextResponse.json(
        apiError("WORKSPACE_METADATA_UPDATE_FAILED", "Failed to update workspace metadata"),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[workspace PUT] Error:", error);
    return NextResponse.json(
      apiError("WORKSPACE_UPDATE_FAILED", "Failed to update workspace"),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[id]?app=hubify-ws-{username}
 * Destroys the machine and app
 *
 * SECURITY: Requires Clerk authentication + hub ownership verification
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Verify user is authenticated via Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        apiError("UNAUTHORIZED", "Unauthorized: User not authenticated"),
        { status: 401 }
      );
    }

    const { id: machineId } = await params;
    const appName = request.nextUrl.searchParams.get("app");
    const hubId = request.nextUrl.searchParams.get("hub_id");

    if (!appName || !FLY_API_TOKEN) {
      return NextResponse.json(apiError("MISSING_APP_OR_TOKEN", "Missing app or token"), { status: 400 });
    }

    // SECURITY: Verify user owns the hub (if provided)
    if (hubId) {
      try {
        const convex = getConvexClient();
        const hub = await convex.query(api.hubs.getHub, {
          hub_id: hubId as any,
        });

        if (!hub) {
          return NextResponse.json(
            apiError("HUB_NOT_FOUND", "Hub not found"),
            { status: 404 }
          );
        }

        if (hub.owner_id !== userId) {
          return NextResponse.json(
            apiError(
              "FORBIDDEN",
              "Forbidden: You do not have permission to delete this workspace"
            ),
            { status: 403 }
          );
        }
      } catch (hubCheckErr) {
        console.error("[workspace delete] Hub ownership check failed:", hubCheckErr);
        return NextResponse.json(
          apiError("HUB_OWNERSHIP_CHECK_FAILED", "Failed to verify hub ownership"),
          { status: 500 }
        );
      }
    }

    // Step 1: Stop the machine first (force stop if running)
    const stopRes = await fetch(
      `${FLY_MACHINES_API}/apps/${appName}/machines/${machineId}/stop`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${FLY_API_TOKEN}` },
      }
    );
    if (stopRes.ok) {
      // Wait for machine to fully stop (max 15s)
      for (let i = 0; i < 15; i++) {
        const checkRes = await fetch(
          `${FLY_MACHINES_API}/apps/${appName}/machines/${machineId}`,
          { headers: { Authorization: `Bearer ${FLY_API_TOKEN}` } }
        );
        if (checkRes.ok) {
          const machine = await checkRes.json();
          if (machine.state === "stopped" || machine.state === "destroyed") break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Step 2: Destroy machine (force=true handles edge cases)
    const machineDelRes = await fetch(
      `${FLY_MACHINES_API}/apps/${appName}/machines/${machineId}?force=true`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${FLY_API_TOKEN}` },
      }
    );
    if (!machineDelRes.ok && machineDelRes.status !== 404) {
      const errText = await machineDelRes.text().catch(() => "");
      console.error(`[workspace delete] Machine delete failed (${machineDelRes.status}):`, errText);
    }

    // Step 3: Destroy the Fly app
    const appDelRes = await fetch(`${FLY_MACHINES_API}/apps/${appName}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${FLY_API_TOKEN}` },
    });
    if (!appDelRes.ok && appDelRes.status !== 404) {
      const errText = await appDelRes.text().catch(() => "");
      console.error(`[workspace delete] App delete failed (${appDelRes.status}):`, errText);
    }

    // Step 4: Delete hub record from Convex DB
    if (hubId) {
      try {
        const convex = getConvexClient();
        await convex.mutation(api.hubs.deleteWorkspace, {
          hub_id: hubId as any,
          user_id: userId,
        });
        console.log(`[workspace delete] Hub ${hubId} deleted from Convex`);
      } catch (convexErr) {
        console.error("[workspace delete] Convex deletion failed:", convexErr);
        // Non-fatal — Fly resources are already gone
      }
    }

    recordAuditEvent({
      user_id: userId,
      action: "workspace_deleted",
      target_type: "workspace",
      target_id: hubId || machineId,
      metadata: { appName, machineId },
    });

    return NextResponse.json({ id: machineId, status: "deleted" });
  } catch (error) {
    console.error("[workspace delete] Error:", error);
    return NextResponse.json(apiError("WORKSPACE_DELETE_FAILED", "Failed to delete workspace"), { status: 500 });
  }
}
