import { getAuthUser } from "@/lib/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(CONVEX_URL);
}

function getSecret() {
  const rawSecret = process.env.WORKSPACE_JWT_SECRET?.trim();
  if (!rawSecret) throw new Error("WORKSPACE_JWT_SECRET not set");
  return new TextEncoder().encode(rawSecret);
}

/**
 * POST /api/workspace-proxy?workspace=houston&path=/api/switch-mode
 *
 * Proxies authenticated requests to the workspace stats-server.
 * Adds JWT auth so the workspace can verify the caller.
 */
export async function POST(request: NextRequest) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get("workspace");
  const proxyPath = searchParams.get("path");

  if (!workspace || !proxyPath) {
    return NextResponse.json(
      { error: "workspace and path query params required" },
      { status: 400 }
    );
  }

  // Look up workspace to get its subdomain
  const convex = getConvexClient();
  let hub;
  try {
    hub = await convex.query(api.hubs.getHubBySubdomain, {
      subdomain: workspace,
    });
  } catch {
    // Fallback: try with .hubify.com suffix
    try {
      hub = await convex.query(api.hubs.getHubBySubdomain, {
        subdomain: `${workspace}.hubify.com`,
      });
    } catch {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }
  }

  if (!hub) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  // Verify ownership
  if (hub.owner_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build the target URL (workspace stats-server on port 4000)
  const hostname = `${workspace}.hubify.com`;
  const targetUrl = `https://${hostname}${proxyPath}`;

  // Create a short-lived JWT for auth
  let token: string;
  try {
    token = await new SignJWT({ sub: userId, workspace })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30s")
      .sign(getSecret());
  } catch {
    return NextResponse.json(
      { error: "Failed to create auth token" },
      { status: 500 }
    );
  }

  // Forward the request body
  let body: string | undefined;
  try {
    body = await request.text();
  } catch {
    body = undefined;
  }

  try {
    const proxyRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      signal: AbortSignal.timeout(15000),
    });

    const data = await proxyRes.text();
    return new NextResponse(data, {
      status: proxyRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach workspace", details: e.message },
      { status: 502 }
    );
  }
}

/**
 * GET /api/workspace-proxy?workspace=houston&path=/api/update-status
 */
export async function GET(request: NextRequest) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get("workspace");
  const proxyPath = searchParams.get("path");

  if (!workspace || !proxyPath) {
    return NextResponse.json(
      { error: "workspace and path query params required" },
      { status: 400 }
    );
  }

  const hostname = `${workspace}.hubify.com`;
  const targetUrl = `https://${hostname}${proxyPath}`;

  try {
    const token = await new SignJWT({ sub: userId, workspace })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30s")
      .sign(getSecret());

    const proxyRes = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });

    const data = await proxyRes.text();
    return new NextResponse(data, {
      status: proxyRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach workspace", details: e.message },
      { status: 502 }
    );
  }
}
