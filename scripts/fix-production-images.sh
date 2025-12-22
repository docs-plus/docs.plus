#!/usr/bin/env bash
# =============================================================================
# Fix Production - Rebuild with correct image names
# =============================================================================
set -euo pipefail

echo "🔧 Fixing production deployment..."
echo ""

# Check if we're in the right directory
if [ ! -f docker-compose.prod.yml ]; then
  echo "❌ docker-compose.prod.yml not found"
  exit 1
fi

if [ ! -f .env.production ]; then
  echo "❌ .env.production not found"
  exit 1
fi

# Create network if not exists
echo "📡 Ensuring network exists..."
docker network create docsplus-network 2>/dev/null || echo "   Network already exists"

# Build images with correct names
echo ""
echo "🏗️  Building images (this will take a few minutes)..."
docker compose -f docker-compose.prod.yml --env-file .env.production build --parallel

# Deploy with force-recreate to use new images
echo ""
echo "🚀 Deploying services..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d \
  --force-recreate \
  --scale rest-api=2 \
  --scale hocuspocus-server=2 \
  --scale hocuspocus-worker=1 \
  --scale webapp=2

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

for i in {1..30}; do
  HEALTHY=$(docker ps --filter "health=healthy" --filter "label=com.docker.compose.project=docsplus" -q | wc -l)
  echo "   ... $HEALTHY/7 healthy containers"

  if [ "$HEALTHY" -ge 7 ]; then
    echo "✅ All services healthy"
    break
  fi

  if [ $i -eq 30 ]; then
    echo "⚠️ Not all services healthy after 90s, check logs"
  fi

  sleep 3
done

# Show status
echo ""
echo "📊 Current status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep -E "(traefik|docsplus)"

echo ""
echo "✅ Deployment complete"
echo ""
echo "Verify:"
echo "  curl -I https://docs.plus"
echo "  curl -I https://prodback.docs.plus/api/health"

