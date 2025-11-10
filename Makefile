# =============================================================================
# Root Makefile - Full Stack Docker Orchestration
# Manages: Hocuspocus Server + Webapp + Infrastructure
# =============================================================================

.PHONY: help build build-dev up-prod up-dev down logs logs-webapp logs-backend restart clean scale scale-webapp scale-hocuspocus ps stats supabase-start supabase-stop supabase-status

help:
	@echo "Docsplus Full Stack Docker Commands"
	@echo ""
	@echo "Building:"
	@echo "  make build             - Build all services (production)"
	@echo "  make build-dev         - Build all services (development)"
	@echo ""
	@echo "Running:"
	@echo "  make up-prod           - Start all services (production)"
	@echo "  make up-dev            - Start all services (development)"
	@echo ""
	@echo "Scaling (production only):"
	@echo "  make scale-webapp      - Scale webapp to 3 replicas"
	@echo "  make scale-hocuspocus  - Scale hocuspocus services"
	@echo ""
	@echo "Management:"
	@echo "  make down              - Stop all services (auto-detects dev/prod)"
	@echo "  make logs              - View all logs (auto-detects dev/prod)"
	@echo "  make logs-webapp       - View webapp logs (auto-detects dev/prod)"
	@echo "  make logs-backend      - View backend logs (rest-api, hocuspocus-server, worker) (auto-detects dev/prod)"
	@echo "  make restart           - Restart all services (auto-detects dev/prod)"
	@echo "  make clean             - Clean everything (auto-detects dev/prod)"
	@echo ""
	@echo "Utilities:"
	@echo "  make ps                - Show running containers (auto-detects dev/prod)"
	@echo "  make stats             - Show resource usage"
	@echo ""
	@echo "Supabase:"
	@echo "  make supabase-start    - Start Supabase local instance"
	@echo "  make supabase-stop     - Stop Supabase local instance"
	@echo "  make supabase-status   - Show Supabase local instance status"

# =============================================================================
# BUILD COMMANDS
# =============================================================================

build:
	@echo "🏗️  Building all services (production)..."
	@docker-compose -f docker-compose.prod.yml --env-file .env.production build
	@echo "✅ All services built"

build-dev:
	@echo "🏗️  Building all services (development)..."
	@docker-compose -f docker-compose.dev.yml --env-file .env.development build
	@echo "✅ All services built"

# =============================================================================
# RUN COMMANDS
# =============================================================================

up-prod: build
	@echo "🚀 Starting full stack production environment..."
	@echo ""
	@echo "Services:"
	@echo "  📦 PostgreSQL (port 5432)"
	@echo "  🔴 Redis (port 6379)"
	@echo "  🔌 REST API (port 4000) - 2 replicas"
	@echo "  🌐 Hocuspocus WS (port 4001) - 3 replicas"
	@echo "  ⚙️  Worker (port 4002) - 2 replicas"
	@echo "  💻 Webapp (internal:3000) - 2 replicas"
	@echo "  🌍 Nginx (ports 3000:80, 443:443)"
	@echo ""
	@docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
	@echo ""
	@echo "✅ Full stack started!"
	@echo ""
	@echo "Access points:"
	@echo "  Webapp:     http://localhost:3000"
	@echo "  REST API:   http://localhost:4000"
	@echo "  WebSocket:  ws://localhost:4001"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  Redis:      localhost:6379"
	@echo ""
	@echo "Common commands:"
	@echo "  make logs              - View all logs (auto-detects dev/prod)"
	@echo "  make logs-webapp       - View webapp logs (auto-detects dev/prod)"
	@echo "  make logs-backend      - View backend logs (auto-detects dev/prod)"
	@echo "  make ps                - Show running containers (auto-detects dev/prod)"
	@echo "  make down              - Stop all services (auto-detects dev/prod)"
	@echo "  make restart           - Restart all services (auto-detects dev/prod)"

up-dev: build-dev
	@echo "🚀 Starting full stack development environment..."
	@echo "🧹 Cleaning up any existing containers..."
	@docker-compose -f docker-compose.dev.yml --env-file .env.development down 2>/dev/null || true
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
	@docker-compose -f docker-compose.dev.yml --env-file .env.development up -d
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
# SCALING COMMANDS
# =============================================================================

scale-webapp:
	@echo "📈 Scaling webapp to 3 replicas..."
	@docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --scale webapp=3
	@echo "✅ Webapp scaled to 3 replicas"

scale-hocuspocus:
	@echo "📈 Scaling hocuspocus services..."
	@docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --scale rest-api=3 --scale hocuspocus-server=5 --scale hocuspocus-worker=3
	@echo "✅ Hocuspocus services scaled"

# =============================================================================
# MANAGEMENT COMMANDS
# =============================================================================

down:
	@if docker-compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🛑 Stopping all services (development)..."; \
		docker-compose -f docker-compose.dev.yml --env-file .env.development down; \
		echo "✅ All services stopped"; \
	elif docker-compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "🛑 Stopping all services (production)..."; \
		docker-compose -f docker-compose.prod.yml --env-file .env.production down; \
		echo "✅ All services stopped"; \
	else \
		echo "⚠️  No running containers found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

logs:
	@if docker-compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "📋 Detected development environment - showing all logs..."; \
		docker-compose -f docker-compose.dev.yml --env-file .env.development logs -f; \
	elif docker-compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "📋 Detected production environment - showing all logs..."; \
		docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f; \
	else \
		echo "⚠️  No running containers found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

logs-webapp:
	@if docker-compose -f docker-compose.dev.yml --env-file .env.development ps -q webapp 2>/dev/null | grep -q .; then \
		docker-compose -f docker-compose.dev.yml --env-file .env.development logs -f webapp; \
	elif docker-compose -f docker-compose.prod.yml --env-file .env.production ps -q webapp 2>/dev/null | grep -q .; then \
		docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f webapp; \
	else \
		echo "⚠️  Webapp container not found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

logs-backend:
	@if docker-compose -f docker-compose.dev.yml --env-file .env.development ps -q rest-api 2>/dev/null | grep -q .; then \
		docker-compose -f docker-compose.dev.yml --env-file .env.development logs -f rest-api hocuspocus-server hocuspocus-worker; \
	elif docker-compose -f docker-compose.prod.yml --env-file .env.production ps -q rest-api 2>/dev/null | grep -q .; then \
		docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f rest-api hocuspocus-server hocuspocus-worker; \
	else \
		echo "⚠️  Backend containers not found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

restart:
	@if docker-compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🔄 Restarting all services (development)..."; \
		docker-compose -f docker-compose.dev.yml --env-file .env.development restart; \
		echo "✅ All services restarted"; \
	elif docker-compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "🔄 Restarting all services (production)..."; \
		docker-compose -f docker-compose.prod.yml --env-file .env.production restart; \
		echo "✅ All services restarted"; \
	else \
		echo "⚠️  No running containers found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

# =============================================================================
# CLEANUP COMMANDS
# =============================================================================

clean:
	@if docker-compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		echo "🧹 Cleaning up (development)..."; \
		docker-compose -f docker-compose.dev.yml --env-file .env.development down -v; \
		docker rmi docsy-webapp:dev docsy-rest-api docsy-hocuspocus-server docsy-hocuspocus-worker 2>/dev/null || true; \
		echo "✅ Development cleanup complete"; \
	elif docker-compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		echo "🧹 Cleaning up (production)..."; \
		docker-compose -f docker-compose.prod.yml --env-file .env.production down -v; \
		docker rmi docsy-webapp:latest docsy-hocuspocus:latest 2>/dev/null || true; \
		docker system prune -f; \
		echo "✅ Production cleanup complete"; \
	else \
		echo "🧹 No running containers found. Cleaning up images and volumes..."; \
		docker rmi docsy-webapp:dev docsy-webapp:latest docsy-rest-api docsy-hocuspocus-server docsy-hocuspocus-worker docsy-hocuspocus:latest 2>/dev/null || true; \
		docker system prune -f; \
		echo "✅ Cleanup complete"; \
	fi

# =============================================================================
# UTILITY COMMANDS
# =============================================================================

ps:
	@if docker-compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		docker-compose -f docker-compose.dev.yml --env-file .env.development ps; \
	elif docker-compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		docker-compose -f docker-compose.prod.yml --env-file .env.production ps; \
	else \
		echo "⚠️  No running containers found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

stats:
	@if docker-compose -f docker-compose.dev.yml --env-file .env.development ps -q 2>/dev/null | grep -q .; then \
		docker stats $$(docker-compose -f docker-compose.dev.yml --env-file .env.development ps -q); \
	elif docker-compose -f docker-compose.prod.yml --env-file .env.production ps -q 2>/dev/null | grep -q .; then \
		docker stats $$(docker-compose -f docker-compose.prod.yml --env-file .env.production ps -q); \
	else \
		echo "⚠️  No running containers found. Start services with 'make up-dev' or 'make up-prod'"; \
	fi

# =============================================================================
# SUPABASE COMMANDS
# =============================================================================

supabase-start:
	@echo "🚀 Starting Supabase local instance..."
	@cd packages/supabase && bun run start
	@echo "✅ Supabase started"

supabase-stop:
	@echo "🛑 Stopping Supabase local instance..."
	@cd packages/supabase && bun run stop
	@echo "✅ Supabase stopped"

supabase-status:
	@echo "📊 Supabase local instance status:"
	@cd packages/supabase && bun run status
