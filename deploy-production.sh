#!/bin/bash

# skidr.io Production Deployment Script
# This script sets up the environment for production deployment

echo "🚀 Setting up skidr.io for production deployment..."

# Note: All configuration is centralized in packages/server/src/game.config.ts
# No environment files are needed - everything is hardcoded for simplicity

echo "✅ Production environment ready!"
echo ""
echo "📋 Configuration System:"
echo "   - All settings are in packages/server/src/game.config.ts"
echo "   - No .env files needed - everything is hardcoded"
echo "   - Edit game.config.ts to modify any settings"
echo ""
echo "🔒 Production Features:"
echo "   - Debug features disabled for performance"
echo "   - Security features enabled"
echo "   - Bot testing available but controlled"
echo "   - Performance monitoring disabled"
echo ""
echo "🚀 To start production:"
echo "  pnpm build         # Build client for production"
echo "  pnpm start         # Start production server"
echo ""
echo "📝 To modify production settings:"
echo "  Edit packages/server/src/game.config.ts"
echo "  Set features.debug = false"
echo "  Set features.performanceMonitoring = false"
echo "  Restart server to apply changes" 