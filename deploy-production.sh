#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
CANONICAL_DEPLOY_SCRIPT="$REPO_ROOT/scripts/deploy-vps.sh"

if [ ! -x "$CANONICAL_DEPLOY_SCRIPT" ]; then
  echo "[deploy] missing canonical deploy script: $CANONICAL_DEPLOY_SCRIPT" >&2
  exit 1
fi

echo "[deploy] forwarding to canonical deploy path: scripts/deploy-vps.sh"
exec "$CANONICAL_DEPLOY_SCRIPT" production
