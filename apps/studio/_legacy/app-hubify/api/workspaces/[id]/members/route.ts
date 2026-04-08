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

interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: number;
}

// In-memory storage for members (in production, would use Convex DB)
const membersStore = new Map<string, Member[]>();

/**
 * GET /api/workspaces/[id]/members
 * Retrieve members for a workspace
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
      console.error("[members GET] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    // Return stored members or create default (owner only)
    let members = membersStore.get(workspaceId);
    if (!members) {
      // Create owner entry
      members = [
        {
          id: userId,
          name: "Workspace Owner",
          email: "owner@example.com",
          role: "owner",
          joinedAt: Date.now(),
        },
      ];
      membersStore.set(workspaceId, members);
    }

    return NextResponse.json({ members });
  } catch (error) {
    console.error("[members GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/[id]/members
 * Invite a new member to a workspace
 */
export async function POST(
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
    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
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
      console.error("[members POST] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    // Create new member
    const newMember: Member = {
      id: `user_${Date.now()}`,
      name: email.split("@")[0],
      email,
      role: role || "member",
      joinedAt: Date.now(),
    };

    // Get existing members and add the new one
    let members = membersStore.get(workspaceId) || [];
    members.push(newMember);
    membersStore.set(workspaceId, members);

    return NextResponse.json(newMember);
  } catch (error) {
    console.error("[members POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to invite member" },
      { status: 500 }
    );
  }
}
