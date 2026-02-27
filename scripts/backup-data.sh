#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="$OUT_DIR/spermrace-data_$STAMP.tgz"

mkdir -p "$OUT_DIR"
tar -czf "$TARGET" -C "$ROOT" packages/server/data
echo "Backup written: $TARGET"
