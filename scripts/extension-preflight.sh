#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export npm_config_user_agent="bun/${BUN_VERSION:-1.3.14}"

ONLY_ARGS=()
if [ -n "${EXT_ONLY:-}" ]; then
  for e in $EXT_ONLY; do ONLY_ARGS+=(--only "$e"); done
fi

list=$(bun scripts/publishable-extensions.ts "${ONLY_ARGS[@]}") || exit 1
while read -r dir; do
  echo "preflight @docs.plus/${dir}"
  bun run --filter "@docs.plus/${dir}" prepublishOnly
done <<< "$list"

# Both packages style one global `.floating-tooltip`; skins must stay byte-identical
# or cascade order picks a winner (AGENTS.md §Shared Library Config). Always run:
# CI scopes EXT_ONLY to one matrix entry, so an EXT_ONLY guard never checked this.
# Fail closed on an empty extract — otherwise `diff` of two empties reports lockstep.
assert_lockstep() {
  local label=$1 left=$2 right=$3 where=$4
  if [ -z "$left" ] || [ -z "$right" ]; then
    echo "error: $label lockstep extractor matched nothing — the anchor was renamed ($where)" >&2
    exit 1
  fi
  if [ "$left" != "$right" ]; then
    echo "error: $label out of lockstep between $where" >&2
    exit 1
  fi
  echo "lockstep $label: identical"
}

tooltip_skin() {
  sed -n '/^\.floating-tooltip/,/^}/p' "$1"
}
assert_lockstep '.floating-tooltip skins' \
  "$(tooltip_skin extensions/extension-hyperlink/src/styles.css)" \
  "$(tooltip_skin extensions/extension-hypermultimedia/src/styles/media-toolbar.css)" \
  'extension-hyperlink/src/styles.css and extension-hypermultimedia/src/styles/media-toolbar.css'

# The two packages ship the same scheme blocklist. Adding a scheme to one and
# not the other opens a hole in the twin, so the constants must stay
# byte-identical. (They could share a bundled private package as the
# floating-* ones do; one regex does not earn a new package yet.)
scheme_re() {
  # To end of line, so a differing regex flag (e.g. a dropped `i`) is caught too.
  grep -oE 'DANGEROUS_SCHEME_RE = /.*$' "$1" || true
}
assert_lockstep 'DANGEROUS_SCHEME_RE' \
  "$(scheme_re extensions/extension-hyperlink/src/utils/validateURL.ts)" \
  "$(scheme_re extensions/extension-hypermultimedia/src/utils/mediaUrl.ts)" \
  'extension-hyperlink/src/utils/validateURL.ts and extension-hypermultimedia/src/utils/mediaUrl.ts'
