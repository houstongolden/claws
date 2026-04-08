import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";

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
      console.error("[system-status GET] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    if (!FLY_API_TOKEN) {
      return NextResponse.json(
        {
          cpu: { usage: 0, cores: 0 },
          memory: { usage: 0, total: 0, percentage: 0 },
          disk: { usage: 0, total: 0, percentage: 0 },
          machineState: "unknown",
          uptime: 0,
          timestamp: new Date().toISOString(),
          healthStatus: "unknown",
        },
        { status: 200 }
      );
    }

    try {
      const machines = await flyGet(`/apps/${appName}/machines`);
      const machine = machines[0];

      if (!machine) {
        return NextResponse.json(
          {
            cpu: { cores: 0 },
            memory: { allocated_mb: 0 },
            disk: { volumes: [] },
            machineState: "stopped",
            uptime: 0,
            timestamp: new Date().toISOString(),
            healthStatus: "warning",
            region: null,
            image: null,
          },
          { status: 200 }
        );
      }

      // Extract real machine config — no fake usage metrics
      const cpuCores = machine.config?.guest?.cpus || 1;
      const cpuKind = machine.config?.guest?.cpu_kind || "shared";
      const memoryMB = machine.config?.guest?.memory_mb || 256;

      // Extract volume info from mounts
      const volumes = (machine.config?.mounts || []).map((m: any) => ({
        name: m.name || m.volume,
        path: m.path,
        size_gb: m.size_gb || 0,
      }));

      // Calculate uptime from created_at or updated_at
      const startedAt = machine.state === "started"
        ? (machine.events?.find((e: any) => e.type === "start")?.timestamp || machine.updated_at)
        : null;
      const uptime = startedAt
        ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
        : 0;

      // Health check from machine checks
      const checks = machine.checks || [];
      const failingChecks = checks.filter((c: any) => c.status !== "passing");

      let healthStatus: "healthy" | "warning" | "critical" = "healthy";
      if (machine.state !== "started") {
        healthStatus = "critical";
      } else if (failingChecks.length > 0) {
        healthStatus = "warning";
      }

      return NextResponse.json({
        cpu: { cores: cpuCores, kind: cpuKind },
        memory: { allocated_mb: memoryMB },
        disk: { volumes },
        machineState: machine.state,
        uptime,
        timestamp: new Date().toISOString(),
        healthStatus,
        region: machine.region || null,
        image: machine.config?.image || null,
        checks: checks.map((c: any) => ({
          name: c.name,
          status: c.status,
          output: c.output,
        })),
        events: (machine.events || []).slice(0, 10).map((e: any) => ({
          type: e.type,
          status: e.status,
          timestamp: e.timestamp,
          source: e.source,
        })),
      });
    } catch (err) {
      console.error("[system-status GET] Fly API failed:", err);
      return NextResponse.json(
        {
          cpu: { cores: 0 },
          memory: { allocated_mb: 0 },
          disk: { volumes: [] },
          machineState: "unknown",
          uptime: 0,
          timestamp: new Date().toISOString(),
          healthStatus: "unknown" as any,
          region: null,
          image: null,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("[system-status GET] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to fetch system status" },
      { status: 500 }
    );
  }
}
