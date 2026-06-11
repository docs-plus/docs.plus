#!/usr/bin/env bash
# Build floating-popover + publishable extension dist/ trees (CI + local).
set -euo pipefail

cd "$(dirname "$0")/.."

bun run --filter @docs.plus/floating-popover build
while read -r ext; do
  bun run --filter "@docs.plus/${ext}" build
done < <(bun scripts/publishable-extensions.ts)
