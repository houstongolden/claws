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

// In-memory storage for members
const membersStore = new Map<string, Member[]>();

/**
 * PUT /api/workspaces/[id]/members/[memberId]
 * Update a member's role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: workspaceId, memberId } = await params;
    const { role } = await request.json();

    // Validate role
    if (!["owner", "admin", "member"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Verify user is admin/owner of this workspace
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
      console.error("[members PUT] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    // Get members
    let members = membersStore.get(workspaceId) || [];
    const memberIndex = members.findIndex((m) => m.id === memberId);

    if (memberIndex === -1) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Prevent removing owner role
    if (members[memberIndex].role === "owner" && role !== "owner") {
      return NextResponse.json(
        { error: "Cannot remove owner role from owner" },
        { status: 400 }
      );
    }

    // Update member
    members[memberIndex].role = role as any;
    membersStore.set(workspaceId, members);

    return NextResponse.json(members[memberIndex]);
  } catch (error) {
    console.error("[members PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[id]/members/[memberId]
 * Remove a member from the workspace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: workspaceId, memberId } = await params;

    // Verify user is admin/owner of this workspace
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
      console.error("[members DELETE] Convex query failed:", err);
      return NextResponse.json(
        { error: "Failed to verify workspace ownership" },
        { status: 500 }
      );
    }

    // Get members
    let members = membersStore.get(workspaceId) || [];
    const memberIndex = members.findIndex((m) => m.id === memberId);

    if (memberIndex === -1) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Prevent removing owner
    if (members[memberIndex].role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove owner from workspace" },
        { status: 400 }
      );
    }

    // Remove member
    members.splice(memberIndex, 1);
    membersStore.set(workspaceId, members);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[members DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
