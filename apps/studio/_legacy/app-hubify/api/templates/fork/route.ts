import { api } from "@/convex/_generated/api";
import { getAuthUser } from "@/lib/auth";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuthUser();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { templateSlug } = body;

    if (!templateSlug) {
      return NextResponse.json(
        { error: "templateSlug is required" },
        { status: 400 }
      );
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

    const result = await convex.mutation(api.templates.createForkWithoutWorkspace, {
      templateSlug,
      userId,
    });

    return NextResponse.json({
      success: true,
      forkId: result.forkId,
      templateSlug: result.templateSlug,
    });
  } catch (error) {
    console.error("Template fork error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fork template",
      },
      { status: 500 }
    );
  }
}
