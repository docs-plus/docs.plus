#!/bin/bash

# ============================================================================
# Production Status Check Script - Docker Compose Version
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
# Deployment Status
# ============================================================================
echo -e "${BLUE}🚀 DEPLOYMENT STATUS${NC}"
echo "---"

# Check which color is active
if docker ps --format '{{.Names}}' | grep -q "^prod-blue-"; then
    echo -e "${GREEN}✅ BLUE stack is ACTIVE${NC}"
    ACTIVE_COLOR="blue"
    ACTIVE_PORT=3001
elif docker ps --format '{{.Names}}' | grep -q "^prod-green-"; then
    echo -e "${GREEN}✅ GREEN stack is ACTIVE${NC}"
    ACTIVE_COLOR="green"
    ACTIVE_PORT=3011
else
    echo -e "${RED}❌ No active deployment found${NC}"
    ACTIVE_COLOR="none"
fi

if [ "$ACTIVE_COLOR" != "none" ]; then
    echo -e "${CYAN}Active Stack:${NC} prod-$ACTIVE_COLOR"
    echo -e "${CYAN}Frontend Port:${NC} $ACTIVE_PORT"
fi

echo ""

# ============================================================================
# Container Status
# ============================================================================
echo -e "${BLUE}📦 CONTAINER STATUS${NC}"
echo "---"

if [ "$ACTIVE_COLOR" != "none" ]; then
    docker ps --filter "name=prod-$ACTIVE_COLOR-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo -e "${YELLOW}⚠️  No containers found${NC}"
fi

echo ""

# ============================================================================
# Infrastructure Status
# ============================================================================
echo -e "${BLUE}🏗️  INFRASTRUCTURE STATUS${NC}"
echo "---"

# Redis
if docker ps --format '{{.Names}}' | grep -q "prod-docsplus-redis"; then
    echo -e "${GREEN}✅ Redis: Running${NC}"

    if docker exec prod-docsplus-redis redis-cli ping &> /dev/null | grep -q PONG; then
        echo -e "${GREEN}   └─ Health: OK${NC}"
    else
        echo -e "${RED}   └─ Health: FAILED${NC}"
    fi
else
    echo -e "${RED}❌ Redis: Not Running${NC}"
fi

echo ""

# ============================================================================
# Health Checks
# ============================================================================
echo -e "${BLUE}🩺 HEALTH CHECKS${NC}"
echo "---"

if [ "$ACTIVE_COLOR" != "none" ]; then
    # Frontend
    WEBAPP=$(docker ps --filter "name=prod-$ACTIVE_COLOR-webapp" --format "{{.Names}}" | head -1)
    if [ -n "$WEBAPP" ]; then
        if docker exec $WEBAPP bun -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" &> /dev/null; then
            echo -e "${GREEN}✅ Frontend: Healthy${NC}"
        else
            echo -e "${RED}❌ Frontend: Unhealthy${NC}"
        fi
    fi

    # REST API
    REST=$(docker ps --filter "name=prod-$ACTIVE_COLOR-rest-api" --format "{{.Names}}" | head -1)
    if [ -n "$REST" ]; then
        if docker exec $REST bun -e "fetch('http://localhost:4000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" &> /dev/null; then
            echo -e "${GREEN}✅ REST API: Healthy${NC}"
        else
            echo -e "${RED}❌ REST API: Unhealthy${NC}"
        fi
    fi

    # WebSocket
    WS=$(docker ps --filter "name=prod-$ACTIVE_COLOR-hocuspocus-server" --format "{{.Names}}" | head -1)
    if [ -n "$WS" ]; then
        if docker exec $WS bun -e "fetch('http://localhost:4001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" &> /dev/null; then
            echo -e "${GREEN}✅ WebSocket: Healthy${NC}"
        else
            echo -e "${RED}❌ WebSocket: Unhealthy${NC}"
        fi
    fi

    # Worker
    WORKER=$(docker ps --filter "name=prod-$ACTIVE_COLOR-hocuspocus-worker" --format "{{.Names}}" | head -1)
    if [ -n "$WORKER" ]; then
        if docker exec $WORKER bun -e "fetch('http://localhost:4002/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" &> /dev/null; then
            echo -e "${GREEN}✅ Worker: Healthy${NC}"
        else
            echo -e "${RED}❌ Worker: Unhealthy${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  No active deployment${NC}"
fi

echo ""

# ============================================================================
# Nginx Status
# ============================================================================
echo -e "${BLUE}🌐 NGINX STATUS${NC}"
echo "---"

if systemctl is-active --quiet nginx 2>/dev/null || pgrep nginx > /dev/null; then
    echo -e "${GREEN}✅ Nginx: Running${NC}"

    # Show current upstream
    if [ -f "/etc/nginx/sites-available/docs.plus" ]; then
        echo -e "\n${CYAN}Frontend Upstream:${NC}"
        grep "server localhost" /etc/nginx/sites-available/docs.plus 2>/dev/null || echo "Config not found"
    fi
else
    echo -e "${RED}❌ Nginx: Not Running${NC}"
fi

echo ""

# ============================================================================
# Resource Usage
# ============================================================================
echo -e "${BLUE}📊 RESOURCE USAGE${NC}"
echo "---"

# Disk
echo -e "${CYAN}Disk Usage:${NC}"
df -h / | tail -1

# Memory
echo -e "\n${CYAN}Memory Usage:${NC}"
free -h 2>/dev/null | grep Mem || echo "Memory stats not available"

# Docker stats
if [ "$ACTIVE_COLOR" != "none" ]; then
    echo -e "\n${CYAN}Docker Resources (Active Stack):${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        $(docker ps --filter "name=prod-$ACTIVE_COLOR-" -q) 2>/dev/null | head -10
fi

echo ""
echo -e "${CYAN}========================================${NC}"
