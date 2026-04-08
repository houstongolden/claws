#!/usr/bin/env bash
# phase-watchdog.sh — 15-minute safety check
#
# Runs every 15 minutes via launchd. Two jobs:
#   1. Fire the QA audit (scripts/qa-audit.sh)
#   2. Check phase progress against ~/.claws/phase-status.json
#      and append to a log the user can tail to see what's happening.
#
# Non-interactive, does not block, does not prompt.

set -euo pipefail

CLAWS_REPO="${CLAWS_REPO:-$HOME/Desktop/CODE_2025/claws}"
CLAWS_HOME="${CLAWS_HOME:-$HOME/.claws}"
LOG="$CLAWS_HOME/watchdog.log"

mkdir -p "$CLAWS_HOME"

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# 1. QA audit (best effort, ignore failures)
if [ -x "$CLAWS_REPO/scripts/qa-audit.sh" ]; then
  "$CLAWS_REPO/scripts/qa-audit.sh" >> "$LOG" 2>&1 || true
fi

# 2. Phase progress summary
{
  echo "[$TIMESTAMP] watchdog tick"

  # Check if phases.json exists (future: phase runner writes this)
  PHASES_FILE="$CLAWS_REPO/project-context/phases.json"
  if [ -f "$PHASES_FILE" ]; then
    echo "  phases: $(grep -c '"status":' "$PHASES_FILE" 2>/dev/null || echo 0) defined"
    INCOMPLETE=$(grep -c '"status": "pending"\|"status": "in_progress"' "$PHASES_FILE" 2>/dev/null || echo 0)
    echo "  incomplete: $INCOMPLETE"
  fi

  # QA status
  if [ -f "$CLAWS_HOME/phase-status.json" ]; then
    LAST_AUDIT=$(grep -o '"lastAudit": "[^"]*"' "$CLAWS_HOME/phase-status.json" 2>/dev/null | cut -d'"' -f4)
    [ -n "$LAST_AUDIT" ] && echo "  last QA: $LAST_AUDIT"
  fi

  # Gateway/dashboard reachability
  if curl -sf -m 3 http://localhost:4317/api/status >/dev/null 2>&1; then
    echo "  gateway: UP"
  else
    echo "  gateway: down"
  fi
  if curl -sf -m 3 http://localhost:4318 >/dev/null 2>&1; then
    echo "  dashboard: UP"
  else
    echo "  dashboard: down"
  fi
} >> "$LOG"

# Trim log to last 500 lines
if [ -f "$LOG" ]; then
  tail -500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
