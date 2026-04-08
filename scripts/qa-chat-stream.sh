#!/usr/bin/env bash
# E2E smoke: POST /api/chat/stream and assert SSE contains a successful completion.
# Requires: gateway running, and at least one AI key in the gateway process env.
#
# Usage:
#   pnpm dev   # in another terminal
#   pnpm qa:chat-stream
#
# Optional:
#   CLAWS_GATEWAY_URL=http://127.0.0.1:4317 pnpm qa:chat-stream
#   CLAWS_QA_STRICT=1 pnpm qa:chat-stream   # exit 1 if AI not configured (default skips)

set -euo pipefail
GATEWAY_URL="${CLAWS_GATEWAY_URL:-http://127.0.0.1:4317}"
STRICT="${CLAWS_QA_STRICT:-0}"

health=$(curl -s -o /dev/null -w "%{http_code}" "${GATEWAY_URL}/health" || echo "000")
if [[ "$health" != "200" ]]; then
  echo "qa-chat-stream: gateway not reachable at ${GATEWAY_URL}/health (HTTP $health)"
  echo "  Start stack: pnpm dev"
  exit 1
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

# Stream chat; collect full body (small response for tiny prompt)
code=$(curl -sS -o "$tmp" -w "%{http_code}" -X POST "${GATEWAY_URL}/api/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"message":"Reply with exactly the word: ok","chatId":"qa-chat-stream","threadId":"e2e"}' \
  --max-time 120 || true)

if [[ "$code" == "501" ]]; then
  echo "qa-chat-stream: streaming disabled (501) — no AI provider on gateway."
  if [[ "$STRICT" == "1" ]]; then exit 1; fi
  echo "  Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or AI_GATEWAY_API_KEY and restart gateway."
  exit 0
fi

if [[ "$code" != "200" ]]; then
  echo "qa-chat-stream: unexpected HTTP $code"
  cat "$tmp" | head -c 800
  exit 1
fi

if grep -qE '"type"\s*:\s*"complete"|"type":"complete"' "$tmp"; then
  echo "qa-chat-stream: OK — SSE contains complete"
  exit 0
fi

if grep -qE '"type"\s*:\s*"error"|"type":"error"' "$tmp"; then
  echo "qa-chat-stream: stream ended with error event:"
  cat "$tmp" | head -c 1200
  exit 1
fi

echo "qa-chat-stream: no complete event in response (first 800 bytes):"
head -c 800 "$tmp"
exit 1
