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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const appName = request.nextUrl.searchParams.get("appName");

    if (!appName) {
      return NextResponse.json({ error: "Missing appName query parameter" }, { status: 400 });
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
      return NextResponse.json({
        branch: "unknown", latestCommitSha: "unknown",
        latestCommitMessage: "Fly API not configured", author: "unknown",
        timestamp: new Date().toISOString(),
      });
    }

    // Get machine
    const machinesRes = await fetch(`${FLY_MACHINES_API}/apps/${appName}/machines`, {
      headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
    });

    if (!machinesRes.ok) {
      return NextResponse.json({
        branch: "unknown", latestCommitSha: "unknown",
        latestCommitMessage: "Failed to reach workspace", author: "unknown",
        timestamp: new Date().toISOString(),
      });
    }

    const machines = await machinesRes.json();
    const machine = machines[0];

    if (!machine || machine.state !== "started") {
      return NextResponse.json({
        branch: "unknown", latestCommitSha: "unknown",
        latestCommitMessage: "Workspace not running", author: "unknown",
        timestamp: new Date().toISOString(),
      });
    }

    // Get git status via stats-server
    const execRes = await fetch(
      `${FLY_MACHINES_API}/apps/${appName}/machines/${machine.id}/exec`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: ["sh", "-c", "curl -sf http://127.0.0.1:4000/git/status"],
          timeout: 10,
        }),
      }
    );

    if (!execRes.ok) {
      return NextResponse.json({
        branch: "unknown", latestCommitSha: "unknown",
        latestCommitMessage: "Could not reach workspace", author: "unknown",
        timestamp: new Date().toISOString(),
      });
    }

    const execResult = await execRes.json();
    const stdout = execResult.stdout || "";

    try {
      const status = JSON.parse(stdout);
      return NextResponse.json({
        branch: status.branch || "main",
        latestCommitSha: status.head?.short || status.latestCommitSha || "unknown",
        latestCommitMessage: status.head?.message || status.latestCommitMessage || "N/A",
        author: status.head?.author || status.author || "Hubify Agent",
        timestamp: new Date().toISOString(),
        dirty: status.dirty,
        files: status.files,
      });
    } catch {
      return NextResponse.json({
        branch: "unknown", latestCommitSha: "unknown",
        latestCommitMessage: "Unable to parse git status", author: "unknown",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("[git-status GET] Unhandled error:", error);
    return NextResponse.json({ error: "Failed to fetch git status" }, { status: 500 });
  }
}
