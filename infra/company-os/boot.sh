#!/bin/bash
set -e

echo "[company-os boot] Starting — user: ${HUBIFY_USERNAME:-unknown}"

if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "[company-os boot] FATAL: OPENROUTER_API_KEY not set"
  exit 1
fi

export HUBIFY_USERNAME=${HUBIFY_USERNAME:-workspace}
export HUB_ID=${HUB_ID:-unknown}
export WORKSPACE_JWT_SECRET=${WORKSPACE_JWT_SECRET:-"dev-secret-not-for-prod"}

# OpenRouter is API-compatible — expose as Anthropic+OpenAI keys for adapters
export ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-$OPENROUTER_API_KEY}
export ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL:-"https://openrouter.ai/api/v1"}
export OPENAI_API_KEY=${OPENAI_API_KEY:-$OPENROUTER_API_KEY}
export OPENAI_BASE_URL=${OPENAI_BASE_URL:-"https://openrouter.ai/api/v1"}

# Persistent data dirs — point Company OS at /data so everything survives restarts
export COMPANY_OS_HOME=${COMPANY_OS_HOME:-/data/company-os}
export COMPANY_OS_DB_DIR=${COMPANY_OS_DB_DIR:-/data/company-os/instances/default/db}
export COMPANY_OS_STORAGE_DIR=${COMPANY_OS_STORAGE_DIR:-/data/company-os/instances/default/data/storage}
mkdir -p "$COMPANY_OS_DB_DIR" "$COMPANY_OS_STORAGE_DIR" "/data/company-os/instances/default/logs" "/data/company-os/instances/default/secrets"

# Workspace password
if [ ! -f "/data/.workspace-password" ]; then
  openssl rand -base64 16 | tr -d '=+/' > /data/.workspace-password
  chmod 600 /data/.workspace-password
fi

# Write OpenClaw auth-profiles.json so the agent can use the OpenRouter key
OPENCLAW_AGENT_DIR="/data/agents/main/agent"
mkdir -p "$OPENCLAW_AGENT_DIR"
cat > "$OPENCLAW_AGENT_DIR/auth-profiles.json" << AUTHEOF
{
  "profiles": {
    "openrouter": {
      "provider": "openrouter",
      "apiKey": "${OPENROUTER_API_KEY}"
    },
    "anthropic": {
      "provider": "anthropic",
      "apiKey": "${OPENROUTER_API_KEY}",
      "baseUrl": "https://openrouter.ai/api/v1"
    },
    "openai": {
      "provider": "openai",
      "apiKey": "${OPENROUTER_API_KEY}",
      "baseUrl": "https://openrouter.ai/api/v1"
    }
  },
  "default": "openrouter"
}
AUTHEOF
echo "[company-os boot] Auth profiles written"

# Seed OpenClaw workspace on first boot
if [ ! -f "/data/HUB.yaml" ]; then
  echo "[company-os boot] Seeding OpenClaw workspace..."
  cp -rn /opt/templates/companyos/. /data/
  cp -rn /opt/defaults/. /data/ 2>/dev/null || true
  for f in /data/SOUL.md /data/USER.md /data/HUB.yaml /data/AGENTS.md /data/HEARTBEAT.md /data/WELCOME.md /data/MEMORY.md; do
    [ -f "$f" ] && sed -i \
      -e "s/{{USERNAME}}/$HUBIFY_USERNAME/g" \
      -e "s/{{HUB_ID}}/$HUB_ID/g" \
      -e "s/{{SUBDOMAIN}}/$HUBIFY_USERNAME.hubify.com/g" \
      "$f"
  done
  mkdir -p /data/memory /data/skills /data/learnings /data/knowledge
fi

# OpenClaw config
[ ! -f "/data/openclaw.json" ] && envsubst < /opt/openclaw.json.template > /data/openclaw.json

# --- Start real PostgreSQL (bypasses embedded-postgres permission issues) ---
PG_DATA="/data/company-os/pg"
PG_PORT=54329
PG_DB="companyos"
PG_USER="companyos"
PG_PASS="companyos-secret"

mkdir -p "$PG_DATA"
chown -R postgres:postgres "$PG_DATA"

# Find postgres binaries (apt puts them in versioned dirs)
PG_BIN=$(find /usr/lib/postgresql -name "initdb" 2>/dev/null | head -1 | xargs dirname)
export PATH="$PG_BIN:$PATH"
echo "[company-os boot] PG binaries: $PG_BIN"

if [ ! -f "$PG_DATA/PG_VERSION" ]; then
  echo "[company-os boot] Initializing PostgreSQL database..."
  su -s /bin/bash postgres -c "PATH='$PG_BIN:$PATH' initdb -D '$PG_DATA' --username=postgres --auth=trust --no-locale --encoding=UTF8" >> /tmp/pg-init.log 2>&1
  echo "[company-os boot] PostgreSQL initialized"
fi

# Start postgres as postgres user
su -s /bin/bash postgres -c "PATH='$PG_BIN:$PATH' pg_ctl -D '$PG_DATA' -l /tmp/pg.log start -o '-p $PG_PORT'" >> /tmp/pg-init.log 2>&1
sleep 3

# Create DB and user
su -s /bin/bash postgres -c "psql -p $PG_PORT -c \"CREATE USER \\\"$PG_USER\\\" WITH PASSWORD '$PG_PASS';\" postgres 2>/dev/null || true"
su -s /bin/bash postgres -c "psql -p $PG_PORT -c \"CREATE DATABASE \\\"$PG_DB\\\" OWNER \\\"$PG_USER\\\";\" postgres 2>/dev/null || true"
export DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@localhost:${PG_PORT}/${PG_DB}"
echo "[company-os boot] PostgreSQL ready: $DATABASE_URL"

# Company OS config
mkdir -p "/data/company-os/instances/default"
cat > "/data/company-os/instances/default/config.json" << CONFIGEOF
{
  "server": { "serveUi": true, "port": 3100 },
  "database": { "mode": "url" },
  "storage": {
    "provider": "local-disk",
    "localDisk": { "baseDir": "${COMPANY_OS_STORAGE_DIR}" }
  }
}
CONFIGEOF

# Start nginx
echo "[company-os boot] Starting nginx..."
nginx

# Start Company OS API
echo "[company-os boot] Starting Company OS API..."
cd /opt/company-os
mkdir -p /opt/company-os/.paperclip/logs /opt/company-os/.paperclip/secrets
node server/dist/index.js >> /tmp/company-os-server.log 2>&1 &
COMPANY_OS_PID=$!

# Wait for ready — first boot initializes Postgres (~60s), give it 90s
echo "[company-os boot] Waiting for Company OS API (first boot may take 60-90s)..."
for i in $(seq 1 45); do
  curl -sf http://localhost:3100/api/health > /dev/null 2>&1 && echo "[company-os boot] API ready after ${i}x2s" && break
  sleep 2
  # Show server log progress every 10 iterations
  [ $((i % 10)) -eq 0 ] && echo "[company-os boot] Still waiting (${i}x2s)..." && tail -3 /tmp/company-os-server.log 2>/dev/null || true
done

# Start OpenClaw gateway (foreground)
echo "[company-os boot] Starting OpenClaw gateway..."
exec openclaw gateway run --port 3000 --bind lan
