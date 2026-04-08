"use client";

import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import { ChatListProvider } from "./chat-list-context";
import { RootErrorBoundary } from "./root-error-boundary";

export function Providers({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.getElementById("claws-boot-fallback")?.remove();
  }, []);
  return (
    <RootErrorBoundary>
      <ChatListProvider>{children}</ChatListProvider>
    </RootErrorBoundary>
  );
}
