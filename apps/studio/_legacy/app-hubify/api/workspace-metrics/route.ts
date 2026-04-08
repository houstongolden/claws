import { auth } from "@clerk/nextjs/server";

/**
 * GET /api/workspace-metrics
 *
 * Returns workspace execution metrics.
 * Currently returns empty state — will query Convex executions table when wired.
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return empty state — no fake data
    return new Response(
      JSON.stringify({
        success: true,
        executions: [],
        message: "No execution data available yet. Metrics will populate as skills are executed.",
        timestamp: Date.now(),
        userId,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[workspace-metrics] Error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch metrics",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
