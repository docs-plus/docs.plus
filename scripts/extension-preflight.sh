#!/usr/bin/env bash
# Run prepublishOnly on all five publishable extensions (CI extension-tests job).
set -euo pipefail

cd "$(dirname "$0")/.."
export npm_config_user_agent="bun/${BUN_VERSION:-1.3.14}"

# Build --only args from EXT_ONLY (space-separated dir names; empty = all five).
ONLY_ARGS=()
if [ -n "${EXT_ONLY:-}" ]; then
  for e in $EXT_ONLY; do ONLY_ARGS+=(--only "$e"); done
fi

while read -r dir; do
  echo "preflight @docs.plus/${dir}"
  bun run --filter "@docs.plus/${dir}" prepublishOnly
done < <(bun scripts/publishable-extensions.ts "${ONLY_ARGS[@]}")

# Both consumers style the one global .floating-tooltip class; the skins must
# stay byte-identical or cascade order decides which bundle wins (AGENTS.md
# §Shared Library Config).
# Guard: only run when both extensions are in scope.
# EXT_ONLY unset/empty → all five in scope → always run the diff.
LOCKSTEP=1
if [ -n "${EXT_ONLY:-}" ]; then
  in_scope() { case " ${EXT_ONLY} " in *" $1 "*) return 0;; *) return 1;; esac; }
  if ! { in_scope extension-hyperlink && in_scope extension-hypermultimedia; }; then
    LOCKSTEP=0
  fi
fi

if [ "$LOCKSTEP" -eq 1 ]; then
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
else
  echo "info: tooltip-skin lockstep diff skipped — both extension-hyperlink and extension-hypermultimedia not in scope"
fi
