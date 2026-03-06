/**
 * Agent mention parsing for group chat.
 * Extracts @agent-id or @slug from message and normalizes to known agent ids.
 */

/** Known agent ids (must match @claws/agents). */
export const KNOWN_AGENT_IDS = ["orchestrator", "founder", "developer"] as const;

/** Map common mention slugs to agent id. */
const MENTION_SLUG_TO_ID: Record<string, string> = {
  orchestrator: "orchestrator",
  founder: "founder",
  developer: "developer",
  "dev-agent": "developer",
  "design-agent": "creator",
  "intel-agent": "founder",
  creator: "creator",
  agency: "agency",
  personal: "personal",
  fitness: "fitness",
};

/**
 * Extract @mentions from message text. Returns agent ids in order of first mention.
 * Supports @agent-id and @slug (e.g. @dev-agent, @intel-agent).
 */
export function parseAgentMentions(message: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const regex = /@([a-z0-9_-]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(message)) !== null) {
    const slug = m[1].toLowerCase().trim();
    if (slug.length < 2) continue;
    const id = MENTION_SLUG_TO_ID[slug] ?? (KNOWN_AGENT_IDS.includes(slug as typeof KNOWN_AGENT_IDS[number]) ? slug : null);
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/**
 * Resolve lead agent from participants and mentions.
 * Priority: single mention > first pinned participant > first participant > default (orchestrator).
 */
export function resolveLeadAgent(options: {
  mentionedAgentIds: string[];
  participantAgentIds: string[];
  pinnedAgentIds: string[];
  defaultAgentId: string;
}): string {
  const { mentionedAgentIds, participantAgentIds, pinnedAgentIds, defaultAgentId } = options;
  if (mentionedAgentIds.length === 1) return mentionedAgentIds[0];
  const firstPinned = pinnedAgentIds[0];
  if (firstPinned) return firstPinned;
  const firstParticipant = participantAgentIds[0];
  if (firstParticipant) return firstParticipant;
  return defaultAgentId;
}
