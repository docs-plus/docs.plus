#!/usr/bin/env sh

echo "🔄 Entrypoint script starting..."
cd /app || exit 1

echo "🔄 Running database migrations..."

# Use Prisma CLI from node_modules (installed during build)
# This avoids slow bunx downloads at runtime
MIGRATION_FAILED=0
if [ -f "/app/node_modules/.bin/prisma" ]; then
  echo "📦 Using Prisma CLI from node_modules (fast)..."
  timeout 30 /app/node_modules/.bin/prisma migrate deploy || MIGRATION_FAILED=1
elif command -v bunx >/dev/null 2>&1; then
  echo "📦 Using bunx prisma (checks local cache first)..."
  # bunx checks local node_modules and cache before downloading
  timeout 30 bunx prisma migrate deploy || MIGRATION_FAILED=1
else
  echo "⚠️  Prisma CLI not found, skipping migrations..."
fi

if [ "$MIGRATION_FAILED" -eq 1 ]; then
  echo "⚠️  Database migration failed, but continuing to start service..."
fi

echo "✅ Migrations completed (or skipped)"
echo "🚀 Starting services..."
echo "📝 Received command: $*"
echo "📝 Number of args: $#"
echo "📝 Args: $@"

# Convert relative paths to absolute if needed
# Handle both "bun src/index.ts" (as string) and ["bun", "--watch", "src/index.ts"] (as array)
if [ "$#" -eq 3 ] && [ "$1" = "bun" ] && [ "$2" = "--watch" ] && echo "$3" | grep -q "^src/"; then
  FILE=$(echo "$3" | sed 's/^src\///')
  echo "🔄 Converting: bun --watch src/$FILE -> bun --watch /app/src/$FILE"
  exec bun --watch "/app/src/$FILE"
elif [ "$#" -eq 2 ] && [ "$1" = "bun" ] && echo "$2" | grep -q "^src/"; then
  FILE=$(echo "$2" | sed 's/^src\///')
  echo "🔄 Converting: bun src/$FILE -> bun /app/src/$FILE"
  exec bun "/app/src/$FILE"
elif echo "$*" | grep -q "bun.*src/"; then
  # Handle any bun command with src/ path
  if echo "$*" | grep -q "--watch"; then
    FILE=$(echo "$*" | sed 's/.*bun.*--watch.*src\///' | sed 's/ .*//')
    echo "🔄 Converting: bun --watch src/$FILE -> bun --watch /app/src/$FILE"
    exec bun --watch "/app/src/$FILE"
  else
    FILE=$(echo "$*" | sed 's/.*bun.*src\///' | sed 's/ .*//')
    echo "🔄 Converting: bun src/$FILE -> bun /app/src/$FILE"
    exec bun "/app/src/$FILE"
  fi
else
  echo "▶️  Executing original command: $@"
  exec "$@"
fi
