import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(CONVEX_URL);
}

interface AppearanceSettings {
  theme: "light" | "dark" | "auto";
  compactMode: boolean;
  sidebarCollapsed: boolean;
  updatedAt?: number;
}

// In-memory storage for demo (in production, would use Convex DB)
const appearanceStore = new Map<string, AppearanceSettings>();

/**
 * GET /api/workspaces/[id]/appearance
 * Retrieve appearance settings for a workspace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: workspaceId } = await params;

    // Verify user owns this workspace
    try {
      const convex = getConvexClient();
      const hub = await convex.query(api.hubs.getHub, {
        hub_id: workspaceId as any,
      });

      if (!hub || hub.owner_id !== userId) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    } catch (err) {
      console.error("[appearance GET] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    // Return stored settings or defaults
    const settings = appearanceStore.get(workspaceId) || {
      theme: "auto" as const,
      compactMode: false,
      sidebarCollapsed: false,
      updatedAt: Date.now(),
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error("[appearance GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appearance settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspaces/[id]/appearance
 * Update appearance settings for a workspace
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: workspaceId } = await params;
    const settings: AppearanceSettings = await request.json();

    // Validate settings
    if (
      !["light", "dark", "auto"].includes(settings.theme) ||
      typeof settings.compactMode !== "boolean" ||
      typeof settings.sidebarCollapsed !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Invalid settings format" },
        { status: 400 }
      );
    }

    // Verify user owns this workspace
    try {
      const convex = getConvexClient();
      const hub = await convex.query(api.hubs.getHub, {
        hub_id: workspaceId as any,
      });

      if (!hub || hub.owner_id !== userId) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    } catch (err) {
      console.error("[appearance PUT] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    // Store settings
    const updatedSettings = {
      ...settings,
      updatedAt: Date.now(),
    };
    appearanceStore.set(workspaceId, updatedSettings);

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("[appearance PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update appearance settings" },
      { status: 500 }
    );
  }
}
