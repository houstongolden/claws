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
    const body = await request.json().catch(() => ({}));
    const appName = body.appName;

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
      return NextResponse.json({ error: "Workspace must be running to export" }, { status: 400 });
    }

    // Execute export via stats-server
    const execRes = await fetch(
      `${FLY_MACHINES_API}/apps/${appName}/machines/${machine.id}/exec`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: ["sh", "-c", "curl -sf -X POST http://127.0.0.1:4000/workspace/export-template"],
          timeout: 60,
        }),
      }
    );

    if (!execRes.ok) {
      return NextResponse.json({ error: "Failed to export workspace" }, { status: 500 });
    }

    const execResult = await execRes.json();
    const stdout = execResult.stdout || "";

    try {
      const result = JSON.parse(stdout);

      if (!result.ok || !result.manifest) {
        return NextResponse.json(
          { error: result.error || "Export failed" },
          { status: 500 }
        );
      }

      const manifest = result.manifest;
      const metadata = manifest.metadata;

      // Create a template submission as draft
      try {
        const draftId = await convex.mutation(api.templates.createPublished, {
          slug: `export-${workspaceId}-${Date.now()}`,
          name: metadata.template || `${hub.name || "Workspace"} Export`,
          description: metadata.description || "Exported from workspace",
          longDescription: metadata.description || "Exported workspace template",
          icon: (metadata.template || "W")[0].toUpperCase(),
          tags: metadata.tags || [],
          preInstalledSkills: metadata.skills || [],
          bestFor: metadata.description || "General use",
          soulMd: manifest.files.find((f: any) => f.path === "SOUL.md")?.content,
        });

        return NextResponse.json({
          success: true,
          draftId,
          manifest: {
            fileCount: metadata.fileCount,
            totalSize: metadata.totalSize,
            skills: metadata.skills,
            files: manifest.files.map((f: any) => ({
              path: f.path,
              size: f.size,
              hash: f.hash,
            })),
          },
        });
      } catch (convexErr: any) {
        // Even if Convex fails, return the manifest so user can use it
        return NextResponse.json({
          success: true,
          draftId: null,
          manifest: {
            fileCount: metadata.fileCount,
            totalSize: metadata.totalSize,
            skills: metadata.skills,
            files: manifest.files.map((f: any) => ({
              path: f.path,
              size: f.size,
              hash: f.hash,
            })),
          },
          warning: "Template draft creation failed, but export succeeded",
        });
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to parse export result" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[export-template POST] Unhandled error:", error);
    return NextResponse.json({ error: "Failed to export workspace" }, { status: 500 });
  }
}
