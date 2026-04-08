# Runtime persistence (PGlite)

Claws uses **PGlite** for local-first runtime state. The workspace filesystem remains the canonical source of truth for content.

## Canonical sources of truth

| Layer | Store | Purpose |
|-------|--------|--------|
| **Workspace content** | Filesystem | `projects/`, `prompt/`, `identity/`, `notes/`, `tasks.md`, `FOLDER.md`, and all workspace files. Never replaced by the DB. |
| **Runtime state** | PGlite (`.claws/runtime/`) | Sessions, chat transcripts, traces, approvals, grants, workflows, tool events, task event log, memory metadata. |

## What lives in PGlite

- **sessions** — Chat identity, view stack (primary + overlays), per chatId/threadId.
- **messages** — Chat transcript per session (role, content, tool_results).
- **traces** — Runtime ledger (tool-call, approval-required, chat, project-create, task-create, draft-create, etc.).
- **tool_events** — Append-only tool execution log (queryable).
- **approvals** — Pending high-risk tool requests.
- **approval_grants** — Active trust grants (once, session, 24h, tool, agent, view).
- **workflow_runs** / **workflow_steps** — Durable workflow execution state.
- **memory_items** — Curated memory entries (metadata + content for search). Table present; memory tool still uses `.claws/memory-store.json` by default; migration to PGlite optional.
- **task_events** — Append-only task event log (queryable). Dual-write: also appended to `project-context/tasks.jsonl` for backward compatibility.

## Bootstrap

At gateway startup, **`initRuntimeDb({ workspaceRoot })`** is attempted first. It:

1. Ensures `.claws/runtime/` exists.
2. Creates a PGlite instance with that directory as `dataDir`.
3. Runs the schema SQL (all `CREATE TABLE IF NOT EXISTS`).
4. Returns the DB instance used for all runtime-db calls.

**In-memory fallback:** If step 2 fails (e.g. WASM `Aborted()` on some Node/OS combinations), the gateway calls **`initRuntimeDbInMemory()`** (no `dataDir`), logs a warning, and continues. **Runtime state does not survive gateway restarts** in that mode. Mitigations: clear `.claws/runtime`, try another Node LTS, upgrade `@electric-sql/pglite` when fixes land.

No remote DB is required for the prototype. The same schema is suitable for a future migration to hosted Postgres (e.g. per-tenant DB URL).

## Package

- **`@claws/runtime-db`** — `packages/runtime-db`: schema, init, and all query/insert helpers. Gateway depends on it and calls it for sessions, messages, traces, approvals, workflows, task events.

## What still lives only in memory

- **ApprovalStore in-memory maps** — Pending and grants are hydrated from PGlite at startup and synced on enqueue/resolve. The in-memory store is still the authority for `isGranted()` during a run; PGlite is the durable copy.
- **Router view state** — Per-thread view stack is also persisted to the session row in PGlite; gateway reads from session when serving getViewState.

## Filesystem unchanged

- `projects/` — Scanned by gateway; not stored in DB.
- `prompt/`, `identity/`, `notes/` — Read by tools and identity loader; not in DB.
- `tasks.md` — Read by Tasks page via `fs.read`; not in DB.
- `project-context/tasks.jsonl` — Still appended by `tasks.appendEvent` tool; task events are also written to PGlite for querying.
- `FOLDER.md` — Governance: parsed via `loadFolderContractSync` / `parseFolderMd`; allowed roots and write rules in WorkspaceFS (`packages/workspace/folder-md.ts`).
- `.claws/memory-store.json` — Still used by the memory tool unless/until memory is migrated to PGlite.
