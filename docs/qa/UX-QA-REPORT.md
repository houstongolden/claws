# Claws.so Usability QA Report

**Date:** March 6, 2025  
**Mode:** New-user flows (browser + code review)  
**App:** Dashboard (Next.js, port 4318)

---

## Test flows covered

| # | Flow | Status | Notes |
|---|------|--------|-------|
| 1 | Open app | ✅ | Session home loads; sidebar, composer, command chips visible |
| 2 | Start session | ⚠️ | Blocked without gateway / AI provider (Send disabled until connected) |
| 3 | Create project | ⚠️ | Via Session chat; blocked if gateway down |
| 4 | Create task | ✅ | Tasks page: Append event + Create task forms; Create disabled until description entered |
| 5 | Search memory | ⚠️ | Memory page UI fine; search runs via gateway |
| 6 | Trigger approval | ⚠️ | Approvals page ready; approvals appear when gateway triggers high-risk tools |
| 7 | Inspect traces | ✅ | Traces page: filter, type filter, pagination, expand/collapse |
| 8 | Project drill-in | ✅ | Projects list → project slug page; canonical files, traces, task activity, memory, approvals |
| 9 | View files | ✅ | Files: workspace browser, inspector, quick reads; gateway-unavailable state improved |
| 10 | Navigate workflows | ✅ | Workflows: Runs list, Architecture tab, empty state |

---

## UX issues found

### Friction / confusion

- **Tasks — Create button disabled:** No hint why "Create" was disabled (task description required). Could feel broken to a new user.
- **Projects list — Redundant "View" button:** Each row was both a big link and a separate "View" button to the same URL. Redundant and slightly confusing.
- **Files — Gateway down:** When the gateway wasn’t available, the page showed loading then nothing about why workspace/file tools didn’t work. No clear feedback.

### Layout / consistency

- **Theme toggle:** Snapshot showed "Theme" on Memory and "Theme: light (light)" on Tasks. Likely same component; difference may be timing/aria. No code change made; worth a quick check if you see inconsistency.
- **Shell breadcrumb:** Project drill-in (`/projects/[slug]`) shows "Session → Workspace" (first segment only). Could be improved to "Session → Projects → {name}" with a small routing/title change.

### What was already in good shape

- Empty states (Projects, Tasks, Memory, Approvals, Traces, Workflows) are clear and often include a next step (e.g. "Open Session", "Flush session checkpoint").
- Labels and copy (Append event vs Create task, Grant options on Approvals, Memory tabs) are understandable.
- Traces and Workflows pagination/expand and Approvals grant buttons behave as expected from the code.
- No broken interactions or obvious layout glitches were found in the reviewed pages.

---

## Fixes applied

1. **Tasks page (`app/tasks/page.tsx`)**
   - **Create button:** Added `title` and `aria-label` when disabled: "Enter a task description to create" / "Create task (enter a task description first)" so users know why the button is disabled.
   - **Pagination:** Added `aria-label="Previous page"` and `aria-label="Next page"` to the Activity tab pagination icon buttons for accessibility.

2. **Projects page (`app/projects/page.tsx`)**
   - **Single target per row:** Removed the separate "View" button. The whole project row is now one link to the project drill-in, reducing duplicate targets and clarifying that clicking the row opens the project.

3. **Files page (`app/files/page.tsx`)**
   - **Gateway unavailable:** When not loading and `workspaceRoot` is missing (e.g. gateway down), the page now shows a clear notice: "Gateway unavailable — Workspace path and file tools (browse, read) require the Claws gateway. Start the gateway and refresh." Styled with a soft amber border/background so it’s visible but not alarming.

---

## Remaining issues

- **Session / gateway-dependent flows:** Start session, create project via chat, memory search, and approval triggers depend on the gateway (and AI provider for chat). If the gateway is down or env is missing, the UI stays "Connecting…" or errors. This is expected; consider a persistent "Gateway disconnected" or "Setup required" banner on Session when status fails.
- **Theme toggle label:** If you see inconsistent "Theme" vs "Theme: light (light)" between pages, inspect `ThemeToggle` and nav rendering (e.g. hydration) so the visible/aria label is consistent.
- **Project breadcrumb:** Optional improvement: show "Session → Projects → {project name}" (or slug) on project drill-in by deriving the title from the first segment and, if route is `projects/[slug]`, from project name/slug.
- **No automated E2E:** These checks were manual (browser snapshot + code review). Adding Playwright (or similar) for the main flows would catch regressions.

---

## Summary

- **Fixes applied:** 3 (Tasks Create + pagination a11y, Projects single-link row, Files gateway-unavailable message).
- **Blocked by backend:** Session chat, create project, memory search, approvals (when no gateway). UX for those flows is reasonable; improving "disconnected" state on Session would help.
- **Optional next steps:** Consistent theme label, project drill-in breadcrumb, Session disconnected banner, E2E for critical paths.
