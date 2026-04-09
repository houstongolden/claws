#!/usr/bin/env bash
# sub-agent-community.sh — focused work loop for the Claws community/web + templates
#
# Runs every 30 minutes via launchd. Focus: the claws.so web version, community
# template marketplace, account-backed saved templates, CLI commands for
# download/upload, and the "vibe coding app" experience on the landing page.

set -uo pipefail

CLAWS_REPO="${CLAWS_REPO:-$HOME/Desktop/CODE_2025/claws}"
CLAWS_HOME="${CLAWS_HOME:-$HOME/.claws}"
QUEUE_DIR="$CLAWS_HOME/sub-agents/community"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT="$QUEUE_DIR/report-$TIMESTAMP.md"

mkdir -p "$QUEUE_DIR"

cd "$CLAWS_REPO" || exit 0

{
  echo "# Community Sub-Agent — $TIMESTAMP"
  echo
  echo "Focus: claws.so web product, template marketplace, account sync, CLI commands."
  echo
  echo "## Build + deploy state"
  echo

  # 1. Landing page build
  if pnpm --filter @claws/web build >/tmp/web-build.log 2>&1; then
    echo "- ✅ @claws/web builds clean"
  else
    echo "- ❌ @claws/web build failed — see \`/tmp/web-build.log\`"
  fi

  # 2. Landing page live check
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 https://claws-landing.vercel.app 2>/dev/null || echo "000")
  if [ "$http_code" = "200" ]; then
    echo "- ✅ claws-landing.vercel.app serving 200"
  else
    echo "- ⚠ claws-landing.vercel.app returned HTTP $http_code"
  fi

  # 3. Proxy check
  proxy_code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -X POST https://claws-landing.vercel.app/api/proxy \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"ping"}],"max_tokens":5}' 2>/dev/null || echo "000")
  if [ "$proxy_code" = "200" ] || [ "$proxy_code" = "429" ]; then
    echo "- ✅ /api/proxy responding (HTTP $proxy_code)"
  else
    echo "- ⚠ /api/proxy returned HTTP $proxy_code"
  fi

  echo
  echo "## Community goal checklist"
  echo "- [x] Landing page deployed (claws-landing.vercel.app)"
  echo "- [x] Free-tier AI proxy live"
  echo "- [ ] Template gallery on landing page (/templates)"
  echo "- [ ] One-line install in hero: \`npx @claws-so/create my-project\`"
  echo "- [ ] Vibe coding playground embedded in landing page"
  echo "- [ ] User accounts (GitHub OAuth or similar minimal auth)"
  echo "- [ ] Save template to account (cloud persistence)"
  echo "- [ ] \`claws login\` / \`claws pull <slug>\` / \`claws publish\` CLI commands"
  echo "- [ ] Built-in starter templates: founderos, devos, companyos, myos, researchos"
  echo
  echo "## Salvage state"

  if [ -d "apps/studio/_legacy/app-hubify/templates" ]; then
    t_count=$(find "apps/studio/_legacy/app-hubify/templates" -type f 2>/dev/null | wc -l | tr -d '[:space:]')
    echo "- 🟡 Legacy templates UI has **${t_count}** files to port"
  fi

  if [ -d "infra/workspace/templates" ]; then
    built_in=$(find infra/workspace/templates -maxdepth 1 -type d | tail -n +2 | wc -l | tr -d '[:space:]')
    echo "- ✅ **${built_in}** built-in templates salvaged in \`infra/workspace/templates/\`"
  fi

  echo
  echo "## Next concrete action"
  if ! pnpm --filter @claws/web build >/dev/null 2>&1; then
    echo "- Fix @claws/web build."
  elif [ ! -d "apps/web/app/templates" ]; then
    echo "- Scaffold \`apps/web/app/templates/page.tsx\` — public template gallery index."
  elif [ ! -f "packages/cli/src/commands/pull.mjs" ]; then
    echo "- Add \`claws pull <template-slug>\` command at \`packages/cli/src/commands/pull.mjs\`."
  else
    echo "- Add GitHub OAuth to landing page for template publishing."
  fi

  echo
  echo "## Report location"
  echo "\`$REPORT\`"
} > "$REPORT"

# Prune old reports
ls -t "$QUEUE_DIR"/report-*.md 2>/dev/null | tail -n +25 | xargs -I {} rm -f {} 2>/dev/null || true

echo "Community sub-agent report written: $REPORT"
