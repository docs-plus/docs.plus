#!/usr/bin/env bash
# Isolated browser contract tests. The Cypress fixtures own all Supabase HTTP data.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -z "${NEXT_PUBLIC_VIRTUOSO_LICENSE:-}" ]; then
  echo "Set NEXT_PUBLIC_VIRTUOSO_LICENSE to a valid Virtuoso Message List license."
  exit 1
fi

export TZ=UTC
export NODE_ENV=production
export NEXT_PUBLIC_E2E=true
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key
export NEXT_PUBLIC_RESTAPI_URL=http://localhost:4000
export NEXT_PUBLIC_PROVIDER_URL=ws://localhost:1234
export CHATROOM_PORT="${CHATROOM_PORT:-3211}"
export BASE_URL="http://127.0.0.1:${CHATROOM_PORT}"
export CYPRESS_PARALLEL=1
export CI=true

# Never accidentally run against a developer's existing server.
node -e '
  const net = require("node:net")
  const port = Number(process.env.CHATROOM_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) process.exit(1)
  const server = net.createServer()
  server.on("error", (error) => { console.error(error.message); process.exit(1) })
  server.listen(port, "127.0.0.1", () => server.close())
'

mkdir -p Notes
bun scripts/check-next-server.ts
bash scripts/build-extensions.sh
bun run --filter @docs.plus/webapp build:ci

# Next's standalone output does not copy public or static assets automatically.
STANDALONE_DIR="$ROOT_DIR/apps/webapp/.next/standalone/apps/webapp"
mkdir -p "$STANDALONE_DIR/public" "$STANDALONE_DIR/.next/static"
cp -R "$ROOT_DIR/apps/webapp/public/." "$STANDALONE_DIR/public/"
cp -R "$ROOT_DIR/apps/webapp/.next/static/." "$STANDALONE_DIR/.next/static/"
(
  cd "$STANDALONE_DIR"
  exec env PORT="$CHATROOM_PORT" HOSTNAME=127.0.0.1 node server.js
) > "$ROOT_DIR/Notes/chatroom-server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; rm -rf "$ROOT_DIR/apps/webapp/.next"' EXIT

READY=false
for attempt in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    cat Notes/chatroom-server.log
    exit 1
  fi
  if curl -fsS --connect-timeout 2 --max-time 3 "$BASE_URL/api/health" > /dev/null; then
    READY=true
    break
  fi
  sleep 1
done
if [ "$READY" != true ]; then
  cat Notes/chatroom-server.log
  echo "The chatroom test server did not become ready."
  exit 1
fi

bash scripts/run-tests.sh --e2e --scope chatroom
