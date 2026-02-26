#!/usr/bin/env bash
# Fix "failed to register layer" / overlay2 "no such file or directory" (Docker/OrbStack storage).
# Run: ./scripts/docker-build-clean.sh then retry make validate-prod-build

set -e
echo "Cleaning Docker build cache and unused data..."
docker builder prune -af
docker system prune -af --volumes=false
echo "Done. Restart Docker (OrbStack/Docker Desktop) if the error persists, then run: make validate-prod-build"
