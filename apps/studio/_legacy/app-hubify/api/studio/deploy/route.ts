import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { validateTemplate } from "@/lib/studio/file-validator";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, files, workspaceId } = body as {
    title: string;
    files: { path: string; content: string }[];
    workspaceId?: string;
  };

  if (!title || !files || files.length === 0) {
    return NextResponse.json(
      { error: "Title and files are required" },
      { status: 400 }
    );
  }

  // Validate template files
  const validation = validateTemplate(files);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  // For now, redirect to the workspace creation flow with template data
  // Full Fly.io deployment will be wired when workspace provisioning is integrated
  try {
    // Store template data for the workspace creation flow
    // This is a bridge until we wire direct Fly.io deployment
    const templatePayload = {
      name: title,
      files,
      deployedBy: userId,
      deployedAt: Date.now(),
    };

    // Record audit event for studio deploy
    recordAuditEvent({
      user_id: userId,
      action: "studio_deploy",
      target_type: workspaceId ? "workspace" : "template",
      target_id: workspaceId || title,
      metadata: {
        title,
        fileCount: files.length,
        filePaths: files.map((f) => f.path).slice(0, 10), // cap at 10
      },
    });

    // Return the template payload — frontend will redirect to workspace creation
    return NextResponse.json({
      ok: true,
      templatePayload,
      redirectTo: workspaceId
        ? `/workspace/${workspaceId}/settings?applyTemplate=true`
        : `/workspaces/new?studioTemplate=${encodeURIComponent(JSON.stringify({ title, fileCount: files.length }))}`,
    });
  } catch (err) {
    console.error("[studio/deploy] Error:", err);
    return NextResponse.json(
      { error: "Deploy failed. Try again." },
      { status: 500 }
    );
  }
}
