#!/bin/bash

# skidr.io Development Setup Script
# This script sets up the environment for development with all debug features enabled

echo "🔧 Setting up skidr.io for development..."

# Note: All configuration is centralized in packages/server/src/game.config.ts
# No environment files are needed - everything is hardcoded for simplicity

echo "✅ Development environment ready!"
echo ""
echo "📋 Configuration System:"
echo "   - All settings are in packages/server/src/game.config.ts"
echo "   - No .env files needed - everything is hardcoded"
echo "   - Edit game.config.ts to modify any settings"
echo ""
echo "🎮 Development Features:"
echo "   - Debug UI enabled in development mode"
echo "   - Performance monitoring available"
echo "   - Potato mode for testing"
echo "   - Bot testing system enabled"
echo ""
echo "🚀 To start development:"
echo "  pnpm dev          # Start both server and client"
echo "  pnpm server       # Start server only"
echo "  pnpm client       # Start client only"
echo ""
echo "📝 To modify game settings:"
echo "  Edit packages/server/src/game.config.ts"
echo "  Restart server to apply changes" 