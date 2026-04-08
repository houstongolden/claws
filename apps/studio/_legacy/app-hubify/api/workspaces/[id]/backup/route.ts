import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
import { recordAuditEvent } from "@/lib/audit";

const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_MACHINES_API = "https://api.machines.dev/v1";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(CONVEX_URL);
}

/**
 * POST /api/workspaces/[id]/backup
 *
 * Triggers a workspace backup by executing `tar` on the Fly machine.
 * Returns the backup metadata (filename, size, timestamp).
 *
 * The backup is stored on the machine's persistent volume at /data/backups/.
 * Users can download it via the workspace's file system or `hubify` CLI.
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
    const body = await request.json().catch(() => ({}));
    const appName = body.appName;

    if (!appName) {
      return NextResponse.json(
        { error: "Missing appName in request body" },
        { status: 400 }
      );
    }

    // Verify ownership
    const convex = getConvexClient();
    const hub = await convex.query(api.hubs.getHub, {
      hub_id: workspaceId as any,
    });

    if (!hub) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (hub.owner_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!FLY_API_TOKEN) {
      return NextResponse.json(
        { error: "Fly API token not configured" },
        { status: 500 }
      );
    }

    // Get the machine ID
    const machinesRes = await fetch(`${FLY_MACHINES_API}/apps/${appName}/machines`, {
      headers: {
        Authorization: `Bearer ${FLY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!machinesRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch machines" },
        { status: 500 }
      );
    }

    const machines = await machinesRes.json();
    const machine = machines[0];

    if (!machine || machine.state !== "started") {
      return NextResponse.json(
        { error: "Workspace must be running to create a backup" },
        { status: 400 }
      );
    }

    // Execute backup command on the machine via Fly exec API
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupFilename = `backup-${timestamp}.tar.gz`;
    const backupDir = "/data/backups";
    const backupPath = `${backupDir}/${backupFilename}`;

    // Create backup directory and tar the data (excluding backups dir itself)
    const execCmd = [
      "sh",
      "-c",
      `mkdir -p ${backupDir} && tar czf ${backupPath} --exclude='backups' -C /data . && stat -c '%s' ${backupPath} 2>/dev/null || stat -f '%z' ${backupPath}`,
    ];

    const execRes = await fetch(
      `${FLY_MACHINES_API}/apps/${appName}/machines/${machine.id}/exec`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FLY_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cmd: execCmd,
          timeout: 60,
        }),
      }
    );

    if (!execRes.ok) {
      const errText = await execRes.text().catch(() => "");
      console.error("[backup] Fly exec failed:", errText);
      return NextResponse.json(
        { error: "Failed to execute backup command on workspace" },
        { status: 500 }
      );
    }

    const execResult = await execRes.json();
    const stdout = execResult.stdout || "";
    const stderr = execResult.stderr || "";
    const exitCode = execResult.exit_code ?? -1;

    if (exitCode !== 0) {
      console.error("[backup] Backup command failed:", stderr);
      return NextResponse.json(
        { error: `Backup failed: ${stderr.slice(0, 200)}` },
        { status: 500 }
      );
    }

    // Parse the file size from stat output
    const sizeBytes = parseInt(stdout.trim(), 10) || 0;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    recordAuditEvent({
      user_id: userId,
      action: "backup_created",
      target_type: "workspace",
      target_id: workspaceId,
      metadata: { filename: backupFilename, size_mb: parseFloat(sizeMB) },
    });

    return NextResponse.json({
      success: true,
      backup: {
        filename: backupFilename,
        path: backupPath,
        size_bytes: sizeBytes,
        size_mb: parseFloat(sizeMB),
        created_at: new Date().toISOString(),
        machine_id: machine.id,
      },
      message: `Backup created: ${backupFilename} (${sizeMB} MB)`,
    });
  } catch (error) {
    console.error("[backup POST] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to create backup" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workspaces/[id]/backup?appName=...
 *
 * List existing backups on the workspace.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const appName = request.nextUrl.searchParams.get("appName");

    if (!appName) {
      return NextResponse.json(
        { error: "Missing appName query parameter" },
        { status: 400 }
      );
    }

    // Verify ownership
    const convex = getConvexClient();
    const hub = await convex.query(api.hubs.getHub, {
      hub_id: workspaceId as any,
    });

    if (!hub) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (hub.owner_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!FLY_API_TOKEN) {
      return NextResponse.json({ backups: [] });
    }

    // Get machines
    const machinesRes = await fetch(`${FLY_MACHINES_API}/apps/${appName}/machines`, {
      headers: {
        Authorization: `Bearer ${FLY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!machinesRes.ok) {
      return NextResponse.json({ backups: [] });
    }

    const machines = await machinesRes.json();
    const machine = machines[0];

    if (!machine || machine.state !== "started") {
      return NextResponse.json({
        backups: [],
        message: "Workspace must be running to list backups",
      });
    }

    // List backup files
    const execRes = await fetch(
      `${FLY_MACHINES_API}/apps/${appName}/machines/${machine.id}/exec`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FLY_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cmd: [
            "sh",
            "-c",
            "ls -lt /data/backups/*.tar.gz 2>/dev/null | head -20 | awk '{print $5,$6,$7,$8,$9}'",
          ],
          timeout: 10,
        }),
      }
    );

    if (!execRes.ok) {
      return NextResponse.json({ backups: [] });
    }

    const execResult = await execRes.json();
    const lines = (execResult.stdout || "").trim().split("\n").filter(Boolean);

    const backups = lines.map((line: string) => {
      const parts = line.trim().split(/\s+/);
      const sizeBytes = parseInt(parts[0], 10) || 0;
      const filename = parts[parts.length - 1]?.replace("/data/backups/", "") || "unknown";
      return {
        filename,
        path: `/data/backups/${filename}`,
        size_bytes: sizeBytes,
        size_mb: parseFloat((sizeBytes / (1024 * 1024)).toFixed(2)),
      };
    });

    return NextResponse.json({ backups });
  } catch (error) {
    console.error("[backup GET] Unhandled error:", error);
    return NextResponse.json({ backups: [] });
  }
}
