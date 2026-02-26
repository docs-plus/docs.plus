#!/usr/bin/env sh
# Run from monorepo root; app and prisma live under packages/hocuspocus.server

set -e
cd /app/packages/hocuspocus.server || exit 1

echo "🔄 Entrypoint starting (monorepo layout)..."
echo "🔄 Running database migrations..."

MIGRATION_FAILED=0
# Prisma is devDep; image uses --production so CLI comes from bunx only
timeout 30 bunx prisma@6.19.0 migrate deploy || MIGRATION_FAILED=1

if [ "$MIGRATION_FAILED" -eq 1 ]; then
  echo "⚠️  Database migration failed, continuing to start service..."
fi

echo "✅ Migrations done"
echo "🚀 Starting: $*"
exec "$@"
