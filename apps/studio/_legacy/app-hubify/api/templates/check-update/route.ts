import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function getConvexClient() {
  if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  return new ConvexHttpClient(CONVEX_URL);
}

/**
 * GET /api/templates/check-update?template=myos&current_version=1.0.0
 *
 * Public endpoint — workspace stats-servers call this to check for updates.
 * Returns whether a newer version exists and basic metadata.
 */
export async function GET(req: NextRequest) {
  const template = req.nextUrl.searchParams.get("template");
  const currentVersion = req.nextUrl.searchParams.get("current_version");

  if (!template) {
    return NextResponse.json(
      { error: "template query param required" },
      { status: 400 }
    );
  }

  try {
    const client = getConvexClient();
    const latest = await client.query(api.templateVersions.getLatestVersion, {
      template_slug: template,
    });

    if (!latest) {
      return NextResponse.json({
        hasUpdate: false,
        latestVersion: currentVersion || "1.0.0",
        changelog: "",
        fileCount: 0,
      });
    }

    const hasUpdate = currentVersion ? latest.version !== currentVersion : false;

    return NextResponse.json({
      hasUpdate,
      latestVersion: latest.version,
      changelog: latest.changelog,
      fileCount: latest.fileCount,
      publishedAt: latest.published_at,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
