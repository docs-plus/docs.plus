#!/bin/bash

# ============================================================================
# Production Status Check Script — Traefik + Docker Compose
# ============================================================================
#
# Shows health and resource usage for the docsplus production stack.
#
# Usage:
#   ./scripts/status-prod.sh
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   PRODUCTION STATUS CHECK${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ============================================================================
# Infrastructure
# ============================================================================
echo -e "${BLUE}🏗️  INFRASTRUCTURE${NC}"
echo "---"

for svc in traefik docsplus-redis; do
  STATUS=$(docker ps --filter "name=$svc" --filter "status=running" --format "{{.Status}}" | head -1)
  if [ -n "$STATUS" ]; then
    echo -e "${GREEN}  ✅ $svc: $STATUS${NC}"
  else
    echo -e "${RED}  ❌ $svc: NOT running${NC}"
  fi
done

echo ""

# ============================================================================
# Service Health
# ============================================================================
echo -e "${BLUE}📦 SERVICE HEALTH${NC}"
echo "---"

for svc in webapp rest-api hocuspocus-server hocuspocus-worker admin-dashboard; do
  RUNNING=$(docker ps --filter "label=com.docker.compose.service=${svc}" --filter "status=running" -q | wc -l | tr -d ' ')
  HEALTHY=$(docker ps --filter "label=com.docker.compose.service=${svc}" --filter "health=healthy" -q | wc -l | tr -d ' ')

  if [ "$RUNNING" -gt 0 ]; then
    if [ "$HEALTHY" -eq "$RUNNING" ]; then
      echo -e "${GREEN}  ✅ $svc: $HEALTHY/$RUNNING healthy${NC}"
    else
      echo -e "${YELLOW}  ⚠️  $svc: $HEALTHY/$RUNNING healthy${NC}"
    fi
  else
    echo -e "${RED}  ❌ $svc: NOT running${NC}"
  fi
done

echo ""

# ============================================================================
# Endpoint Checks
# ============================================================================
echo -e "${BLUE}🌐 ENDPOINT CHECKS${NC}"
echo "---"

check_endpoint() {
  local url=$1
  local label=$2
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$url" --max-time 5 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}  ✅ $label → $HTTP_CODE${NC}"
  else
    echo -e "${RED}  ❌ $label → $HTTP_CODE${NC}"
  fi
}

check_endpoint "https://docs.plus/" "https://docs.plus"
check_endpoint "https://prodback.docs.plus/api/health" "REST API health"
check_endpoint "https://admin.docs.plus/" "Admin dashboard"

echo ""

# ============================================================================
# Resource Usage
# ============================================================================
echo -e "${BLUE}📊 RESOURCE USAGE${NC}"
echo "---"

# Disk
echo -e "${CYAN}Disk:${NC}"
df -h / | tail -1

# Memory
echo -e "\n${CYAN}Memory:${NC}"
free -h 2>/dev/null | grep Mem || echo "  (not available on macOS)"

# Docker container stats
CONTAINERS=$(docker ps --filter "label=com.docker.compose.project=docsplus" -q 2>/dev/null)
if [ -n "$CONTAINERS" ]; then
  echo -e "\n${CYAN}Docker:${NC}"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" $CONTAINERS 2>/dev/null | head -15
fi

echo ""
echo -e "${CYAN}========================================${NC}"
