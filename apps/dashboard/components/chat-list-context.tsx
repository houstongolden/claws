"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createSessionMeta,
  persistSessionMeta,
  readSessionMeta,
  type SessionMeta,
} from "../lib/session";
import {
  addToChatList,
  ensureChatInList,
  getChatList,
  getChatListSorted,
  recoverChatsFromStorage,
  updateChatInList,
  toggleStar as toggleStarStorage,
  type ChatListItem,
} from "../lib/chat-list";

type ChatListContextValue = {
  chatList: ChatListItem[];
  currentMeta: SessionMeta | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  starred: ChatListItem[];
  chats: ChatListItem[];
  newChat: () => void;
  selectChat: (chatId: string) => void;
  toggleStar: (chatId: string) => void;
  refreshList: () => void;
  updateChatTitle: (chatId: string, title: string) => void;
  updateChatActivity: (chatId: string) => void;
};

const ChatListContext = createContext<ChatListContextValue | null>(null);

export function useChatList(): ChatListContextValue {
  const ctx = useContext(ChatListContext);
  if (!ctx) throw new Error("useChatList must be used within ChatListProvider");
  return ctx;
}

export function ChatListProvider({ children }: { children: ReactNode }) {
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [currentMeta, setCurrentMeta] = useState<SessionMeta | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshList = useCallback(() => {
    setChatList(getChatList());
  }, []);

  /** Client-only session init — avoids SSR/client UUID mismatch (blank screen from hydration failure). */
  useLayoutEffect(() => {
    recoverChatsFromStorage();
    let meta = readSessionMeta();
    if (!meta) {
      meta = createSessionMeta();
      persistSessionMeta(meta);
    }
    setCurrentMeta(meta);
    ensureChatInList(meta.chatId, meta.threadId);
    refreshList();
  }, [refreshList]);

  const { starred, chats } = useMemo(
    () => getChatListSorted(chatList, searchQuery),
    [chatList, searchQuery]
  );

  const newChat = useCallback(() => {
    const prev = readSessionMeta();
    const list = getChatList();
    /* Always keep previous thread in the list so you can resume it later. */
    if (prev) {
      if (list.some((c) => c.chatId === prev.chatId)) {
        updateChatInList(prev.chatId, { lastActivity: Date.now() });
      } else {
        addToChatList({
          chatId: prev.chatId,
          threadId: prev.threadId,
          title: "Chat",
          starred: false,
          lastActivity: Date.now(),
        });
      }
    }
    const created = createSessionMeta();
    persistSessionMeta(created);
    setCurrentMeta(created);
    ensureChatInList(created.chatId, created.threadId);
    setChatList(getChatList());
  }, []);

  const selectChat = useCallback((chatId: string) => {
    const list = getChatList();
    const item = list.find((c) => c.chatId === chatId);
    if (!item) return;
    updateChatInList(chatId, { lastActivity: Date.now() });
    const meta: SessionMeta = {
      workspaceId: "ws_local",
      channel: "local",
      chatId: item.chatId,
      threadId: item.threadId,
      userId: "local-user",
    };
    persistSessionMeta(meta);
    setCurrentMeta(meta);
    setChatList(getChatList());
  }, []);

  const toggleStar = useCallback((chatId: string) => {
    toggleStarStorage(chatId);
    setChatList(getChatList());
  }, []);

  const updateChatTitle = useCallback((chatId: string, title: string) => {
    updateChatInList(chatId, { title });
    setChatList(getChatList());
  }, []);

  const updateChatActivity = useCallback((chatId: string) => {
    updateChatInList(chatId, { lastActivity: Date.now() });
    setChatList(getChatList());
  }, []);

  const value: ChatListContextValue = useMemo(
    () => ({
      chatList,
      currentMeta,
      searchQuery,
      setSearchQuery,
      starred,
      chats,
      newChat,
      selectChat,
      toggleStar,
      refreshList,
      updateChatTitle,
      updateChatActivity,
    }),
    [
      chatList,
      currentMeta,
      searchQuery,
      starred,
      chats,
      newChat,
      selectChat,
      toggleStar,
      refreshList,
      updateChatTitle,
      updateChatActivity,
    ]
  );

  return (
    <ChatListContext.Provider value={value}>
      {children}
    </ChatListContext.Provider>
  );
}
