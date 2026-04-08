import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_MACHINES_API = "https://api.machines.dev/v1";

function getConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(CONVEX_URL);
}

async function flyGet(path: string) {
  const res = await fetch(`${FLY_MACHINES_API}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const error = await res.text().catch(() => "");
    throw new Error(`Fly API error (${res.status}): ${error}`);
  }
  return res.json();
}

function eventToLogLevel(type: string, status: string): "info" | "warn" | "error" | "debug" {
  if (status === "error" || type === "exit" || type === "destroy") return "error";
  if (type === "restart" || status === "failed") return "warn";
  if (type === "launch" || type === "start") return "info";
  return "debug";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User not authenticated" },
        { status: 401 }
      );
    }

    const { id: workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const appName = searchParams.get("appName");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!appName) {
      return NextResponse.json(
        { error: "Missing appName query parameter" },
        { status: 400 }
      );
    }

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
      console.error("[logs GET] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    if (!FLY_API_TOKEN) {
      return NextResponse.json({
        logs: [],
        totalCount: 0,
        source: "unavailable",
      });
    }

    try {
      // Fetch real machine events from Fly API
      const machines = await flyGet(`/apps/${appName}/machines`);
      const machine = machines[0];

      if (!machine) {
        return NextResponse.json({
          logs: [],
          totalCount: 0,
          source: "fly",
        });
      }

      // Machine events are real state transitions (start, stop, exit, restart, etc.)
      const events = (machine.events || []).slice(0, limit);

      const logs = events.map((evt: any, i: number) => ({
        id: `fly-${machine.id}-${i}`,
        timestamp: evt.timestamp,
        level: eventToLogLevel(evt.type, evt.status),
        message: `[${evt.type}] ${evt.status}${evt.source ? ` (${evt.source})` : ""}${evt.request?.exit_event ? ` — exit ${evt.request.exit_event.exit_code}` : ""}`,
        service: "fly-machine",
        source: evt.source,
      }));

      return NextResponse.json({
        logs,
        totalCount: logs.length,
        source: "fly",
        machineId: machine.id,
      });
    } catch (err) {
      console.error("[logs GET] Fly API failed:", err);
      return NextResponse.json(
        {
          logs: [],
          totalCount: 0,
          source: "error",
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("[logs GET] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
