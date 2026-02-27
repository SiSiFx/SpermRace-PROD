#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_PORT="${SERVER_PORT:-8080}"
CHECK_INTERVAL="${CHECK_INTERVAL:-90}"
RUN_MOBILE="${RUN_MOBILE:-0}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.autonomous/logs}"
FAIL_FAST="${FAIL_FAST:-0}"

STATUS_FILE="${STATUS_FILE:-$LOG_DIR/last-check.status}"
FAIL_FILE="${FAIL_FILE:-$LOG_DIR/last-check.fail}"

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

echo "[checks] root=$ROOT_DIR"
echo "[checks] server_port=$SERVER_PORT"
echo "[checks] interval=$CHECK_INTERVAL"
echo "[checks] run_mobile=$RUN_MOBILE"
echo "[checks] status_file=$STATUS_FILE"

while true; do
  ts="$(date -Is)"
  echo "[checks] run at $ts"

  if SERVER_PORT="$SERVER_PORT" RUN_MOBILE="$RUN_MOBILE" "$ROOT_DIR/scripts/autonomous-smoke.sh"; then
    echo "ok $ts" >"$STATUS_FILE"
    rm -f "$FAIL_FILE" || true
    echo "[checks] OK"
  else
    code="$?"
    echo "fail $ts exit=$code" >"$STATUS_FILE"
    echo "fail $ts exit=$code" >"$FAIL_FILE"
    echo "[checks] FAIL exit=$code"
    if [[ "$FAIL_FAST" == "1" ]]; then
      exit "$code"
    fi
  fi

  sleep "$CHECK_INTERVAL"
done
