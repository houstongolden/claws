import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(CONVEX_URL);
}

/**
 * GET /api/templates/version-files?template=myos&version=1.1.0
 *
 * Public endpoint — returns the full manifest with file contents
 * so workspace stats-servers can download and apply updates.
 */
export async function GET(req: NextRequest) {
  const template = req.nextUrl.searchParams.get("template");
  const version = req.nextUrl.searchParams.get("version");

  if (!template || !version) {
    return NextResponse.json(
      { error: "template and version query params required" },
      { status: 400 }
    );
  }

  try {
    const client = getConvexClient();
    const record = await client.query(api.templateVersions.getVersionManifest, {
      template_slug: template,
      version,
    });

    if (!record) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      version: record.version,
      changelog: record.changelog,
      manifest: record.manifest,
      publishedAt: record.published_at,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
