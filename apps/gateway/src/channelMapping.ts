/**
 * Parser for Telegram and Slack channel mapping files.
 * Format: key (telegram_topic or slack_channel) followed by maps_to on next line or same block.
 */

export type MappingKeyPrefix = "telegram_topic" | "slack_channel";

export interface MappingEntry {
  /** External id (e.g. "12345", "C01234ABCD") */
  externalId: string;
  /** Claws destination: "#channel-slug" or "project:project-slug" */
  mapsTo: string;
}

/**
 * Parse a mapping file content. Expects lines like:
 *   telegram_topic: 12345
 *   maps_to: #sales
 * Pairs key: value with the following maps_to: value. Blank lines separate entries.
 */
export function parseMappingFile(
  content: string,
  keyPrefix: MappingKeyPrefix
): Map<string, string> {
  const result = new Map<string, string>();
  const lines = content.split(/\r?\n/);
  const keyRegex = new RegExp(`^\\s*${keyPrefix}\\s*:\\s*(.+)$`, "i");
  const mapsToRegex = /^\s*maps_to\s*:\s*(.+)$/i;

  let currentKey: string | null = null;

  for (const line of lines) {
    const keyMatch = line.match(keyRegex);
    const mapsToMatch = line.match(mapsToRegex);

    if (keyMatch) {
      currentKey = keyMatch[1].trim();
    } else if (mapsToMatch && currentKey !== null) {
      const mapsTo = mapsToMatch[1].trim();
      if (mapsTo) result.set(currentKey, mapsTo);
      currentKey = null;
    } else if (line.trim() === "") {
      currentKey = null;
    }
  }

  return result;
}

/**
 * Parse mapping file and return entries (for inspection/testing).
 */
export function parseMappingEntries(content: string, keyPrefix: MappingKeyPrefix): MappingEntry[] {
  const map = parseMappingFile(content, keyPrefix);
  return Array.from(map.entries()).map(([externalId, mapsTo]) => ({ externalId, mapsTo }));
}

/**
 * Normalize destination string to a canonical form.
 * - "#sales" or "#sales-channel" -> channel slug "sales" or "sales-channel"
 * - "project:claws-so" -> project slug "claws-so"
 */
export function parseDestination(destination: string): { type: "channel"; slug: string } | { type: "project"; slug: string } | null {
  const s = destination.trim();
  if (s.startsWith("#")) {
    const slug = s.slice(1).replace(/^[-]+|[-]+$/g, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "general";
    return { type: "channel", slug };
  }
  if (s.toLowerCase().startsWith("project:")) {
    const slug = s.slice(8).trim().replace(/^[-]+|[-]+$/g, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    if (!slug) return null;
    return { type: "project", slug };
  }
  return null;
}
