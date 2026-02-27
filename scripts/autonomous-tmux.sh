#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_NAME="${SESSION_NAME:-spermrace-autonomous}"
SERVER_PORT="${SERVER_PORT:-8080}"
CHECK_INTERVAL="${CHECK_INTERVAL:-90}"
RUN_MOBILE="${RUN_MOBILE:-0}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.autonomous/logs}"
CODEX_CMD="${CODEX_CMD:-}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[error] missing command: $cmd" >&2
    exit 1
  fi
}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <start|stop|status|attach|bootstrap|smoke>

Environment variables:
  SESSION_NAME   tmux session name (default: spermrace-autonomous)
  SERVER_PORT    backend port for health checks (default: 8080)
  CHECK_INTERVAL seconds between autonomous smoke loops (default: 90)
  RUN_MOBILE     1 to include mobile Playwright in loops (default: 0)
  CODEX_CMD      optional command to run in the codex window
USAGE
}

bootstrap() {
  require_cmd pnpm
  mkdir -p "$LOG_DIR"
  cd "$ROOT_DIR"
  echo "[bootstrap] pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
  echo "[bootstrap] pnpm exec playwright install"
  pnpm exec playwright install
}

start_session() {
  require_cmd tmux
  require_cmd pnpm
  require_cmd node
  require_cmd curl

  mkdir -p "$LOG_DIR"

  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "[info] session already exists: $SESSION_NAME"
    return 0
  fi

  tmux new-session -d -s "$SESSION_NAME" -n stack -c "$ROOT_DIR"
  tmux send-keys -t "$SESSION_NAME":stack.0 "cd '$ROOT_DIR' && pnpm --filter server dev 2>&1 | tee '$LOG_DIR/server.log'" C-m

  tmux split-window -h -t "$SESSION_NAME":stack -c "$ROOT_DIR"
  tmux send-keys -t "$SESSION_NAME":stack.1 "cd '$ROOT_DIR' && pnpm --filter client dev 2>&1 | tee '$LOG_DIR/client.log'" C-m

  tmux new-window -t "$SESSION_NAME" -n checks -c "$ROOT_DIR"
  tmux send-keys -t "$SESSION_NAME":checks.0 "cd '$ROOT_DIR' && sleep 8 && SERVER_PORT='$SERVER_PORT' CHECK_INTERVAL='$CHECK_INTERVAL' RUN_MOBILE='$RUN_MOBILE' LOG_DIR='$LOG_DIR' '$ROOT_DIR/scripts/autonomous-check-loop.sh' 2>&1 | tee '$LOG_DIR/checks.log'" C-m

  tmux new-window -t "$SESSION_NAME" -n codex -c "$ROOT_DIR"
  if [[ -n "$CODEX_CMD" ]]; then
    # Run directly in tmux PTY; Codex needs a real terminal and fails behind tee pipes.
    tmux send-keys -t "$SESSION_NAME":codex.0 "cd '$ROOT_DIR' && $CODEX_CMD" C-m
  else
    tmux send-keys -t "$SESSION_NAME":codex.0 "cd '$ROOT_DIR' && echo 'Set CODEX_CMD and restart session to auto-launch Codex.' && bash" C-m
  fi

  tmux select-window -t "$SESSION_NAME":stack

  cat <<MSG
[started] tmux session: $SESSION_NAME
  attach:  tmux attach -t $SESSION_NAME
  status:  $(basename "$0") status
  stop:    $(basename "$0") stop
MSG
}

stop_session() {
  require_cmd tmux
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    tmux kill-session -t "$SESSION_NAME"
    echo "[stopped] $SESSION_NAME"
  else
    echo "[info] session not found: $SESSION_NAME"
  fi
}

show_status() {
  require_cmd tmux
  if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "[info] session not found: $SESSION_NAME"
    exit 1
  fi

  echo "[status] session=$SESSION_NAME"
  tmux list-windows -t "$SESSION_NAME" -F "  window #{window_index}: #{window_name} (#{window_panes} panes)"
  echo "[status] panes"
  tmux list-panes -t "$SESSION_NAME" -a -F "  #{session_name}:#{window_name}.#{pane_index} pid=#{pane_pid} cmd=#{pane_current_command}"

  if [[ -f "$LOG_DIR/checks.log" ]]; then
    echo "[status] last checks"
    tail -n 20 "$LOG_DIR/checks.log"
  fi

  if [[ -f "$LOG_DIR/last-check.fail" ]]; then
    echo "[status] last check failed:"
    cat "$LOG_DIR/last-check.fail"
    exit 2
  fi
}

attach_session() {
  require_cmd tmux
  exec tmux attach -t "$SESSION_NAME"
}

run_smoke_once() {
  SERVER_PORT="$SERVER_PORT" RUN_MOBILE="$RUN_MOBILE" "$ROOT_DIR/scripts/autonomous-smoke.sh"
}

main() {
  local action="${1:-}"
  case "$action" in
    start) start_session ;;
    stop) stop_session ;;
    status) show_status ;;
    attach) attach_session ;;
    bootstrap) bootstrap ;;
    smoke) run_smoke_once ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
