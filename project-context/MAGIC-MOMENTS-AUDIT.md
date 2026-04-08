# Magic Moments Audit

**Date:** 2025-03-06  
**Synced:** 2026-03 — audit text below was updated to match current repo.

**Mode:** Magic-moment execution (re-prioritize roadmap around 4 moments; no broad dashboard polish).

## Product priorities (from PRD / OpenClaw response)

1. **Install + onboarding feels magical**
2. **Working persistent session chat**
3. **Agent visibly works** (live state, tool streaming, approvals)
4. **Proactive follow-up or scheduled brief** (proves AI OS, not chat app)

**Working chat** bar (PRD): Dashboard + gateway boot, session send/receive, **session persists across reload/restart**, tool events stream incrementally, traces update, approvals interrupt/gate correctly.

---

## 1. Install + onboarding feels magical

| Status | **Partial** |
|--------|--------------|
| **Evidence** | CLI: `claws setup`, `claws onboard`, `npx @claws-so/create`. Home dir, config, workspace bootstrap, doctor, status, TUI. Onboarding wizard with steps, env detection, next steps. |
| **Working** | setup/onboard/create flow exists; doctor has 8 categories and health score; status probes gateway; TUI has 6 panes and keyboard nav; shared vocab and cross-references. |
| **Blockers** | None critical. Polish is “good enough” for magic moment; further improvements are incremental. |
| **Next** | Validate locally with “local CLI validation” pass; fix any broken paths. |

---

## 2. Working persistent session chat

| Status | **Strong (persistent PGlite)** / **Partial (in-memory fallback)** |
|--------|--------------|
| **Evidence** | Streaming path: `onComplete` in `writeStreamToResponse` → `persistSessionHistory` — assistant reply saved after stream. **Nav Sessions**: starred + recent, resume by selection. If gateway uses **in-memory PGlite** (persistent init failed), transcript does not survive gateway restart. |
| **Working** | Full transcript after reload when PGlite persistent works. Session list/resume in UI. |
| **Blockers** | In-memory DB mode: no cross-restart persistence. Fix: stable PGlite dataDir or doc fallback. |
| **Next** | Optional: mobile polish for artifact + composer; heartbeat runners. |

---

## 3. Agent visibly works (live state, tool streaming, approvals)

| Status | **Strong** |
|--------|--------------|
| **Evidence** | Same as before, plus dashboard: **file cards** during stream for fs.write/fs.append; **artifact panel** (code + HTML preview + open in browser). |
| **Working** | Incremental tool UI in chat; approvals; traces. |
| **Blockers** | None critical for moment 3. |
| **Next** | Richer multi-step tool timeline optional. |

---

## 4. Proactive follow-up or scheduled brief

| Status | **Strong (scheduler)** / **Partial (handlers)** |
|--------|--------------|
| **Evidence** | Gateway **30s interval** calls `listDueScheduledJobs(Date.now())` and `runProactiveJob` for each due job. Slash + Run still work. Full cron expression parsing for next-run optional. |
| **Working** | Due jobs run on schedule (with cron throttle until full parsing). |
| **Blockers** | Stub handlers until LLM/product wiring; proactive messages into conversation thread not done. |
| **Next** | Real brief content; post into conversation; full cron parsing. |

---

## Summary table

| Magic moment                     | Status   | Main blocker(s) |
|----------------------------------|----------|------------------|
| 1. Install + onboarding          | Partial  | None critical    |
| 2. Working persistent session    | Strong*  | *In-memory PGlite = no restart persistence |
| 3. Agent visibly works            | Strong   | Optional richer timeline |
| 4. Proactive follow-up / brief    | Strong*  | *Handler stubs; thread post missing |

---

## Recommended implementation order (updated 2026-03)

1. ~~Session persistence (streaming)~~ — Done (`onComplete` → persistSessionHistory).
2. ~~Proactivity scheduler~~ — Done (gateway 30s loop).
3. ~~Dashboard tool streaming UI~~ — Done (file cards + artifact panel).
4. **Next:** PGlite stable on all hosts (or accept fallback); proactive LLM handlers; multi-agent delegation UX.

Design passes (glass bar, pages aligned) done separately from this audit’s “no broad polish” rule.

---

## Local CLI validation (executed this pass)

| Command | Result |
|---------|--------|
| `claws --help` | Working — workflow, categories, env docs |
| `claws setup` | Working — idempotent, shows config and next steps |
| `claws doctor` | Working — 8 categories, health score, fix suggestions, cross-refs |
| `claws status` | Working — config + services; when gateway down, suggests gateway/dashboard |
| `claws tui` | Working — pre-flight check, clean exit when gateway not running |
| `claws dashboard --help` | Working — See also present |
| `claws gateway --help` | Working — See also present |
| `claws chat` (no message) | Working — usage and examples |

**Conclusion:** CLI is usable and coherent. Full TUI interaction and `claws chat "msg"` require a running gateway (and AI keys); not run in this validation.

---

## Files touched in audit

- `apps/gateway/src/main.ts` (getSessionHistory, persistSessionHistory, handleChatStream)
- `apps/gateway/src/aiHandler.ts` (writeStreamToResponse — already emits tool_call/tool_result)
- `packages/runtime-db/src/index.ts` (appendMessage, getSessionMessages, replaceSessionMessages)
- `project-context/prd.md` (strategy and magic moments already updated)
- `project-context/next-pass.md` (to be updated to reflect this order)
