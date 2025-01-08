# Start backend development server with PostgreSQL
back_dev:
	cd packages/hocuspocus.server && npm run dev:pg --trace-deprecation

# Start backend WebSocket server
back_ws:
	cd packages/hocuspocus.server && npm run dev:ws --trace-deprecation

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

# Build and run frontend in stage environment
build_front_stage:
	cd packages/webapp && npm run build && npm run pm2:start:stage

# Build and run frontend in production environment
build_front_production:
	cd packages/webapp && npm run build && npm run pm2:start:prod

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

# Stop and remove the production container, and remove the local production image
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
