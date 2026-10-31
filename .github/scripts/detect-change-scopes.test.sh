#!/usr/bin/env bash
# Self-contained test harness for detect-change-scopes.sh (no bats dependency).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${HERE}/detect-change-scopes.sh"
PASS=0; FAIL=0

# run <files, one per line> [ALL_SCOPES] [FILE_COUNT, default: the line count] -> sets OUT
run() {
  local count="${3-auto}"
  [ "${count}" != auto ] || count="$(printf '%s' "$1" | grep -c . || true)"
  OUT="$(printf '%s\n' "$1" | ALL_SCOPES="${2:-false}" FILE_COUNT="${count}" GITHUB_OUTPUT='' bash "${SCRIPT}" 2>/dev/null)"
}
# expect <webapp> <admin> <backend> <docs_only> <label>
expect() {
  local got; got="$(printf '%s\n' "${OUT}" | grep -E '^(webapp|admin|backend|docs_only)=' | cut -d= -f2 | tr '\n' ' ')"
  if [ "${got}" = "$1 $2 $3 $4 " ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL [$5]: expected '$1 $2 $3 $4' got '${got}'"; fi
}

run $'README.md\ndocs/api/README.md\ndocs/assets/flow.png\n.github/ISSUE_TEMPLATE/bug_report.md\nLICENSE\n.github/WORKFLOWS.md'
expect false false false true docs-only
run 'apps/webapp/src/utils/titleWrite.ts';                   expect true false false false webapp-only
run 'extensions/extension-mermaid/assets/demo-dark.gif';     expect false false false false gif-only
run 'bun.lock';                                              expect true true true false lockfile
run 'extensions/extension-mermaid/README.md';                expect true false false false ext-readme
run 'extensions/extension-hyperlink/CHANGELOG.md';           expect true false true false backend-ext-changelog
run 'extensions/extension-mermaid/src/assets/icon.svg';      expect true false false false src-assets-not-media
run 'apps/webapp/src/notes.md';                              expect true false false false md-under-src
run 'apps/webapp/public/robots.md';                          expect true false false false md-under-public
run 'apps/admin-dashboard/src/app/page.tsx';                 expect false true false false admin-only
run 'apps/hocuspocus.server/src/index.ts';                   expect false false true false backend-only
run 'packages/supabase/scripts/12-buckets.sql';              expect true false true false supabase
run 'packages/floating-popover/src/index.ts';                expect true false true false floating
run 'packages/email-templates/src/index.ts';                 expect false false true false email-templates
run 'packages/pad-url/src/padUrlCore.ts';                    expect true false true false pad-url
run '.github/workflows/prod.docs.plus.yml';                  expect true true true false workflow-file
run 'tsconfig.base.json';                                    expect true true true false root-tsconfig
run 'apps/webapp/tsconfig.json';                             expect true false false false app-tsconfig
run 'packages/document-swarm/src/run.ts';                    expect true true true false unmatched
run $'README.md\napps/webapp/src/a.ts';                      expect true false false false docs-plus-code
run '' false 0;                                              expect true true true false no-files
run 'README.md' true;                                        expect true true true false forced
run 'packages/document-swarm/src/fixtures/academy.md';       expect true true true false md-under-package-src
run 'extensions/extension-mermaid/docs/guide.md';            expect false false false true ext-docs-folder
run 'extensions/extension-hypermultimedia/assets/readme-media/sample.mp4'; expect false false false false nested-assets
run 'extensions/extension-mermaid/demo.webp';                expect false false false false ext-root-media
run 'extensions/extension-hypermultimedia/cypress/fixtures/x.png'; expect true false true false media-outside-assets
run '.github/assets/social-preview.png';                     expect true true true false github-assets
run 'README.md' false 501;                                   expect true true true false too-many-files
run 'README.md' false 2;                                     expect true true true false count-mismatch
run 'README.md' false '';                                    expect true true true false no-file-count

echo "PASS=${PASS} FAIL=${FAIL}"
[ "${FAIL}" -eq 0 ]
