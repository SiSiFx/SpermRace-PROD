#!/usr/bin/env bash

set -euo pipefail

ENVIRONMENT="${1:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PM2_ECOSYSTEM="${PM2_ECOSYSTEM:-$REPO_ROOT/ops/pm2/ecosystem.config.js}"
PM2_APP_NAME="${PM2_APP_NAME:-spermrace-server-ws}"
RUN_GIT_PULL="${RUN_GIT_PULL:-0}"
RUN_INSTALL="${RUN_INSTALL:-1}"
RUN_BUILD="${RUN_BUILD:-1}"
RUN_TESTS="${RUN_TESTS:-0}"

say() {
  printf '%s\n' "$1"
}

step() {
  printf '\n[deploy] %s\n' "$1"
}

if [ ! -f "$PM2_ECOSYSTEM" ]; then
  say "[deploy] PM2 ecosystem config not found: $PM2_ECOSYSTEM"
  exit 1
fi

step "Checking prerequisites"
command -v node >/dev/null 2>&1 || { say "[deploy] node is required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { say "[deploy] pnpm is required"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { say "[deploy] pm2 is required"; exit 1; }

step "Using repository root"
cd "$REPO_ROOT"
say "[deploy] repo: $REPO_ROOT"
say "[deploy] environment: $ENVIRONMENT"
say "[deploy] pm2 config: $PM2_ECOSYSTEM"

if [ "$RUN_GIT_PULL" = "1" ]; then
  step "Updating git branch"
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  git fetch origin
  git pull --ff-only origin "$CURRENT_BRANCH"
  say "[deploy] updated branch: $CURRENT_BRANCH"
fi

if [ "$RUN_INSTALL" = "1" ]; then
  step "Installing dependencies"
  pnpm install --frozen-lockfile
fi

if [ "$RUN_TESTS" = "1" ]; then
  step "Running server tests"
  pnpm --filter server test
fi

if [ "$RUN_BUILD" = "1" ]; then
  step "Building project"
  pnpm build
fi

step "Validating server build output"
SERVER_ENTRY="$REPO_ROOT/packages/server/dist/server/src/index.js"
if [ ! -f "$SERVER_ENTRY" ]; then
  say "[deploy] expected server entry missing: $SERVER_ENTRY"
  exit 1
fi

step "Checking server env file"
ENV_FILE="$REPO_ROOT/packages/server/.env.$ENVIRONMENT"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE="$REPO_ROOT/packages/server/.env"
fi

if [ -f "$ENV_FILE" ]; then
  say "[deploy] env file: $ENV_FILE"
  if grep -Eq "REPLACE_WITH_|YOUR_" "$ENV_FILE"; then
    say "[deploy] env file contains placeholder values; update before production deploy"
    exit 1
  fi
else
  say "[deploy] no env file found at packages/server/.env.$ENVIRONMENT or packages/server/.env"
  exit 1
fi

step "Starting or restarting PM2 app"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME" --update-env
else
  pm2 start "$PM2_ECOSYSTEM" --only "$PM2_APP_NAME" --update-env
fi
pm2 save

step "Health checks"
if curl -fsS http://127.0.0.1:8080/api/healthz >/dev/null; then
  say "[deploy] healthz OK"
else
  say "[deploy] healthz failed"
  exit 1
fi

if curl -fsS http://127.0.0.1:8080/api/ws-healthz >/dev/null; then
  say "[deploy] ws-healthz OK"
else
  say "[deploy] ws-healthz failed"
  exit 1
fi

step "Done"
say "[deploy] PM2 status (filtered):"
pm2 status "$PM2_APP_NAME"
say "[deploy] use 'pm2 logs $PM2_APP_NAME --lines 100' for logs"
