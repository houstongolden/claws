#!/usr/bin/env bash
set -euo pipefail

APP_NAME="hubify-caddy"

if ! flyctl apps list | grep -q "^${APP_NAME}\b"; then
  flyctl apps create "${APP_NAME}"
fi

flyctl deploy -c infra/caddy/fly.toml
