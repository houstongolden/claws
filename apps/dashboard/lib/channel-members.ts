/**
 * Channel members — per-channel agent team composition.
 *
 * Stores member lists per channel in localStorage for now. When we wire
 * a real backend (Phase L2), this moves to the runtime DB.
 *
 * Model: A channel is a Slack-style room where multiple specialist agents
 * collaborate on a project. You invite agents by id, pick a lead, and
 * their conversations stream into the channel like a real team thread.
 */

const STORAGE_KEY = "claws-channel-members-v1";

export interface ChannelTeam {
  /** Ordered member list — index 0 is the default lead. */
  memberAgentIds: string[];
  /** Optional explicit lead override; falls back to memberAgentIds[0]. */
  leadAgentId?: string;
  /** ISO timestamp of last edit. */
  updatedAt: string;
}

interface ChannelMembersStore {
  version: 1;
  channels: Record<string, ChannelTeam>;
}

function readStore(): ChannelMembersStore {
  if (typeof window === "undefined") {
    return { version: 1, channels: {} };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, channels: {} };
    const parsed = JSON.parse(raw) as ChannelMembersStore;
    if (parsed.version !== 1 || !parsed.channels) {
      return { version: 1, channels: {} };
    }
    return parsed;
  } catch {
    return { version: 1, channels: {} };
  }
}

function writeStore(store: ChannelMembersStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

/** Get the team for a channel. Returns null if no team configured. */
export function getChannelTeam(channelId: string): ChannelTeam | null {
  const store = readStore();
  return store.channels[channelId] ?? null;
}

/** Replace the entire member list for a channel. */
export function setChannelMembers(
  channelId: string,
  memberAgentIds: string[],
  leadAgentId?: string
): ChannelTeam {
  const store = readStore();
  const team: ChannelTeam = {
    memberAgentIds: Array.from(new Set(memberAgentIds)),
    leadAgentId: leadAgentId ?? memberAgentIds[0],
    updatedAt: new Date().toISOString(),
  };
  store.channels[channelId] = team;
  writeStore(store);
  notify(channelId, team);
  return team;
}

/** Add one agent to a channel's team. */
export function addChannelMember(
  channelId: string,
  agentId: string
): ChannelTeam {
  const existing = getChannelTeam(channelId);
  const members = existing?.memberAgentIds ?? [];
  if (members.includes(agentId)) {
    return existing ?? setChannelMembers(channelId, members);
  }
  return setChannelMembers(
    channelId,
    [...members, agentId],
    existing?.leadAgentId ?? agentId
  );
}

/** Remove one agent from a channel's team. */
export function removeChannelMember(
  channelId: string,
  agentId: string
): ChannelTeam | null {
  const existing = getChannelTeam(channelId);
  if (!existing) return null;
  const nextMembers = existing.memberAgentIds.filter((id) => id !== agentId);
  if (nextMembers.length === 0) {
    const store = readStore();
    delete store.channels[channelId];
    writeStore(store);
    notify(channelId, null);
    return null;
  }
  const nextLead =
    existing.leadAgentId === agentId
      ? nextMembers[0]
      : existing.leadAgentId;
  return setChannelMembers(channelId, nextMembers, nextLead);
}

/** Set which agent leads responses in this channel. */
export function setChannelLead(
  channelId: string,
  leadAgentId: string
): ChannelTeam | null {
  const existing = getChannelTeam(channelId);
  if (!existing) return null;
  if (!existing.memberAgentIds.includes(leadAgentId)) return existing;
  return setChannelMembers(channelId, existing.memberAgentIds, leadAgentId);
}

/** Subscribe to changes to a specific channel's team. */
type Listener = (team: ChannelTeam | null) => void;
const listeners = new Map<string, Set<Listener>>();

function notify(channelId: string, team: ChannelTeam | null): void {
  const subs = listeners.get(channelId);
  if (!subs) return;
  for (const listener of subs) {
    try {
      listener(team);
    } catch {
      // isolate listener errors
    }
  }
}

export function subscribeChannelMembers(
  channelId: string,
  listener: Listener
): () => void {
  let subs = listeners.get(channelId);
  if (!subs) {
    subs = new Set();
    listeners.set(channelId, subs);
  }
  subs.add(listener);
  return () => {
    subs?.delete(listener);
    if (subs && subs.size === 0) {
      listeners.delete(channelId);
    }
  };
}
