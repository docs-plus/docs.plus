#!/bin/bash

# ============================================================================
# Production Rollback Script - Blue-Green with Docker Compose
# ============================================================================
#
# Quickly rollback to the previous deployment
#
# USAGE:
#   ./scripts/rollback-prod.sh
# ============================================================================

set -e

DEPLOYMENT_DIR="${DEPLOYMENT_DIR:-/opt/projects/prod.docs.plus}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
FRONTEND_PORT_BLUE=3001
FRONTEND_PORT_GREEN=3011

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
# Rollback Full Stack
# ============================================================================
rollback_stack() {
    log_warning "Rolling back deployment..."

    cd "$DEPLOYMENT_DIR"

    # Detect current and old colors
    if docker ps --format '{{.Names}}' | grep -q "^prod-blue-"; then
        CURRENT_COLOR="blue"
        CURRENT_PORT=$FRONTEND_PORT_BLUE
        OLD_COLOR="green"
        OLD_PORT=$FRONTEND_PORT_GREEN
    elif docker ps --format '{{.Names}}' | grep -q "^prod-green-"; then
        CURRENT_COLOR="green"
        CURRENT_PORT=$FRONTEND_PORT_GREEN
        OLD_COLOR="blue"
        OLD_PORT=$FRONTEND_PORT_BLUE
    else
        log_error "No active deployment found"
        exit 1
    fi

    log_info "Current: $CURRENT_COLOR | Rolling back to: $OLD_COLOR"

    # Check if old stack exists (containers might be stopped)
    if ! docker ps -a --format '{{.Names}}' | grep -q "^prod-$OLD_COLOR-"; then
        log_error "Previous deployment ($OLD_COLOR) not found. Cannot rollback."
        log_info "You may need to redeploy manually."
        exit 1
    fi

    # Start old stack
    log_info "Starting $OLD_COLOR stack..."

    # Update env file with old port
    if [ -f "$ENV_FILE" ]; then
        sed -i.bak "s/NGINX_HTTP_PORT=.*/NGINX_HTTP_PORT=$OLD_PORT/" $ENV_FILE
    fi

    docker-compose -f $COMPOSE_FILE \
        --env-file $ENV_FILE \
        -p prod-$OLD_COLOR \
        up -d \
        --scale webapp=2 \
        --scale rest-api=2 \
        --scale hocuspocus-server=2 \
        --scale hocuspocus-worker=1

    # Wait for services
    log_info "Waiting for services..."
    sleep 20

    # Health checks
    log_info "Checking health..."

    WEBAPP=$(docker ps --filter "name=prod-$OLD_COLOR-webapp" --format "{{.Names}}" | head -1)
    if docker exec $WEBAPP bun -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" &> /dev/null; then
        log_success "Frontend is healthy"
    else
        log_error "Frontend health check failed"
        docker logs $WEBAPP --tail 50
        exit 1
    fi

    REST=$(docker ps --filter "name=prod-$OLD_COLOR-rest-api" --format "{{.Names}}" | head -1)
    if docker exec $REST bun -e "fetch('http://localhost:4000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" &> /dev/null; then
        log_success "REST API is healthy"
    else
        log_error "REST API health check failed"
        exit 1
    fi

    # Update nginx
    log_info "Switching nginx to $OLD_COLOR (port $OLD_PORT)..."
    sudo sed -i "s/server localhost:[0-9]\+;/server localhost:$OLD_PORT;/" /etc/nginx/sites-available/docs.plus
    sudo nginx -t && sudo nginx -s reload

    log_success "Nginx switched to $OLD_COLOR"

    # Grace period
    sleep 10

    # Stop current stack
    log_info "Stopping $CURRENT_COLOR stack..."
    docker-compose -f $COMPOSE_FILE \
        --env-file $ENV_FILE \
        -p prod-$CURRENT_COLOR \
        down

    log_success "Rollback completed!"
    log_info "Active Stack: prod-$OLD_COLOR"

    docker ps --filter "name=prod-$OLD_COLOR-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# ============================================================================
# Main
# ============================================================================
rollback_stack

log_success "Rollback completed successfully! 🔄"
