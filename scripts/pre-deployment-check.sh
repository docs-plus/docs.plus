#!/usr/bin/env bash
# =============================================================================
# Pre-Deployment Checklist Script
# Run this BEFORE deploying to ensure everything is ready
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 PRE-DEPLOYMENT CHECKLIST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

check_pass() {
  echo -e "${GREEN}✅ $1${NC}"
  ((CHECKS_PASSED++))
}

check_fail() {
  echo -e "${RED}❌ $1${NC}"
  ((CHECKS_FAILED++))
}

check_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
  ((CHECKS_WARNING++))
}

check_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# =============================================================================
# 1. FILE EXISTENCE CHECKS
# =============================================================================
echo "📁 Checking required files..."

if [ -f "docker-compose.prod.yml" ]; then
  check_pass "docker-compose.prod.yml exists"
else
  check_fail "docker-compose.prod.yml NOT found"
  exit 1
fi

if [ -f ".env.production" ]; then
  check_pass ".env.production exists"
else
  check_warn ".env.production NOT found (required on VPS)"
fi

if [ -f "Makefile" ]; then
  check_pass "Makefile exists"
else
  check_fail "Makefile NOT found"
fi

if [ -f ".github/workflows/prod.docs.plus.yml" ]; then
  check_pass "GitHub Actions workflow exists"
else
  check_warn "CI/CD workflow NOT found"
fi

if [ -f "packages/hocuspocus.server/docker/Dockerfile.bun" ]; then
  check_pass "Hocuspocus Dockerfile exists"
else
  check_fail "Hocuspocus Dockerfile NOT found"
fi

if [ -f "packages/webapp/docker/Dockerfile.bun" ]; then
  check_pass "Webapp Dockerfile exists"
else
  check_fail "Webapp Dockerfile NOT found"
fi

echo ""

# =============================================================================
# 2. DOCKER COMPOSE SYNTAX
# =============================================================================
echo "📋 Validating Docker Compose syntax..."

if docker compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
  check_pass "Docker Compose syntax valid"
else
  check_fail "Docker Compose syntax INVALID"
  docker compose -f docker-compose.prod.yml config 2>&1 | tail -20
  exit 1
fi

echo ""

# =============================================================================
# 3. SERVICE DEFINITIONS
# =============================================================================
echo "🔧 Checking service definitions..."

SERVICES=$(docker compose -f docker-compose.prod.yml config --services 2>/dev/null)

for service in traefik redis rest-api hocuspocus-server hocuspocus-worker webapp admin-dashboard; do
  if echo "$SERVICES" | grep -q "^${service}$"; then
    check_pass "Service '$service' defined"
  else
    check_fail "Service '$service' MISSING"
  fi
done

echo ""

# =============================================================================
# 4. IMAGE NAMES
# =============================================================================
echo "🏷️  Verifying image names..."

CONFIG=$(docker compose -f docker-compose.prod.yml config 2>/dev/null)

check_image() {
  local service=$1
  local expected=$2

  if echo "$CONFIG" | grep -A 5 "name: ${service}" | grep -q "image:.*${expected}"; then
    check_pass "$service uses $expected image"
  else
    check_warn "$service image name may not match expected pattern"
  fi
}

check_image "rest-api" "docsplus-rest-api"
check_image "hocuspocus-server" "docsplus-hocuspocus"
check_image "hocuspocus-worker" "docsplus-hocuspocus"
check_image "webapp" "docsplus-webapp"
check_image "admin-dashboard" "docsplus-admin"

echo ""

# =============================================================================
# 5. HEALTH CHECKS
# =============================================================================
echo "🏥 Verifying health checks..."

for service in rest-api hocuspocus-server hocuspocus-worker webapp admin-dashboard; do
  if echo "$CONFIG" | grep -A 30 "name: ${service}" | grep -q "healthcheck:"; then
    check_pass "$service has healthcheck"
  else
    check_fail "$service MISSING healthcheck"
  fi
done

echo ""

# =============================================================================
# 6. GRACEFUL SHUTDOWN
# =============================================================================
echo "🛑 Checking graceful shutdown config..."

for service in rest-api hocuspocus-server hocuspocus-worker webapp admin-dashboard; do
  if echo "$CONFIG" | grep -A 30 "name: ${service}" | grep -q "stop_grace_period:"; then
    check_pass "$service has stop_grace_period"
  else
    check_fail "$service MISSING stop_grace_period"
  fi
done

echo ""

# =============================================================================
# 7. ENTRY POINTS
# =============================================================================
echo "⚙️  Checking service entry points..."

check_entry() {
  local service=$1
  local file=$2

  if echo "$CONFIG" | grep -A 30 "name: ${service}" | grep -q "$file"; then
    check_pass "$service → $file"
  else
    check_warn "$service entry point may differ"
  fi
}

check_entry "rest-api" "index.ts"
check_entry "hocuspocus-server" "hocuspocus.server.ts"
check_entry "hocuspocus-worker" "hocuspocus.worker.ts"

echo ""

# =============================================================================
# 8. DEPENDENCIES
# =============================================================================
echo "🔗 Checking service dependencies..."

for service in rest-api hocuspocus-server hocuspocus-worker; do
  if echo "$CONFIG" | grep -A 20 "name: ${service}" | grep -A 5 "depends_on:" | grep -q "redis"; then
    check_pass "$service depends on redis"
  else
    check_fail "$service MISSING redis dependency"
  fi
done

echo ""

# =============================================================================
# 9. NETWORK & VOLUMES
# =============================================================================
echo "🌐 Checking network and volumes..."

if echo "$CONFIG" | grep -q "docsplus-network"; then
  check_pass "Network 'docsplus-network' configured"
else
  check_fail "Network 'docsplus-network' MISSING"
fi

if echo "$CONFIG" | grep -q "traefik-certs"; then
  check_pass "Volume 'traefik-certs' configured"
else
  check_fail "Volume 'traefik-certs' MISSING"
fi

if echo "$CONFIG" | grep -q "redis-data"; then
  check_pass "Volume 'redis-data' configured"
else
  check_fail "Volume 'redis-data' MISSING"
fi

echo ""

# =============================================================================
# 10. TRAEFIK ROUTING
# =============================================================================
echo "🔀 Checking Traefik routing..."

if echo "$CONFIG" | grep -A 50 "name: webapp" | grep -q "docs.plus"; then
  check_pass "Webapp routes to docs.plus"
else
  check_warn "Webapp Traefik routing may need verification"
fi

if echo "$CONFIG" | grep -A 50 "name: rest-api" | grep -q "prodback.docs.plus"; then
  check_pass "REST API routes to prodback.docs.plus"
else
  check_warn "REST API Traefik routing may need verification"
fi

if echo "$CONFIG" | grep -A 50 "name: hocuspocus-server" | grep -q "prodback.docs.plus"; then
  check_pass "Hocuspocus routes to prodback.docs.plus"
else
  check_warn "Hocuspocus Traefik routing may need verification"
fi

if echo "$CONFIG" | grep -A 50 "name: admin-dashboard" | grep -q "admin.docs.plus"; then
  check_pass "Admin dashboard routes to admin.docs.plus"
else
  check_warn "Admin dashboard Traefik routing may need verification"
fi

echo ""

# =============================================================================
# 11. DOCKER AVAILABILITY
# =============================================================================
echo "🐳 Checking Docker..."

if command -v docker >/dev/null 2>&1; then
  check_pass "Docker installed"

  if docker info >/dev/null 2>&1; then
    check_pass "Docker daemon running"
  else
    check_fail "Docker daemon NOT running"
  fi
else
  check_fail "Docker NOT installed"
fi

echo ""

# =============================================================================
# 12. MAKEFILE COMMANDS
# =============================================================================
echo "📝 Checking Makefile commands..."

if grep -q "deploy-prod:" Makefile; then
  check_pass "make deploy-prod command exists"
else
  check_fail "make deploy-prod command MISSING"
fi

if grep -q "docker compose" Makefile; then
  check_pass "Makefile uses 'docker compose' (v2)"
else
  check_warn "Makefile may use old 'docker-compose' syntax"
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Passed:  $CHECKS_PASSED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $CHECKS_WARNING${NC}"
echo -e "${RED}❌ Failed:  $CHECKS_FAILED${NC}"
echo ""

if [ "$CHECKS_FAILED" -gt 0 ]; then
  echo -e "${RED}❌ DEPLOYMENT NOT READY${NC}"
  echo "Please fix the failed checks before deploying."
  exit 1
elif [ "$CHECKS_WARNING" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  WARNINGS DETECTED${NC}"
  echo "Review warnings before deploying. Deployment may still work."
  echo ""
  echo "Continue? (y/n)"
  read -r response
  if [[ "$response" != "y" && "$response" != "Y" ]]; then
    echo "Deployment cancelled."
    exit 0
  fi
else
  echo -e "${GREEN}✅ ALL CHECKS PASSED - READY TO DEPLOY!${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DEPLOYMENT OPTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Option 1: Via Makefile (Recommended)"
echo "  $ make deploy-prod"
echo ""
echo "Option 2: Via Fix Script (First Time)"
echo "  $ ./scripts/fix-production-images.sh"
echo ""
echo "Option 3: Via CI/CD"
echo "  $ git commit -m 'build: front+back - deploy'"
echo "  $ git push"
echo ""
echo "Option 4: Manual"
echo "  $ docker compose -f docker-compose.prod.yml --env-file .env.production build"
echo "  $ docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate --scale rest-api=2 --scale hocuspocus-server=2 --scale hocuspocus-worker=1 --scale webapp=2"
echo ""

