# Docker Migration Fix Guide

## 🐳 Fix Migration in Running Container

### Option 1: Fix Inside Running Container

```bash
# Get container ID
docker ps

# Execute fix script inside container
docker exec -it <container_id> ./fix-docker.sh

# Restart PM2 processes
docker exec -it <container_id> bunx pm2 restart all
```

### Option 2: Fix with Docker Compose

```bash
# Stop services
docker-compose down

# Build and start with the new scripts
docker-compose up --build

# If migration still fails, run fix in container
docker-compose exec backend ./fix-docker.sh
```

### Option 3: Manual Fix

```bash
# Enter container
docker exec -it <container_id> /bin/sh

# Run fix script
bun fix-migration.js

# Restart PM2
bunx pm2 restart all
```

## 🚀 Scripts Available

- `fix-migration.js` - Fixes the stuck migration
- `start-production.js` - Robust startup with auto-recovery
- `fix-docker.sh` - Docker-specific fix script

## 📦 Bun Commands

- `bun run fix:migration` - Fix migration
- `bun run start:production:rest` - Start REST API
- `bun run start:production:ws` - Start WebSocket server
