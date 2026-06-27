#!/usr/bin/env sh
# Run from monorepo root; app and prisma live under apps/hocuspocus.server

set -e
cd /app/apps/hocuspocus.server || exit 1

echo "🔄 Entrypoint starting (monorepo layout)..."
# Self-migrate is default-on (dev/local). In prod RUN_MIGRATIONS=0 and a one-shot
# `migrate` service runs migrations once, fail-fast, before any app replica starts.
# No mask, no timeout: under `set -e` a failed migration now stops boot loudly
# instead of booting a half-migrated app behind a green /health check.
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "🔄 Running database migrations..."
  bunx prisma@6.19.3 migrate deploy
  echo "✅ Migrations done"
fi
echo "🚀 Starting: $*"
exec "$@"
