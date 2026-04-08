# Phase D — claw-code reference repos

**Status:** Cloned to `~/Desktop/CODE_2025/forks/claw-code-ultraworkers/` (15MB, 9 Rust crates, ~28K LOC in runtime alone).

**Note:** `Nuos/ai-instructkr-claw-code` is disabled by its owner — cannot clone. ultraworkers/claw-code is the richer reference anyway.

## Purpose

This is a REFERENCE repo, not a copy source. We mine patterns from it, then port to the Claws TypeScript stack. The Rust code itself is not consumable by Claws — but the architecture decisions, data models, and patterns are.

## High-value patterns to port to Claws experimental OS (Pillar 2)

### P1 (load-bearing, port first)

1. **Session JSONL format** — `rust/crates/runtime/src/session.rs` (1496 LOC)
   - Append-only event log, per-session file
   - Resumable, forkable, compactable
   - Already referenced in our CEO plan. This file is the authoritative reference.
   - Port target: `packages/runtime-db/src/session-events.ts` (planned)

2. **Permission modes** — `rust/crates/runtime/src/permissions.rs` (683 LOC)
   - Three modes: read-only, workspace-write, danger-full-access
   - Enforced at the tool level
   - Port target: `packages/core/src/permissions.ts` (new file)

3. **Worker boot lifecycle** — `rust/crates/runtime/src/worker_boot.rs` (1180 LOC)
   - Explicit states: spawning → trust_required → ready_for_prompt → running → blocked → finished
   - Handles the "async agent loop" we planned in CEO doc
   - Port target: `apps/worker/src/main.ts` (extend existing stub)

4. **Session control API** — `rust/crates/runtime/src/session_control.rs` (873 LOC)
   - Pause/resume/fork primitives
   - Port target: `apps/gateway/src/httpServer.ts` (add endpoints)

### P2 (polish, port after P1)

5. **Trust resolver** — `rust/crates/runtime/src/trust_resolver.rs` (299 LOC)
   - Workspace trust prompts (first-run gate)
   - Port target: `packages/core/src/trust.ts`

6. **Stale branch/base detection** — `stale_branch.rs` (417 LOC) + `stale_base.rs` (429 LOC)
   - Detect git state drift before agents act on stale assumptions
   - Port target: `packages/tools/src/git.ts` (new)

7. **Recovery recipes** — `recovery_recipes.rs` (631 LOC)
   - Known failure → automated recovery steps
   - Port target: `packages/core/src/recovery.ts` (new)

8. **Task registry** — `task_registry.rs` (503 LOC)
   - In-memory lifecycle management for async tasks
   - Port target: `packages/core/src/task-registry.ts` (new)

9. **Team cron registry** — `team_cron_registry.rs` (509 LOC)
   - Scheduled/recurring task management
   - Port target: `packages/core/src/cron-registry.ts` (new)

10. **Policy engine** — `policy_engine.rs` (581 LOC)
    - Merge policy, retry policy, lane events
    - Port target: `packages/core/src/policy.ts` (new)

### P3 (nice-to-have)

11. **Mock Anthropic service** — `rust/crates/mock-anthropic-service/`
    - Deterministic fake AI provider for CI testing
    - Port target: `apps/gateway/src/__tests__/mockProvider.ts`
    - This is what unlocks deterministic agent flow tests

12. **Plugin lifecycle** — `plugin_lifecycle.rs` (533 LOC)
    - PreToolUse / PostToolUse / PostToolUseFailure hooks
    - Port target: `packages/core/src/plugins.ts` (new)
    - Defer until there's real user demand for extensibility

13. **Summary compression** — `summary_compression.rs` (300 LOC)
    - Auto-compact session when token count exceeds threshold
    - Port target: `packages/core/src/compact.ts` (new)

14. **Usage tracking** — `usage.rs` (313 LOC)
    - Budget enforcement, token ledger
    - Port target: `packages/core/src/usage.ts` (new)
    - Ties into the cost ticker from the CEO plan

### What NOT to port

- **MCP transport** (stdio, SSE, WebSocket, HTTP) — defer until user needs MCP interop
- **LSP client** — defer, not core to Claws mission
- **Prompt cache** — the AI SDK handles this
- **OAuth flow** — Claws uses BYOK, no OAuth needed
- **Telemetry crate** — use existing tracing infrastructure

## How to use this reference

```bash
# Read a specific file to study the pattern
cat ~/Desktop/CODE_2025/forks/claw-code-ultraworkers/rust/crates/runtime/src/session.rs

# Search for a specific concept
grep -rn "PermissionMode" ~/Desktop/CODE_2025/forks/claw-code-ultraworkers/rust/crates/runtime/src/

# Compare with our existing TS code
diff -u our-file.ts <(translate-rust-concept session.rs)  # (conceptual, no actual tool)
```

## Porting strategy

1. Read the Rust file
2. Extract the data model (struct → TS interface)
3. Extract the state machine or algorithm
4. Write idiomatic TypeScript (don't mimic Rust patterns literally)
5. Add tests using the MockAIProvider pattern
6. Document the source in a comment: `// Ported from ultraworkers/claw-code rust/crates/runtime/src/session.rs`

## Licensing

ultraworkers/claw-code is MIT licensed (confirmed in the repo's LICENSE). Direct porting with attribution is legally clean. For Claws to stay MIT compatible, we just add attribution in the ported file headers.
