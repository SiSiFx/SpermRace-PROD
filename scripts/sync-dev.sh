#!/bin/bash
# Sync dev branch with master
# Usage: ./scripts/sync-dev.sh

set -e

echo "🔄 Syncing dev branch with master..."

# Fetch latest
git fetch origin

# Switch to dev
git checkout dev
git pull origin dev

# Merge master
echo "📥 Merging master into dev..."
git merge master -m "chore: Sync dev with master"

# Push
echo "📤 Pushing to origin/dev..."
git push origin dev

echo "✅ Dev branch synced with master!"
echo ""
echo "Branch status:"
git branch -vv | grep -E "master|dev"
