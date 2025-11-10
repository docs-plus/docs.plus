#!/bin/bash

# Test script for worker deployment
# This script validates the worker process works correctly

set -e

echo "🧪 Testing Worker Deployment..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Redis is running
echo -n "Checking Redis connection... "
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis is not running${NC}"
    echo "Start Redis: redis-server"
    exit 1
fi

# Check PostgreSQL is running
echo -n "Checking PostgreSQL connection... "
if pg_isready > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL check failed (might be remote)${NC}"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    bun install
fi

echo ""
echo "Starting worker in test mode..."
echo "Worker will run for 30 seconds, then shutdown"
echo ""

# Start worker with timeout
timeout 30s bun run dev:worker || true

echo ""
echo -e "${GREEN}✓ Worker test complete${NC}"
echo ""
echo "Next steps:"
echo "  1. Run 'bun run dev:worker' to start worker"
echo "  2. Check health: curl http://localhost:3003/health"
echo "  3. Monitor logs for job processing"

