#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_PORT="${SERVER_PORT:-8080}"
RUN_BUILD="${RUN_BUILD:-0}"
RUN_MOBILE="${RUN_MOBILE:-0}"
PLAYWRIGHT_CONFIG="${PLAYWRIGHT_CONFIG:-$ROOT_DIR/playwright.config.ts}"

wait_for_server() {
  local attempts="${1:-40}"
  local delay="${2:-1}"
  local i
  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "http://127.0.0.1:${SERVER_PORT}/api/healthz" >/dev/null; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

cd "$ROOT_DIR"

echo "[smoke] root=$ROOT_DIR"
echo "[smoke] server_port=$SERVER_PORT"

if [[ "$RUN_BUILD" == "1" ]]; then
  echo "[smoke] running pnpm build"
  pnpm build
fi

echo "[smoke] waiting for server health endpoint"
wait_for_server 60 1

echo "[smoke] running integration handshake"
TEST_BASE="http://127.0.0.1:${SERVER_PORT}" TEST_WS="ws://127.0.0.1:${SERVER_PORT}/ws" node "$ROOT_DIR/test-integration.js"

echo "[smoke] running Playwright (pc project)"
pnpm exec playwright test -c "$PLAYWRIGHT_CONFIG" --project=pc --reporter=line

if [[ "$RUN_MOBILE" == "1" ]]; then
  echo "[smoke] running Playwright (mobile project)"
  pnpm exec playwright test -c "$PLAYWRIGHT_CONFIG" --project=mobile --reporter=line
fi

echo "[smoke] success"
