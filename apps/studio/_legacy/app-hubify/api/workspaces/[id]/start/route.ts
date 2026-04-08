import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";

const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_MACHINES_API = "https://api.machines.dev/v1";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(CONVEX_URL);
}

/** POST /api/workspaces/[id]/start?app=hubify-ws-{name}&hub_id={convexId} */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Not signed in", friendlyMessage: "Please sign in to start your workspace." },
        { status: 401 }
      );
    }

    const { id: machineId } = await params;
    const appName = request.nextUrl.searchParams.get("app");
    const hubId = request.nextUrl.searchParams.get("hub_id");

    if (!appName || !FLY_API_TOKEN) {
      return NextResponse.json(
        { error: "Configuration error", friendlyMessage: "Please refresh and try again." },
        { status: 400 }
      );
    }

    if (hubId) {
      const convex = getConvexClient();
      const hub = await convex.query(api.hubs.getHub, { hub_id: hubId as any });
      if (!hub) {
        return NextResponse.json(
          { error: "Workspace not found", friendlyMessage: "This workspace may have been deleted." },
          { status: 404 }
        );
      }
      if (hub.owner_id !== userId) {
        return NextResponse.json(
          { error: "Access denied", friendlyMessage: "You don't have permission to start this workspace." },
          { status: 403 }
        );
      }
    }

    const res = await fetch(`${FLY_MACHINES_API}/apps/${appName}/machines/${machineId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${FLY_API_TOKEN}` },
    });

    if (!res.ok && res.status !== 400) {
      return NextResponse.json(
        { error: "Failed to start workspace", friendlyMessage: "Please try again. If this continues, contact support." },
        { status: 500 }
      );
    }

    // Don't set "active" here — the machine is starting but the gateway isn't ready yet.
    // The status API (/api/workspaces/[id]) will set "active" once the gateway health check passes.
    if (hubId) {
      try {
        const convex = getConvexClient();
        await convex.mutation(api.hubs.updateHubStatus, {
          hub_id: hubId as any,
          status: "starting" as const,
        });
      } catch (e) {
        console.warn("[workspace start] Failed to sync status:", e);
      }
    }

    return NextResponse.json({ id: machineId, status: "starting" });
  } catch (error) {
    console.error("[workspace start] Error:", error);
    return NextResponse.json(
      { error: "Failed to start workspace", friendlyMessage: "Please try again or contact support." },
      { status: 500 }
    );
  }
}
