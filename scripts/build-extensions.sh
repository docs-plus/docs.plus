#!/usr/bin/env bash
# Build floating-popover + floating-tooltip + publishable extension dist/ trees (CI + local).
set -euo pipefail

cd "$(dirname "$0")/.."

bun run --filter @docs.plus/floating-popover build
bun run --filter @docs.plus/floating-tooltip build
while read -r ext; do
  bun run --filter "@docs.plus/${ext}" build
done < <(bun scripts/publishable-extensions.ts)
