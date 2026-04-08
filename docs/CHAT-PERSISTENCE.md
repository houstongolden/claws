# Chat persistence (local)

Chats and sessions are stored **in the browser** so you can close the tab and resume later.

| Storage key | What |
|-------------|------|
| `claws-chat-session` | Last opened thread (`chatId` + `threadId`) — reopened on load |
| `claws-chat-list` | Sidebar list (titles, star, last activity) |
| `claws-chat-history-<chatId>` | Messages for that thread (one key per chat) |

**Resume a thread:** click it in the sidebar (or use Search chats). History loads from `claws-chat-history-*`.

**New chat:** starts a fresh `dashboard-<uuid>` thread; the previous thread stays in the list.

**Recovery:** On load, any history file without a sidebar row is re-added (e.g. after clearing only the list).

Data is per **origin** (e.g. `http://localhost:4318`). Clearing site data removes all threads.
