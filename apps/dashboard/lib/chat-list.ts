"use client";

import { CHAT_HISTORY_PREFIX } from "./session";

export const CHAT_LIST_KEY = "claws-chat-list";

export type ChatListItem = {
  id: string;
  chatId: string;
  threadId?: string;
  title: string;
  starred: boolean;
  lastActivity: number;
  projectSlug?: string;
};

const DEFAULT_TITLE = "New chat";

export function getChatList(): ChatListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatListItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChatList(list: ChatListItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAT_LIST_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function addToChatList(item: Omit<ChatListItem, "id">): ChatListItem {
  const list = getChatList();
  const id = crypto.randomUUID();
  const entry: ChatListItem = { ...item, id };
  const next = [entry, ...list.filter((c) => c.chatId !== item.chatId)];
  saveChatList(next);
  return entry;
}

export function updateChatInList(
  chatId: string,
  patch: Partial<Pick<ChatListItem, "title" | "starred" | "lastActivity" | "projectSlug">>
): void {
  const list = getChatList();
  const next = list.map((c) =>
    c.chatId === chatId ? { ...c, ...patch } : c
  );
  saveChatList(next);
}

export function ensureChatInList(chatId: string, threadId?: string, title = DEFAULT_TITLE): ChatListItem | null {
  const list = getChatList();
  const existing = list.find((c) => c.chatId === chatId);
  if (existing) return existing;
  return addToChatList({
    chatId,
    threadId,
    title,
    starred: false,
    lastActivity: Date.now(),
  });
}

export function toggleStar(chatId: string): boolean {
  const list = getChatList();
  const entry = list.find((c) => c.chatId === chatId);
  if (!entry) return false;
  const nextStarred = !entry.starred;
  updateChatInList(chatId, { starred: nextStarred });
  return nextStarred;
}

/**
 * Find local threads that have saved history but no sidebar row (e.g. after cache clear of list only).
 */
export function recoverChatsFromStorage(): number {
  if (typeof window === "undefined") return 0;
  let added = 0;
  const list = getChatList();
  const known = new Set(list.map((c) => c.chatId));
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(CHAT_HISTORY_PREFIX)) continue;
    const chatId = key.slice(CHAT_HISTORY_PREFIX.length);
    if (!chatId || chatId.startsWith("conv_") || known.has(chatId)) continue;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown[]) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) continue;
      const firstUser = parsed.find(
        (m: unknown) => typeof m === "object" && m !== null && (m as { role?: string }).role === "user"
      ) as { content?: string } | undefined;
      const snippet = typeof firstUser?.content === "string" ? firstUser.content.trim().slice(0, 52) : "";
      const title = snippet ? (snippet.length >= 52 ? `${snippet}…` : snippet) : "Restored chat";
      addToChatList({
        chatId,
        title,
        starred: false,
        lastActivity: Date.now(),
      });
      known.add(chatId);
      added++;
    } catch {
      /* ignore */
    }
  }
  return added;
}

export function getChatListSorted(list: ChatListItem[], searchQuery?: string): {
  starred: ChatListItem[];
  chats: ChatListItem[];
} {
  const q = searchQuery?.trim().toLowerCase() ?? "";
  const filtered = q
    ? list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.projectSlug ?? "").toLowerCase().includes(q)
      )
    : list;
  const starred = filtered.filter((c) => c.starred).sort((a, b) => b.lastActivity - a.lastActivity);
  const chats = filtered.filter((c) => !c.starred).sort((a, b) => b.lastActivity - a.lastActivity);
  return { starred, chats };
}
