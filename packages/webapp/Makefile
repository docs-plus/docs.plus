# Makefile for Docsy Webapp Docker (Monorepo)

.PHONY: help build build-local up up-prod down logs logs-prod logs-webapp-api clean dev scale

help:
	@echo "Docsy Webapp Docker Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev       - Start development environment"
	@echo "  make build-local - Build locally (without Docker)"
	@echo ""
	@echo "Production:"
	@echo "  make build     - Build Docker image"
	@echo "  make up-prod   - Start production containers"
	@echo "  make scale     - Scale to 3 replicas"
	@echo ""
	@echo "Management:"
	@echo "  make down      - Stop containers"
	@echo "  make logs      - View dev logs"
	@echo "  make logs-webapp-api - View webapp + rest-api logs (dev)"
	@echo "  make logs-prod - View production logs"
	@echo "  make clean     - Clean everything"

# Build locally (without Docker) - builds extensions first, then webapp
build-local:
	@echo "🏗️  Building monorepo packages..."
	@cd ../.. && bun run build

# Build Docker image (from monorepo root using docker-compose to load .env)
build:
	@echo "🐳 Building Docker image..."
	@cd ../.. && docker-compose -f docker-compose.prod.yml --env-file .env.production build webapp

# Development
dev:
	@echo "🚀 Starting development environment..."
	@docker-compose -f docker/docker-compose.dev.yml up --build

# Production
up-prod: build
	@echo "🚀 Starting production containers..."
	@docker-compose -f docker/docker-compose.prod.yml up -d

# Scale production
scale: build
	@echo "📈 Scaling to 3 replicas..."
	@docker-compose -f docker/docker-compose.prod.yml up -d --scale app=3

# Stop containers
down:
	@docker-compose -f docker/docker-compose.dev.yml down 2>/dev/null || true
	@docker-compose -f docker/docker-compose.prod.yml down 2>/dev/null || true
	@echo "✅ Containers stopped"

# View logs
logs:
	@docker-compose -f docker/docker-compose.dev.yml logs -f

logs-webapp-api:
	@echo "📋 Viewing webapp + rest-api logs (development)..."
	@cd ../.. && docker-compose -f docker-compose.dev.yml --env-file .env.development logs -f webapp rest-api

logs-prod:
	@docker-compose -f docker/docker-compose.prod.yml logs -f app

# Clean everything
clean:
	@echo "🧹 Cleaning up..."
	@docker-compose -f docker/docker-compose.dev.yml down -v 2>/dev/null || true
	@docker-compose -f docker/docker-compose.prod.yml down -v 2>/dev/null || true
	@docker rmi docsy-webapp:latest docsy-webapp:dev 2>/dev/null || true
	@docker system prune -f
	@echo "✅ Cleanup complete"

