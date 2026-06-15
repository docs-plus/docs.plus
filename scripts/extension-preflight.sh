#!/usr/bin/env bash
# Run prepublishOnly on all five publishable extensions (CI extension-tests job).
set -euo pipefail

cd "$(dirname "$0")/.."
export npm_config_user_agent="bun/${BUN_VERSION:-1.3.14}"

while read -r dir; do
  echo "preflight @docs.plus/${dir}"
  bun run --filter "@docs.plus/${dir}" prepublishOnly
done < <(bun scripts/publishable-extensions.ts)

# Both consumers style the one global .floating-tooltip class; the skins must
# stay byte-identical or cascade order decides which bundle wins (AGENTS.md
# §Shared Library Config).
tooltip_skin() {
  sed -n '/^\.floating-tooltip/,/^}/p' "$1"
}
if ! diff -q \
  <(tooltip_skin extensions/extension-hyperlink/src/styles.css) \
  <(tooltip_skin extensions/extension-hypermultimedia/src/styles/media-toolbar.css) >/dev/null; then
  echo "error: .floating-tooltip skins out of lockstep between extension-hyperlink/src/styles.css and extension-hypermultimedia/src/styles/media-toolbar.css" >&2
  exit 1
fi
echo "lockstep .floating-tooltip skins: identical"
