# Claws.so UI — Top 10 UX Issues Audit

**Date:** March 2025  
**Scope:** Full dashboard UI (Session, Nav, Shell, Projects, Tasks, Files, Memory, Approvals, Traces, Workflows, Agents, Settings, Project drill-in)

---

## Top 10 UX issues (by impact)

### 1. **Session: No gateway-offline feedback** — FIXED
- **Issue:** When the gateway isn't online, the subtitle shows "Connecting…" but there's no clear call-out. The composer stays fully usable; sending fails with a generic error. New users don't know they need to start the gateway.
- **Fix applied:** Banner above the composer when gateway is not connected: "Gateway not connected — Start the Claws gateway to chat and use tools. Check your setup and refresh." Composer textarea and Send button are disabled when gateway is not online (after status has loaded).

### 2. **Session: Chat error has no recovery action** — FIXED
- **Issue:** The error block is static (no Retry or "Check gateway"). After a failed send, users don't know what to do next.
- **Fix applied:** Error block now includes a "Dismiss and retry" button that clears the error and refocuses the input.

### 3. **Session: Composer active when gateway is down** — FIXED
- **Issue:** Users can type and click Send when the gateway is offline; the request fails. No clear expectation that chat is unavailable.
- **Fix applied:** Handled with fix #1: textarea and submit button are disabled when `status != null && status.gateway !== "online"`.

### 4. **Agents: Empty states are plain text** — FIXED
- **Issue:** Empty roster and empty tool list use inline text instead of the shared `EmptyState` component (icon, title, description). Inconsistent with Projects, Memory, Approvals and less scannable.
- **Fix applied:** Agent Roster and Tool Registry tabs now use `EmptyState` with icon, title, and description when empty.

### 5. **Memory: Search button not disabled when query is empty**
- **Issue:** User can click "Search" with an empty field; the handler no-ops and there's no feedback. Button should be disabled when query is empty.
- **Status:** Not fixed in this pass.

### 6. **Traces: Pagination lacks context**
- **Issue:** Toolbar shows "X events" and prev/next only. No "Page N" or "1–50 of 120", so users don't know where they are in the list.
- **Status:** Not fixed in this pass.

### 7. **Settings: Primary view can be unset**
- **Issue:** If `viewRes.state` is null, `primary` can stay "". The Select may show a blank or the first option incorrectly. There should be a default (e.g. `founder`) when primary is empty.
- **Status:** Not fixed in this pass.

### 8. **Tasks: Two forms look similar**
- **Issue:** "Append task event" and "Create task (updates project-context/tasks.md)" sit next to each other with similar styling. A clearer visual separation or one-line distinction could reduce confusion.
- **Status:** Not fixed in this pass.

### 9. **Files: Gateway-unavailable hides all content**
- **Issue:** When the gateway is down, only the amber "Gateway unavailable" banner shows; the workspace structure list and "Creating and editing files" block are hidden. Users don't see what they'll get once connected.
- **Status:** Not fixed in this pass. Optional improvement: show a read-only list of canonical dirs when offline.

### 10. **Shell breadcrumb: Project slug shows "Projects" only**
- **Issue:** On `/projects/my-app` the breadcrumb is "Session → Projects", not the project name. Minor orientation gap.
- **Status:** Not fixed in this pass. Would require dynamic title (e.g. from route or API) in the shell.

---

## Summary

| # | Issue | Fixed? |
|---|--------|--------|
| 1 | Session: gateway-offline feedback | Yes |
| 2 | Session: error recovery (Dismiss and retry) | Yes |
| 3 | Session: composer disabled when offline | Yes |
| 4 | Agents: EmptyState for roster & tools | Yes |
| 5 | Memory: disable Search when query empty | No |
| 6 | Traces: pagination context (page/range) | No |
| 7 | Settings: default primary view | No |
| 8 | Tasks: visual separation of two forms | No |
| 9 | Files: preview structure when offline | No |
| 10 | Shell: project name in breadcrumb | No |

**Fixes applied:** 4 (issues 1–4).  
**Remaining:** 6 (5–10). Recommended next: #5 (Memory Search disabled state) and #7 (Settings default primary).
