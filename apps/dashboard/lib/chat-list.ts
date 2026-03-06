"use client";

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
