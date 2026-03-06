# Artifact Index (Source Dump -> Consolidated Files)

Source analyzed: `project-context/Claws-PRD-v0.01.md`

## Major Sections Found

| Source section/theme | Merged into |
|---|---|
| Living spec core definition and principles | `project-context/prd.md` |
| Canonical truth + sync model | `project-context/prd.md` |
| Vercel-native stack defaults | `project-context/prd.md` |
| UX surfaces, visibility modes, watch-live/record/background | `project-context/prd.md`, `project-context/build-roadmap.md` |
| Identity layer (`you.md` bundle) | `project-context/prd.md`, `project-context/repo-map.md` |
| Views as overlays | `project-context/prd.md` |
| Task and memory architecture | `project-context/prd.md`, `project-context/tasks.md` |
| Approvals and trust grant philosophy | `project-context/prd.md`, `project-context/tasks.md` |
| Create-claws onboarding specification | `project-context/prd.md`, `project-context/build-roadmap.md` |
| Magic moments and sequencing | `project-context/prd.md`, `project-context/build-roadmap.md` |
| Engineering harness requirements | `project-context/prd.md`, `project-context/tasks.md` |
| Repo scaffold tree (`apps/`, `packages/`, `templates/`) | `project-context/repo-map.md` |
| Open questions section | `project-context/open-questions.md`, `project-context/human-tasks.md` |
| Reference links section | `project-context/integration-links.md` |
| Repeated "best next implementation pass" sections | `project-context/tasks.md`, `project-context/build-roadmap.md`, `project-context/prd.md` |

## Duplicate/Outdated Content Handling

The source dump contains repeated copies and iterative updates. Consolidation rules applied:

1. For duplicate sections, latest occurrence (closer to bottom) used as baseline.
2. Older details retained only when not superseded by newer definitions.
3. Placeholder scaffold stubs were superseded by newer "real implementation pass" notes where present.

## Discarded as Outdated Duplicates

Discarded from canonical outputs:
- First full PRD copy (earlier duplicate of later PRD block).
- Repeated copies of identity/onboarding/open-questions sections where content matched or was less complete.
- Earlier "best next step" lists superseded by later bottom-of-file implementation priorities.
- Multiple interim code snippets for the same files where a later upgraded version existed.

## Preserved from Older Sections (Because Still Useful)

- Workspace prompt/identity template semantics from scaffold pack.
- Folder governance details (`FOLDER.md`) not repeated in later implementation notes.
- Personality and onboarding tone requirements.
- Execution mode language (`watch-live`, `record-on-complete`, `hybrid`, `background`).

## Resulting Canonical Planning Set

- `project-context/prd.md`
- `project-context/tasks.md`
- `project-context/tasks.jsonl`
- `project-context/human-tasks.md`
- `project-context/repo-map.md`
- `project-context/build-roadmap.md`
- `project-context/current-state.md`
- `project-context/next-pass.md`
- `project-context/open-questions.md`
- `project-context/integration-links.md`
- `project-context/artifact-index.md`
- `AGENT.md`
- `README.md`

## Key Implementation Artifacts (by package)

### Gateway (`apps/gateway/src/`)
- `main.ts` — runtime orchestration, tool registration, chat handler, state persistence
- `httpServer.ts` — HTTP API with all routes (chat, streaming, workflows, tenants)
- `aiHandler.ts` — AI SDK `generateText` + `streamText` + SSE streaming
- `tenantRouter.ts` — multi-tenant request routing middleware
- `cli.ts` — CLI command handlers
- `localStore.ts` — disk-backed persistence for runtime state

### Dashboard (`apps/dashboard/`)
- `app/chat/page.tsx` — streaming-capable chat with SSE + fallback
- `app/settings/page.tsx` — tabbed settings with comprehensive status display
- `app/workflows/page.tsx` — workflow viewer with step-level controls
- `app/agents/page.tsx` — agent roster with AI status
- `app/memory/page.tsx` — interactive memory search
- `app/files/page.tsx` — workspace info and fs tools
- `app/api/chat/route.ts` — proxy with streaming support
- `components/ui/` — shadcn/ui component library (Button, Input, Select, Textarea, Badge, Card, Dialog, Tabs)
- `components/shell.tsx` — tenant-aware dashboard shell
- `components/nav.tsx` — navigation with tenant context
- `lib/api.ts` — typed API client for all gateway endpoints

### Core (`packages/core/src/`)
- `router.ts` — per-thread view-state routing
- `approvals.ts` — approval store with trust grants
- `workflow.ts` — disk-backed workflow engine
- `workflow-vercel.ts` — Vercel Workflow adapter skeleton

### Tools (`packages/tools/src/`)
- `browser.ts` — Agent Browser + Playwright adapters with extended actions
- `demo.ts` — demo artifact pathing and persistence
- `ai-sdk-adapter.ts` — Claws tools → AI SDK tool conversion
- `index.ts` — tool registration with risk mapping
- `memory.ts`, `fs.ts`, `tasks.ts`, `sandbox.ts` — core tool implementations

### Worker (`apps/worker/src/`)
- `main.ts` — background workflow step executor with polling

### Harness (`packages/harness/src/`)
- `smoke.js`, `security.js`, `ui-smoke.js`, `golden.js`, `replay.js`
