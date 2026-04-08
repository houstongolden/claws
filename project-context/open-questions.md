# Open Questions (Deduped)

**Last synced:** 2026-03 — product/policy items unchanged; runtime gaps below are historical (see feature-ledger).

Sorted by implementation impact. Blocking items are marked clearly.

## Blocking

1. **Default metadata/index strategy**  
   Choose baseline:
   - SQLite-only by default
   - SQLite with optional Convex plugin as default recommendation  
   **Why it blocks:** affects config defaults, storage adapters, and onboarding scaffolds.

2. **Memory auto-distillation cadence**  
   Choose:
   - nightly
   - weekly  
   **Why it blocks:** affects scheduler defaults, memory policies, and workload assumptions.

3. **iMessage bridge strategy and boundary**  
   Choose packaging/hosting model (likely separate adapter service).  
   **Why it blocks:** affects channel architecture boundaries and roadmap commitments.

## High Priority (Not hard-blocking day 1 prototype)

4. **Default approval mode for new workspaces**
   - off
   - smart
   - strict

5. **Initial cloud posture for v0**
   - local-only runtime with optional later cloud
   - local-first with immediate optional cloud dashboard

6. **`create-claws` placement in monorepo**
   - standalone app
   - package/CLI submodule

## Medium Priority

7. **Which integrations should be enabled in first-run onboarding by default?**
   Candidates: GitHub, Telegram, Slack, Notion, Linear, Vercel.

8. **Default visibility mode by selected view**
   Clarify whether developer defaults to `record-on-complete` universally or by task type.

9. **How aggressively should trust grants be offered automatically in smart mode?**
   Define safe boundaries for low/medium risk tool classes.

## Low Priority / Deferred Clarifications

10. **OpenClaw compatibility scope for v0 vs later**
11. **Depth of built-in skill registry UX in first release**
12. **When to include richer external channel parity beyond Telegram**

## Resolved by Consolidation (No longer open)

- Canonical source of truth is local filesystem, governed by `FOLDER.md`.
- Views are overlays, not isolated workspace copies.
- Identity layer uses `identity/you.md` bundle with approval-gated edits.
- Browser/computer execution supports `background`, `record-on-complete`, `watch-live`, `hybrid`.

## Implementation-Critical Gaps (Historical)

Early audit gaps are **resolved** in repo. Current gaps are in `next-pass.md` (e.g. multi-agent delegation, proactive thread post, full cron parsing). Canonical feature state: `feature-ledger.md`.
