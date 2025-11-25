#!/bin/bash

# ============================================================================
# Manual Production Deployment Script - Blue-Green with Docker Compose
# ============================================================================
#
# Use this script for manual deployments when GitHub Actions is unavailable
#
# USAGE:
#   ./scripts/deploy-prod-manual.sh all
# ============================================================================

set -e

DEPLOYMENT_DIR="${DEPLOYMENT_DIR:-/opt/projects/prod.docs.plus}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
DOCKER_NETWORK="prod-docsplus-network"
FRONTEND_PORT_BLUE=3001
FRONTEND_PORT_GREEN=3011

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# ============================================================================
# Full Stack Deployment with Docker Compose
# ============================================================================
deploy_stack() {
    log_info "Starting Full Stack Blue-Green Deployment with Docker Compose..."

    cd "$DEPLOYMENT_DIR"

    # Install dependencies
    log_info "Installing dependencies..."
    bun install --frozen-lockfile

    # Prepare environment
    if [ ! -f ".env" ]; then
        log_error ".env file not found"
        exit 1
    fi

    cp .env $ENV_FILE
    log_success "Environment prepared"

    # Detect current color
    if docker ps --format '{{.Names}}' | grep -q "^prod-blue-"; then
        CURRENT_COLOR="blue"
        CURRENT_PORT=$FRONTEND_PORT_BLUE
        NEW_COLOR="green"
        NEW_PORT=$FRONTEND_PORT_GREEN
        log_info "Current: BLUE | Deploying: GREEN"
    elif docker ps --format '{{.Names}}' | grep -q "^prod-green-"; then
        CURRENT_COLOR="green"
        CURRENT_PORT=$FRONTEND_PORT_GREEN
        NEW_COLOR="blue"
        NEW_PORT=$FRONTEND_PORT_BLUE
        log_info "Current: GREEN | Deploying: BLUE"
    else
        CURRENT_COLOR="none"
        NEW_COLOR="blue"
        NEW_PORT=$FRONTEND_PORT_BLUE
        log_info "First deployment: BLUE"
    fi

    # Ensure shared infrastructure
    log_info "Checking shared infrastructure..."
    docker network create $DOCKER_NETWORK 2>/dev/null || true

    if ! docker ps | grep -q "prod-docsplus-redis"; then
        log_info "Starting Redis..."
        docker run -d \
            --name prod-docsplus-redis \
            --network $DOCKER_NETWORK \
            --restart unless-stopped \
            -p 6379:6379 \
            -v prod-redis-data:/data \
            redis:alpine \
            redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy noeviction
        sleep 5
    fi

    if docker exec prod-docsplus-redis redis-cli ping | grep -q PONG; then
        log_success "Redis is healthy"
    else
        log_error "Redis health check failed"
        exit 1
    fi

    # Build images
    log_info "Building Docker images for $NEW_COLOR stack..."

    # Update env file with new frontend port
    sed -i.bak "s/NGINX_HTTP_PORT=.*/NGINX_HTTP_PORT=$NEW_PORT/" $ENV_FILE

    docker-compose -f $COMPOSE_FILE \
        --env-file $ENV_FILE \
        -p prod-$NEW_COLOR \
        build

    log_success "Images built"

    # Deploy new stack
    log_info "Deploying $NEW_COLOR stack..."

    docker-compose -f $COMPOSE_FILE \
        --env-file $ENV_FILE \
        -p prod-$NEW_COLOR \
        up -d \
        --scale webapp=2 \
        --scale rest-api=2 \
        --scale hocuspocus-server=2 \
        --scale hocuspocus-worker=1

    log_success "New stack deployed"

    # Wait for initialization
    log_info "Waiting for services to initialize..."
    sleep 30

    # Health checks
    log_info "Running health checks..."

    # Frontend
    WEBAPP=$(docker ps --filter "name=prod-$NEW_COLOR-webapp" --format "{{.Names}}" | head -1)
    if [ -z "$WEBAPP" ]; then
        log_error "No webapp container found"
        exit 1
    fi

    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec $WEBAPP bun -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" &> /dev/null; then
            log_success "Frontend is healthy"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        log_error "Frontend health check failed"
        docker logs $WEBAPP --tail 100
        exit 1
    fi

    # Backend health checks
    REST=$(docker ps --filter "name=prod-$NEW_COLOR-rest-api" --format "{{.Names}}" | head -1)
    if docker exec $REST bun -e "fetch('http://localhost:4000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" &> /dev/null; then
        log_success "REST API is healthy"
    else
        log_error "REST API health check failed"
        exit 1
    fi

    WS=$(docker ps --filter "name=prod-$NEW_COLOR-hocuspocus-server" --format "{{.Names}}" | head -1)
    if docker exec $WS bun -e "fetch('http://localhost:4001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" &> /dev/null; then
        log_success "WebSocket is healthy"
    else
        log_error "WebSocket health check failed"
        exit 1
    fi

    WORKER=$(docker ps --filter "name=prod-$NEW_COLOR-hocuspocus-worker" --format "{{.Names}}" | head -1)
    if docker exec $WORKER bun -e "fetch('http://localhost:4002/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" &> /dev/null; then
        log_success "Worker is healthy"
    else
        log_error "Worker health check failed"
        exit 1
    fi

    # Update nginx
    log_info "Updating nginx to route to $NEW_COLOR stack (port $NEW_PORT)..."

    sudo cp /etc/nginx/sites-available/docs.plus /etc/nginx/sites-available/docs.plus.backup.$(date +%Y%m%d_%H%M%S)
    sudo sed -i "s/server localhost:[0-9]\+;/server localhost:$NEW_PORT;/" /etc/nginx/sites-available/docs.plus
    sudo nginx -t && sudo nginx -s reload

    log_success "Nginx updated"

    # Grace period
    log_info "Waiting for traffic switch..."
    sleep 15

    # Stop old stack
    if [ "$CURRENT_COLOR" != "none" ]; then
        log_info "Stopping $CURRENT_COLOR stack..."
        docker-compose -f $COMPOSE_FILE \
            --env-file $ENV_FILE \
            -p prod-$CURRENT_COLOR \
            down
        log_success "Old stack stopped"
    fi

    # Cleanup
    log_info "Cleaning up..."
    docker image prune -f
    docker volume prune -f --filter "label!=keep"

    log_success "Deployment completed!"
    log_info "Deployed Stack: prod-$NEW_COLOR"
    log_info "Frontend Port: $NEW_PORT"

    docker ps --filter "name=prod-$NEW_COLOR-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# ============================================================================
# Main
# ============================================================================
case "${1:-all}" in
    all|stack)
        deploy_stack
        ;;
    *)
        echo "Usage: $0 {all|stack}"
        echo ""
        echo "Note: This script deploys the full stack using Docker Compose."
        echo "      Frontend and backend are deployed together in blue-green mode."
        exit 1
        ;;
esac

log_success "Deployment completed successfully! 🚀"
