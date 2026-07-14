# =============================================================================
# Root Makefile - Full Stack Docker Orchestration
# Manages: Hocuspocus Server + Webapp + Infrastructure
# =============================================================================

.PHONY: help build build-dev build-prod-ci build-prod-backend run-prod-backend up-prod up-dev infra-up infra-down infra-logs dev-local dev-backend down logs logs-webapp logs-backend restart clean scale-webapp scale-hocuspocus ps stats deploy-prod rollback-prod status-prod logs-traefik

help:
	@echo "Docsplus Full Stack Docker Commands"
	@echo ""
	@echo "Building:"
	@echo "  make build             - Build all services (production)"
	@echo "  make build-dev         - Build all services (development)"
	@echo "  make build-prod-ci       - Build prod images with stub env (no .env.production needed)"
	@echo "  make build-prod-backend  - Build only backend prod images (rest-api, hocuspocus, worker)"
	@echo ""
	@echo "Running:"
	@echo "  make up-prod           - Start all services (production)"
	@echo "  make up-dev            - Start all services (development - Docker)"
	@echo ""
	@echo "Local Development (one command):"
	@echo "  make dev-local          - Install/deps, DB, Supabase, backend + webapp"
	@echo "  make dev-backend        - Same bootstrap, backend processes only"
	@echo "  make infra-up           - Start Postgres + Redis only"
	@echo "  make infra-down         - Stop Postgres + Redis"
	@echo "  make infra-logs         - Tail Postgres + Redis logs"
	@echo ""
	@echo "Individual processes (Bun, not Make):"
	@echo "  bun run dev                                       - Frontend (webapp)"
	@echo "  bun run dev:admin                                 - Admin dashboard"
	@echo "  bun --filter @docs.plus/hocuspocus dev:rest       - REST API"
	@echo "  bun --filter @docs.plus/hocuspocus dev:ws         - WebSocket server"
	@echo "  bun --filter @docs.plus/hocuspocus dev:worker     - Worker"
	@echo "  bun --filter @docs.plus/supabase_back start|stop  - Supabase up / down"
	@echo ""
	@echo "Production Deployment (Traefik):"
	@echo "  make deploy-prod             - Deploy full stack with Traefik"
	@echo "  make rollback-prod           - Rollback to previous deployment"
	@echo "  make status-prod             - Check production status"
	@echo "  make logs-traefik            - View Traefik logs"
	@echo ""
	@echo "Scaling (production only):"
	@echo "  make scale-webapp      - Scale webapp to 3 replicas"
	@echo "  make scale-hocuspocus  - Scale hocuspocus services"
	@echo ""
	@echo "Management:"
	@echo "  make down              - Stop all services (auto-detects dev/prod/local)"
	@echo "  make logs              - View all logs (auto-detects dev/prod/local)"
	@echo "  make logs-webapp       - View webapp logs (auto-detects dev/prod)"
	@echo "  make logs-backend      - View backend logs (rest-api, hocuspocus-server, worker) (auto-detects dev/prod)"
	@echo "  make restart           - Restart all services (auto-detects dev/prod)"
	@echo "  make clean             - Clean everything (auto-detects dev/prod/local)"
	@echo ""
	@echo "Utilities:"
	@echo "  make ps                - Show running containers (auto-detects dev/prod/local)"
	@echo "  make stats             - Show resource usage"

# =============================================================================
# BUILD COMMANDS
# =============================================================================

build:
	@echo "🏗️  Building all services (production)..."
	@docker compose -f docker-compose.prod.yml --env-file .env.production build
	@echo "✅ All services built"

# Build prod images with stub env — run before push to catch Docker build failures.
# Does not require .env.production. Uses same compose + BuildKit as CI deploy.
build-prod-ci:
	@echo "🏗️  Validating production Docker build (stub env)..."
	@test -f scripts/env.production.build-stub || (echo "❌ scripts/env.production.build-stub missing"; exit 1)
	DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose -f docker-compose.prod.yml --env-file scripts/env.production.build-stub build --parallel
	@echo "✅ Production build validation passed"

# Build only backend (rest-api, hocuspocus-server, hocuspocus-worker) prod images. Same image, 3 services.
# Use before pushing to verify backend Dockerfile builds.
build-prod-backend:
	@echo "🏗️  Building backend production images (rest-api, hocuspocus-server, hocuspocus-worker)..."
	@test -f scripts/env.production.build-stub || (echo "❌ scripts/env.production.build-stub missing"; exit 1)
	DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose -f docker-compose.prod.yml --env-file scripts/env.production.build-stub build rest-api hocuspocus-server hocuspocus-worker
	@echo "✅ Backend production images built"

# Run backend prod images locally: Redis + rest-api + hocuspocus-server + hocuspocus-worker (1 replica each).
# Uses .env.local for DATABASE_URL and secrets. No Traefik; override publishes 4000/4001/4002.
run-prod-backend: build-prod-backend
	@test -f .env.local || (echo "❌ .env.local required (DATABASE_URL, SUPABASE_*, JWT_SECRET, etc.)"; exit 1)
	@echo "🚀 Starting backend (prod images) + Redis locally..."
	# DEPLOY_TAG must match build-prod-backend's build-stub tag, else compose looks for :latest.
	DEPLOY_TAG=build-validate DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose -f docker-compose.prod.yml -f docker-compose.backend-local.override.yml --env-file .env.local up -d redis rest-api hocuspocus-server hocuspocus-worker
	@echo "✅ Backend running. REST: http://localhost:4000  WS: ws://localhost:4001  Health: http://localhost:4000/health"
	@echo "  make logs-backend  - view logs"

build-dev:
	@echo "🏗️  Building all services (development)..."
	@docker compose -f docker-compose.dev.yml --env-file .env.development build
	@echo "✅ All services built"

# =============================================================================
# RUN COMMANDS
# =============================================================================

up-prod: build
	@echo "🚀 Starting full stack production environment (Traefik)..."
	@echo ""
	@echo "Services:"
	@echo "  🔀 Traefik (ports 80, 443) - reverse proxy + SSL"
	@echo "  🔴 Redis (internal) - cache & pub/sub"
	@echo "  🔌 REST API - 2 replicas"
	@echo "  🌐 Hocuspocus WS - 2 replicas"
	@echo "  ⚙️  Worker - 1 replica"
	@echo "  💻 Webapp - 2 replicas"
	@echo ""
	@docker compose -f docker-compose.prod.yml --env-file .env.production up -d \
		--scale rest-api=2 \
		--scale hocuspocus-server=2 \
		--scale hocuspocus-worker=1 \
		--scale webapp=2
	@echo ""
	@echo "✅ Full stack started!"
	@echo ""
	@echo "URLs:"
	@echo "  Webapp:    https://docs.plus"
	@echo "  API:       https://prodback.docs.plus/api"
	@echo "  WebSocket: wss://prodback.docs.plus/hocuspocus"
	@echo "  Dashboard: https://traefik.docs.plus"
	@echo ""
	@echo "Commands:"
	@echo "  make logs         - View all logs"
	@echo "  make logs-traefik - View Traefik logs"
	@echo "  make status-prod  - Check production status"
	@echo "  make down         - Stop all services"

up-dev: build-dev
	@echo "🚀 Starting full stack development environment..."
	@echo "🧹 Cleaning up any existing containers..."
	@docker compose -f docker-compose.dev.yml --env-file .env.development down 2>/dev/null || true
	@CONTAINERS=$$(docker ps -a -q --filter "name=docsy-" 2>/dev/null); \
	if [ -n "$$CONTAINERS" ]; then \
		echo "Removing stale containers..."; \
		docker rm -f $$CONTAINERS 2>/dev/null || true; \
	fi
	@echo ""
	@if [ ! -f .env.development ]; then \
		echo "❌ .env.development missing — run: cp .env.example .env.development"; \
		exit 1; \
	fi
	@echo "Services:"
	@echo "  📦 PostgreSQL (port 5432)"
	@echo "  🔴 Redis (port 6379)"
	@echo "  🔌 REST API (port 4000) - hot reload enabled"
	@echo "  🌐 Hocuspocus WS (port 4001) - hot reload enabled"
	@echo "  ⚙️  Worker (port 4002) - hot reload enabled"
	@echo "  💻 Webapp (port 3000) - hot reload enabled"
	@echo ""
	@docker compose -f docker-compose.dev.yml --env-file .env.development up -d
	@echo ""
	@echo "✅ Development environment started!"
	@echo ""
	@echo "Access points:"
	@echo "  Webapp:     http://localhost:3000"
	@echo "  REST API:   http://localhost:4000"
	@echo "  WebSocket:  ws://localhost:4001"
	@echo "  Worker:     http://localhost:4002"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  Redis:      localhost:6379"
	@echo ""
	@echo "💡 Hot reload is enabled - code changes will auto-reload"
	@echo ""
	@echo "Common commands:"
	@echo "  make logs              - View all logs (auto-detects dev/prod)"
	@echo "  make logs-webapp       - View webapp logs (auto-detects dev/prod)"
	@echo "  make logs-backend      - View backend logs (auto-detects dev/prod)"
	@echo "  make ps                - Show running containers (auto-detects dev/prod)"
	@echo "  make down              - Stop all services (auto-detects dev/prod)"
	@echo "  make restart           - Restart all services (auto-detects dev/prod)"

# =============================================================================
# LOCAL DEVELOPMENT COMMANDS (Infrastructure Only in Docker)
# =============================================================================

infra-up:
	@echo "🚀 Starting infrastructure services (PostgreSQL + Redis)..."
	@if [ ! -f .env.local ]; then \
		if [ ! -f .env.development ]; then \
			echo "✗ .env.local missing and .env.development not found"; exit 1; \
		fi; \
		echo "• Creating .env.local from .env.development — review secrets"; \
		cp .env.development .env.local; \
	fi
	@docker compose -f docker-compose.local.yml --env-file .env.local up -d --wait
	@echo ""
	@echo "✅ Infrastructure started!"
	@echo ""
	@echo "Services:"
	@echo "  📦 PostgreSQL: localhost:$${DB_PORT:-5432}"
	@echo "  🔴 Redis:      localhost:$${REDIS_PORT:-6379}"
	@echo ""
	@echo "Next: make dev-local"

infra-down:
	@echo "🛑 Stopping infrastructure services..."
	@docker compose -f docker-compose.local.yml --env-file .env.local down
	@echo "✅ Infrastructure stopped"

infra-logs:
	@echo "📋 Infrastructure logs..."
	@docker compose -f docker-compose.local.yml --env-file .env.local logs -f

# Bootstraps env/deps/DB/extensions then starts processes (implementation: scripts/dev-local-preflight.ts).
dev-local:
	@bun scripts/dev-local-preflight.ts
	@echo "🚀 Starting local development (REST + WS + Worker + Webapp)..."
	@bunx concurrently --kill-others-on-fail -n "REST,WS,WORKER,WEBAPP" -c "blue,green,yellow,magenta" \
		"bun --filter @docs.plus/hocuspocus dev:rest" \
		"bun --filter @docs.plus/hocuspocus dev:ws" \
		"bun --filter @docs.plus/hocuspocus dev:worker" \
		"bun --filter @docs.plus/webapp dev"

dev-backend:
	@bun scripts/dev-local-preflight.ts
	@echo "🚀 Starting backend services (REST API, WebSocket, Worker)..."
	@bunx concurrently --kill-others-on-fail -n "REST,WS,WORKER" -c "blue,green,yellow" \
		"bun --filter @docs.plus/hocuspocus dev:rest" \
		"bun --filter @docs.plus/hocuspocus dev:ws" \
		"bun --filter @docs.plus/hocuspocus dev:worker"

# =============================================================================
# SCALING COMMANDS
# =============================================================================

scale-webapp:
	@echo "📈 Scaling webapp to 3 replicas..."
	@docker compose -f docker-compose.prod.yml --env-file .env.production up -d --scale webapp=3
	@echo "✅ Webapp scaled to 3 replicas"

scale-hocuspocus:
	@echo "📈 Scaling hocuspocus services..."
	@docker compose -f docker-compose.prod.yml --env-file .env.production up -d --scale rest-api=3 --scale hocuspocus-server=5 --scale hocuspocus-worker=3
	@echo "✅ Hocuspocus services scaled"

# =============================================================================
# MANAGEMENT COMMANDS
# =============================================================================

down:
	@if docker compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🛑 Stopping all services (development)..."; \
		docker compose -f docker-compose.dev.yml --env-file .env.development down; \
		echo "✅ All services stopped"; \
	elif docker compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "🛑 Stopping all services (production)..."; \
		docker compose -f docker-compose.prod.yml --env-file .env.production down; \
		echo "✅ All services stopped"; \
	elif docker compose -f docker-compose.local.yml --env-file .env.local ps -q 2>/dev/null | grep -q .; then \
		echo "🛑 Stopping infrastructure services (local)..."; \
		docker compose -f docker-compose.local.yml --env-file .env.local down; \
		echo "✅ Infrastructure stopped"; \
		echo "💡 Apps run natively - stop them with Ctrl+C; Supabase: bun --filter @docs.plus/supabase_back stop"; \
	else \
		echo "⚠️  No running containers found. Start with 'make dev-local' (local) or 'make up-dev' (Docker)"; \
	fi

logs:
	@if docker compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "📋 Detected development environment - showing all logs..."; \
		docker compose -f docker-compose.dev.yml --env-file .env.development logs -f; \
	elif docker compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "📋 Detected production environment - showing all logs..."; \
		docker compose -f docker-compose.prod.yml --env-file .env.production logs -f; \
	elif docker compose -f docker-compose.local.yml --env-file .env.local ps -q 2>/dev/null | grep -q .; then \
		echo "📋 Local mode: infra logs below; app logs live in the 'make dev-local' terminal..."; \
		docker compose -f docker-compose.local.yml --env-file .env.local logs -f; \
	else \
		echo "⚠️  No running containers found. Start with 'make dev-local' (local) or 'make up-dev' (Docker)"; \
	fi

logs-webapp:
	@if docker compose -f docker-compose.dev.yml --env-file .env.development ps -q webapp 2>/dev/null | grep -q .; then \
		docker compose -f docker-compose.dev.yml --env-file .env.development logs -f webapp; \
	elif docker compose -f docker-compose.prod.yml --env-file .env.production ps -q webapp 2>/dev/null | grep -q .; then \
		docker compose -f docker-compose.prod.yml --env-file .env.production logs -f webapp; \
	else \
		echo "⚠️  Webapp container not found. Under 'make dev-local' the webapp runs natively — see the WEBAPP stream in that terminal"; \
	fi

logs-backend:
	@if docker compose -f docker-compose.dev.yml --env-file .env.development ps -q rest-api 2>/dev/null | grep -q .; then \
		docker compose -f docker-compose.dev.yml --env-file .env.development logs -f rest-api hocuspocus-server hocuspocus-worker; \
	elif docker compose -f docker-compose.prod.yml --env-file .env.production ps -q rest-api 2>/dev/null | grep -q .; then \
		docker compose -f docker-compose.prod.yml --env-file .env.production logs -f rest-api hocuspocus-server hocuspocus-worker; \
	else \
		echo "⚠️  Backend containers not found. Under 'make dev-local' the backend runs natively — see the REST/WS/WORKER streams in that terminal"; \
	fi

restart:
	@if docker compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🔄 Restarting all services (development)..."; \
		docker compose -f docker-compose.dev.yml --env-file .env.development restart; \
		echo "✅ All services restarted"; \
	elif docker compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "🔄 Restarting all services (production)..."; \
		docker compose -f docker-compose.prod.yml --env-file .env.production restart; \
		echo "✅ All services restarted"; \
	else \
		echo "⚠️  No running containers found. Start with 'make dev-local' (local) or 'make up-dev' (Docker)"; \
	fi

# =============================================================================
# CLEANUP COMMANDS
# =============================================================================

clean:
	@if docker compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🧹 Cleaning up (development)..."; \
		docker compose -f docker-compose.dev.yml --env-file .env.development down -v; \
		docker rmi docsplus-webapp:dev 2>/dev/null || true; \
		echo "✅ Development cleanup complete"; \
	elif docker compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "🧹 Cleaning up (production)..."; \
		docker compose -f docker-compose.prod.yml --env-file .env.production down -v; \
		docker rmi docsplus-webapp:latest docsplus-hocuspocus:latest 2>/dev/null || true; \
		echo "✅ Production cleanup complete"; \
	elif docker compose -f docker-compose.local.yml --env-file .env.local ps -q 2>/dev/null | grep -q .; then \
		echo "🧹 Cleaning up (local)..."; \
		docker compose -f docker-compose.local.yml --env-file .env.local down -v; \
		echo "✅ Local cleanup complete"; \
	else \
		echo "🧹 No running containers found. Cleaning up project images..."; \
		docker rmi docsplus-webapp:dev docsplus-webapp:latest docsplus-hocuspocus:latest 2>/dev/null || true; \
		docker volume rm docsy-postgres-dev docsy-redis-dev docsy-postgres-prod docsy-redis-prod docsy-postgres-local docsy-redis-local 2>/dev/null || true; \
		docker network rm docsy-network-dev docsy-network docsy-network-local 2>/dev/null || true; \
		echo "✅ Cleanup complete"; \
	fi

# =============================================================================
# UTILITY COMMANDS
# =============================================================================

ps:
	@if docker compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		docker compose -f docker-compose.dev.yml --env-file .env.development ps; \
	elif docker compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		docker compose -f docker-compose.prod.yml --env-file .env.production ps; \
	elif docker compose -f docker-compose.local.yml --env-file .env.local ps -q 2>/dev/null | grep -q .; then \
		docker compose -f docker-compose.local.yml --env-file .env.local ps; \
		echo ""; \
		echo "💡 Apps are running natively (not shown above)"; \
	else \
		echo "⚠️  No running containers found. Start with 'make dev-local' (local) or 'make up-dev' (Docker)"; \
	fi

stats:
	@if docker compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		docker stats $$(docker compose -f docker-compose.dev.yml --env-file .env.development ps -q); \
	elif docker compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		docker stats $$(docker compose -f docker-compose.prod.yml --env-file .env.production ps -q); \
	else \
		echo "⚠️  No running containers found. Start with 'make dev-local' (local) or 'make up-dev' (Docker)"; \
	fi

# =============================================================================
# PRODUCTION DEPLOYMENT COMMANDS (Traefik)
# =============================================================================

deploy-prod:
	@echo "🚀 Deploying to production with Traefik..."
	@if [ ! -f .env.production ]; then \
		echo "❌ .env.production not found"; \
		exit 1; \
	fi
	@echo "Building images..."
	@docker compose -f docker-compose.prod.yml --env-file .env.production build
	@echo "Deploying services (zero-downtime)..."
	@docker compose -f docker-compose.prod.yml --env-file .env.production up -d \
		--scale rest-api=2 \
		--scale hocuspocus-server=2 \
		--scale hocuspocus-worker=1 \
		--scale webapp=2
	@echo "✅ Production deployed"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -15

rollback-prod:
	@echo "🔄 Rolling back production..."
	@PREV_TAG=$$(docker images docsplus-webapp --format "{{.Tag}}" | grep -v latest | head -1); \
	if [ -n "$$PREV_TAG" ]; then \
		echo "Rolling back to: $$PREV_TAG"; \
		sed -i.bak "s/DEPLOY_TAG=.*/DEPLOY_TAG=$$PREV_TAG/" .env.production; \
		docker compose -f docker-compose.prod.yml --env-file .env.production up -d; \
		echo "✅ Rollback complete"; \
	else \
		echo "❌ No previous version found"; \
	fi

status-prod:
	@echo "📊 Production Status"
	@echo "===================="
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No containers running"
	@echo ""
	@echo "Traefik Dashboard: https://traefik.docs.plus"
	@echo ""
	@echo "Health Checks:"
	@curl -sf https://docs.plus/api/health 2>/dev/null && echo "  ✅ docs.plus" || echo "  ❌ docs.plus"
	@curl -sf https://prodback.docs.plus/api/health 2>/dev/null && echo "  ✅ prodback.docs.plus/api" || echo "  ❌ prodback.docs.plus/api"

logs-traefik:
	@docker logs traefik -f --tail 100

# --- Observability (server-only; run on the prod droplet) ---
OBS_COMPOSE = docker-compose.observability.yml
OBS_ENV = /opt/projects/prod.docs.plus/.env.observability

.PHONY: observability-up observability-down observability-logs observability-pull
observability-up:
	docker compose -f $(OBS_COMPOSE) --env-file $(OBS_ENV) up -d --remove-orphans
observability-down:
	docker compose -f $(OBS_COMPOSE) --env-file $(OBS_ENV) down
observability-logs:
	docker compose -f $(OBS_COMPOSE) --env-file $(OBS_ENV) logs -f --tail=200
observability-pull:
	docker compose -f $(OBS_COMPOSE) --env-file $(OBS_ENV) pull
