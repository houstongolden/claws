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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const body = await request.json();
    const { commitSha, appName } = body;

    if (!commitSha || !appName) {
      return NextResponse.json(
        { error: "Missing commitSha or appName" },
        { status: 400 }
      );
    }

    // Verify ownership
    const convex = getConvexClient();
    const hub = await convex.query(api.hubs.getHub, { hub_id: workspaceId as any });

    if (!hub) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    if (hub.owner_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!FLY_API_TOKEN) {
      return NextResponse.json({ error: "Fly API token not configured" }, { status: 500 });
    }

    // Get machine
    const machinesRes = await fetch(`${FLY_MACHINES_API}/apps/${appName}/machines`, {
      headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
    });

    if (!machinesRes.ok) {
      return NextResponse.json({ error: "Failed to fetch machines" }, { status: 500 });
    }

    const machines = await machinesRes.json();
    const machine = machines[0];

    if (!machine || machine.state !== "started") {
      return NextResponse.json(
        { error: "Workspace must be running for rollback" },
        { status: 400 }
      );
    }

    // Execute rollback via stats-server
    const execRes = await fetch(
      `${FLY_MACHINES_API}/apps/${appName}/machines/${machine.id}/exec`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: [
            "sh", "-c",
            `curl -sf -X POST http://127.0.0.1:4000/git/rollback -H 'Content-Type: application/json' -d '{"sha":"${commitSha}"}'`,
          ],
          timeout: 30,
        }),
      }
    );

    if (!execRes.ok) {
      return NextResponse.json({ error: "Failed to execute rollback" }, { status: 500 });
    }

    const execResult = await execRes.json();
    const stdout = execResult.stdout || "";

    try {
      const result = JSON.parse(stdout);
      if (result.ok) {
        return NextResponse.json({
          success: true,
          message: `Rolled back to ${result.rolledBackTo}`,
          newCommitSha: result.newShortSha,
          rolledBackTo: result.rolledBackTo,
        });
      }
      return NextResponse.json(
        { success: false, message: result.error || "Rollback failed" },
        { status: 400 }
      );
    } catch {
      return NextResponse.json(
        { success: false, message: "Unexpected response from workspace" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[rollback POST] Unhandled error:", error);
    return NextResponse.json({ error: "Failed to perform rollback" }, { status: 500 });
  }
}
