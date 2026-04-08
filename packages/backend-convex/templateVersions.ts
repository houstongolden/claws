// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * TEMPLATE VERSIONS — SmartSync versioning system
 * Stores file manifests for each template version so workspaces
 * can pull updates without needing GitHub access.
 */

/**
 * Publish a new template version (called by CI or manually)
 */
export const publishVersion = mutation({
  args: {
    template_slug: v.string(),
    version: v.string(),
    previous_version: v.optional(v.string()),
    manifest: v.string(),
    changelog: v.string(),
    published_by: v.optional(v.string()),
    compressed: v.optional(v.boolean()), // true if manifest is gzip+base64 compressed
  },
  handler: async (ctx, args) => {
    // Check if this version already exists
    const existing = await ctx.db
      .query("template_versions")
      .withIndex("by_template_version", (q) =>
        q.eq("template_slug", args.template_slug).eq("version", args.version)
      )
      .first();

    if (existing) {
      throw new Error(
        `Version ${args.version} already exists for template ${args.template_slug}`
      );
    }

    const id = await ctx.db.insert("template_versions", {
      template_slug: args.template_slug,
      version: args.version,
      previous_version: args.previous_version,
      manifest: args.manifest,
      changelog: args.changelog,
      published_at: Date.now(),
      published_by: args.published_by ?? "ci",
      compressed: args.compressed ?? false,
    });

    return { id, version: args.version };
  },
});

/**
 * Get the latest version for a template
 */
export const getLatestVersion = query({
  args: { template_slug: v.string() },
  handler: async (ctx, { template_slug }) => {
    const versions = await ctx.db
      .query("template_versions")
      .withIndex("by_template", (q) => q.eq("template_slug", template_slug))
      .collect();

    if (versions.length === 0) return null;

    // Sort by published_at descending, return latest
    versions.sort((a, b) => b.published_at - a.published_at);
    const latest = versions[0];

    // Parse manifest to get file count without returning full content
    // Manifests may be gzip+base64 compressed (compressed: true) or raw JSON
    let fileCount = 0;
    try {
      let manifestStr = latest.manifest;
      if ((latest as any).compressed) {
        // Compressed manifests are stored as gzip+base64
        // In query context we can't decompress, so just return 0 file count
        // The full manifest is available via getVersionManifest
        fileCount = -1; // indicates compressed, count unavailable inline
      } else {
        const manifest = JSON.parse(manifestStr);
        fileCount =
          (manifest.files?.length ?? 0) +
          (manifest.dashboardFiles?.length ?? 0);
      }
    } catch {}

    return {
      version: latest.version,
      previous_version: latest.previous_version,
      changelog: latest.changelog,
      published_at: latest.published_at,
      published_by: latest.published_by,
      fileCount,
      compressed: (latest as any).compressed ?? false,
    };
  },
});

/**
 * Get the full manifest for a specific version
 */
export const getVersionManifest = query({
  args: {
    template_slug: v.string(),
    version: v.string(),
  },
  handler: async (ctx, { template_slug, version }) => {
    const record = await ctx.db
      .query("template_versions")
      .withIndex("by_template_version", (q) =>
        q.eq("template_slug", template_slug).eq("version", version)
      )
      .first();

    if (!record) return null;

    return {
      version: record.version,
      changelog: record.changelog,
      manifest: record.manifest,
      published_at: record.published_at,
    };
  },
});

/**
 * Get a single file's content from a version manifest
 */
export const getFileContent = query({
  args: {
    template_slug: v.string(),
    version: v.string(),
    file_path: v.string(),
  },
  handler: async (ctx, { template_slug, version, file_path }) => {
    const record = await ctx.db
      .query("template_versions")
      .withIndex("by_template_version", (q) =>
        q.eq("template_slug", template_slug).eq("version", version)
      )
      .first();

    if (!record) return null;

    try {
      const manifest = JSON.parse(record.manifest);
      const allFiles = [
        ...(manifest.files ?? []),
        ...(manifest.dashboardFiles ?? []),
      ];
      const file = allFiles.find(
        (f: { path: string }) => f.path === file_path
      );
      return file ?? null;
    } catch {
      return null;
    }
  },
});

/**
 * List version history for a template
 */
export const listVersions = query({
  args: { template_slug: v.string() },
  handler: async (ctx, { template_slug }) => {
    const versions = await ctx.db
      .query("template_versions")
      .withIndex("by_template", (q) => q.eq("template_slug", template_slug))
      .collect();

    versions.sort((a, b) => b.published_at - a.published_at);

    return versions.map((v) => ({
      version: v.version,
      previous_version: v.previous_version,
      changelog: v.changelog,
      published_at: v.published_at,
      published_by: v.published_by,
    }));
  },
});
