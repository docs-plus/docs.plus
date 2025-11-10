# =============================================================================
# Hocuspocus Server - Makefile
# Quick commands for Docker operations
# =============================================================================

.PHONY: help dev prod build-dev build-prod up-dev up-prod down-dev down-prod logs migrate clean

.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

## help: Show this help
help:
	@echo "$(BLUE)Hocuspocus Server - Docker Commands$(NC)"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  $(GREEN)/' | sed 's/:/ $(NC)-/'

# =============================================================================
# DEVELOPMENT
# =============================================================================

## dev: Start development environment (hot reload)
dev:
	@echo "$(BLUE)Starting development environment...$(NC)"
	docker-compose -f docker-compose.dev.yml up

## dev-build: Build and start development
dev-build:
	@echo "$(BLUE)Building and starting development...$(NC)"
	docker-compose -f docker-compose.dev.yml up --build

## dev-d: Start development (detached)
dev-d:
	@echo "$(BLUE)Starting development (background)...$(NC)"
	docker-compose -f docker-compose.dev.yml up -d
	@echo "$(GREEN)✓ Development services started$(NC)"

## dev-down: Stop development environment
dev-down:
	@echo "$(YELLOW)Stopping development environment...$(NC)"
	docker-compose -f docker-compose.dev.yml down

## dev-logs: Show development logs
dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

## dev-restart: Restart development
dev-restart: dev-down dev-d

# =============================================================================
# PRODUCTION
# =============================================================================

## prod: Start production environment
prod:
	@echo "$(BLUE)Starting production environment...$(NC)"
	docker-compose -f docker-compose.prod.yml up -d
	@echo "$(GREEN)✓ Production services started$(NC)"

## prod-build: Build and start production
prod-build:
	@echo "$(BLUE)Building and starting production...$(NC)"
	docker-compose -f docker-compose.prod.yml up -d --build

## prod-down: Stop production environment
prod-down:
	@echo "$(YELLOW)Stopping production environment...$(NC)"
	docker-compose -f docker-compose.prod.yml down

## prod-logs: Show production logs
prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

## prod-restart: Restart production
prod-restart: prod-down prod

# =============================================================================
# SCALING (Production)
# =============================================================================

## scale-ws: Scale WebSocket servers (usage: make scale-ws n=5)
scale-ws:
	@echo "$(BLUE)Scaling WebSocket servers to $(n)...$(NC)"
	docker-compose -f docker-compose.prod.yml up -d --scale hocuspocus-server=$(n)

## scale-worker: Scale workers (usage: make scale-worker n=5)
scale-worker:
	@echo "$(BLUE)Scaling workers to $(n)...$(NC)"
	docker-compose -f docker-compose.prod.yml up -d --scale hocuspocus-worker=$(n)

## scale-all: Scale all services (usage: make scale-all ws=5 worker=3 rest=2)
scale-all:
	@echo "$(BLUE)Scaling all services...$(NC)"
	docker-compose -f docker-compose.prod.yml up -d \
		--scale rest-api=$(rest) \
		--scale hocuspocus-server=$(ws) \
		--scale hocuspocus-worker=$(worker)

# =============================================================================
# DATABASE
# =============================================================================

## migrate-dev: Run migrations (development)
migrate-dev:
	@echo "$(BLUE)Running development migrations...$(NC)"
	docker-compose -f docker-compose.dev.yml exec rest-api bunx prisma migrate dev

## migrate-prod: Deploy migrations (production)
migrate-prod:
	@echo "$(BLUE)Deploying production migrations...$(NC)"
	docker-compose -f docker-compose.prod.yml exec rest-api bunx prisma migrate deploy

## db-shell-dev: PostgreSQL shell (dev)
db-shell-dev:
	docker-compose -f docker-compose.dev.yml exec postgres psql -U docsplus -d docsplus_dev

## db-shell-prod: PostgreSQL shell (prod)
db-shell-prod:
	docker-compose -f docker-compose.prod.yml exec postgres psql -U docsplus -d docsplus

# =============================================================================
# LOGS
# =============================================================================

## logs-rest-dev: REST API logs (dev)
logs-rest-dev:
	docker-compose -f docker-compose.dev.yml logs -f rest-api

## logs-ws-dev: WebSocket logs (dev)
logs-ws-dev:
	docker-compose -f docker-compose.dev.yml logs -f hocuspocus-server

## logs-worker-dev: Worker logs (dev)
logs-worker-dev:
	docker-compose -f docker-compose.dev.yml logs -f hocuspocus-worker

## logs-rest-prod: REST API logs (prod)
logs-rest-prod:
	docker-compose -f docker-compose.prod.yml logs -f rest-api

## logs-ws-prod: WebSocket logs (prod)
logs-ws-prod:
	docker-compose -f docker-compose.prod.yml logs -f hocuspocus-server

## logs-worker-prod: Worker logs (prod)
logs-worker-prod:
	docker-compose -f docker-compose.prod.yml logs -f hocuspocus-worker

# =============================================================================
# SHELL ACCESS
# =============================================================================

## shell-rest-dev: Shell into REST API (dev)
shell-rest-dev:
	docker-compose -f docker-compose.dev.yml exec rest-api sh

## shell-rest-prod: Shell into REST API (prod)
shell-rest-prod:
	docker-compose -f docker-compose.prod.yml exec rest-api sh

## redis-dev: Redis CLI (dev)
redis-dev:
	docker-compose -f docker-compose.dev.yml exec redis redis-cli

## redis-prod: Redis CLI (prod)
redis-prod:
	docker-compose -f docker-compose.prod.yml exec redis redis-cli

# =============================================================================
# STATUS & HEALTH
# =============================================================================

## ps-dev: List development containers
ps-dev:
	docker-compose -f docker-compose.dev.yml ps

## ps-prod: List production containers
ps-prod:
	docker-compose -f docker-compose.prod.yml ps

## health-dev: Check development health
health-dev:
	@echo "$(BLUE)Development Health Check$(NC)"
	@curl -s http://localhost:4000/health || echo "REST API: $(RED)✗$(NC)"
	@curl -s http://localhost:4002/health || echo "Worker: $(RED)✗$(NC)"

## health-prod: Check production health
health-prod:
	@echo "$(BLUE)Production Health Check$(NC)"
	@curl -s http://localhost:4000/health || echo "REST API: $(RED)✗$(NC)"
	@curl -s http://localhost:4002/health || echo "Worker: $(RED)✗$(NC)"

# =============================================================================
# CLEANUP
# =============================================================================

## clean-dev: Remove development containers and volumes
clean-dev:
	@echo "$(YELLOW)Cleaning development environment...$(NC)"
	docker-compose -f docker-compose.dev.yml down -v
	@echo "$(GREEN)✓ Development cleaned$(NC)"

## clean-prod: Remove production containers and volumes
clean-prod:
	@echo "$(RED)WARNING: This will remove production data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose -f docker-compose.prod.yml down -v; \
		echo "$(GREEN)✓ Production cleaned$(NC)"; \
	fi

## prune: Remove all unused Docker resources
prune:
	@echo "$(RED)This will remove ALL unused Docker resources!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker system prune -af --volumes; \
		echo "$(GREEN)✓ Docker pruned$(NC)"; \
	fi

# =============================================================================
# SETUP
# =============================================================================

## setup-dev: Initial development setup
setup-dev:
	@echo "$(BLUE)Setting up development environment...$(NC)"
	@if [ ! -f .env ]; then cp .env.dev .env; echo "Created .env from .env.dev"; fi
	docker-compose -f docker-compose.dev.yml up -d --build
	@echo "Waiting for services to be healthy..."
	@sleep 10
	docker-compose -f docker-compose.dev.yml exec rest-api bunx prisma migrate dev
	@echo "$(GREEN)✓ Development setup complete$(NC)"

## setup-prod: Initial production setup
setup-prod:
	@echo "$(BLUE)Setting up production environment...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(RED)ERROR: .env file not found!$(NC)"; \
		echo "Copy .env.prod to .env and configure it first"; \
		exit 1; \
	fi
	docker-compose -f docker-compose.prod.yml up -d --build
	@echo "Waiting for services to be healthy..."
	@sleep 15
	docker-compose -f docker-compose.prod.yml exec rest-api bunx prisma migrate deploy
	@echo "$(GREEN)✓ Production setup complete$(NC)"

