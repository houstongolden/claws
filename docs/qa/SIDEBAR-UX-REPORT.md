# Sidebar UX — Changes Report

The sidebar was updated to match the requested structure and ChatGPT-style navigation: **New chat**, **Search chats**, and four sections — **Sessions**, **Projects**, **Channels**, **Agents**. The UI is kept minimal.

---

## 1. Top block: New chat + Search

- **New chat** — Primary button at the top (icon + “New chat” when expanded; icon-only when collapsed). Starts a new session and navigates to `/` when not already on the chat route.
- **Search chats** — Input directly under New chat, placeholder “Search chats”. Filters the Sessions list by title and project slug (existing `searchQuery` / `getChatListSorted` behavior). Hidden when sidebar is collapsed.

Pattern matches ChatGPT: main action first, then search over the list.

---

## 2. Section order and labels

Sections appear in this order:

1. **Sessions** — Chat sessions (see below).
2. **Projects** — Links to project pages (`/projects/[slug]`), up to 8.
3. **Channels** — Channel list with “Create channel” and `#slug` entries; create form inline when opened.
4. **Agents** — Single entry “View agents” linking to `/agents`; active state when `pathname === "/agents"`.

Section headers use a small uppercase label + icon, with slightly reduced padding for a denser layout.

---

## 3. Sessions (merged with Starred)

- **Before:** Separate “Starred” and “Chats” sections.
- **After:** One **Sessions** section. Starred items are listed first, then non-starred chats (both still filtered by the search box). Empty state: “No chats yet”.
- Session rows are unchanged in behavior: click to select, star/unstar on hover, time on the right. Styling is tightened (smaller text, less padding).

---

## 4. Projects

- Still shows up to 8 projects with icon, name, and chevron.
- Slightly reduced padding and font size for consistency with the minimal look.

---

## 5. Channels

- Unchanged behavior: “Create channel” button, list of `#slug`, inline create form (name + Create/Cancel).
- Slightly reduced padding and font size.

---

## 6. Agents

- **New section.** Icon: `Bot` (lucide-react).
- Single item: “View agents” with chevron, linking to `/agents`. Uses active styling when on `/agents`.
- Collapsed state: icon-only button to `/agents`.

---

## 7. Header and footer

- **Header:** Logo + “Claws” + collapse toggle. “AI workspace” subtitle removed for a minimal header.
- **Footer:** Theme toggle + Settings link; slightly reduced padding.

---

## 8. Minimal / ChatGPT-style details

- **Order:** New chat → Search → scrollable sections (Sessions, Projects, Channels, Agents). No extra blocks in between.
- **Density:** Smaller section labels (11px uppercase), 12px for list items, 10px for timestamps; reduced vertical padding on rows and sections.
- **Collapsed:** Logo, New chat icon, then section content as icon-only rows; no search or section labels.
- **Icons:** Slightly smaller (14–15px) where it didn’t hurt tap targets.

---

## 9. Files changed

- **`apps/dashboard/components/nav.tsx`**
  - Imports: added `Bot`, kept `Star` for session star button.
  - Header: removed subtitle; slightly smaller logo/text.
  - New chat + Search: same behavior, tighter styling; placeholder “Search chats”.
  - Sections: Starred merged into Sessions; order set to Sessions → Projects → Channels → Agents.
  - New Agents section with link to `/agents`.
  - Section component: smaller label and padding.
  - ChatRow: smaller text and padding; star and time unchanged.
  - Footer: smaller padding.

No new dependencies; no API or data changes.
