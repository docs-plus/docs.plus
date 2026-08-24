#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

bun run --filter @docs.plus/floating-popover build
bun run --filter @docs.plus/floating-tooltip build
ONLY_ARGS=()
for e in ${EXT_ONLY:-}; do ONLY_ARGS+=( --only "$e" ); done
list=$(bun scripts/publishable-extensions.ts "${ONLY_ARGS[@]}") || exit 1

# hypermultimedia's playground fixture imports @docs.plus/extension-hyperlink,
# which resolves only through its built dist/.
if grep -qx extension-hypermultimedia <<< "$list" && ! grep -qx extension-hyperlink <<< "$list"; then
  bun run --filter @docs.plus/extension-hyperlink build
fi

while read -r ext; do
  bun run --filter "@docs.plus/${ext}" build
done <<< "$list"
