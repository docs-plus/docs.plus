#!/usr/bin/env bash
# Self-contained test harness for detect-cancel-gap.sh (no bats dependency).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${HERE}/detect-cancel-gap.sh"
PASS=0; FAIL=0

# check <stdin> <expected force> <expected reason> <label>
check() {
  local out force reason
  out="$(printf '%s' "$1" | GITHUB_OUTPUT='' bash "${SCRIPT}" 2>/dev/null)"
  force="$(printf '%s\n' "${out}" | sed -n 's/^force=//p')"
  reason="$(printf '%s\n' "${out}" | sed -n 's/^reason=//p')"
  if [ "${force} ${reason}" = "$2 $3" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL [$4]: expected '$2 $3' got '${force} ${reason}'"; fi
}
job() { printf '{"name":"%s","status":"%s","conclusion":%s}' "$1" "$2" "$3"; }

gates_done="$(job '🔎 Detect Changes' completed '"success"'),$(job '📝 Type Check' completed '"success"'),$(job '🔧 Backend Validation' completed '"skipped"')"
deploy_cut="$(job '🚀 Deploy Production' completed '"cancelled"'),$(job '🔭 Deploy Observability / 🔭 Deploy Observability' completed '"cancelled"')"

check 'null' false no-previous-run no-previous-run
check '{"status":"completed","conclusion":"success","jobs":[]}' false previous-run-ended previous-success
check "{\"status\":\"completed\",\"conclusion\":\"failure\",\"jobs\":[$(job '📝 Type Check' completed '"failure"')]}" false previous-run-ended previous-failure
# Run 42643193705: cancelled after every gate ended.
check "{\"status\":\"completed\",\"conclusion\":\"cancelled\",\"jobs\":[${gates_done},${deploy_cut}]}" false previous-gates-ended cancelled-after-gates
# Run 40072782268: cancelled mid-gate.
check "{\"status\":\"completed\",\"conclusion\":\"cancelled\",\"jobs\":[${gates_done},$(job '📝 Type Check' completed '"cancelled"')]}" true forced-after-cancel cancelled-mid-gate
check "{\"status\":\"in_progress\",\"conclusion\":null,\"jobs\":[${gates_done},$(job '🧪 Ext (extension-mermaid)' in_progress null)]}" true forced-after-cancel in-progress-gate
check "{\"status\":\"in_progress\",\"conclusion\":null,\"jobs\":[${gates_done},$(job '🚀 Deploy Production' in_progress null)]}" false previous-gates-ended in-progress-deploy-only
check '{"status":"queued","conclusion":null,"jobs":[]}' true forced-after-cancel queued-no-jobs
# Run 40072862372: cancelled while queued, so it has no jobs.
check '{"status":"completed","conclusion":"cancelled","jobs":[]}' true forced-after-cancel cancelled-no-jobs
check '{"status":"completed","conclusion":"cancelled","jobs":null}' true forced-unreadable-run no-job-list
check '' true forced-unreadable-run empty-input

echo "PASS=${PASS} FAIL=${FAIL}"
[ "${FAIL}" -eq 0 ]
