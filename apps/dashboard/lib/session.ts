"use client";

export const CHAT_STORAGE_KEY = "claws-chat-history";
export const CHAT_HISTORY_PREFIX = "claws-chat-history-";
export const CHAT_DRAFT_KEY = "claws-chat-draft";
export const CHAT_SESSION_KEY = "claws-chat-session";

export type SessionMeta = {
  workspaceId: string;
  channel: "local";
  chatId: string;
  threadId?: string;
  userId: string;
};

export type SessionHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export function getHistoryStorageKey(chatId: string): string {
  return `${CHAT_HISTORY_PREFIX}${chatId}`;
}

export function loadHistoryForChat(chatId: string): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getHistoryStorageKey(chatId);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryForChat(chatId: string, messages: unknown[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getHistoryStorageKey(chatId), JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export function createSessionMeta(): SessionMeta {
  return {
    workspaceId: "ws_local",
    channel: "local",
    chatId: `dashboard-${crypto.randomUUID()}`,
    userId: "local-user",
  };
}

export function readSessionMeta(): SessionMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CHAT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionMeta;
    if (!parsed.chatId || !parsed.workspaceId || !parsed.channel || !parsed.userId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function persistSessionMeta(meta: SessionMeta): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(meta));
}

export function ensureSessionMeta(): SessionMeta {
  const existing = readSessionMeta();
  if (existing) return existing;
  const created = createSessionMeta();
  persistSessionMeta(created);
  return created;
}
