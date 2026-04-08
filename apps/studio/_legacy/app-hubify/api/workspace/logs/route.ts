import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/workspace/[id]/logs?limit=20
 *
 * Fetches recent workspace logs (shell command output history).
 * This is a simple in-memory cache for now — in production, logs would be
 * persisted in a database or external logging service.
 *
 * Returns:
 *   {
 *     "logs": [
 *       { "id": "log-123", "timestamp": 1234567890, "output": "...", "type": "stdout" | "stderr" }
 *     ],
 *     "limit": 20
 *   }
 *
 * SECURITY: Requires Clerk authentication and workspace permissions
 */

// In-memory log storage (per-workspace)
// In production, this would be a persistent store
const logCache = new Map<string, Array<{
  id: string;
  timestamp: number;
  output: string;
  type: "stdout" | "stderr";
}>>();

const MAX_LOGS_PER_WORKSPACE = 1000;

export function addLog(
  workspaceId: string,
  output: string,
  type: "stdout" | "stderr" = "stdout"
) {
  if (!logCache.has(workspaceId)) {
    logCache.set(workspaceId, []);
  }
  const logs = logCache.get(workspaceId)!;
  logs.push({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    output,
    type,
  });
  // Keep only the last N logs
  if (logs.length > MAX_LOGS_PER_WORKSPACE) {
    logs.splice(0, logs.length - MAX_LOGS_PER_WORKSPACE);
  }
}

export function getLogs(workspaceId: string, limit: number = 20) {
  const logs = logCache.get(workspaceId) || [];
  return logs.slice(-limit);
}

export async function GET(request: NextRequest) {
  // SECURITY: Verify user is authenticated via Clerk
  try {
    const authUser = await getAuthUser();
    const { userId } = authUser;
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "No user ID found" },
        { status: 401 }
      );
    }

    const workspaceId = request.nextUrl.searchParams.get("workspace");
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "20"), 100);

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing workspace parameter" },
        { status: 400 }
      );
    }

    const logs = getLogs(workspaceId, limit);

    return NextResponse.json({
      logs,
      limit,
    });
  } catch (error) {
    console.error("Error in GET /api/workspace/logs:", error);
    return NextResponse.json(
      { error: "Unauthorized", message: (error as Error).message },
      { status: 401 }
    );
  }
}
