#!/bin/bash
# Squad VPS Boot Script
# Runs on every machine start — all tools are pre-installed in the image

echo "[boot] Squad VPS starting at $(date)"
echo "[boot] Node: $(node --version), Git: $(git --version), Python: $(python3 --version 2>&1)"
echo "[boot] OpenClaw: $(openclaw --version 2>/dev/null || echo 'not found')"

# Set up git identity from env vars if provided
if [ -n "$GITHUB_USERNAME" ]; then
  git config --global user.name "$GITHUB_USERNAME"
  echo "[boot] Git user.name set to $GITHUB_USERNAME"
fi
if [ -n "$GITHUB_EMAIL" ]; then
  git config --global user.email "$GITHUB_EMAIL"
  echo "[boot] Git user.email set to $GITHUB_EMAIL"
fi

# Clone repo if not already present and GITHUB_REPO is set
if [ -n "$GITHUB_REPO" ] && [ ! -d "/workspace/repo/.git" ]; then
  echo "[boot] Cloning $GITHUB_REPO..."
  if [ -n "$GITHUB_PAT" ]; then
    git clone "https://${GITHUB_USERNAME}:${GITHUB_PAT}@github.com/${GITHUB_REPO}.git" /workspace/repo
  else
    git clone "https://github.com/${GITHUB_REPO}.git" /workspace/repo
  fi
fi

# Copy scripts to workspace if they exist in the image
if [ -d "/opt/scripts" ]; then
  mkdir -p /workspace/scripts
  cp -n /opt/scripts/*.py /workspace/scripts/ 2>/dev/null || true
  cp -n /opt/scripts/*.js /workspace/scripts/ 2>/dev/null || true
  echo "[boot] Scripts copied to /workspace/scripts/"
fi

# Write boot log
mkdir -p /workspace/.hubify
echo "Booted at $(date)" >> /workspace/.hubify/boot.log

# Start Telegram bot in background if token is set
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  echo "[boot] Starting Telegram bot..."
  nohup node /workspace/scripts/telegram_bot.js >> /workspace/.hubify/telegram.log 2>&1 &
  echo "[boot] Telegram bot started (PID: $!)"
fi

echo "[boot] Starting ttyd web terminal on port 8080..."

# ── Security ──
# TTYD_CREDENTIAL: set as Fly secret (e.g. "admin:strongpassword")
#   fly secrets set TTYD_CREDENTIAL="admin:$(openssl rand -base64 24)" -a hubify-squads
# TTYD_READONLY: set to "1" to disable keyboard input (view-only for public embeds)
#   fly secrets set TTYD_READONLY=1 -a hubify-squads

TTYD_ARGS="-p 8080 -W"
TTYD_ARGS="$TTYD_ARGS -t fontSize=14"
TTYD_ARGS="$TTYD_ARGS -t theme={\"background\":\"#0a0a0a\",\"foreground\":\"#e0e0e0\"}"

# Require credential if TTYD_CREDENTIAL is set (format: "user:password")
if [ -n "$TTYD_CREDENTIAL" ]; then
  TTYD_ARGS="$TTYD_ARGS -c $TTYD_CREDENTIAL"
  echo "[boot] ttyd password protection ENABLED"
else
  echo "[boot] WARNING: ttyd running WITHOUT password protection!"
  echo "[boot] Set TTYD_CREDENTIAL secret: fly secrets set TTYD_CREDENTIAL='admin:yourpassword' -a hubify-squads"
fi

# Read-only mode: disables keyboard input, terminal is view-only
if [ "$TTYD_READONLY" = "1" ]; then
  TTYD_ARGS="$TTYD_ARGS -R"
  echo "[boot] ttyd read-only mode ENABLED (view-only)"
fi

# ttyd is the foreground process — keeps the container alive
exec /usr/local/bin/ttyd $TTYD_ARGS bash
