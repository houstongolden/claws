import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiUnauthorized, apiServerError, apiServiceUnavailable, apiRateLimited } from "@/lib/api-errors";
import { checkUserRateLimit } from "@/lib/rate-limit";
import { addLog } from "../../logs/route";

/**
 * POST /api/workspace/terminal/execute
 *
 * Executes a shell command on the workspace and returns the output.
 * Also adds output to the log cache for live display.
 *
 * Request body:
 * {
 *   "workspaceId": "workspace-123",
 *   "app": "hubify-ws-{username}",
 *   "machineId": "{machine-id}",
 *   "command": "ls -la"
 * }
 *
 * Response:
 * {
 *   "id": "exec-123",
 *   "output": "...",
 *   "exitCode": 0,
 *   "timestamp": 1234567890
 * }
 *
 * SECURITY: Rate limited to 5 commands/second per user
 * Timeout: 30 seconds per command
 */

const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_MACHINES_API = "https://api.machines.dev/v1";

export async function POST(request: NextRequest) {
  // SECURITY: Verify user is authenticated via Clerk
  const { userId } = await getAuthUser();
  if (!userId) {
    return apiUnauthorized();
  }

  // SECURITY: Rate limit — 5 commands per second per user
  const { allowed: rlAllowed, remaining: rlRemaining, resetAt: rlResetAt } =
    await checkUserRateLimit(`terminal:${userId}`, 5, 1000);
  if (!rlAllowed) {
    const retryAfter = Math.ceil((rlResetAt - Date.now()) / 1000);
    return apiRateLimited(
      `Too many commands — please wait before sending more`,
      retryAfter
    );
  }

  try {
    const body = await request.json();
    const { workspaceId, app, machineId, command } = body;

    if (!workspaceId || !app || !machineId || !command) {
      return apiError(
        'Missing required fields: workspaceId, app, machineId, and command',
        400,
        'BAD_REQUEST'
      );
    }

    // Validate inputs
    if (typeof app !== 'string' || !/^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$/.test(app)) {
      return apiError('Invalid app name format', 400, 'BAD_REQUEST');
    }

    if (typeof machineId !== 'string' || !/^[a-z0-9]{8,24}$/.test(machineId)) {
      return apiError('Invalid machine ID format', 400, 'BAD_REQUEST');
    }

    if (typeof command !== 'string' || command.length === 0 || command.length > 10000) {
      return apiError('Command must be 1-10000 characters', 400, 'BAD_REQUEST');
    }

    const execId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Dev mode: return mock output
    if (!FLY_API_TOKEN) {
      const output = `$ ${command}\n[DEV MODE] Command executed successfully`;
      addLog(workspaceId, output, "stdout");
      return NextResponse.json({
        id: execId,
        output,
        exitCode: 0,
        timestamp: Date.now(),
      });
    }

    // Get machine details
    let machineIp: string | null = null;
    try {
      const machineRes = await fetch(
        `${FLY_MACHINES_API}/apps/${app}/machines/${machineId}`,
        {
          headers: { Authorization: `Bearer ${FLY_API_TOKEN}` },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (machineRes.ok) {
        const machineData = await machineRes.json();
        machineIp = machineData.private_ip || null;
      }
    } catch (e) {
      console.error("Failed to get machine IP:", e);
    }

    if (!machineIp) {
      return apiServiceUnavailable(
        'Workspace machine',
        'Machine is not available'
      );
    }

    // Execute command via Fly SSH
    try {
      const sshRes = await fetch(
        `${FLY_MACHINES_API}/apps/${app}/machines/${machineId}/exec`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FLY_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cmd: ["/bin/sh", "-c", command],
            timeout: 30,
          }),
          signal: AbortSignal.timeout(35000),
        }
      );

      if (!sshRes.ok) {
        const errText = await sshRes.text();
        const errorOutput = `$ ${command}\nError: ${errText}`;
        addLog(workspaceId, errorOutput, "stderr");
        return NextResponse.json(
          {
            id: execId,
            output: errorOutput,
            exitCode: sshRes.status,
            timestamp: Date.now(),
          },
          { status: sshRes.status < 500 ? 400 : 500 }
        );
      }

      const result = await sshRes.json();
      const output = `$ ${command}\n${result.stdout || ""}`;

      // Store in log cache
      addLog(workspaceId, output, "stdout");
      if (result.stderr) {
        addLog(workspaceId, result.stderr, "stderr");
      }

      return NextResponse.json({
        id: execId,
        output,
        exitCode: result.exit_code ?? 0,
        timestamp: Date.now(),
      });
    } catch (e) {
      const errorOutput = `$ ${command}\nError: ${(e as Error).message}`;
      addLog(workspaceId, errorOutput, "stderr");
      return apiServiceUnavailable(
        'Workspace SSH',
        `Execution failed: ${(e as Error).message}`
      );
    }
  } catch (e) {
    return apiError(
      'Invalid request body',
      400,
      'BAD_REQUEST',
      { detail: (e as Error).message }
    );
  }
}
