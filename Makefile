# Start backend development server with PostgreSQL
back_dev:
	cd packages/hocuspocus.server && bun run dev:pg --trace-deprecation

# Start backend WebSocket server
back_ws:
	cd packages/hocuspocus.server && bun run dev:ws --trace-deprecation

# Start Supabase development server
supabase_start:
	cd packages/Supabase && npm run start

# Stop Supabase server
supabase_stop:
	cd packages/Supabase && npm run stop

# Display Supabase status
supabase_status:
	cd packages/supabase && npm run status

# Prepare seed.sql by concatenating all SQL files from scripts directory
prepare-seed:
	@echo "Preparing seed.sql file..."
	@cd packages/supabase && \
	if [ -f seed.sql ]; then \
		echo "" > seed.sql; \
		echo "Cleared existing seed.sql"; \
	fi; \
	for file in scripts/*.sql; do \
		if [ -f "$$file" ]; then \
			echo "\n-- Including $$file" >> seed.sql; \
			cat "$$file" >> seed.sql; \
			echo "Added $$file to seed.sql"; \
		fi; \
	done; \
	echo "Seed preparation completed."

# Resets the local database to a clean state.
supabase-reset:
	@echo "Resetting the database..."
	@read -p "Are you sure you want to reset the database? [y/N]: " confirm; \
	if [ "$$confirm" = "y" ]; then \
		make prepare-seed && \
		cd packages/supabase && pnpm db:reset; \
	else \
		echo "Database reset canceled."; \
	fi

# Start frontend development server
front_dev:
	cd packages/webapp && npm run dev --trace-deprecation

# Run backend, WebSocket and frontend development servers concurrently
local:
	make -j 4 supabase_start back_dev back_ws front_dev

# Run Cypress tests
cypress_open:
	cd packages/webapp && npm run cypress:open

cypress_run:
	cd packages/webapp && npm run cypress:run

# Start editor development server
dev_editor:
	cd packages/webapp && npm run dev

# Start Hocus Pocus development server
dev_editor_hocuspocus:
	cd packages/web && npm run hocuspocus:server

# Run editor and Hocus Pocus development servers concurrently
editor:
	make -j 2 dev_editor_hocuspocus dev_editor

# Build the application
build:
	cd packages/web && rm -rf dist && npm run build
	cd packages/hocuspocus.server && docker-compose -f docker-compose.prod.yml up

# Run the application without building
fastRun:
	docker-compose -f docker-compose.prod.yml up

# Build and run frontend in stage environment with monitoring
build_front_stage:
	@echo "🏗️  Building and deploying to stage environment..."
	@cd packages/webapp && \
	NODE_ENV=production npm run build && \
	npm run pm2:start:stage && \
	sleep 10 && \
	curl -f http://localhost:3000/api/health || (echo "❌ Stage health check failed" && pm2 logs nextjs_stage --lines 20 && exit 1) && \
	echo "✅ Stage deployment completed!"

# Build and run frontend in production environment with optimization
build_front_production:
	@echo "🚀 Starting production deployment..."
	@echo "📊 Pre-deployment system check..."
	@cd packages/webapp && \
	echo "Memory usage:" && free -h && \
	echo "Disk space:" && df -h . && \
	echo "📈 Build size analysis:" && \
	du -sh .next/ && \
	echo "🔄 Starting PM2 deployment..." && \
	npm run pm2:start:prod && \
	echo "⏳ Waiting for application startup..." && \
	sleep 15 && \
	echo "🩺 Running health check..." && \
	curl -f http://localhost:3001/api/health || (echo "❌ Health check failed" && pm2 logs nextjs_production --lines 20 && exit 1) && \
	echo "✅ Production deployment completed successfully!" && \
	echo "📊 Final PM2 status:" && \
	npm run pm2:status

# Build, stop and remove the existing stage container, and run a new stage container
build_hocuspocus.server_stage: down_stage
	cd packages/hocuspocus.server && env ENVIRONMENT=stage docker-compose -p stage-docsplus build --no-cache
	cd packages/hocuspocus.server && env ENVIRONMENT=stage docker-compose -p stage-docsplus up -d

# Stop and remove the stage container, and remove the local stage image
down_stage:
	cd packages/hocuspocus.server && env ENVIRONMENT=stage docker-compose -p stage-docsplus down --rmi local

# Build, stop and remove the existing production container, and run a new production container
build_hocuspocus.server_prod: down_prod
	@echo "Checking for existing containers..."
	@if docker ps | grep -q "prod-docsplus"; then \
		echo "Found running containers. Stopping gracefully..."; \
		docker-compose -p prod-docsplus stop || true; \
	fi
	@echo "Building and starting new containers..."
	cd packages/hocuspocus.server && env ENVIRONMENT=prod docker-compose -p prod-docsplus build --no-cache
	cd packages/hocuspocus.server && env ENVIRONMENT=prod docker-compose -p prod-docsplus up -d
	@echo "Deployment completed successfully."

# Stop and remove the production container, and remove the local production imageq
down_prod:
	cd packages/hocuspocus.server && env ENVIRONMENT=prod docker-compose -p prod-docsplus down --rmi local

# Build and run Uptime Kuma
build_uptime_kuma:
	docker compose -f docker-compose.uptime-kuma.yml down
	docker compose -f docker-compose.uptime-kuma.yml pull
	docker compose -f docker-compose.uptime-kuma.yml up -d

# Stop and remove Uptime Kuma
down_uptime_kuma:
	docker compose -f docker-compose.uptime-kuma.yml down


help: # Show available commands
	@echo "Available commands:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?# .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?# "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: help

generate_supabase_types: # Generate Supabase TypeScript types
	cd packages/supabase && yarn supabase:types

# Frontend monitoring and troubleshooting commands
pm2_status: # Show PM2 process status
	cd packages/webapp && npm run pm2:status

pm2_logs: # Show PM2 logs for production
	cd packages/webapp && npm run pm2:logs:prod

pm2_logs_error: # Show PM2 error logs only
	cd packages/webapp && npm run pm2:logs:error

pm2_restart: # Restart production frontend
	cd packages/webapp && npm run pm2:restart

pm2_reload: # Graceful reload production frontend
	cd packages/webapp && npm run pm2:reload

pm2_monitor: # Open PM2 monitoring dashboard
	cd packages/webapp && npm run pm2:monitor

health_check: # Manual health check
	@echo "🩺 Running health check..."
	@curl -s http://localhost:3001/api/health | jq '.' || echo "❌ Health check failed or jq not installed"

system_info: # Show system information
	@echo "📊 System Information:"
	@echo "Memory usage:" && free -h
	@echo "Disk usage:" && df -h
	@echo "CPU usage:" && top -bn1 | grep "Cpu(s)"
	@echo "PM2 processes:" && pm2 list

cleanup_logs: # Clean up old log files
	cd packages/webapp && npm run logs:cleanup && echo "✅ Log cleanup completed"

# Production deployment with rollback capability
deploy_production_safe: # Safe production deployment with auto-rollback
	@echo "🚀 Starting safe production deployment..."
	@cd packages/webapp && \
	if [ -d ".next" ]; then \
		echo "📦 Creating backup..." && \
		cp -r .next .next.backup.$$(date +%Y%m%d-%H%M%S); \
	fi && \
	if make build_front_production; then \
		echo "✅ Deployment successful!"; \
	else \
		echo "❌ Deployment failed, attempting rollback..." && \
		if [ -d ".next.backup.*" ]; then \
			LATEST_BACKUP=$$(ls -t .next.backup.* | head -n1) && \
			rm -rf .next && \
			mv $$LATEST_BACKUP .next && \
			npm run pm2:restart && \
			echo "🔄 Rollback completed"; \
		fi && \
		exit 1; \
	fi
