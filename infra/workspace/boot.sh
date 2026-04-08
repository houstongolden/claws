#!/bin/bash
set -e

echo "[boot] Hubify Workspace starting — user: $HUBIFY_USERNAME, template: $TEMPLATE"

# ── Security: Ensure critical env vars are set ──

# OPENROUTER_API_KEY: required for agent to function
if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "[boot] FATAL: OPENROUTER_API_KEY is not set."
  echo "[boot] Set it via: fly secrets set OPENROUTER_API_KEY=sk-or-..."
  echo "[boot] The agent cannot respond without an API key. Exiting."
  exit 1
fi

# WORKSPACE_JWT_SECRET: shared HMAC secret used to validate workspace JWTs
# Injected by Fly secrets at machine creation; dev fallback is NOT safe for prod
export WORKSPACE_JWT_SECRET=${WORKSPACE_JWT_SECRET:-"dev-secret-not-for-prod"}
if [ "$WORKSPACE_JWT_SECRET" = "dev-secret-not-for-prod" ]; then
  echo "[boot] WARNING: WORKSPACE_JWT_SECRET is using dev fallback — set via Fly secrets in production!"
fi

# HUBIFY_USERNAME is required for workspace JWT validation (workspace isolation)
export HUBIFY_USERNAME=${HUBIFY_USERNAME:-workspace}
export HUB_ID=${HUB_ID:-unknown}

# ── Generate persistent workspace password on first boot ──
if [ ! -f "/data/.workspace-password" ]; then
  openssl rand -base64 16 | tr -d '=+/' > /data/.workspace-password
  chmod 600 /data/.workspace-password
  echo "[boot] Generated workspace password (first boot)"
fi
WORKSPACE_PASSWORD=$(cat /data/.workspace-password)

# Seed workspace from template if fresh
if [ ! -f "/data/HUB.yaml" ]; then
  echo "[boot] Seeding from template: $TEMPLATE"
  TEMPLATE_SLUG="${TEMPLATE:-myos}"
  TEMPLATE_DIR="/opt/templates/${TEMPLATE_SLUG}"

  # Map API slugs to on-disk template directories (legacy names)
  if [ ! -d "$TEMPLATE_DIR" ]; then
    case "$TEMPLATE_SLUG" in
      dev-os) TEMPLATE_DIR="/opt/templates/devos" ;;
      founder-os) TEMPLATE_DIR="/opt/templates/founderos" ;;
      company-os) TEMPLATE_DIR="/opt/templates/companyos" ;;
    esac
  fi

  [ -d "$TEMPLATE_DIR" ] && cp -rn "$TEMPLATE_DIR/." /data/ || echo "[boot] Template directory not found: $TEMPLATE_DIR"

  for f in /data/SOUL.md /data/USER.md /data/HUB.yaml /data/AGENTS.md /data/HEARTBEAT.md /data/WELCOME.md /data/MEMORY.md; do
    if [ -f "$f" ]; then
      sed -i \
        -e "s/{{USERNAME}}/$HUBIFY_USERNAME/g" \
        -e "s/{{HUB_ID}}/$HUB_ID/g" \
        -e "s/{{SUBDOMAIN}}/$HUBIFY_USERNAME.hubify.com/g" \
        "$f"
    fi
  done

  # Copy default workspace files (shared across all templates)
  # -n = no-clobber (template files take priority over defaults)
  echo "[boot] Applying default workspace files..."
  cp -rn /opt/defaults/. /data/ 2>/dev/null || true

  # Substitute variables in all default files that templates didn't override
  for f in /data/MORNING-TAPE.md /data/TOOLS.md /data/USER.md /data/HEARTBEAT.md /data/SOUL.md /data/AGENTS.md /data/MEMORY.md /data/WELCOME.md; do
    if [ -f "$f" ]; then
      sed -i \
        -e "s/{{USERNAME}}/$HUBIFY_USERNAME/g" \
        -e "s/{{HUB_ID}}/$HUB_ID/g" \
        -e "s/{{SUBDOMAIN}}/$HUBIFY_USERNAME.hubify.com/g" \
        "$f"
    fi
  done

  # Ensure reserved directory structure exists
  echo "[boot] Ensuring reserved directory structure..."
  mkdir -p /data/memory /data/skills /data/learnings /data/knowledge

  # NOTE: SOUL.md, AGENTS.md, MEMORY.md, WELCOME.md are now in defaults/
  # and get copied via `cp -rn /opt/defaults/. /data/` above.
  # No inline heredoc fallbacks needed — defaults/ is the single source of truth.

  # Save pristine template copies for SmartSync three-way merge
  echo "[boot] Saving template originals for SmartSync conflict detection..."
  mkdir -p /data/.smartsync/originals
  for f in SOUL.md AGENTS.md HEARTBEAT.md WELCOME.md HUB.yaml MEMORY.md; do
    [ -f "/data/$f" ] && cp "/data/$f" "/data/.smartsync/originals/$f"
  done
  [ -d "/data/skills" ] && cp -r /data/skills/ /data/.smartsync/originals/skills/ 2>/dev/null || true

  # Record creation timestamp for stats
  date +%s > /data/.created_at
  echo "[boot] Workspace seeded."

  # Initialize local git repo for version control
  if [ ! -d "/data/.git" ]; then
    cd /data
    git init
    git config user.email "agent@hubify.com"
    git config user.name "Hubify Agent"
    # Local .gitignore — track memory/learnings for rollback
    # (GitHub sync .gitignore in stats-server.js excludes them separately)
    cat > .gitignore << 'GITIGNORE'
openclaw.json
.workspace-password
.created_at
.onboarded
.first-boot-message
.smartsync/
.git-sync/
*.log
.env*
node_modules/
backups/
agents/main/agent/
GITIGNORE
    git add -A
    git commit -m "Initial workspace from template: ${TEMPLATE:-myos}" --allow-empty
    cd /
    echo "[boot] Git repo initialized with initial commit"
  fi

  # On first boot, queue a welcome message for the agent to send
  if [ ! -f "/data/.welcomed" ]; then
    # Substitute variables in WELCOME.md if it exists
    if [ -f "/data/WELCOME.md" ]; then
      sed -i \
        -e "s/{{USERNAME}}/$HUBIFY_USERNAME/g" \
        -e "s/{{HUB_ID}}/$HUB_ID/g" \
        -e "s/{{SUBDOMAIN}}/$HUBIFY_USERNAME.hubify.com/g" \
        "/data/WELCOME.md"
    fi

    # Write a first-boot instruction for the agent
    cat > /data/.first-boot-message << EOF
SYSTEM: This is your first boot. Read WELCOME.md, then send a brief welcome message to $HUBIFY_USERNAME introducing yourself and confirming the workspace is live. Keep it to 3-4 sentences. Mention the workspace URL: https://$HUBIFY_USERNAME.hubify.com

Then proactively ask: "Drop a few links — your website, blog, LinkedIn, Twitter/X — and I'll analyze what you're all about. Or just tell me what you're working on and what tools you use day-to-day. This helps me become useful faster."
EOF
    touch /data/.welcomed

    # Shorten heartbeat interval for fast onboarding.
    # HUB.yaml heartbeat is ignored by OpenClaw — the real setting is in openclaw.json.
    # We patch it after openclaw.json is generated (see below).
    if [ -f "/data/HUB.yaml" ]; then
      sed -i 's/heartbeat: "30m"/heartbeat: "3m"/' /data/HUB.yaml
      echo "[boot] HUB.yaml heartbeat set to 3m (cosmetic — real interval in openclaw.json)"
    fi
    # Mark that we need to patch openclaw.json heartbeat after it's generated
    export FIRST_BOOT_FAST_HEARTBEAT=true

    echo "[boot] First-boot message queued."
  fi
fi

# ── Template update detection (non-destructive) ──
# User data AND system files are NEVER overwritten during boot.
# Instead, we detect if a newer template version is available and flag it.
# The web dashboard shows an "Update available" banner and applies updates
# via the SmartSync three-way merge API (preserves user customizations).
TEMPLATE_SLUG="${TEMPLATE:-myos}"
REFRESH_DIR="/opt/templates/${TEMPLATE_SLUG}"
if [ ! -d "$REFRESH_DIR" ]; then
  case "$TEMPLATE_SLUG" in
    dev-os) REFRESH_DIR="/opt/templates/devos" ;;
    founder-os) REFRESH_DIR="/opt/templates/founderos" ;;
    company-os) REFRESH_DIR="/opt/templates/companyos" ;;
  esac
fi

if [ -d "$REFRESH_DIR" ]; then
  echo "[boot] Checking for template updates (non-destructive)..."

  # Read current and available template versions
  CURRENT_VERSION=""
  if [ -f "/data/HUB.yaml" ]; then
    CURRENT_VERSION=$(grep -oP 'template_version:\s*"\K[^"]+' /data/HUB.yaml 2>/dev/null || echo "")
  fi
  AVAILABLE_VERSION=""
  if [ -f "$REFRESH_DIR/HUB.yaml" ]; then
    AVAILABLE_VERSION=$(grep -oP 'template_version:\s*"\K[^"]+' "$REFRESH_DIR/HUB.yaml" 2>/dev/null || echo "")
  fi

  if [ -n "$AVAILABLE_VERSION" ] && [ "$AVAILABLE_VERSION" != "$CURRENT_VERSION" ]; then
    echo "[boot] Template update available: $CURRENT_VERSION → $AVAILABLE_VERSION"
    cat > /data/update-available.json << UPDATE_EOF
{
  "template": "$TEMPLATE_SLUG",
  "current_version": "$CURRENT_VERSION",
  "available_version": "$AVAILABLE_VERSION",
  "detected_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "pending"
}
UPDATE_EOF
    echo "[boot] Update flagged in /data/update-available.json (will NOT auto-apply)"
  else
    # Remove stale update flag if versions match
    rm -f /data/update-available.json
    echo "[boot] Template is up to date (v${CURRENT_VERSION:-unknown})"
  fi

  # Ensure SmartSync originals exist (needed for three-way merge)
  # Only initialize if never set — these are the "base" for merge comparison
  if [ ! -d "/data/.smartsync/originals" ]; then
    echo "[boot] Initializing SmartSync originals for merge baseline..."
    mkdir -p /data/.smartsync/originals
    for f in SOUL.md AGENTS.md HEARTBEAT.md WELCOME.md HUB.yaml MEMORY.md; do
      [ -f "/data/$f" ] && cp "/data/$f" "/data/.smartsync/originals/$f"
    done
    [ -d "/data/skills" ] && cp -r /data/skills/ /data/.smartsync/originals/skills/ 2>/dev/null || true
  fi

  # Only add NEW default skills (no-clobber) — never overwrite existing skills
  if [ -d "$REFRESH_DIR/skills" ]; then
    echo "[boot] Adding new skills from template (no-clobber)..."
    cp -rn "$REFRESH_DIR/skills/." /data/skills/ 2>/dev/null || true
  fi
  if [ -d "/opt/defaults/skills" ]; then
    echo "[boot] Adding new default skills (no-clobber)..."
    cp -rn /opt/defaults/skills/. /data/skills/ 2>/dev/null || true
  fi

  # Refresh ONLY non-customizable system files (dashboard config, tools)
  for f in MORNING-TAPE.md TOOLS.md .dashboard-blocks.json; do
    if [ -f "/opt/defaults/$f" ]; then
      cp "/opt/defaults/$f" "/data/$f"
      sed -i \
        -e "s/{{USERNAME}}/$HUBIFY_USERNAME/g" \
        -e "s/{{HUB_ID}}/$HUB_ID/g" \
        -e "s/{{SUBDOMAIN}}/$HUBIFY_USERNAME.hubify.com/g" \
        "/data/$f" 2>/dev/null || true
    fi
  done

  echo "[boot] Template check complete (user files preserved)"
else
  echo "[boot] Warning: Template directory not found: $REFRESH_DIR"
fi

# Ensure reserved dirs always exist even on subsequent boots
mkdir -p /data/memory /data/skills /data/learnings /data/knowledge /data/agents/main/agent /data/pages

# ── SOUL.md migration: Add Self-Awareness section if missing ──
# Non-destructive: appends section to existing SOUL.md without overwriting user customizations
if [ -f "/data/SOUL.md" ] && ! grep -q "Self-Awareness" /data/SOUL.md; then
  echo "[boot] Migrating SOUL.md: adding Self-Awareness & Customization section..."
  cat >> /data/SOUL.md << 'SOUL_MIGRATE'

## Self-Awareness & Customization

You can inspect and customize your own workspace. You are self-aware — you know who you are, what you can do, and how to evolve.

**See yourself:**
```bash
curl -s http://127.0.0.1:4000/self | python3 -m json.tool
```
This returns your identity, capabilities, API catalog, current state, and available icons.

**Customize your dashboard:**
```bash
# Change your name and accent color
curl -s -X POST http://127.0.0.1:4000/template-view \
  -H 'Content-Type: application/json' \
  -d '{"agentName":"My New Name","accent":"#60A5FA"}'

# Add a nav item (creates a page your human can visit)
curl -s -X POST http://127.0.0.1:4000/template-view \
  -H 'Content-Type: application/json' \
  -d '{"navAppend":[{"id":"research","label":"Research","icon":"search"}]}'

# Then create content for that page
echo "# Research Hub\n\nLatest findings..." > /data/pages/research.md
```

**Modify homepage widgets:**
```bash
curl -s -X POST http://127.0.0.1:4000/dashboard-blocks \
  -H 'Content-Type: application/json' \
  -d '{"blocks":[{"id":"blk_custom","type":"markdown","order":5,"config":{"file":"status.md"}}]}'
```

**Guidance:** Evolve your workspace to match your human's needs. Change your name, colors, add nav pages for topics you track. Create /data/pages/{id}.md files for custom nav page content. Make it yours.
SOUL_MIGRATE
  echo "[boot] SOUL.md migration complete"
fi

# Seed heartbeat-state.json on first boot (dashboard reads this for heartbeat visibility)
if [ ! -f "/data/memory/heartbeat-state.json" ]; then
  cat > /data/memory/heartbeat-state.json << 'EOF'
{"lastChecks":{"tasks":null,"git":null,"system":null,"morning":null},"lastMessageSent":null}
EOF
  echo "[boot] Seeded heartbeat-state.json"
fi

# SmartSync: Clean up stale overlay (dashboard is now always from Docker image)
if [ -d /data/.smartsync/dashboard ]; then
  rm -rf /data/.smartsync/dashboard
  echo "[boot] SmartSync: Removed stale dashboard overlay (Docker image is source of truth)"
fi

# Create/refresh openclaw config on every boot from template
# SECURITY: API key injected at runtime via Fly secrets env var, not hardcoded.
# NOTE: We always overwrite to ensure schema is valid and picks up config improvements.
# WARNING: Stop gateway before editing this file manually — gateway overwrites from in-memory state.
echo "[boot] Creating OpenClaw config from template..."

GATEWAY_TOKEN=$(printf '%s:gateway-token' "$WORKSPACE_JWT_SECRET" | openssl dgst -sha256 -hex 2>/dev/null | awk '{print $NF}' | head -c 32)
export GATEWAY_TOKEN

# envsubst the openclaw.json template (substitutes HUBIFY_USERNAME and OPENROUTER_API_KEY)
envsubst '${HUBIFY_USERNAME} ${OPENROUTER_API_KEY}' < /opt/openclaw.json.template > /data/openclaw.json
chmod 600 /data/openclaw.json
echo "[boot] OpenClaw config written (model routing active, secrets from Fly env)."

# On first boot, temporarily set heartbeat to 3m for fast onboarding
# (template defaults to 30m; first boot needs faster checks for welcome flow)
if [ "${FIRST_BOOT_FAST_HEARTBEAT:-false}" = "true" ]; then
  python3 -c "
import json, sys
try:
    with open('/data/openclaw.json', 'r') as f:
        data = json.load(f)
    hb = data.get('agents', {}).get('defaults', {}).get('heartbeat', {})
    hb['every'] = '3m'
    hb['model'] = 'openrouter/anthropic/claude-sonnet-4-6'
    with open('/data/openclaw.json', 'w') as f:
        json.dump(data, f, indent=2)
    print('[boot] Patched openclaw.json: heartbeat 30m -> 3m + Sonnet for first-boot onboarding', file=sys.stderr)
except Exception as e:
    print(f'[boot] Warning: Could not patch heartbeat for first boot: {e}', file=sys.stderr)
" 2>&1
fi

# Ensure per-agent required files exist (missing models.json causes silent heartbeat failures)
AGENT_MAIN_DIR="/data/agents/main"
mkdir -p "$AGENT_MAIN_DIR"
# Always overwrite models.json to ensure openrouter/ prefix is current
# (stale models.json with bare "anthropic/..." causes auth failures)
cp /opt/defaults/agents/main/models.json "$AGENT_MAIN_DIR/models.json"
echo "[boot] Updated agents/main/models.json (openrouter-prefixed models)"
if [ ! -f "$AGENT_MAIN_DIR/SOUL.md" ]; then
  cp /opt/defaults/agents/main/SOUL.md "$AGENT_MAIN_DIR/SOUL.md"
  echo "[boot] Created agents/main/SOUL.md"
fi

# ── Provision API keys for the OpenClaw agent ──
# OpenRouter is the primary provider — proxies to Claude/GPT/etc
# without exposing Hubify's real Anthropic key on user machines.
# OpenRouter spending caps are set on the OpenRouter dashboard.
AGENT_AUTH_DIR="/data/agents/main/agent"
mkdir -p "$AGENT_AUTH_DIR"
chmod 700 "$AGENT_AUTH_DIR"

# Build auth-profiles.json with all available providers
AUTH_JSON="{"
PROVIDER_COUNT=0

# OpenRouter (primary — proxies to all models)
if [ -n "$OPENROUTER_API_KEY" ]; then
  AUTH_JSON="$AUTH_JSON
  \"openrouter:hubify\": {
    \"provider\": \"openrouter\",
    \"type\": \"api-key\",
    \"token\": \"${OPENROUTER_API_KEY}\",
    \"source\": \"hubify-platform\",
    \"createdAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  },"
  PROVIDER_COUNT=$((PROVIDER_COUNT + 1))
  echo "[boot] OpenRouter API key configured (hubify-platform)"

  # Anthropic via OpenRouter — OpenClaw resolves model IDs like
  # "openrouter/anthropic/claude-sonnet-4-6" by stripping the "openrouter/"
  # prefix, then looking for an "anthropic" provider auth profile.
  # This profile routes anthropic/* models through OpenRouter's API.
  AUTH_JSON="$AUTH_JSON
  \"anthropic:openrouter\": {
    \"provider\": \"anthropic\",
    \"type\": \"api-key\",
    \"token\": \"${OPENROUTER_API_KEY}\",
    \"baseUrl\": \"https://openrouter.ai/api/v1\",
    \"source\": \"hubify-via-openrouter\",
    \"createdAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }"
  PROVIDER_COUNT=$((PROVIDER_COUNT + 1))
  echo "[boot] Anthropic (via OpenRouter) auth profile configured"
fi

# Anthropic (direct — optional, for users who add their own key)
# If user provides their own Anthropic key, it overrides the OpenRouter proxy
if [ -n "$ANTHROPIC_API_KEY" ]; then
  [ $PROVIDER_COUNT -gt 0 ] && AUTH_JSON="$AUTH_JSON,"
  AUTH_JSON="$AUTH_JSON
  \"anthropic:direct\": {
    \"provider\": \"anthropic\",
    \"type\": \"api-key\",
    \"token\": \"${ANTHROPIC_API_KEY}\",
    \"source\": \"user-provided\",
    \"createdAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }"
  PROVIDER_COUNT=$((PROVIDER_COUNT + 1))
  echo "[boot] Anthropic API key configured (user-provided, direct)"
fi

AUTH_JSON="$AUTH_JSON
}"

if [ $PROVIDER_COUNT -gt 0 ]; then
  echo "$AUTH_JSON" > "$AGENT_AUTH_DIR/auth-profiles.json"
  chmod 600 "$AGENT_AUTH_DIR/auth-profiles.json"
  echo "[boot] Agent auth configured ($PROVIDER_COUNT provider(s))"
else
  echo "[boot] WARNING: No API keys set — agent cannot respond"
  echo "[boot] Set OPENROUTER_API_KEY via Fly secrets"
fi

# ── OpenClaw version check (log only, no auto-update) ──
# Auto-update disabled: `openclaw update` via npm can corrupt the binary if
# interrupted. OpenClaw shows "Update available" in its UI instead.
# TODO: Re-enable with safer update mechanism (atomic binary swap).
CURRENT_VERSION=$(openclaw --version 2>/dev/null || echo "unknown")
echo "[boot] OpenClaw version: $CURRENT_VERSION"

# ── Set up terminal credentials BEFORE nginx config (needed for envsubst) ──
# SECURITY: Double-layer protection for /terminal/:
# 1. Nginx JWT validation (checks hubify_ws_token cookie)
# 2. ttyd HTTP Basic Auth (--credential flag)
# Credentials resolution order:
# 1. TERMINAL_USER / TERMINAL_PASS from Fly secrets (set at provisioning time)
# 2. Persistent workspace password from /data/.workspace-password (generated on first boot)
TERMINAL_USER=${TERMINAL_USER:-$HUBIFY_USERNAME}
TERMINAL_PASS=${TERMINAL_PASS:-$WORKSPACE_PASSWORD}
export TERMINAL_USER TERMINAL_PASS
# Pre-compute Base64 auth for nginx to auto-inject when proxying to ttyd
# This makes the Basic Auth transparent — users only need the JWT cookie
export TERMINAL_AUTH_BASIC=$(printf '%s:%s' "$TERMINAL_USER" "$TERMINAL_PASS" | base64 | tr -d '\n')
echo "[boot] ttyd auth: user=$TERMINAL_USER (password from Fly secrets or /data/.workspace-password)"

# Generate nginx config from template (substitutes env vars including TERMINAL_AUTH_BASIC)
echo "[boot] Configuring nginx..."
envsubst '${HUBIFY_USERNAME} ${HUB_ID} ${TERMINAL_AUTH_BASIC} ${GATEWAY_TOKEN}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start stats server (port 4000 — internal only, handles /auth/validate for nginx)
# Passes critical env vars: HUBIFY_USERNAME (workspace isolation), WORKSPACE_JWT_SECRET (JWT HMAC)
echo "[boot] Starting stats server (port 4000)..."
nohup env \
  HUBIFY_USERNAME="$HUBIFY_USERNAME" \
  HUB_ID="$HUB_ID" \
  WORKSPACE_JWT_SECRET="$WORKSPACE_JWT_SECRET" \
  node /opt/stats-server.js >> /data/stats.log 2>&1 &
echo "[boot] Stats server started (PID: $!)"

# Wait for stats-server to be ready before starting nginx
# (nginx auth_request returns 502 if stats-server isn't listening yet)
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:4000/auth/validate > /dev/null 2>&1 || [ "$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:4000/auth/validate 2>/dev/null)" = "401" ]; then
    echo "[boot] Stats server ready (attempt $i)"
    break
  fi
  sleep 0.25
done

# Start nginx (serves dashboard on port 80)
echo "[boot] Starting nginx (port 80)..."
nginx
echo "[boot] nginx started"

# Start ttyd (port 8080) with authentication
echo "[boot] Starting ttyd (port 8080)..."
echo "[boot] SECURITY: ttyd double-layered auth enabled (Nginx JWT + HTTP Basic)"
nohup ttyd --credential "${TERMINAL_USER}:${TERMINAL_PASS}" -p 8080 -t fontSize=14 -t theme='{"background":"#050505","foreground":"#FAFAFA","cursor":"#D4A574"}' bash >> /data/ttyd.log 2>&1 &
echo "[boot] ttyd started with HTTP Basic Auth (PID: $!)"

# ── Startup banner — show actual configured model routing ──
echo ""
echo "=================================================="
echo "  Hubify OpenClaw — Model Routing Active"
echo "=================================================="
echo "  Primary:  claude-sonnet-4-6   (conversations)"
echo "  Fast/bg:  gemma-3-27b-it:free (heartbeats/crons)"
echo "  Fallback: openrouter/auto"
echo "=================================================="
echo "  Workspace: https://$HUBIFY_USERNAME.hubify.com"
echo "=================================================="
echo ""

# ── Configure Hubify CLI for collective intelligence ──
echo "[boot] Configuring Hubify CLI..."
mkdir -p /root/.hubify
cat > /root/.hubify/config.yaml << HUBIFY_EOF
# Hubify CLI configuration — auto-generated by boot.sh
workspace_id: "$HUB_ID"
username: "$HUBIFY_USERNAME"
agent_id: "workspace-$HUBIFY_USERNAME"
platform: "openclaw"
convex_url: "https://dapper-mockingbird-619.convex.cloud"
auto_share: true
HUBIFY_EOF
echo "[boot] Hubify CLI configured (workspace=$HUB_ID, agent=workspace-$HUBIFY_USERNAME)"

# ── Configure hubify-research toolkit ──
echo "[boot] Configuring hubify-research toolkit..."
mkdir -p /root/.hubify
# Write research .env with any available API keys
{
  [ -n "$ANTHROPIC_API_KEY" ] && echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  [ -n "$OPENAI_API_KEY" ] && echo "OPENAI_API_KEY=$OPENAI_API_KEY"
  [ -n "$GOOGLE_AI_API_KEY" ] && echo "GOOGLE_AI_API_KEY=$GOOGLE_AI_API_KEY"
  [ -n "$DEEPSEEK_API_KEY" ] && echo "DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY"
  [ -n "$OPENROUTER_API_KEY" ] && echo "OPENROUTER_API_KEY=$OPENROUTER_API_KEY"
  [ -n "$NASA_ADS_API_KEY" ] && echo "NASA_ADS_API_KEY=$NASA_ADS_API_KEY"
  [ -n "$PERPLEXITY_API_KEY" ] && echo "PERPLEXITY_API_KEY=$PERPLEXITY_API_KEY"
  [ -n "$WOLFRAM_ALPHA_APP_ID" ] && echo "WOLFRAM_ALPHA_APP_ID=$WOLFRAM_ALPHA_APP_ID"
  [ -n "$HUGGINGFACE_TOKEN" ] && echo "HUGGINGFACE_TOKEN=$HUGGINGFACE_TOKEN"
  [ -n "$RUNPOD_API_KEY" ] && echo "RUNPOD_API_KEY=$RUNPOD_API_KEY"
} > /root/.hubify/.env
chmod 600 /root/.hubify/.env
echo "[boot] hubify-research env configured (keys from Fly secrets)"

# Add hubify collective sync to cron (every 30min, pull latest insights)
# NOTE: crontab may not be installed in all images — skip gracefully
if command -v crontab >/dev/null 2>&1; then
  if ! crontab -l 2>/dev/null | grep -q "hubify collective"; then
    (crontab -l 2>/dev/null; echo "*/30 * * * * hubify collective sync --workspace $HUB_ID --limit 20 >> /data/hubify-sync.log 2>&1") | crontab -
    echo "[boot] Hubify collective sync cron added (every 30min)"
  fi
else
  echo "[boot] crontab not available — skipping collective sync cron (OpenClaw crons handle scheduling)"
fi

# ── Sync squads and subscriptions from Convex ──
# Writes deployed squad info and knowledge subscriptions into HUB.yaml
# so the local agent knows about its squad memberships and connected hubs.
echo "[boot] Syncing squads and subscriptions from Convex..."
CONVEX_URL="${CONVEX_URL:-https://judicious-dinosaur-987.convex.cloud}"

# Fetch squads deployed to this hub
SQUADS_JSON=$(curl -sf -X POST "$CONVEX_URL/api/query" \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"squads:listByHub\",\"args\":{\"hub_id\":\"$HUB_ID\"}}" 2>/dev/null || echo "null")

if [ "$SQUADS_JSON" != "null" ] && [ -n "$SQUADS_JSON" ]; then
  # Write squad summary to knowledge dir for agent reference
  mkdir -p /data/knowledge/squads
  python3 -c "
import json, sys
try:
    resp = json.loads('''$SQUADS_JSON''')
    squads = resp.get('value', []) if isinstance(resp, dict) else resp if isinstance(resp, list) else []
    if not squads:
        sys.exit(0)
    with open('/data/knowledge/squads/active-squads.md', 'w') as f:
        f.write('# Active Squads in This Workspace\n\n')
        f.write('> Auto-synced from Hubify platform. Do not edit manually.\n\n')
        for s in squads:
            f.write(f\"## {s.get('display_name', s.get('name', 'Unknown'))}\n\")
            f.write(f\"- **Status:** {s.get('status', 'unknown')}\n\")
            f.write(f\"- **Style:** {s.get('communication_style', '?')} / {s.get('domains', [])}\n\")
            members = s.get('members', [])
            f.write(f\"- **Agents ({len(members)}):** {', '.join(m.get('role','?') for m in members)}\n\")
            sc = s.get('standup_config', {})
            if sc.get('enabled'):
                f.write(f\"- **Standups:** Every {sc.get('frequency_hours', 12)}h (managed by Convex crons)\n\")
            f.write(f\"- **Missions completed:** {s.get('missions_completed', 0)}\n\")
            f.write('\n')
    print(f'[boot] Wrote {len(squads)} squad(s) to /data/knowledge/squads/active-squads.md', file=sys.stderr)
except Exception as e:
    print(f'[boot] Warning: Could not parse squads: {e}', file=sys.stderr)
" 2>&1
else
  echo "[boot] No squads found for this hub (or Convex unreachable)"
fi

# Fetch knowledge subscriptions for this hub
SUBS_JSON=$(curl -sf -X POST "$CONVEX_URL/api/query" \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"hubSubscriptions:getSubscriptions\",\"args\":{\"hub_id\":\"$HUB_ID\"}}" 2>/dev/null || echo "null")

if [ "$SUBS_JSON" != "null" ] && [ -n "$SUBS_JSON" ]; then
  mkdir -p /data/knowledge/subscriptions
  python3 -c "
import json, sys
try:
    resp = json.loads('''$SUBS_JSON''')
    subs = resp.get('value', []) if isinstance(resp, dict) else resp if isinstance(resp, list) else []
    if not subs:
        sys.exit(0)
    with open('/data/knowledge/subscriptions/connected-hubs.md', 'w') as f:
        f.write('# Connected Knowledge Hubs\n\n')
        f.write('> Your workspace is subscribed to these platform hubs.\n')
        f.write('> Cross-pollinated knowledge flows here automatically via Convex crons.\n\n')
        for h in subs:
            f.write(f\"## {h.get('display_name', h.get('name', 'Unknown'))}\n\")
            if h.get('domain'):
                f.write(f\"- **Domain:** {h['domain']}\n\")
            if h.get('tags'):
                f.write(f\"- **Tags:** {', '.join(h['tags'])}\n\")
            f.write('\n')
    print(f'[boot] Wrote {len(subs)} subscription(s) to /data/knowledge/subscriptions/connected-hubs.md', file=sys.stderr)
except Exception as e:
    print(f'[boot] Warning: Could not parse subscriptions: {e}', file=sys.stderr)
" 2>&1
else
  echo "[boot] No subscriptions found for this hub (or Convex unreachable)"
fi

# ── Seed cron jobs BEFORE gateway starts (gateway loads jobs.json on startup) ──
# Write directly to jobs.json instead of using CLI (avoids auth issues with trusted-proxy mode)
mkdir -p /data/cron
CRON_JOBS=$(cat /data/cron/jobs.json 2>/dev/null || echo '{"jobs":[]}')
if echo "$CRON_JOBS" | grep -q '"jobs".*\[\]'; then
  echo "[boot] Seeding cron jobs..."
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  cat > /data/cron/jobs.json << CRON_EOF
{
  "jobs": [
    {
      "jobId": "heartbeat",
      "name": "heartbeat",
      "schedule": {
        "kind": "cron",
        "expr": "*/30 * * * *",
        "stagger": "5m"
      },
      "agentId": "main",
      "sessionTarget": "isolated",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "Run heartbeat check. Read /data/HEARTBEAT.md for instructions. Check 2-3 items from the rotation (tasks, git, system, morning). Update /data/memory/heartbeat-state.json with timestamps. If something needs user attention, surface it. Otherwise reply HEARTBEAT_OK.",
        "model": "openrouter/google/gemma-3-27b-it:free",
        "timeoutSeconds": 90
      },
      "enabled": false,
      "createdAt": "$NOW"
    },
    {
      "jobId": "morning-brief",
      "name": "morning-brief",
      "schedule": {
        "kind": "cron",
        "expr": "0 9 * * *"
      },
      "agentId": "main",
      "sessionTarget": "isolated",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "Run morning brief. Read /data/HEARTBEAT.md 'Morning Brief' section. Summarize yesterday from memory files, list today's priorities from USER.md, flag unread/pending items. Send brief if anything notable, stay quiet if clean.",
        "model": "openrouter/google/gemma-3-27b-it:free",
        "timeoutSeconds": 90
      },
      "enabled": false,
      "createdAt": "$NOW"
    },
    {
      "jobId": "collective-share",
      "name": "collective-share",
      "schedule": {
        "kind": "cron",
        "expr": "0 */6 * * *"
      },
      "agentId": "main",
      "sessionTarget": "isolated",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "Run collective knowledge sharing. Review /data/learnings/ for any new insights since last share. For each significant learning, pattern, or failure lesson, run: hubify collective share <type> '<content>' --context '<what you were doing>'. Focus on sharing things that would help OTHER workspaces improve. Skip trivial or workspace-specific things. Update /data/memory/last-collective-share.json with timestamp.",
        "model": "openrouter/google/gemma-3-27b-it:free",
        "timeoutSeconds": 120
      },
      "enabled": true,
      "createdAt": "$NOW"
    },
    {
      "jobId": "squad-sync",
      "name": "squad-sync",
      "schedule": {
        "kind": "cron",
        "expr": "0 */4 * * *"
      },
      "agentId": "main",
      "sessionTarget": "isolated",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "Run squad and subscription sync. Read /data/knowledge/squads/active-squads.md to see current squad deployments. Read /data/knowledge/subscriptions/connected-hubs.md to see knowledge subscriptions. For each active squad, check if there are new squad standups or findings worth noting in today's memory file. For subscriptions, check /data/learnings/ for any new cross-pollinated knowledge that arrived. Summarize anything notable. If nothing new, reply SQUAD_SYNC_OK.",
        "model": "openrouter/google/gemma-3-27b-it:free",
        "timeoutSeconds": 90
      },
      "enabled": true,
      "createdAt": "$NOW"
    },
    {
      "jobId": "auto-commit",
      "name": "auto-commit",
      "schedule": {
        "kind": "cron",
        "expr": "0 */2 * * *"
      },
      "agentId": "main",
      "sessionTarget": "isolated",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "Run auto-commit check. Check if there are uncommitted changes in the workspace by running: curl -s http://127.0.0.1:4000/git/status | If there are modified files, commit them with a descriptive message using: curl -s -X POST http://127.0.0.1:4000/git/local-commit -H 'Content-Type: application/json' -d '{\"message\":\"Auto-commit: <describe changes>\"}'. Only commit if there are actual changes. Reply AUTO_COMMIT_OK when done.",
        "model": "openrouter/google/gemma-3-27b-it:free",
        "timeoutSeconds": 60
      },
      "enabled": true,
      "createdAt": "$NOW"
    },
    {
      "jobId": "system-health",
      "name": "system-health",
      "schedule": {
        "kind": "cron",
        "expr": "0 3 * * *"
      },
      "agentId": "main",
      "sessionTarget": "isolated",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "Run system health check. Read /data/HEARTBEAT.md 'System Health' section. Check memory file count, session sizes, skill loadability, workspace updates. Flag anything concerning.",
        "model": "openrouter/google/gemma-3-27b-it:free",
        "timeoutSeconds": 90
      },
      "enabled": false,
      "createdAt": "$NOW"
    }
  ]
}
CRON_EOF
  echo "[boot] Cron jobs seeded (heartbeat, morning-brief, system-health)"
else
  echo "[boot] Cron jobs already configured, skipping"
fi

# ── Post-onboarding cleanup (runs EVERY boot) ──
# If the user already completed onboarding, disable the welcome cron
# and ensure heartbeat is at the normal 30m interval (not the 3m fast-onboarding rate).
# This prevents the "DONE" loop where the welcome cron fires every 3m
# and the agent just replies DONE endlessly.
if [ -f "/data/.first-boot-done" ]; then
  echo "[boot] Onboarding complete — ensuring normal heartbeat config..."

  # Ensure heartbeat is at normal 30m interval (not 3m onboarding rate)
  if [ -f "/data/openclaw.json" ] && grep -q '"every": "3m"' /data/openclaw.json; then
    sed -i 's/"every": "3m"/"every": "30m"/' /data/openclaw.json
    echo "[boot] Reset heartbeat interval from 3m → 30m (onboarding complete)"
  fi

  # Also reset heartbeat model to Haiku (cheap) if it was Sonnet (onboarding rate)
  if [ -f "/data/openclaw.json" ] && grep -q '"model": "openrouter/anthropic/claude-sonnet-4-6"' /data/openclaw.json; then
    # Only change the heartbeat model, not other model references
    python3 -c "
import json, sys
try:
    with open('/data/openclaw.json', 'r') as f:
        data = json.load(f)
    hb = data.get('agents', {}).get('defaults', {}).get('heartbeat', {})
    if hb.get('model') == 'openrouter/anthropic/claude-sonnet-4-6':
        hb['model'] = 'openrouter/google/gemma-3-27b-it:free'
        print('[boot] Changed heartbeat model from Sonnet → Haiku', file=sys.stderr)
    with open('/data/openclaw.json', 'w') as f:
        json.dump(data, f, indent=2)
except Exception as e:
    print(f'[boot] Warning: Could not patch heartbeat model: {e}', file=sys.stderr)
" 2>&1
  fi
else
  echo "[boot] First boot — onboarding crons active"
fi

# ── Dashboard escaping fix (background) ──────────────────────────────────────
# OpenClaw's onboarding.finalize wizard regenerates /opt/dashboard/index.html
# on first boot with unescaped single quotes in JS strings. This background
# watcher detects the regeneration and fixes the escaping automatically.
(
  ORIGINAL_SIZE=$(stat -c%s /opt/dashboard/index.html 2>/dev/null || echo 0)
  for i in $(seq 1 60); do
    sleep 5
    CURRENT_SIZE=$(stat -c%s /opt/dashboard/index.html 2>/dev/null || echo 0)
    if [ "$CURRENT_SIZE" != "$ORIGINAL_SIZE" ] && [ "$CURRENT_SIZE" -gt 0 ]; then
      echo "[boot] Dashboard regenerated (${ORIGINAL_SIZE} -> ${CURRENT_SIZE} bytes), applying escaping fix..."
      python3 /opt/fix-dashboard-escaping.py
      break
    fi
  done
) &

# Start OpenClaw gateway (port 3000, foreground — internal only)
# Auth: trusted-proxy mode — nginx handles all auth via JWT cookies,
# then forwards the authenticated username via X-Auth-Username header.
# This bypasses device pairing entirely (the proxy IS the trust boundary).
# Gateway only listens on loopback — all external traffic goes through nginx.
echo "[boot] Starting OpenClaw gateway (port 3000, auth=trusted-proxy)..."
exec openclaw gateway run --port 3000 --bind lan
