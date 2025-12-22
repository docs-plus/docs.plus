#!/usr/bin/env bash
# =============================================================================
# Emergency Rollback Script
# Use this if deployment fails and services are unhealthy
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 EMERGENCY ROLLBACK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f docker-compose.prod.yml ]; then
  echo -e "${RED}❌ docker-compose.prod.yml not found${NC}"
  exit 1
fi

if [ ! -f .env.production ]; then
  echo -e "${RED}❌ .env.production not found${NC}"
  exit 1
fi

# Check current deployment tag
CURRENT_TAG=$(grep "DEPLOY_TAG=" .env.production | cut -d'=' -f2 || echo "latest")
echo -e "${YELLOW}Current DEPLOY_TAG: $CURRENT_TAG${NC}"
echo ""

# List available image tags
echo "📦 Available images:"
echo ""
docker images docsplus-webapp --format "table {{.Tag}}\t{{.CreatedAt}}" | head -10
echo ""

# Ask for rollback target
echo "Choose rollback strategy:"
echo ""
echo "1) Roll back to previous image tag"
echo "2) Restart all services (keep current images)"
echo "3) Force recreate all services"
echo "4) Cancel"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
  1)
    echo ""
    echo "Available image tags:"
    docker images docsplus-webapp --format "{{.Tag}}" | grep -v "$CURRENT_TAG" | grep -v "latest" | head -5
    echo ""
    read -p "Enter tag to rollback to: " ROLLBACK_TAG

    if [ -z "$ROLLBACK_TAG" ]; then
      echo -e "${RED}❌ No tag specified${NC}"
      exit 1
    fi

    echo ""
    echo -e "${YELLOW}⚠️  Rolling back to tag: $ROLLBACK_TAG${NC}"
    echo "This will:"
    echo "  1. Update DEPLOY_TAG in .env.production"
    echo "  2. Restart all services with old images"
    echo ""
    read -p "Continue? (y/n): " confirm

    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
      echo "Rollback cancelled"
      exit 0
    fi

    # Backup current .env.production
    cp .env.production .env.production.backup.$(date +%s)

    # Update DEPLOY_TAG
    if grep -q "DEPLOY_TAG=" .env.production; then
      sed -i.bak "s/DEPLOY_TAG=.*/DEPLOY_TAG=$ROLLBACK_TAG/" .env.production
    else
      echo "DEPLOY_TAG=$ROLLBACK_TAG" >> .env.production
    fi

    echo ""
    echo "🔄 Restarting services with tag: $ROLLBACK_TAG..."

    docker compose -f docker-compose.prod.yml --env-file .env.production up -d \
      --no-build \
      --force-recreate \
      --scale rest-api=2 \
      --scale hocuspocus-server=2 \
      --scale hocuspocus-worker=1 \
      --scale webapp=2

    echo ""
    echo -e "${GREEN}✅ Rollback initiated${NC}"
    ;;

  2)
    echo ""
    echo -e "${YELLOW}⚠️  Restarting all services (no image change)${NC}"
    echo ""
    read -p "Continue? (y/n): " confirm

    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
      echo "Restart cancelled"
      exit 0
    fi

    docker compose -f docker-compose.prod.yml --env-file .env.production restart

    echo ""
    echo -e "${GREEN}✅ Services restarted${NC}"
    ;;

  3)
    echo ""
    echo -e "${YELLOW}⚠️  Force recreating all services${NC}"
    echo "This will cause brief downtime (~10-30s)"
    echo ""
    read -p "Continue? (y/n): " confirm

    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
      echo "Recreate cancelled"
      exit 0
    fi

    docker compose -f docker-compose.prod.yml --env-file .env.production up -d \
      --force-recreate \
      --scale rest-api=2 \
      --scale hocuspocus-server=2 \
      --scale hocuspocus-worker=1 \
      --scale webapp=2

    echo ""
    echo -e "${GREEN}✅ Services recreated${NC}"
    ;;

  4)
    echo "Cancelled"
    exit 0
    ;;

  *)
    echo -e "${RED}❌ Invalid choice${NC}"
    exit 1
    ;;
esac

# Wait for services to stabilize
echo ""
echo "⏳ Waiting for services to stabilize (30s)..."
sleep 30

# Check health
echo ""
echo "🩺 Checking service health..."
echo ""

HEALTHY=0
TOTAL=0

for service in rest-api hocuspocus-server hocuspocus-worker webapp; do
  COUNT=$(docker ps --filter "label=com.docker.compose.service=${service}" -q | wc -l | tr -d ' ')
  HEALTHY_COUNT=$(docker ps --filter "label=com.docker.compose.service=${service}" --filter "health=healthy" -q | wc -l | tr -d ' ')

  TOTAL=$((TOTAL + COUNT))
  HEALTHY=$((HEALTHY + HEALTHY_COUNT))

  if [ "$HEALTHY_COUNT" -ge 1 ]; then
    echo -e "${GREEN}✅ $service: $HEALTHY_COUNT/$COUNT healthy${NC}"
  else
    echo -e "${RED}❌ $service: $HEALTHY_COUNT/$COUNT healthy${NC}"
  fi
done

echo ""
echo "Overall: $HEALTHY/$TOTAL containers healthy"

if [ "$HEALTHY" -ge 6 ]; then
  echo ""
  echo -e "${GREEN}✅ ROLLBACK SUCCESSFUL${NC}"
  echo ""
  echo "Test endpoints:"
  echo "  curl -I https://docs.plus"
  echo "  curl https://prodback.docs.plus/api/health"
else
  echo ""
  echo -e "${RED}❌ ROLLBACK MAY HAVE ISSUES${NC}"
  echo ""
  echo "Debug commands:"
  echo "  docker ps -a"
  echo "  docker compose -f docker-compose.prod.yml --env-file .env.production logs -f"
  echo ""
  echo "Manual recovery:"
  echo "  docker compose -f docker-compose.prod.yml --env-file .env.production down"
  echo "  docker compose -f docker-compose.prod.yml --env-file .env.production up -d"
fi

echo ""
echo "Current running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep -E "(traefik|docsplus)"

