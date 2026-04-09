#!/usr/bin/env bash
# sub-agent-framework.sh — focused work loop for the Claws front-end framework
#
# Runs every 30 minutes via launchd. Responsibilities:
#   - Check the current state of the @claws/sdk, apps/studio, and Fly.io infra
#   - Run the studio build + SDK build + typecheck
#   - Append any breakage or missing-wiring items to the framework work queue
#   - Write a status report that the next human/agent session can read
#
# This is NOT a real autonomous agent. It surfaces concrete deltas so a human
# (or an interactive Claude Code session) can act on them quickly.

set -uo pipefail

CLAWS_REPO="${CLAWS_REPO:-$HOME/Desktop/CODE_2025/claws}"
CLAWS_HOME="${CLAWS_HOME:-$HOME/.claws}"
QUEUE_DIR="$CLAWS_HOME/sub-agents/framework"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT="$QUEUE_DIR/report-$TIMESTAMP.md"

mkdir -p "$QUEUE_DIR"

cd "$CLAWS_REPO" || exit 0

{
  echo "# Framework Sub-Agent — $TIMESTAMP"
  echo
  echo "Focus: Claws SDK + Studio + Fly.io infra. Goal: anyone can install + run Studio, build OpenClaw themes locally, deploy to Fly."
  echo
  echo "## Build checks"
  echo

  # 1. SDK build
  if pnpm --filter @claws/sdk build >/tmp/sdk-build.log 2>&1; then
    echo "- ✅ @claws/sdk builds clean"
  else
    echo "- ❌ @claws/sdk build failed — see \`/tmp/sdk-build.log\`"
    echo "  - **action:** fix the SDK build before anything else"
  fi

  # 2. Studio build
  if pnpm --filter @claws/studio build >/tmp/studio-build.log 2>&1; then
    echo "- ✅ @claws/studio builds clean"
  else
    echo "- ❌ @claws/studio build failed — see \`/tmp/studio-build.log\`"
    echo "  - **action:** fix the studio build"
  fi

  # 3. Studio typecheck
  if pnpm --filter @claws/studio typecheck >/tmp/studio-typecheck.log 2>&1; then
    echo "- ✅ @claws/studio typechecks clean"
  else
    echo "- ❌ @claws/studio typecheck failed — see \`/tmp/studio-typecheck.log\`"
  fi

  echo
  echo "## Salvage state tracking"
  echo

  # Count _legacy files still pending port
  if [ -d "apps/studio/_legacy" ]; then
    legacy_count=$(find apps/studio/_legacy -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | wc -l | tr -d '[:space:]')
    echo "- 🟡 \`apps/studio/_legacy/\` still has **${legacy_count}** unported TS/TSX files"
    echo "  - **action:** port StudioLayout, template gallery, deploy modal into \`apps/studio/app/\`"
  fi

  if [ -d "packages/backend-convex" ]; then
    convex_count=$(find packages/backend-convex -type f -name "*.ts" 2>/dev/null | wc -l | tr -d '[:space:]')
    echo "- 🟡 \`packages/backend-convex/\` has **${convex_count}** files — not yet wired to any backend"
    echo "  - **action:** choose Convex vs simple HTTP/JSONL store, then wire"
  fi

  # Check for Fly CLI and test image existence
  if command -v flyctl >/dev/null 2>&1 || command -v fly >/dev/null 2>&1; then
    echo "- ✅ \`flyctl\` CLI available"
  else
    echo "- ⚠ \`flyctl\` not in PATH"
  fi

  echo
  echo "## Framework goal checklist"
  echo "- [x] @claws/sdk publishable (builds)"
  echo "- [x] Fly.io pipeline validated (test app deployed + destroyed in Phase G)"
  echo "- [ ] One-line install: \`npx @claws-so/create\` should bootstrap a working project"
  echo "- [ ] Studio template editor fully wired (StudioLayout restored from _legacy)"
  echo "- [ ] Community template gallery with fork/publish"
  echo "- [ ] \`claws pull <template-slug>\` CLI command to download templates locally"
  echo "- [ ] \`claws deploy\` CLI command to provision a Fly workspace from a template"
  echo "- [ ] End-to-end smoke test: install → create template → deploy → reachable"
  echo
  echo "## Next concrete action"
  echo
  # Simple heuristic: what's the top unblocker?
  if [ ! -f "packages/sdk/dist/claws-sdk.js" ]; then
    echo "- SDK dist not built. Run \`pnpm --filter @claws/sdk build\`."
  elif [ -d "apps/studio/_legacy" ] && [ ! -f "apps/studio/app/components/StudioLayout.tsx" ]; then
    echo "- Port \`apps/studio/_legacy/components-hubify/StudioLayout.tsx\` into \`apps/studio/app/components/\` with imports rewritten."
  else
    echo "- Add an E2E smoke test that installs \`@claws/sdk\`, renders a dashboard, and connects to a mock gateway."
  fi

  echo
  echo "## Report location"
  echo "\`$REPORT\`"
} > "$REPORT"

# Prune old reports — keep last 24 (12 hours at 30min cadence)
ls -t "$QUEUE_DIR"/report-*.md 2>/dev/null | tail -n +25 | xargs -I {} rm -f {} 2>/dev/null || true

echo "Framework sub-agent report written: $REPORT"
