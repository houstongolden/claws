import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";

const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_MACHINES_API = "https://api.machines.dev/v1";

/**
 * GET /api/workspace/status?app=hubify-ws-{username}&machine={machineId}
 *
 * Checks:
 * 1. Fly machine state (is the VM alive?)
 * 2. ttyd on :8080 (is the terminal reachable?)
 * 3. OpenClaw health on :3000 (is the agent running?)
 *
 * Returns:
 *   {
 *     machine: "active" | "stopped" | "starting" | "unknown",
 *     openclaw: "online" | "offline" | "unknown",
 *     terminal: "online" | "offline" | "unknown",
 *     workspaceUrl: string | null,
 *     checkedAt: number
 *   }
 *
 * SECURITY: Requires Clerk authentication
 */
export async function GET(request: NextRequest) {
  // SECURITY: Verify user is authenticated via Clerk
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      apiError("UNAUTHORIZED", "Unauthorized: User not authenticated"),
      { status: 401 }
    );
  }

  const appName = request.nextUrl.searchParams.get("app");
  const machineId = request.nextUrl.searchParams.get("machine");

  if (!appName) {
    return NextResponse.json(apiError("MISSING_APP_PARAM", "Missing ?app param"), { status: 400 });
  }

  const checkedAt = Date.now();

  // --- Dev mode: no token ---
  if (!FLY_API_TOKEN) {
    return NextResponse.json({
      machine: "unknown",
      openclaw: "unknown",
      terminal: "unknown",
      workspaceUrl: null,
      checkedAt,
      dev: true,
    });
  }

  // 1. Check machine state from Fly API
  let machineState: string = "unknown";
  let privateIp: string | null = null;

  try {
    const machineUrl = machineId
      ? `${FLY_MACHINES_API}/apps/${appName}/machines/${machineId}`
      : `${FLY_MACHINES_API}/apps/${appName}/machines`;

    const res = await fetch(machineUrl, {
      headers: { Authorization: `Bearer ${FLY_API_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      // If listing, pick first machine
      const machine = Array.isArray(data) ? data[0] : data;
      if (machine) {
        const flyState = machine.state as string;
        const stateMap: Record<string, string> = {
          started: "active",
          starting: "starting",
          created: "starting",
          stopped: "stopped",
          failed: "stopped",
          destroying: "stopped",
          destroyed: "stopped",
        };
        machineState = stateMap[flyState] ?? "unknown";
        privateIp = machine.private_ip ?? null;
      }
    }
  } catch {
    machineState = "unknown";
  }

  const workspaceUrl = machineState === "active" ? `https://${appName}.fly.dev` : null;

  // 2 & 3: Check OpenClaw + ttyd only if machine is active
  let openclawStatus: "online" | "offline" | "unknown" = "unknown";
  let terminalStatus: "online" | "offline" | "unknown" = "unknown";

  if (machineState === "active" && workspaceUrl) {
    // OpenClaw API health endpoint (served via nginx proxy on the workspace)
    const checkService = async (path: string): Promise<boolean> => {
      try {
        const res = await fetch(`${workspaceUrl}${path}`, {
          signal: AbortSignal.timeout(4000),
          cache: "no-store",
        });
        return res.ok;
      } catch {
        return false;
      }
    };

    const [openclawOk, terminalOk] = await Promise.all([
      checkService("/api/health"), // OpenClaw health endpoint
      checkService("/terminal/"),   // ttyd served via nginx at /terminal/
    ]);

    openclawStatus = openclawOk ? "online" : "offline";
    terminalStatus = terminalOk ? "online" : "offline";
  } else if (machineState !== "active") {
    openclawStatus = "offline";
    terminalStatus = "offline";
  }

  return NextResponse.json({
    machine: machineState,
    openclaw: openclawStatus,
    terminal: terminalStatus,
    workspaceUrl,
    privateIp,
    checkedAt,
  });
}
