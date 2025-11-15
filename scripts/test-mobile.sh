#!/bin/bash

set -e

echo "=========================================="
echo "   SpermRace.io Mobile Workflow Tests    "
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Kill any existing vitest processes to prevent runaways
pkill -f vitest || true
sleep 1

# Set memory limits
export NODE_OPTIONS="--max-old-space-size=2048"

# Navigate to project root
cd /opt/spermrace

echo -e "${BLUE}Step 1: Checking dependencies...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}pnpm not found! Installing...${NC}"
    npm install -g pnpm
fi

echo -e "${BLUE}Step 2: Installing test dependencies (if needed)...${NC}"
cd packages/client
if [ ! -d "node_modules/vitest" ]; then
    pnpm add -D vitest @vitest/ui @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
fi

echo -e "${BLUE}Step 3: Running mobile workflow tests...${NC}"

# Run coverage if requested
if [ "$1" == "--coverage" ]; then
    echo -e "${BLUE}Running tests with coverage report...${NC}"
    timeout 60 pnpm vitest run --coverage --reporter=verbose || {
        echo -e "${RED}Test execution timed out or failed${NC}"
        pkill -f vitest || true
        exit 1
    }
elif [ "$1" == "--ui" ]; then
    echo -e "${BLUE}Opening Vitest UI...${NC}"
    echo -e "${YELLOW}Note: UI mode should be used interactively, not in scripts${NC}"
    pnpm vitest --ui --no-open
else
    # Default: run tests once with timeout
    timeout 60 pnpm vitest run --reporter=verbose || {
        echo -e "${RED}Test execution timed out or failed${NC}"
        pkill -f vitest || true
        exit 1
    }
fi

# Cleanup any lingering processes
pkill -f vitest || true

echo ""
echo -e "${GREEN}=========================================="
echo -e "   Mobile Tests Completed Successfully!   "
echo -e "==========================================${NC}"
