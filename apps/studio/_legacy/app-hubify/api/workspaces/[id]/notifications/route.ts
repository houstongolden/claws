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

interface NotificationSettings {
  emailNotifications: boolean;
  slackNotifications: boolean;
  deploymentAlerts: boolean;
  weeklyDigest: boolean;
  updatedAt?: number;
}

// In-memory storage for demo (in production, would use Convex DB)
const notificationStore = new Map<string, NotificationSettings>();

/**
 * GET /api/workspaces/[id]/notifications
 * Retrieve notification settings for a workspace
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
      console.error("[notifications GET] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    // Return stored settings or defaults
    const settings = notificationStore.get(workspaceId) || {
      emailNotifications: true,
      slackNotifications: false,
      deploymentAlerts: true,
      weeklyDigest: true,
      updatedAt: Date.now(),
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error("[notifications GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspaces/[id]/notifications
 * Update notification settings for a workspace
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
    const settings: NotificationSettings = await request.json();

    // Validate settings
    if (
      typeof settings.emailNotifications !== "boolean" ||
      typeof settings.slackNotifications !== "boolean" ||
      typeof settings.deploymentAlerts !== "boolean" ||
      typeof settings.weeklyDigest !== "boolean"
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
      console.error("[notifications PUT] Convex query failed:", err);
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
    notificationStore.set(workspaceId, updatedSettings);

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("[notifications PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update notification settings" },
      { status: 500 }
    );
  }
}
