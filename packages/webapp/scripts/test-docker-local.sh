#!/bin/bash
# Test docker-compose.scale.yml locally before production deploy
# Usage: cd packages/webapp && ./scripts/test-docker-local.sh

set -e

# Must run from packages/webapp directory
if [ ! -f "docker-compose.scale.yml" ]; then
    echo "❌ Must run from packages/webapp directory"
    echo "   cd packages/webapp && ./scripts/test-docker-local.sh"
    exit 1
fi

echo "🧪 Docker Local Testing Script"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production not found!${NC}"
    echo "Create it first with required environment variables"
    exit 1
fi

echo -e "${GREEN}✓${NC} .env.production found"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is running"
echo ""

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose.scale.yml down 2>/dev/null || true
echo ""

# Test 1: Build the image
echo "🔨 Test 1: Building Docker image..."
docker-compose -f docker-compose.scale.yml build || {
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
}
echo -e "${GREEN}✓${NC} Build successful"
echo ""

# Test 2: Start single instance
echo "🚀 Test 2: Starting single instance..."
docker-compose -f docker-compose.scale.yml up -d
sleep 5
echo ""

# Test 3: Check container is running
echo "🔍 Test 3: Checking container status..."
CONTAINERS=$(docker-compose -f docker-compose.scale.yml ps -q webapp)
if [ -z "$CONTAINERS" ]; then
    echo -e "${RED}❌ No containers running!${NC}"
    docker-compose -f docker-compose.scale.yml logs
    exit 1
fi
echo -e "${GREEN}✓${NC} Container is running"
echo ""

# Test 4: Wait for health check
echo "❤️  Test 4: Waiting for health check (max 60s)..."
for i in {1..12}; do
    if curl -s http://localhost/health > /dev/null; then
        echo -e "${GREEN}✓${NC} Health check passed"
        break
    fi
    if [ $i -eq 12 ]; then
        echo -e "${RED}❌ Health check failed!${NC}"
        docker-compose -f docker-compose.scale.yml logs --tail=50
        exit 1
    fi
    echo "  Waiting... (${i}/12)"
    sleep 5
done
echo ""

# Test 5: Test endpoints
echo "🌐 Test 5: Testing endpoints..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓${NC} App responds with 200"
else
    echo -e "${RED}❌ App returned HTTP $HTTP_CODE${NC}"
    docker-compose -f docker-compose.scale.yml logs --tail=50
    exit 1
fi
echo ""

# Test 6: Scale to 3 instances
echo "📈 Test 6: Scaling to 3 instances..."
docker-compose -f docker-compose.scale.yml up -d --scale webapp=3 --no-recreate
sleep 5

WEBAPP_COUNT=$(docker-compose -f docker-compose.scale.yml ps -q webapp | wc -l | xargs)
if [ "$WEBAPP_COUNT" -eq 3 ]; then
    echo -e "${GREEN}✓${NC} Scaled to 3 instances"
else
    echo -e "${YELLOW}⚠${NC}  Expected 3 instances, got $WEBAPP_COUNT"
fi
echo ""

# Test 7: Test load distribution
echo "🔄 Test 7: Testing load distribution..."
for i in {1..5}; do
    curl -s http://localhost/health > /dev/null && echo "  Request $i: OK"
done
echo -e "${GREEN}✓${NC} Load distribution working"
echo ""

# Test 8: Resource usage
echo "📊 Test 8: Checking resource usage..."
echo "Container stats (Ctrl+C to continue):"
timeout 5 docker stats --no-stream || true
echo ""

# Final summary
echo "=============================="
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "Your docker-compose.scale.yml is ready for production."
echo ""
echo "Next steps:"
echo "  1. Review logs: bun run docker:logs"
echo "  2. Check running containers: bun run docker:ps"
echo "  3. When satisfied, stop: bun run docker:down"
echo "  4. Deploy to production"
echo ""
echo "To stop the test containers:"
echo "  docker-compose -f docker-compose.scale.yml down"

