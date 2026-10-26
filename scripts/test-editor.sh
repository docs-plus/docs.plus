#!/usr/bin/env bash
# Editor browser tests on the /editor playground. No REST, WS or Supabase server runs.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# run-tests.sh parses Cypress box-drawing output; a POSIX locale counts 0 specs.
export LC_ALL=C.UTF-8
export TEST_PORT="${EDITOR_PORT:-3212}"
export CYPRESS_PARALLEL="${CYPRESS_PARALLEL:-1}"
# Cypress 16 removed Cypress.env(). CYPRESS_EXPOSE sets the config `expose` object,
# so the filter specs read Cypress.expose('EDITOR_ONLY_STACK') and skip.
export CYPRESS_EXPOSE='{"EDITOR_ONLY_STACK":true}'

exec bash scripts/test-standalone-webapp.sh editor
