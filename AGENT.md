# AGENT.md

This repository is maintained with the help of coding agents.

## Source of truth
- `/project-context/prd.md` = canonical product specification
- `/project-context/tasks.md` = human-readable task plan
- `/project-context/tasks.jsonl` = append-only machine task log
- `/project-context/feature-ledger.md` = canonical list of features and reconciliation status
- `/project-context/prompts/prompt-ledger.md` = log of development prompts and their outcomes
- `/project-context/human-tasks.md` = tasks that require the human owner
- `/project-context/Claws-PRD-v0.01.md` = archival source dump (reference-only, not canonical)

## Agent workflow rules
Agents working in this repo should:

1. Always read `/project-context/prd.md` before implementing features.
2. **Record every prompt:** Every prompt provided during development must be recorded in `/project-context/prompts/` (e.g. `prompt-ledger.md`). Each prompt entry must capture: title, intent, requested features, status (complete/partial/missing), and evidence. Before implementation proceeds, update the feature ledger and task list (see below).
3. Update `/project-context/tasks.md` and append to `/project-context/tasks.jsonl`
   after meaningful changes.
4. Keep `/project-context/feature-ledger.md` aligned with reality: when a feature is implemented or its status changes, update the feature ledger (status + evidence: files, routes, UI, runtime).
5. Add any required manual work (API keys, accounts, decisions) to
   `/project-context/human-tasks.md`.
6. Prefer Vercel AI SDK primitives over custom abstractions.
7. Preserve the local-first architecture and filesystem source of truth.
8. Follow the `FOLDER.md` workspace contract when modifying workspace files.
9. When duplicates exist, prefer the most recent version of a file definition.
10. Keep implementations incremental and aligned with the PRD.
11. Do not commit secrets; instead record them in `human-tasks.md`.
12. Runtime state uses PGlite (`.claws/runtime/`); workspace content stays on the filesystem. See `project-context/runtime-persistence.md`.

## Stack conventions
- **UI**: Geist fonts, Tailwind CSS, Lucide icons, shadcn/ui patterns. No inline styles.
- **Types**: Shared types in `packages/shared/src/types.ts`. Import from `@claws/shared`.
- **Runtime state**: PGlite via `@claws/runtime-db`; init at gateway startup; schema in `packages/runtime-db/src/schema.ts`.
- **Tools**: Register in `packages/tools/src/index.ts`. Use risk map for approval gating.
- **Browser**: Agent Browser preferred, Playwright fallback. Configurable via `CLAWS_BROWSER_PROVIDER`.
- **Workflow**: Use `packages/core/src/workflow.ts` interfaces. Align with Vercel Workflow patterns.
- **Testing**: Run `pnpm typecheck` and `pnpm test` after changes.

## Philosophy
Claws.so is:
- local-first
- Vercel-native
- chat-first
- markdown-native
- multi-agent capable

Favor clarity, composability, and maintainability over cleverness.
