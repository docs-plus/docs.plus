#!/usr/bin/env sh
# Run from monorepo root; app and prisma live under apps/hocuspocus.server

set -e
cd /app/apps/hocuspocus.server || exit 1

echo "🔄 Entrypoint starting (monorepo layout)..."
echo "🔄 Running database migrations..."

MIGRATION_FAILED=0
# Prisma CLI is pre-warmed into the image (Dockerfile), so bunx runs offline.
# 120s covers a slow first-boot migration without silently skipping the schema.
timeout 120 bunx prisma@6.19.3 migrate deploy || MIGRATION_FAILED=1

if [ "$MIGRATION_FAILED" -eq 1 ]; then
  echo "⚠️  Database migration failed, continuing to start service..."
fi

echo "✅ Migrations done"
echo "🚀 Starting: $*"
exec "$@"
