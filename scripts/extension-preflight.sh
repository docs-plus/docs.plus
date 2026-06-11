#!/usr/bin/env bash
# Run prepublishOnly on all five publishable extensions (CI extension-tests job).
set -euo pipefail

cd "$(dirname "$0")/.."
export npm_config_user_agent="bun/${BUN_VERSION:-1.3.14}"

while read -r dir; do
  echo "preflight @docs.plus/${dir}"
  bun run --filter "@docs.plus/${dir}" prepublishOnly
done < <(bun scripts/publishable-extensions.ts)
