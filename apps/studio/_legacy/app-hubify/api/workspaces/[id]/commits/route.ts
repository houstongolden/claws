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

// GET — return commit history from Convex
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

    const convex = getConvexClient();
    const hub = await convex.query(api.hubs.getHub, { hub_id: workspaceId as any });

    if (!hub) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    if (hub.owner_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Try Convex first
    try {
      const commits = await convex.query(api.workspaceCommits.listCommits, {
        hub_id: workspaceId,
        limit: 50,
      });
      return NextResponse.json({ commits, source: "convex" });
    } catch {
      // Fallback: get from workspace directly
      const appName = request.nextUrl.searchParams.get("appName");
      if (!appName || !FLY_API_TOKEN) {
        return NextResponse.json({ commits: [], source: "none" });
      }

      const machinesRes = await fetch(`${FLY_MACHINES_API}/apps/${appName}/machines`, {
        headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
      });

      if (!machinesRes.ok) {
        return NextResponse.json({ commits: [], source: "none" });
      }

      const machines = await machinesRes.json();
      const machine = machines[0];

      if (!machine || machine.state !== "started") {
        return NextResponse.json({ commits: [], source: "none" });
      }

      const execRes = await fetch(
        `${FLY_MACHINES_API}/apps/${appName}/machines/${machine.id}/exec`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            cmd: ["sh", "-c", "curl -sf 'http://127.0.0.1:4000/git/log?limit=50'"],
            timeout: 10,
          }),
        }
      );

      if (!execRes.ok) {
        return NextResponse.json({ commits: [], source: "none" });
      }

      const execResult = await execRes.json();
      try {
        const result = JSON.parse(execResult.stdout || "{}");
        return NextResponse.json({ commits: result.commits || [], source: "workspace" });
      } catch {
        return NextResponse.json({ commits: [], source: "none" });
      }
    }
  } catch (error) {
    console.error("[commits GET] Unhandled error:", error);
    return NextResponse.json({ error: "Failed to fetch commits" }, { status: 500 });
  }
}

// POST — trigger a manual commit via workspace stats-server
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
    const { message, appName } = body;

    if (!appName) {
      return NextResponse.json({ error: "Missing appName" }, { status: 400 });
    }

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

    const machinesRes = await fetch(`${FLY_MACHINES_API}/apps/${appName}/machines`, {
      headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
    });

    if (!machinesRes.ok) {
      return NextResponse.json({ error: "Failed to fetch machines" }, { status: 500 });
    }

    const machines = await machinesRes.json();
    const machine = machines[0];

    if (!machine || machine.state !== "started") {
      return NextResponse.json({ error: "Workspace must be running" }, { status: 400 });
    }

    const commitMsg = (message || "Manual commit").replace(/'/g, "'\\''");

    const execRes = await fetch(
      `${FLY_MACHINES_API}/apps/${appName}/machines/${machine.id}/exec`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: [
            "sh", "-c",
            `curl -sf -X POST http://127.0.0.1:4000/git/local-commit -H 'Content-Type: application/json' -d '{"message":"${commitMsg}"}'`,
          ],
          timeout: 30,
        }),
      }
    );

    if (!execRes.ok) {
      return NextResponse.json({ error: "Failed to trigger commit" }, { status: 500 });
    }

    const execResult = await execRes.json();
    try {
      const result = JSON.parse(execResult.stdout || "{}");
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
    }
  } catch (error) {
    console.error("[commits POST] Unhandled error:", error);
    return NextResponse.json({ error: "Failed to create commit" }, { status: 500 });
  }
}
