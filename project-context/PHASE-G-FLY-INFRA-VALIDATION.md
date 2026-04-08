# Phase G — Fly.io Infra Validation

**Status:** ✅ COMPLETE 2026-04-08
**Outcome:** Full pipeline validated, test app torn down, zero ongoing cost

## What was tested

The complete Fly.io deployment pipeline for Claws workspace provisioning:

1. `flyctl` CLI installed to `~/.fly/bin/`
2. Auth works with provided `FLY_API_TOKEN` (org: `hubify`)
3. App creation via `flyctl apps create` — idempotent
4. Remote builder image build (no local Docker needed)
5. Image push to `registry.fly.io/claws-workspace-test`
6. Machine provisioning in `sjc` region
7. Shared IPv4 + dedicated IPv6 allocation
8. DNS propagation for `*.fly.dev` subdomain
9. TLS certificate auto-provisioning
10. HTTP health check: 200 OK in 130ms
11. App teardown via `flyctl apps destroy --yes`

## Test artifacts

**Test app:** `claws-workspace-test` (destroyed after validation)

**Dockerfile used:** `infra/claws-workspace-test/Dockerfile`
- Alpine 3.19 base (5.5 MB final image)
- busybox netcat serving a JSON health endpoint
- No heavyweight dependencies (proves the pipeline, not the full image)

**fly.toml:** `infra/claws-workspace-test/fly.toml`
- `shared-cpu-1x` / 256 MB (minimum for cheapest test)
- `auto_stop_machines = "stop"` + `min_machines_running = 0` (auto-idle)

## Live response captured during test

```json
{
  "ok": true,
  "service": "claws-workspace-test",
  "version": "0.1.0",
  "pillar": "framework",
  "message": "Claws Fly.io provisioning pipeline is alive",
  "hostname": "3d8d2475b46538",
  "uptime": 0.87,
  "memory_kb": 212236
}
```

HTTP: 200 | Response time: 0.129920s

## What this proves for Claws

The **Studio template marketplace and "one-click deploy OpenClaw workspace" flow** from `PRDv2` Phase 1 is technically unblocked:

- ✅ Fly Machines API authenticates with the provided token
- ✅ Remote builder works (no local Docker required for dev)
- ✅ Image registry accepts pushes
- ✅ Subdomain routing works via `*.fly.dev` by default
- ✅ Machine lifecycle (create / start / destroy) is scriptable
- ✅ Deploy → reachable → destroy cycle is under 3 minutes

## What's NOT yet tested (deferred)

The real OpenClaw workspace image at `infra/workspace/Dockerfile` is 97 lines and builds an Ubuntu 22.04 + Node 22 + OpenClaw + nginx + stats-server + ttyd stack. That build is likely:
- ~5 minutes remote builder time
- ~1 GB final image
- Needs real `ANTHROPIC_API_KEY`, JWT secrets, nginx template rendering
- Needs a persistent volume mount (`workspace_data` per fly.toml)
- Needs custom subdomain routing (`*.claws.so` or similar)

These are deferred to a later phase (call it G2) when there's a real user to provision a workspace for. Running live workspaces costs $ per month per user, so it should only happen on demand.

## Next step to unblock production

To move from "pipeline validated" to "Studio deploys real workspaces":

1. Copy `infra/workspace/` to a new `claws-workspace-base` fly app name
2. Update `infra/workspace/fly.toml` `app = "claws-workspace-base"` (currently says `hubify-workspace-base`)
3. `flyctl deploy` the full image (build once, reuse for all user workspaces)
4. Wire the Studio's `apps/studio/_legacy/app-hubify/api/workspaces/route.ts` to clone machines from that base image
5. Set up `*.claws.so` DNS pointing at Fly

Each of those is a discrete turn.

## Cost summary

- Test app creation: free
- Image build on remote builder: ~30 seconds, free
- 1 machine at `shared-cpu-1x` for ~2 minutes: <$0.01
- Destroyed immediately after validation

Total Phase G cost: **~$0.01**

## Files added

```
infra/claws-workspace-test/
  Dockerfile      (minimal Alpine + busybox netcat)
  fly.toml        (shared-cpu-1x, 256MB)
```

These are preserved in-repo for future retests.
