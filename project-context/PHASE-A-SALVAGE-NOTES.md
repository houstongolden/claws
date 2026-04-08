# Phase A Salvage Notes — 2026-04-08

**Status:** Salvage complete. SDK builds cleanly. Studio, backend-convex, infra all copied but NOT yet wired to run.

This doc is the map the next agent uses to continue Phase B onward.

---

## What got extracted

### 1. `packages/sdk/` — `@claws/sdk`
- **Source:** `hubify/packages/claws-sdk/`
- **Files:** 33 (core + 17 React hooks + vite config + tsconfig + package.json)
- **State:** ✅ BUILDS CLEANLY via `pnpm --filter @claws/sdk build`
- **Output:** `dist/claws-sdk.{js,cjs}` (core, ~2 KB) + `dist/claws-sdk-react.{js,cjs}` (React hooks, ~21 KB) + type declarations
- **Change made:** `tsconfig.json` `extends` path changed from `../../tsconfig.json` to `../../tsconfig.base.json` (Claws uses `tsconfig.base.json` instead of root `tsconfig.json`)
- **Next step:** nothing required. SDK is standalone-ready. Publish to npm in a later phase.

### 2. `apps/studio/` — `@claws/studio`
- **Source:**
  - `hubify/apps/web/components/studio/` → `apps/studio/components/`
  - `hubify/apps/web/lib/studio/` → `apps/studio/lib/`
  - `hubify/apps/web/app/api/studio/` → `apps/studio/app/api/studio/`
  - `hubify/apps/web/app/api/workspaces/` → `apps/studio/app/api/workspaces/`
  - `hubify/apps/web/app/api/workspace/` → `apps/studio/app/api/workspace/`
  - `hubify/apps/web/app/api/workspace-proxy/` → `apps/studio/app/api/workspace-proxy/`
  - `hubify/apps/web/app/api/workspace-token/` → `apps/studio/app/api/workspace-token/`
  - `hubify/apps/web/app/api/workspace-metrics/` → `apps/studio/app/api/workspace-metrics/`
  - `hubify/apps/web/app/api/templates/` → `apps/studio/app/api/templates/`
  - `hubify/apps/web/app/(archive)/templates/` → `apps/studio/app/templates/`
  - `hubify/apps/web/app/(archive)/store/` → `apps/studio/app/store/`
- **State:** 🟡 COPIED, NOT WIRED. Files are in place but import paths point at the hubify project (`@/convex/_generated/api`, `@/lib/studio/...`, etc.)
- **package.json:** stub with `build: echo "skip" && exit 0` so it doesn't break the workspace build
- **Next step (Phase B or C):**
  1. Set up a Next.js 15 app shell at `apps/studio/` (package.json, next.config.ts, app/layout.tsx, app/page.tsx)
  2. Decide: Convex or replace with local HTTP/JSONL backend
  3. Rewrite imports: `@/convex/_generated/api` → `@claws/backend-convex` or adapter
  4. Rewrite imports: `@/lib/studio/*` → `./lib/studio/*`
  5. Wire the gateway protocol to `@claws/sdk`
  6. Verify: `pnpm --filter @claws/studio dev` starts Next.js

### 3. `packages/backend-convex/` — `@claws/backend-convex`
- **Source:** `hubify/convex/` (claws-related files only)
- **Files:** 16 .ts files + `schema.hubify-reference.ts`
  - `templates.ts` — Template gallery CRUD
  - `templateVersions.ts` — SmartSync versioning (three-way merge)
  - `workspaces.ts` — Workspace records
  - `workspaceSync.ts` — Cloud file sync (SOUL/memory/skills)
  - `workspaceAccess.ts` — Access control
  - `workspaceActivity.ts` — Activity feed
  - `workspaceAlerts.ts` — Alerting
  - `workspaceCommits.ts` — Git-like commits
  - `workspaceEvents.ts` — Event log
  - `studioSessions.ts` — Studio draft persistence
  - `squadCompute.ts` — Fly.io machine provisioning (Convex side)
  - `hubs.ts` — Hub provisioning
  - `hubKnowledge.ts` — Knowledge base
  - `hubLearnings.ts` — Learnings store
  - `hubSubscriptions.ts` — Subscriptions
  - `schema.hubify-reference.ts` — Full hubify schema (reference only, prune to claws tables)
- **State:** 🟡 COPIED, NOT WIRED. Files reference `convex/_generated/*`, `convex/server`, `./schema`, etc. which need a Convex project to generate.
- **package.json:** stub with `typecheck: exit 0`
- **Next step (Phase B or later):**
  - Option A: Create a fresh Convex project, run `npx convex dev` to generate, then migrate just the claws tables from `schema.hubify-reference.ts`
  - Option B: Replace Convex with a simpler backend (HTTP + SQLite / JSONL / Postgres) and port the functions manually
  - Recommendation: Option B if the goal is self-hosted local-first. Option A if hosted multi-user is a day-one feature.

### 4. `infra/` — Fly.io + Docker + Nginx + Stats Server
- **Source:** `hubify/infra/{workspace,company-os,squad-vps,user-workspace,caddy}/`
- **Files:** 125 total
- **Key contents:**
  - `infra/workspace/Dockerfile` — multi-service workspace VM (OpenClaw + nginx + stats server + ttyd)
  - `infra/workspace/boot.sh` — 25-step boot sequence
  - `infra/workspace/fly.toml` — Fly.io app config
  - `infra/workspace/nginx.conf.template` — reverse proxy + JWT auth
  - `infra/workspace/openclaw.json.template` — OpenClaw gateway config
  - `infra/workspace/defaults/` — bundled SOUL.md, SKILL.md files, agent defaults
  - `infra/workspace/templates/` — 5 AIOS templates: founderos, companyos, myos, devos, researchos
  - `infra/company-os/` — alternate Docker stack
  - `infra/squad-vps/` — alternate VPS flavor
  - `infra/user-workspace/` — alternate user workspace image
  - `infra/caddy/` — Caddy reverse proxy config
- **State:** 🟡 COPIED, NOT BUILT. Requires Fly.io account + Docker to test.
- **Next step (Phase E or later):**
  1. Test `docker build infra/workspace/` locally
  2. Create a Fly.io app for Claws (`fly apps create claws-workspace-test`)
  3. Test the provisioning flow from `apps/studio/app/api/workspaces/route.ts`
  4. Set up TLS + custom subdomain (`*.claws.so`) via Fly certs

### 5. `docs/`
- **Source:** `hubify/docs/claws/overview.mdx` + `hubify/docs/integrations/claws-sdk.mdx`
- **State:** ✅ COPIED. Mintlify-compatible mdx files.
- **Next step:** Set up a Mintlify docs site at `docs.claws.so` (or serve as part of the landing page).

### 6. `project-context/TEMPLATES.md`
- **Source:** `hubify/TEMPLATES.md`
- **State:** ✅ COPIED. Human-readable spec for the built-in AIOS templates.

---

## What was NOT touched (intentional)

- **Existing Claws gateway/dashboard/worker/cli** — not modified. They continue to work exactly as before. Smoke test confirmed gateway still serves `/api/status` after all the extraction.
- **Existing `apps/web/` landing page** — not rewritten yet. Phase B will update the hero copy + positioning.
- **Existing `DESIGN.md`** — still v1 (red accent, control room). Phase C will decide whether to keep or revise given the new framework direction.
- **claw-code forks** — not cloned yet. Phase D.
- **Hourly QA cron** — not created. Phase E (once UI is stable).

---

## Quick validation

```bash
# 1. SDK builds
pnpm --filter @claws/sdk build
# Expected: dist/ output, no errors

# 2. Gateway still runs
npx tsx apps/gateway/src/main.ts
# Expected: "Gateway listening on http://localhost:4317"

# 3. Workspace is healthy
pnpm install --no-frozen-lockfile
# Expected: "Scope: all 16 workspace projects"

# 4. Landing page still builds (unchanged from before)
pnpm --filter @claws/web build
# Expected: Next.js build success
```

---

## Directory diff (new since start of Phase A)

```
packages/
  sdk/                        ← NEW (from hubify/packages/claws-sdk, BUILDS)
  backend-convex/             ← NEW (from hubify/convex, needs rewiring)
apps/
  studio/                     ← NEW (from hubify web components/lib/api, needs Next.js shell)
infra/                        ← NEW (from hubify/infra, needs Fly.io testing)
docs/
  claws/overview.mdx          ← NEW (from hubify/docs/claws)
  integrations/
    claws-sdk.mdx             ← NEW (from hubify/docs/integrations)
project-context/
  CLAWS_EXTRACTION_ARCHITECTURE.md  ← NEW (copy of hubify doc)
  PRDv2-2026-04-08.md               ← NEW (new positioning PRD)
  PHASE-A-SALVAGE-NOTES.md          ← NEW (this file)
  TEMPLATES.md                      ← NEW (from hubify root)
```

**No existing files modified except:**
- `packages/sdk/tsconfig.json` (extends path fix)

---

## Phase B — what to do next

1. **Update landing page** (`apps/web/app/page.tsx`) with the new dual positioning. Hero: "The front-end framework for OpenClaw UIs + an experimental agent OS for Vercelians 👽🦞"
2. **Update README.md** with the new positioning.
3. **Redeploy** the landing page to `claws-landing.vercel.app`.
4. **Write a quick Phase B notes doc** describing what narrative shifted.

Phase B is a single bounded turn. Phase C (UI polish on the existing dashboard) comes after.

---

## For future agents

The salvage preserves structure. Imports will need rewriting based on whatever backend architecture you choose. Do NOT try to force a Convex setup if the user prefers a simpler backend. Ask first.

The SDK (`@claws/sdk`) is the one piece that's 100% ready to ship. It could be published to npm tomorrow if desired.
