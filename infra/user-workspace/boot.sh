#!/bin/bash
# Hubify User Workspace Boot Script
# ENV: HUBIFY_USERNAME (required), HUBIFY_PROJECT_ID, HUBIFY_API_KEY, HUBIFY_TEMPLATE, TTYD_CREDENTIAL, TTYD_READONLY
set -e

USERNAME="${HUBIFY_USERNAME:-workspace}"
TEMPLATE="${HUBIFY_TEMPLATE:-myos}"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "[boot] Starting workspace for: ${USERNAME} (template: ${TEMPLATE})"

mkdir -p /data/.hub /data/memory /data/skills /data/projects

# Seed on first boot
if [ ! -f /data/AGENTS.md ]; then
  echo "[boot] First boot — seeding ${USERNAME} workspace..."

  printf '# AGENTS.md\nThis workspace belongs to %s.\nRead SOUL.md for identity.\n' \
    "${USERNAME}" > /data/AGENTS.md

  printf '# SOUL.md\nYou are %s, running at %s.hubify.com.\nBe proactive and build great things.\n' \
    "${USERNAME}" "${USERNAME}" > /data/SOUL.md

  printf '# MEMORY.md\nWorkspace created: %s\nUsername: %s\nTemplate: %s\n' \
    "${NOW}" "${USERNAME}" "${TEMPLATE}" > /data/MEMORY.md

  printf '{"project_id":"%s","username":"%s","template":"%s","workspace_url":"https://%s.hubify.com"}' \
    "${HUBIFY_PROJECT_ID:-}" "${USERNAME}" "${TEMPLATE}" "${USERNAME}" > /data/.hub/config.json

  echo "[boot] Workspace seeded"
fi

echo "${NOW} boot ${USERNAME}" >> /data/.hub/boot.log

TTYD_ARGS="-p 8080 -W -t fontSize=14"
[ -n "${TTYD_CREDENTIAL}" ] && TTYD_ARGS="${TTYD_ARGS} -c ${TTYD_CREDENTIAL}"
[ "${TTYD_READONLY}" = "1" ] && TTYD_ARGS="${TTYD_ARGS} -R"

exec /usr/local/bin/ttyd ${TTYD_ARGS} bash
