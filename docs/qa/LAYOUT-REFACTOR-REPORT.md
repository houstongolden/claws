# Claws.so UI Layout Refactor — Conversation-First

**Goal:** Transform the dashboard into a **chat-first** AI workspace similar to ChatGPT, Claude, Cursor, and Perplexity.

---

## 1. Layout architecture

### Before
- **Left sidebar:** Session, Workspace (Projects, Tasks, Files, Memory), Runtime (Approvals, Traces, Workflows), System (Agents, Settings), Theme.
- **Center:** Session (chat) or other full-width pages.
- **Right:** Context panel (Overview, Project, Files, Approvals, Memory, Traces, Workflow) only on Session, fixed visible on xl.

### After
- **Left sidebar:** Chat-focused only.
  - New Chat
  - Search Chats
  - Starred (starred conversations)
  - Projects (list from workspace)
  - Chats (all conversations, sorted by last activity)
  - Settings + Theme at bottom
- **Center:** Session / Chat as the primary surface.
- **Right sidecar:** Collapsible context panel (Files, Tasks, Approvals, Memory, Traces, Workflow state) with quick links to full pages.

---

## 2. Files modified

| File | Change |
|------|--------|
| `apps/dashboard/lib/chat-list.ts` | **New.** Chat list storage: `getChatList`, `saveChatList`, `addToChatList`, `updateChatInList`, `ensureChatInList`, `toggleStar`, `getChatListSorted`. Persisted in `localStorage` under `claws-chat-list`. |
| `apps/dashboard/lib/session.ts` | Added `CHAT_HISTORY_PREFIX`, `getHistoryStorageKey`, `loadHistoryForChat`, `saveHistoryForChat` for per-chat history keys `claws-chat-history-${chatId}`. |
| `apps/dashboard/components/chat-list-context.tsx` | **New.** React context: `chatList`, `currentMeta`, `searchQuery`, `starred`, `chats`, `newChat`, `selectChat`, `toggleStar`, `refreshList`, `updateChatTitle`, `updateChatActivity`. |
| `apps/dashboard/components/providers.tsx` | **New.** Client wrapper that renders `ChatListProvider` around children. |
| `apps/dashboard/app/layout.tsx` | Wrapped `{children}` with `<Providers>` so Nav and Session have access to `ChatListContext`. |
| `apps/dashboard/components/nav.tsx` | **Replaced.** Conversation-first left sidebar: New Chat, Search Chats, Starred, Projects, Chats list. Uses `useChatList()`. Removed Tasks, Files, Memory, Approvals, Traces, Workflows, Agents from primary nav. Settings and Theme in footer. |
| `apps/dashboard/components/shell.tsx` | Removed `tenant` state and prop; `<Nav />` no longer receives tenant. |
| `apps/dashboard/components/session-workbench.tsx` | Uses `useChatList()` for `currentMeta`, `newChat`, `updateChatTitle`, `updateChatActivity`. History load/save keyed by `chatId` via `loadHistoryForChat` / `saveHistoryForChat`. Clear conversation calls `newChat()`. Collapsible right context panel (state `contextPanelOpen`, toggle in header). Context panel header includes quick links to Files, Tasks, Memory, Approvals, Traces, Workflows. Message spacing `space-y-8` → `space-y-10`. Toggle panel button (PanelRight / PanelRightClose). |

---

## 3. Chat navigation behavior

- **New Chat:** Creates a new session (`createSessionMeta()`), pushes previous chat into the list with updated `lastActivity`, persists new meta, adds new chat to list via `ensureChatInList`. Session workbench reacts to `currentMeta.chatId` and loads empty history for the new chat.
- **Chat list:** Sorted by last activity. Starred chats shown in “Starred”; non-starred in “Chats”. Search filters by title and project slug.
- **Select chat:** Clicking a chat in the list calls `selectChat(chatId)`: persists that chat’s meta to session storage and sets it as current. Session workbench effect loads history for that `chatId`. If not already on `/`, navigates to `/`.
- **Starring:** Star icon on each chat row; click toggles `starred` in the list (persisted in localStorage). Starred chats appear under “Starred”.
- **History:** Stored per chat in `sessionStorage` under `claws-chat-history-${chatId}`. Switching chat loads that key; sending messages saves to the current chat’s key. Draft remains single key `claws-chat-draft`; cleared when switching chats.

---

## 4. Starring implementation

- **Storage:** `ChatListItem` in `claws-chat-list` (localStorage) includes `starred: boolean`.
- **Toggle:** `toggleStar(chatId)` in context calls `toggleStarStorage(chatId)` from `lib/chat-list.ts` and refreshes list state.
- **UI:** In the sidebar, each chat row shows a star icon (filled when starred). Click handler stops propagation so it doesn’t select the chat. “Starred” section lists only items with `starred === true`, sorted by last activity.

---

## 5. UI improvements

- **Chat-first nav:** Sidebar focuses on conversations (New Chat, Search, Starred, Chats) and Projects; no tool pages as primary nav.
- **Context panel:** Collapsible via header button; when closed, main chat area uses full width. Panel header includes short copy and links to full pages (Files, Tasks, Memory, Approvals, Traces, Workflows).
- **Message spacing:** Main chat content uses `space-y-10` for clearer separation between messages.
- **Composer:** Unchanged: fixed to bottom, max-width container, single draft key. Send and input disabled when gateway is offline (existing behavior).
- **Chat titles:** First user message in a new chat is used to set the list entry title (first 50 characters); `updateChatTitle` and `updateChatActivity` called from Session workbench on send.

---

## 6. What stayed the same

- **Routes:** `/`, `/chat`, `/projects`, `/projects/[slug]`, `/tasks`, `/files`, `/memory`, `/approvals`, `/traces`, `/workflows`, `/agents`, `/settings` still exist. Only the sidebar entry points changed; tools are reached via context panel links or direct URL.
- **Session API:** Chat still uses same gateway endpoints and session meta (chatId, threadId, etc.); persistence is now per-chat in the client.
- **Geist, Tailwind, shadcn:** No change to design tokens or component library.

---

## 7. Testing checklist

- [ ] Sidebar: New Chat creates a new conversation and shows it in Chats.
- [ ] Sidebar: Search filters Chats and Starred by title.
- [ ] Sidebar: Starring a chat moves it to Starred; unstarring moves it back.
- [ ] Sidebar: Selecting a chat loads its history and shows it in the center.
- [ ] Sidebar: Projects list links to `/projects` and project slug pages.
- [ ] Chat: Composer is fixed at bottom; message list scrolls above.
- [ ] Chat: Context panel opens/closes via header toggle; when open, tabs (Overview, Project, Files, etc.) and quick links work.
- [ ] Chat: Clearing conversation (New chat / trash) starts a new chat and updates the list.
- [ ] Layout: On non-chat routes (e.g. Projects, Settings), sidebar still shows; “Back to Session” breadcrumb and content behave as before.

---

## 8. Note on build

`pnpm --filter @claws/dashboard build` currently fails due to a **pre-existing** type error in `app/projects/[slug]/page.tsx` (Next.js 15 `params` as `Promise`). The refactor does not modify that file. Fixing that type will unblock the build.
