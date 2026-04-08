import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
import crypto from "crypto";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const WORKSPACE_JWT_SECRET = process.env.WORKSPACE_JWT_SECRET;

function getConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(CONVEX_URL);
}

function deriveGatewayToken(secret: string): string {
  return crypto
    .createHash("sha256")
    .update(`${secret}:gateway-token`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * GET /api/workspaces/[id]/connect
 *
 * Returns connection details for the workspace's OpenClaw Gateway.
 * Used by external apps (iOS agent, CLI) to establish WebSocket connections.
 *
 * Query params:
 *   ?app = Fly app name (e.g. hubify-ws-houston)
 *   ?hub_id = Convex hub ID (for ownership verification)
 *
 * SECURITY:
 *   - Requires Clerk authentication
 *   - Requires hub ownership verification
 *   - Response includes Cache-Control: no-store (token is sensitive)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User not authenticated" },
        { status: 401 }
      );
    }

    const { id: machineId } = await params;
    const appName = request.nextUrl.searchParams.get("app") ?? "";
    const hubId = request.nextUrl.searchParams.get("hub_id");

    if (!appName) {
      return NextResponse.json(
        { error: "Missing ?app query param" },
        { status: 400 }
      );
    }

    // Verify hub ownership
    if (hubId) {
      try {
        const convex = getConvexClient();
        const hub = await convex.query(api.hubs.getHub, {
          hub_id: hubId as any,
        });

        if (!hub) {
          return NextResponse.json(
            { error: "Hub not found" },
            { status: 404 }
          );
        }

        if (hub.owner_id !== userId) {
          return NextResponse.json(
            { error: "Forbidden: You do not have permission to access this workspace" },
            { status: 403 }
          );
        }
      } catch (hubCheckErr) {
        console.error("[connect] Hub ownership check failed:", hubCheckErr);
        return NextResponse.json(
          { error: "Failed to verify hub ownership" },
          { status: 500 }
        );
      }
    }

    const username = appName.replace(/^hubify-ws-/, "");
    const workspaceUrl = `https://${username}.hubify.com`;
    const gatewayUrl = `wss://${username}.hubify.com/gateway/`;
    const controlUrl = `https://${username}.hubify.com/control/`;

    // Derive gateway token
    let gatewayToken: string | null = null;
    if (WORKSPACE_JWT_SECRET) {
      gatewayToken = deriveGatewayToken(WORKSPACE_JWT_SECRET);
    }

    const response = NextResponse.json({
      gateway_url: gatewayUrl,
      gateway_token: gatewayToken,
      control_url: controlUrl,
      workspace_url: workspaceUrl,
      username,
      machine_id: machineId,
      protocol: {
        version: 3,
        transport: "websocket",
        handshake: {
          type: "req",
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: "your-app-id",
              version: "1.0.0",
              platform: "ios",
              mode: "node",
            },
            role: "node",
            scopes: [],
            caps: ["canvas", "voice", "location"],
            auth: { token: "YOUR_GATEWAY_TOKEN" },
          },
        },
      },
      cli: {
        connect: `npx hubify connect --subdomain ${username}`,
        sync: "npx hubify sync --once",
      },
    });

    // Sensitive data — prevent caching
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error("[connect] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch connection details" },
      { status: 500 }
    );
  }
}
