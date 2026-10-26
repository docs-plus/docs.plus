#!/usr/bin/env bash
# Isolated browser contract tests. The Cypress fixtures own all Supabase HTTP data.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -z "${NEXT_PUBLIC_VIRTUOSO_LICENSE:-}" ]; then
  echo "Set NEXT_PUBLIC_VIRTUOSO_LICENSE to a valid Virtuoso Message List license."
  exit 1
fi

export TEST_PORT="${CHATROOM_PORT:-3211}"
export CYPRESS_PARALLEL=1

exec bash scripts/test-standalone-webapp.sh chatroom
