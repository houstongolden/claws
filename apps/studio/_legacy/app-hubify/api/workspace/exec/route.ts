import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiError, apiUnauthorized, apiServerError, apiServiceUnavailable, apiRateLimited } from "@/lib/api-errors";
import { checkUserRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/workspace/exec
 *
 * Executes a shell command on the workspace machine via SSH.
 *
 * Request body:
 * {
 *   "app": "hubify-ws-{username}",
 *   "machineId": "{machine-id}",
 *   "command": "ls -la"
 * }
 *
 * Response:
 * {
 *   "stdout": "...",
 *   "stderr": "...",
 *   "exitCode": 0,
 *   "timestamp": 1234567890
 * }
 *
 * SECURITY: Requires Clerk authentication. Uses Fly SSH for secure execution.
 */

const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_MACHINES_API = "https://api.machines.dev/v1";

export async function POST(request: NextRequest) {
  // SECURITY: Verify user is authenticated via Clerk
  const { userId } = await auth();
  if (!userId) {
    return apiUnauthorized();
  }

  // SECURITY: Rate limit — 30 exec commands per minute per user
  const { allowed: rlAllowed, remaining: rlRemaining, resetAt: rlResetAt } =
    await checkUserRateLimit(`exec:${userId}`, 30, 60_000);
  if (!rlAllowed) {
    const retryAfter = Math.ceil((rlResetAt - Date.now()) / 1000);
    return apiRateLimited(
      `Too many commands — please wait before sending more. Try again after ${new Date(rlResetAt).toLocaleTimeString()}.`,
      retryAfter
    );
  }

  try {
    const body = await request.json();
    const { app, machineId, command } = body;

    if (!app || !machineId || !command) {
      return apiError('Missing required fields: app, machineId, and command are all required', 400, 'BAD_REQUEST');
    }

    // Validate app name format (hubify-ws-{username}) — prevents path traversal / injection
    if (typeof app !== 'string' || !/^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$/.test(app)) {
      return apiError('Invalid app name format', 400, 'BAD_REQUEST');
    }

    // Validate machineId format (Fly machine IDs are alphanumeric hex-like strings)
    if (typeof machineId !== 'string' || !/^[a-z0-9]{8,24}$/.test(machineId)) {
      return apiError('Invalid machine ID format', 400, 'BAD_REQUEST');
    }

    // Validate command type and length
    if (typeof command !== 'string') {
      return apiError('command must be a string', 400, 'BAD_REQUEST');
    }

    // Validate command is not too long
    if (command.length > 10000) {
      return apiError('Command exceeds maximum length of 10,000 characters', 400, 'BAD_REQUEST');
    }

    // Dev mode: return mock output
    if (!FLY_API_TOKEN) {
      return NextResponse.json({
        stdout: `[DEV MODE] Command would execute: ${command}`,
        stderr: "",
        exitCode: 0,
        timestamp: Date.now(),
      });
    }

    // Get machine details to get private IP
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
      return apiServiceUnavailable('Workspace machine', 'Could not reach the workspace machine — it may be stopped or starting up. Try again in a moment.');
    }

    // Execute command via Fly SSH
    // Use the Fly SSH API to run the command
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
          signal: AbortSignal.timeout(35000), // 35s to account for 30s timeout + overhead
        }
      );

      if (!sshRes.ok) {
        const errText = await sshRes.text();
        console.error("SSH exec failed:", sshRes.status, errText);
        return apiError('Command execution failed on the workspace machine', 500, 'INTERNAL_ERROR', { exitCode: sshRes.status, detail: errText });
      }

      const result = await sshRes.json();

      return NextResponse.json({
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exit_code ?? 0,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error("SSH execution error:", e);
      return apiServiceUnavailable('Workspace SSH', `Command timed out or the network connection failed: ${(e as Error).message}`);
    }
  } catch (e) {
    console.error("Request parsing error:", e);
    return apiError('Invalid request body — expected JSON with app, machineId, and command fields', 400, 'BAD_REQUEST', { detail: (e as Error).message });
  }
}
