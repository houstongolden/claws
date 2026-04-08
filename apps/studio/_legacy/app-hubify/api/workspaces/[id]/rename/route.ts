import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(CONVEX_URL);
}

/** PATCH /api/workspaces/[id]/rename */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: hubId } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.length < 1 || name.length > 64) {
      return NextResponse.json({ error: "Invalid name (1-64 characters)" }, { status: 400 });
    }

    // Validate: lowercase alphanumeric + hyphens only
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && name.length > 1) {
      return NextResponse.json({ error: "Name must be lowercase letters, numbers, and hyphens" }, { status: 400 });
    }

    const convex = getConvexClient();

    // Verify ownership
    const hub = await convex.query(api.hubs.getHub, { hub_id: hubId as any });
    if (!hub) return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    if (hub.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Update name in Convex
    await convex.mutation(api.hubs.updateHubName, {
      hub_id: hubId as any,
      name,
    });

    return NextResponse.json({ id: hubId, name, status: "updated" });
  } catch (error) {
    console.error("[workspace rename] Error:", error);
    return NextResponse.json({ error: "Failed to rename workspace" }, { status: 500 });
  }
}
