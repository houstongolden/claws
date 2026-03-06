"use client";

import type { ReactNode } from "react";
import { ChatListProvider } from "./chat-list-context";

export function Providers({ children }: { children: ReactNode }) {
  return <ChatListProvider>{children}</ChatListProvider>;
}
