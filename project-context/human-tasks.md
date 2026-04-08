# Human Tasks (Owner-Only)

**Last reviewed:** 2026-03 — unchanged items still apply.

Only include tasks that require human access, accounts, secrets, or product decisions.

Status:
- `todo`
- `blocked`
- `done`

## 1) Secrets / Env Vars

- [ ] `todo` Provide model/provider secrets for local development.
  - `AI_GATEWAY_API_KEY` (or chosen equivalent)
  - optional provider fallback keys if enabled
- [ ] `todo` Provide `TELEGRAM_BOT_TOKEN` if Telegram adapter is enabled.
- [ ] `todo` Confirm local secret handling preference:
  - `.env.local`
  - OS keychain + env injection

## 2) External Accounts to Create / Connect

- [ ] `todo` Confirm Vercel account/project owner for Claws.so.
- [ ] `todo` Confirm whether Telegram is enabled for v0 and provide bot ownership.

## 3) Vercel Setup Decisions

- [ ] `todo` Decide AI Gateway usage model:
  - single project routing
  - per-workspace routing
- [ ] `todo` Decide when Queues/Sandbox are turned on:
  - prototype stage
  - post-prototype

## 4) Domain / DNS (Only if cloud dashboard is enabled)

- [ ] `todo` Decide local-only vs cloud dashboard for early releases.
- [ ] `todo` If cloud enabled, reserve domain/subdomain and configure DNS.

## 5) Product / Policy Decisions (Blocking)

- [ ] `blocked` Choose default metadata/index policy:
  - SQLite-only
  - SQLite + optional Convex plugin
- [ ] `blocked` Choose memory distillation cadence:
  - nightly
  - weekly
- [ ] `blocked` Choose default approval mode for new workspaces:
  - off
  - smart
  - strict
- [ ] `blocked` Confirm iMessage scope:
  - deferred out of v0
  - included in later milestone

## 6) Product Messaging Decisions (Non-Blocking)

- [ ] `todo` Approve final onboarding voice and greeting copy for `create-claws`.
- [ ] `todo` Approve final naming and wording of the 4 magic moments for external docs.

## Current Human Blockers Snapshot

- Blocking decisions for default policy values:
  - metadata/index default policy
  - default approval mode
  - iMessage scope
- Non-blocking for local development:
  - local runtime can boot and be tested without completing the above
