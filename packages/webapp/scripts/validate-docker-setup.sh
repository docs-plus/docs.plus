#!/bin/bash

# Validation script for Docker setup
# Checks all required files and dependencies

set -e

echo "🔍 Validating Docker setup for webapp..."
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check Docker
echo -n "Checking Docker installation... "
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)
    echo -e "${GREEN}✓${NC} Docker $DOCKER_VERSION"
else
    echo -e "${RED}✗${NC} Docker not found"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker Compose
echo -n "Checking Docker Compose... "
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | cut -d ' ' -f4 | cut -d ',' -f1)
    echo -e "${GREEN}✓${NC} Docker Compose $COMPOSE_VERSION"
else
    echo -e "${RED}✗${NC} Docker Compose not found"
    ERRORS=$((ERRORS + 1))
fi

# Check Dockerfiles
echo -n "Checking dockerfile.development... "
if [ -f "dockerfile.development" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo -n "Checking dockerfile.production... "
if [ -f "dockerfile.production" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker Compose files
echo -n "Checking docker/docker-compose.dev.yml... "
if [ -f "docker/docker-compose.dev.yml" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo -n "Checking docker/docker-compose.prod.yml... "
if [ -f "docker/docker-compose.prod.yml" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check .dockerignore
echo -n "Checking .dockerignore... "
if [ -f ".dockerignore" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC} .dockerignore not found (optional but recommended)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check environment file
echo -n "Checking .env file... "
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC}"

    # Check required variables
    echo "  Checking required environment variables:"

    REQUIRED_VARS=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "NEXT_PUBLIC_PROVIDER_URL"
    )

    for VAR in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${VAR}=" .env && ! grep -q "^${VAR}=$" .env; then
            echo -e "    ${GREEN}✓${NC} $VAR"
        else
            echo -e "    ${RED}✗${NC} $VAR (missing or empty)"
            ERRORS=$((ERRORS + 1))
        fi
    done
else
    echo -e "${RED}✗${NC} .env file not found"
    echo "  Create .env from .env.template"
    ERRORS=$((ERRORS + 1))
fi

# Check Next.js config
echo -n "Checking next.config.js... "
if [ -f "next.config.js" ]; then
    if grep -q "output.*standalone" next.config.js; then
        echo -e "${GREEN}✓${NC} (standalone output enabled)"
    else
        echo -e "${YELLOW}⚠${NC} standalone output not found"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check package.json for Docker scripts
echo -n "Checking package.json... "
if [ -f "package.json" ]; then
    if grep -q "docker:dev" package.json; then
        echo -e "${GREEN}✓${NC} (Docker scripts found)"
    else
        echo -e "${YELLOW}⚠${NC} Docker scripts not found"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker daemon
echo -n "Checking Docker daemon... "
if docker info &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker daemon is running"
else
    echo -e "${RED}✗${NC} Docker daemon is not running"
    ERRORS=$((ERRORS + 1))
fi

# Check port availability
echo -n "Checking port 3000... "
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠${NC} Port 3000 is already in use"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} Port 3000 is available"
fi

echo ""
echo "============================================"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ Validation passed!${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    fi
    echo ""
    echo "You can now run:"
    echo "  bun run docker:dev   (for development)"
    echo "  bun run docker:prod  (for production)"
    exit 0
else
    echo -e "${RED}✗ Validation failed with $ERRORS error(s)${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    fi
    exit 1
fi

