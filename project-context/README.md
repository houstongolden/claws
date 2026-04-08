# Project context — where to document what

**Last synced:** 2026-03 — matches session list, artifact/vibe UI, PGlite fallback, proactivity scheduler, FOLDER.md enforcement.

This directory holds the canonical planning and feature state for Claws. Coding agents and contributors should use these files as the source of truth.

| File | Purpose |
|------|---------|
| **prd.md** | Canonical product specification (philosophy, architecture, UX, workspace contract). |
| **tasks.md** | Human-readable build queue: task IDs, status, priority, dependencies, acceptance criteria. |
| **tasks.jsonl** | Append-only machine log of task and feature events. |
| **feature-ledger.md** | Canonical list of all features with status (complete/partial/placeholder/missing) and evidence (files, routes, UI, runtime). Update this when a feature is implemented or its status changes. |
| **prompts/prompt-ledger.md** | Reconstructed development prompts and their outcomes (requested, status, evidence). Use for prompt-by-prompt reconciliation. |
| **prompts/prompt-ledger-dump2.md** | Raw prompt history and reference material (landscape, spec fragments). Not the task list; use prompt-ledger.md for reconciled outcomes. |
| **next-pass.md** | Current sprint: next 10–15 highest-value tasks, dependency-ordered. |
| **current-state.md** | Snapshot of what exists, what still needs implementation, system readiness score, and critical missing capabilities. |
| **human-tasks.md** | Tasks that require human input (API keys, account decisions, approval mode). |
| **build-roadmap.md** | Phased delivery plan. |
| **RECONCILIATION-REPORT.md** | Feature ledger reconciliation audit summary. |

See [AGENT.md](../AGENT.md) for agent workflow rules and [CONTRIBUTING.md](../CONTRIBUTING.md) for how to add features.
