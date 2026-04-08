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
    const limit = parseInt(searchParams.get("limit") || "10");

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
      console.error("[deployments GET] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    if (!FLY_API_TOKEN) {
      return NextResponse.json(
        {
          deployments: [],
          lastUpdate: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    try {
      const machines = await flyGet(`/apps/${appName}/machines`);
      
      const deployments = machines
        .slice(0, limit)
        .map((machine: any) => ({
          id: machine.id,
          timestamp: machine.updated_at || new Date().toISOString(),
          commitSha: (machine.config?.env?.["COMMIT_SHA"] || "unknown").substring(0, 8),
          branch: machine.config?.env?.["GIT_BRANCH"] || "unknown",
          status:
            machine.state === "started"
              ? "success"
              : machine.state === "created"
                ? "pending"
                : "failed",
          message: `Machine ${machine.name} - ${machine.state}`,
        }));

      return NextResponse.json({
        deployments,
        lastUpdate: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[deployments GET] Fly API failed:", err);
      return NextResponse.json(
        {
          deployments: [],
          lastUpdate: new Date().toISOString(),
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("[deployments GET] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deployments" },
      { status: 500 }
    );
  }
}
