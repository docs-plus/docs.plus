# =============================================================================
# Root Makefile - Full Stack Docker Orchestration
# Manages: Hocuspocus Server + Webapp + Infrastructure
# =============================================================================

.PHONY: help build build-dev up-prod up-dev up-local infra-up infra-down infra-logs dev-local dev-backend dev-webapp dev-rest dev-ws dev-worker down logs logs-webapp logs-backend restart clean scale scale-webapp scale-hocuspocus ps stats supabase-start supabase-stop supabase-status deploy-prod rollback-prod status-prod logs-traefik

help:
	@echo "Docsplus Full Stack Docker Commands"
	@echo ""
	@echo "Building:"
	@echo "  make build             - Build all services (production)"
	@echo "  make build-dev         - Build all services (development)"
	@echo ""
	@echo "Running:"
	@echo "  make up-prod           - Start all services (production)"
	@echo "  make up-dev            - Start all services (development - Docker)"
	@echo "  make up-local          - Start local dev (infra in Docker, apps native)"
	@echo ""
	@echo "Local Development (macOS-friendly, no Docker IO):"
	@echo "  make infra-up           - Start infrastructure only (postgres, redis)"
	@echo "  make infra-down         - Stop infrastructure"
	@echo "  make infra-logs         - View infrastructure logs"
	@echo "  make dev-local          - Start all services (backend + frontend)"
	@echo "  make dev-backend        - Start backend services (REST, WS, Worker)"
	@echo "  make dev-webapp         - Start frontend only"
	@echo "  make dev-rest           - Start REST API only"
	@echo "  make dev-ws             - Start WebSocket server only"
	@echo "  make dev-worker         - Start Worker only"
	@echo "  make migrate            - Run database migrations"
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
	@echo "  make logs              - View all logs (auto-detects dev/prod)"
	@echo "  make logs-webapp       - View webapp logs (auto-detects dev/prod)"
	@echo "  make logs-backend      - View backend logs (rest-api, hocuspocus-server, worker) (auto-detects dev/prod)"
	@echo "  make restart           - Restart all services (auto-detects dev/prod)"
	@echo "  make clean             - Clean everything (auto-detects dev/prod/local)"
	@echo ""
	@echo "Utilities:"
	@echo "  make ps                - Show running containers (auto-detects dev/prod/local)"
	@echo "  make stats             - Show resource usage"
	@echo ""
	@echo "Supabase (uses .env.local):"
	@echo "  make supabase-start    - Start Supabase local instance"
	@echo "  make supabase-stop     - Stop Supabase local instance"
	@echo "  make supabase-status   - Show Supabase local instance status"

# =============================================================================
# BUILD COMMANDS
# =============================================================================

build:
	@echo "🏗️  Building all services (production)..."
	@docker compose -f docker compose.prod.yml --env-file .env.production build
	@echo "✅ All services built"

build-dev:
	@echo "🏗️  Building all services (development)..."
	@docker compose -f docker compose.dev.yml --env-file .env.development build
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
	@docker compose -f docker compose.prod.yml --env-file .env.production up -d \
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
	@docker compose -f docker compose.dev.yml --env-file .env.development down 2>/dev/null || true
	@CONTAINERS=$$(docker ps -a -q --filter "name=docsy-" 2>/dev/null); \
	if [ -n "$$CONTAINERS" ]; then \
		echo "Removing stale containers..."; \
		docker rm -f $$CONTAINERS 2>/dev/null || true; \
	fi
	@echo ""
	@if [ ! -f .env.development ]; then \
		echo "⚠️  Warning: .env.development not found. Creating from template..."; \
		cp .env .env.development 2>/dev/null || true; \
	fi
	@echo "Services:"
	@echo "  📦 PostgreSQL (port 5432)"
	@echo "  🔴 Redis (port 6379)"
	@echo "  🔌 REST API (port 4000) - hot reload enabled"
	@echo "  🌐 Hocuspocus WS (port 4001) - hot reload enabled"
	@echo "  ⚙️  Worker (port 4002) - hot reload enabled"
	@echo "  💻 Webapp (port 3000) - hot reload enabled"
	@echo ""
	@docker compose -f docker compose.dev.yml --env-file .env.development up -d
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
		echo "⚠️  Warning: .env.local not found. Creating from .env.development..."; \
		cp .env.development .env.local 2>/dev/null || true; \
	fi
	@docker compose -f docker compose.local.yml --env-file .env.local up -d
	@echo ""
	@echo "✅ Infrastructure started!"
	@echo ""
	@echo "Services:"
	@echo "  📦 PostgreSQL: localhost:${DB_PORT:-5432}"
	@echo "  🔴 Redis:      localhost:${REDIS_PORT:-6379}"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Start Supabase:  make supabase-start"
	@echo "  2. Start apps:       make dev-local"
	@echo ""
	@echo "Or run manually:"
	@echo "  Backend REST API:    cd packages/hocuspocus.server && bun run dev:rest"
	@echo "  Backend WebSocket:   cd packages/hocuspocus.server && bun run dev:hocuspocus.server"
	@echo "  Backend Worker:      cd packages/hocuspocus.server && bun run dev:hocuspocus.worker"
	@echo "  Frontend:            cd packages/webapp && bun run dev"

infra-down:
	@echo "🛑 Stopping infrastructure services..."
	@docker compose -f docker compose.local.yml --env-file .env.local down
	@echo "✅ Infrastructure stopped"

infra-logs:
	@echo "📋 Infrastructure logs..."
	@docker compose -f docker compose.local.yml --env-file .env.local logs -f

dev-local:
	@echo "🚀 Starting local development (all services)..."
	@if [ ! -f .env.local ]; then \
		echo "⚠️  .env.local not found. Creating from .env.development..."; \
		cp .env.development .env.local; \
		echo "✅ Created .env.local - please review and adjust for localhost if needed"; \
	fi
	@if ! docker ps | grep -q docsy-postgres-local; then \
		echo "⚠️  PostgreSQL not running. Starting infrastructure..."; \
		$(MAKE) infra-up; \
	elif ! docker ps | grep -q docsy-redis-local; then \
		echo "⚠️  Redis not running. Starting infrastructure..."; \
		$(MAKE) infra-up; \
	fi
	@if ! lsof -Pi :54321 -sTCP:LISTEN -t >/dev/null 2>&1; then \
		echo "⚠️  Starting Supabase..."; \
		cd packages/supabase && dotenv -e ../../.env.local -- supabase start > /dev/null 2>&1 || true; \
	fi
	@echo "🔧 Ensuring Prisma client is generated..."
	@cd packages/hocuspocus.server && bun run prisma:generate > /dev/null 2>&1 || true
	@echo "🔧 Ensuring database migrations are applied..."
	@cd packages/hocuspocus.server && bun --env-file ../../.env.local -e "import { $$ } from 'bun'; await $$\`bunx prisma migrate deploy\`" > /dev/null 2>&1 || true
	@echo ""
	@echo "Starting all services..."
	@bunx concurrently -n "REST,WS,WORKER,WEBAPP" -c "blue,green,yellow,magenta" \
		"$(MAKE) dev-rest" \
		"$(MAKE) dev-ws" \
		"$(MAKE) dev-worker" \
		"$(MAKE) dev-webapp"

migrate:
	@echo "🔧 Running database migrations..."
	@if [ ! -f .env.local ]; then \
		echo "⚠️  .env.local not found. Using .env.development..."; \
		cd packages/hocuspocus.server && bun --env-file ../../.env.development -e "import { $$ } from 'bun'; await $$\`bunx prisma migrate deploy\`"; \
	else \
		cd packages/hocuspocus.server && bun --env-file ../../.env.local -e "import { $$ } from 'bun'; await $$\`bunx prisma migrate deploy\`"; \
	fi

dev-backend:
	@echo "🚀 Starting backend services (REST API, WebSocket, Worker)..."
	@bunx concurrently -n "REST,WS,WORKER" -c "blue,green,yellow" \
		"$(MAKE) dev-rest" \
		"$(MAKE) dev-ws" \
		"$(MAKE) dev-worker"

dev-webapp:
	@echo "🚀 Starting frontend..."
	@cd packages/webapp && dotenv -e ../../.env.local -- next dev --turbopack

dev-rest:
	@cd packages/hocuspocus.server && NODE_ENV=development bun --env-file ../../.env.local --watch src/index.ts

dev-ws:
	@cd packages/hocuspocus.server && NODE_ENV=development bun --env-file ../../.env.local --watch src/hocuspocus.server.ts

dev-worker:
	@cd packages/hocuspocus.server && NODE_ENV=development bun --env-file ../../.env.local --watch src/hocuspocus.worker.ts

up-local: infra-up
	@echo ""
	@echo "💡 Infrastructure is ready. Run 'make dev-local' to start apps, or start them manually:"
	@echo "   Backend:  cd packages/hocuspocus.server && bun run dev:rest"
	@echo "   Frontend: cd packages/webapp && bun run dev"

# =============================================================================
# SCALING COMMANDS
# =============================================================================

scale-webapp:
	@echo "📈 Scaling webapp to 3 replicas..."
	@docker compose -f docker compose.prod.yml --env-file .env.production up -d --scale webapp=3
	@echo "✅ Webapp scaled to 3 replicas"

scale-hocuspocus:
	@echo "📈 Scaling hocuspocus services..."
	@docker compose -f docker compose.prod.yml --env-file .env.production up -d --scale rest-api=3 --scale hocuspocus-server=5 --scale hocuspocus-worker=3
	@echo "✅ Hocuspocus services scaled"

# =============================================================================
# MANAGEMENT COMMANDS
# =============================================================================

down:
	@if docker compose -f docker compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🛑 Stopping all services (development)..."; \
		docker compose -f docker compose.dev.yml --env-file .env.development down; \
		echo "✅ All services stopped"; \
	elif docker compose -f docker compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "🛑 Stopping all services (production)..."; \
		docker compose -f docker compose.prod.yml --env-file .env.production down; \
		echo "✅ All services stopped"; \
	elif docker compose -f docker compose.local.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🛑 Stopping infrastructure services (local)..."; \
		docker compose -f docker compose.local.yml --env-file .env.development down; \
		echo "✅ Infrastructure stopped"; \
		echo "💡 Apps are running natively - stop them manually (Ctrl+C)"; \
	else \
		echo "⚠️  No running containers found. Start services with 'make up-dev', 'make up-prod', or 'make up-local'"; \
	fi

logs:
	@if docker compose -f docker compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "📋 Detected development environment - showing all logs..."; \
		docker compose -f docker compose.dev.yml --env-file .env.development logs -f; \
	elif docker compose -f docker compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "📋 Detected production environment - showing all logs..."; \
		docker compose -f docker compose.prod.yml --env-file .env.production logs -f; \
	else \
		echo "⚠️  No running containers found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

logs-webapp:
	@if docker compose -f docker compose.dev.yml --env-file .env.development ps -q webapp 2>/dev/null | grep -q .; then \
		docker compose -f docker compose.dev.yml --env-file .env.development logs -f webapp; \
	elif docker compose -f docker compose.prod.yml --env-file .env.production ps -q webapp 2>/dev/null | grep -q .; then \
		docker compose -f docker compose.prod.yml --env-file .env.production logs -f webapp; \
	else \
		echo "⚠️  Webapp container not found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

logs-backend:
	@if docker compose -f docker compose.dev.yml --env-file .env.development ps -q rest-api 2>/dev/null | grep -q .; then \
		docker compose -f docker compose.dev.yml --env-file .env.development logs -f rest-api hocuspocus-server hocuspocus-worker; \
	elif docker compose -f docker compose.prod.yml --env-file .env.production ps -q rest-api 2>/dev/null | grep -q .; then \
		docker compose -f docker compose.prod.yml --env-file .env.production logs -f rest-api hocuspocus-server hocuspocus-worker; \
	else \
		echo "⚠️  Backend containers not found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

restart:
	@if docker compose -f docker compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🔄 Restarting all services (development)..."; \
		docker compose -f docker compose.dev.yml --env-file .env.development restart; \
		echo "✅ All services restarted"; \
	elif docker compose -f docker compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "🔄 Restarting all services (production)..."; \
		docker compose -f docker compose.prod.yml --env-file .env.production restart; \
		echo "✅ All services restarted"; \
	else \
		echo "⚠️  No running containers found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

# =============================================================================
# CLEANUP COMMANDS
# =============================================================================

clean:
	@if docker compose -f docker compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🧹 Cleaning up (development)..."; \
		docker compose -f docker compose.dev.yml --env-file .env.development down -v; \
		docker rmi docsplus-webapp:dev 2>/dev/null || true; \
		echo "✅ Development cleanup complete"; \
	elif docker compose -f docker compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "🧹 Cleaning up (production)..."; \
		docker compose -f docker compose.prod.yml --env-file .env.production down -v; \
		docker rmi docsplus-webapp:latest docsplus-hocuspocus:latest 2>/dev/null || true; \
		echo "✅ Production cleanup complete"; \
	elif docker compose -f docker compose.local.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🧹 Cleaning up (local)..."; \
		docker compose -f docker compose.local.yml --env-file .env.development down -v; \
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
	@if docker compose -f docker compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		docker compose -f docker compose.dev.yml --env-file .env.development ps; \
	elif docker compose -f docker compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		docker compose -f docker compose.prod.yml --env-file .env.production ps; \
	elif docker compose -f docker compose.local.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		docker compose -f docker compose.local.yml --env-file .env.development ps; \
		echo ""; \
		echo "💡 Apps are running natively (not shown above)"; \
	else \
		echo "⚠️  No running containers found. Start services with 'make up-dev', 'make up-prod', or 'make up-local'"; \
	fi

stats:
	@if docker compose -f docker compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		docker stats $$(docker compose -f docker compose.dev.yml --env-file .env.development ps -q); \
	elif docker compose -f docker compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		docker stats $$(docker compose -f docker compose.prod.yml --env-file .env.production ps -q); \
	else \
		echo "⚠️  No running containers found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

# =============================================================================
# SUPABASE COMMANDS
# =============================================================================

supabase-start:
	@echo "🚀 Starting Supabase local instance..."
	@if [ ! -f .env.local ]; then \
		echo "⚠️  Warning: .env.local not found. Creating from .env.development..."; \
		cp .env.development .env.local 2>/dev/null || true; \
	fi
	@cd packages/supabase && bun run start
	@echo "✅ Supabase started"

supabase-stop:
	@echo "🛑 Stopping Supabase local instance..."
	@cd packages/supabase && bun run stop
	@echo "✅ Supabase stopped"

supabase-status:
	@echo "📊 Supabase local instance status:"
	@cd packages/supabase && bun run status

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
		docker compose -f docker compose.prod.yml --env-file .env.production up -d; \
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
