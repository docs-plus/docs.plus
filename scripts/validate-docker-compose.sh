#!/usr/bin/env bash
# =============================================================================
# Validate Docker Compose Configuration
# Checks that all services are properly configured and cohesive
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Validating docker-compose.prod.yml configuration..."
echo ""

# Check if file exists
if [ ! -f docker-compose.prod.yml ]; then
  echo -e "${RED}❌ docker-compose.prod.yml not found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ docker-compose.prod.yml found${NC}"

# Validate compose file syntax
echo ""
echo "📋 Validating compose file syntax..."
if docker compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Compose file syntax valid${NC}"
else
  echo -e "${RED}❌ Compose file syntax invalid${NC}"
  docker compose -f docker-compose.prod.yml config 2>&1 | head -20
  exit 1
fi

# Check service definitions
echo ""
echo "📦 Checking service definitions..."

EXPECTED_SERVICES=("traefik" "redis" "rest-api" "hocuspocus-server" "hocuspocus-worker" "webapp" "admin-dashboard")
for service in "${EXPECTED_SERVICES[@]}"; do
  if docker compose -f docker-compose.prod.yml config --services | grep -q "^${service}$"; then
    echo -e "${GREEN}  ✅ $service defined${NC}"
  else
    echo -e "${RED}  ❌ $service missing${NC}"
    exit 1
  fi
done

# Check image names
echo ""
echo "🏷️  Validating image names..."

check_image() {
  local service=$1
  local expected=$2
  local actual=$(docker compose -f docker-compose.prod.yml config | grep -A 1 "^  ${service}:" | grep "image:" | awk '{print $2}' | cut -d':' -f1)

  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}  ✅ $service: $actual${NC}"
  else
    echo -e "${RED}  ❌ $service: expected '$expected', got '$actual'${NC}"
    exit 1
  fi
}

check_image "rest-api" "docsplus-rest-api"
check_image "hocuspocus-server" "docsplus-hocuspocus"
check_image "hocuspocus-worker" "docsplus-hocuspocus"
check_image "webapp" "docsplus-webapp"

# Check commands
echo ""
echo "⚙️  Validating service commands..."

check_command() {
  local service=$1
  local expected=$2
  local actual=$(docker compose -f docker-compose.prod.yml config | grep -A 20 "^  ${service}:" | grep "command:" -A 1 | tail -1 | sed 's/^[[:space:]]*//' | sed 's/^- //')

  if [[ "$actual" == *"$expected"* ]]; then
    echo -e "${GREEN}  ✅ $service: $expected${NC}"
  else
    echo -e "${RED}  ❌ $service: expected '$expected' in command${NC}"
    echo "     Got: $actual"
    exit 1
  fi
}

check_command "rest-api" "index.ts"
check_command "hocuspocus-server" "hocuspocus.server.ts"
check_command "hocuspocus-worker" "hocuspocus.worker.ts"

# Check health checks
echo ""
echo "🏥 Validating health checks..."

check_healthcheck() {
  local service=$1
  local port=$2
  local config=$(docker compose -f docker-compose.prod.yml config)

  if echo "$config" | grep -A 30 "^  ${service}:" | grep -q "healthcheck:"; then
    if echo "$config" | grep -A 30 "^  ${service}:" | grep -q "localhost:${port}"; then
      echo -e "${GREEN}  ✅ $service: healthcheck on port $port${NC}"
    else
      echo -e "${YELLOW}  ⚠️  $service: healthcheck exists but port may not match${NC}"
    fi
  else
    echo -e "${RED}  ❌ $service: no healthcheck defined${NC}"
    exit 1
  fi
}

check_healthcheck "rest-api" "4000"
check_healthcheck "hocuspocus-server" "4001"
check_healthcheck "hocuspocus-worker" "4002"
check_healthcheck "webapp" "3000"
check_healthcheck "admin-dashboard" "3100"

# Check graceful shutdown
echo ""
echo "🛑 Validating graceful shutdown configuration..."

check_grace_period() {
  local service=$1
  local config=$(docker compose -f docker-compose.prod.yml config)

  if echo "$config" | grep -A 30 "^  ${service}:" | grep -q "stop_grace_period:"; then
    local period=$(echo "$config" | grep -A 30 "^  ${service}:" | grep "stop_grace_period:" | awk '{print $2}')
    echo -e "${GREEN}  ✅ $service: stop_grace_period=$period${NC}"
  else
    echo -e "${RED}  ❌ $service: stop_grace_period not configured${NC}"
    exit 1
  fi

  if echo "$config" | grep -A 30 "^  ${service}:" | grep -q "stop_signal: SIGTERM"; then
    echo -e "${GREEN}  ✅ $service: stop_signal=SIGTERM${NC}"
  else
    echo -e "${YELLOW}  ⚠️  $service: stop_signal not explicitly set (defaults to SIGTERM)${NC}"
  fi
}

check_grace_period "rest-api"
check_grace_period "hocuspocus-server"
check_grace_period "hocuspocus-worker"
check_grace_period "webapp"
check_grace_period "admin-dashboard"

# Check dependencies
echo ""
echo "🔗 Validating service dependencies..."

check_dependency() {
  local service=$1
  local depends_on=$2
  local config=$(docker compose -f docker-compose.prod.yml config)

  if echo "$config" | grep -A 20 "^  ${service}:" | grep -A 5 "depends_on:" | grep -q "$depends_on"; then
    echo -e "${GREEN}  ✅ $service depends on $depends_on${NC}"
  else
    echo -e "${RED}  ❌ $service missing dependency on $depends_on${NC}"
    exit 1
  fi
}

check_dependency "rest-api" "redis"
check_dependency "hocuspocus-server" "redis"
check_dependency "hocuspocus-worker" "redis"

# Check Traefik labels
echo ""
echo "🔀 Validating Traefik routing..."

check_traefik_route() {
  local service=$1
  local host=$2
  local config=$(docker compose -f docker-compose.prod.yml config)

  if echo "$config" | grep -A 50 "^  ${service}:" | grep "traefik.enable" | grep -q "true"; then
    if echo "$config" | grep -A 50 "^  ${service}:" | grep "traefik.http.routers" | grep -q "$host"; then
      echo -e "${GREEN}  ✅ $service: Traefik routes to $host${NC}"
    else
      echo -e "${YELLOW}  ⚠️  $service: Traefik enabled but host pattern may differ${NC}"
    fi
  else
    echo -e "${YELLOW}  ⚠️  $service: Traefik not enabled${NC}"
  fi
}

check_traefik_route "rest-api" "prodback.docs.plus"
check_traefik_route "hocuspocus-server" "prodback.docs.plus"
check_traefik_route "webapp" "docs.plus"
check_traefik_route "admin-dashboard" "admin.docs.plus"

# Check network
echo ""
echo "🌐 Validating network configuration..."

if docker compose -f docker-compose.prod.yml config | grep -A 5 "^networks:" | grep -q "docsplus-network"; then
  echo -e "${GREEN}✅ Network 'docsplus-network' configured${NC}"
else
  echo -e "${RED}❌ Network 'docsplus-network' not found${NC}"
  exit 1
fi

# Check volumes
echo ""
echo "💾 Validating volumes..."

if docker compose -f docker-compose.prod.yml config | grep -A 10 "^volumes:" | grep -q "traefik-certs"; then
  echo -e "${GREEN}✅ Volume 'traefik-certs' configured${NC}"
else
  echo -e "${RED}❌ Volume 'traefik-certs' not found${NC}"
  exit 1
fi

if docker compose -f docker-compose.prod.yml config | grep -A 10 "^volumes:" | grep -q "redis-data"; then
  echo -e "${GREEN}✅ Volume 'redis-data' configured${NC}"
else
  echo -e "${RED}❌ Volume 'redis-data' not found${NC}"
  exit 1
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ ALL VALIDATION CHECKS PASSED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration is:"
echo "  ✅ Syntactically valid"
echo "  ✅ Services properly defined"
echo "  ✅ Images correctly named"
echo "  ✅ Commands properly set"
echo "  ✅ Health checks configured"
echo "  ✅ Graceful shutdown enabled"
echo "  ✅ Dependencies correct"
echo "  ✅ Traefik routing configured"
echo "  ✅ Networks and volumes defined"
echo ""
echo "Ready for deployment! 🚀"

