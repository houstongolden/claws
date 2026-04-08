import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      templateName,
      description,
      skills,
      tags,
      authorHandle,
      forkId,
      soulMd,
      dashboardConfig,
      agentVoice,
      brandVoice,
    } = body;

    // Validation
    if (!templateName || !description) {
      return NextResponse.json(
        { error: "Template name and description are required" },
        { status: 400 }
      );
    }

    // Initialize Convex client
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

    // Submit for review
    const submission = await convex.mutation(api.templates.submitForReview, {
      forkId: forkId as any,
      templateName,
      description,
      authorHandle,
      skills: skills || [],
      tags: tags || [],
      soulMd,
      dashboardConfig,
      agentVoice,
      brandVoice,
    });

    return NextResponse.json({
      success: true,
      submissionId: submission.submissionId,
      status: submission.status,
      message: "Template submission created successfully. Awaiting review.",
    });
  } catch (error) {
    console.error("Template publish error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to publish template",
      },
      { status: 500 }
    );
  }
}
