#!/usr/bin/env bash
# Maps changed paths (one per line on stdin) to the CI scopes a change can
# affect. If a skip is not provable, every scope turns on.
# Keep the patterns in step with the scope table in .github/WORKFLOWS.md.
set -uo pipefail

MAX_FILES=500

emit() { # key value
  [ -n "${GITHUB_OUTPUT:-}" ] && printf '%s=%s\n' "$1" "$2" >> "${GITHUB_OUTPUT}"
  printf '%s=%s\n' "$1" "$2"
}
emit_all() { # webapp admin backend docs_only reason
  emit webapp "$1"; emit admin "$2"; emit backend "$3"; emit docs_only "$4"; emit reason "$5"
}
# Drain stdin first, so the writer upstream never dies of SIGPIPE under pipefail.
everything() { cat > /dev/null; emit_all true true true false "$1"; exit 0; }

[ "${ALL_SCOPES:-false}" = true ] && everything forced
case "${FILE_COUNT:-}" in ''|*[!0-9]*) everything no-file-count ;; esac
[ "${FILE_COUNT}" -gt "${MAX_FILES}" ] && everything too-many-files

webapp=false; admin=false; backend=false; total=0; docs=0
while IFS= read -r f; do
  [ -n "${f}" ] || continue
  total=$((total + 1))

  # Docs are neutral, except preflight inputs and anything under a src/ or the
  # served public/ folder. A case `*` also matches `/`, which only widens these.
  case "${f}" in
    extensions/*/README.md|extensions/*/CHANGELOG.md|src/*|*/src/*|apps/webapp/public/*) : ;;
    *.md|docs/*|.github/ISSUE_TEMPLATE/*|LICENSE) docs=$((docs + 1)); echo "docs      ${f}" >&2; continue ;;
  esac
  # Extension README media is neutral. Same set as `_readme_media` in .github/filters/extensions.yaml.
  if [[ "${f}" =~ ^extensions/[^/]+/(assets/|[^/]+\.(gif|png|jpe?g|webp|mp4)$) ]]; then
    echo "media     ${f}" >&2; continue
  fi

  case "${f}" in
    package.json|bun.lock|bunfig.toml|tsconfig*.json|tsup.base.ts|.github/*|scripts/*|packages/eslint-config/*|.prettierrc*|.prettierignore|eslint.config.*|.stylelintrc*|docker-compose*.yml)
      webapp=true; admin=true; backend=true; echo "shared    ${f}" >&2; continue ;;
  esac

  hit=false
  case "${f}" in apps/webapp/*|extensions/*|packages/floating-*|packages/supabase/*) webapp=true; hit=true ;; esac
  case "${f}" in apps/admin-dashboard/*) admin=true; hit=true ;; esac
  case "${f}" in
    apps/hocuspocus.server/*|packages/email-templates/*|packages/supabase/*|packages/floating-*|extensions/extension-hyperlink/*|extensions/extension-hypermultimedia/*|extensions/extension-inline-code/*)
      backend=true; hit=true ;;
  esac
  if [ "${hit}" = true ]; then
    echo "scoped    ${f}" >&2
  else
    webapp=true; admin=true; backend=true; echo "unmatched ${f}" >&2
  fi
done

[ "${total}" -gt 0 ] || everything no-files
[ "${total}" -eq "${FILE_COUNT}" ] || everything count-mismatch
docs_only=false
[ "${docs}" -eq "${total}" ] && docs_only=true
emit_all "${webapp}" "${admin}" "${backend}" "${docs_only}" "files=${total}"
