#!/usr/bin/env bash
# Usage: notify-e2e-red-after-green.sh <workflow-file> <text>
# Alerts only when the last finished push run on main was green (#557 mode a).
# Reads GH_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_NUMBER and
# GITHUB_RUN_ATTEMPT. Fails open on API errors. Never fails the caller.
set -u
WF="${1:-}"
TEXT="${2:-}"
REPO="${GITHUB_REPOSITORY:-}"
RUN_ID="${GITHUB_RUN_ID:-0}"
RUN_NUMBER="${GITHUB_RUN_NUMBER:-0}"
NOTIFY="$(dirname "$0")/../../scripts/ci/notify-telegram.sh"

alert() {
  bash "${NOTIFY}" - "$1"
  exit 0
}

# Attempt 1 already decided for this SHA; a rerun must not alert twice.
if [ "${GITHUB_RUN_ATTEMPT:-1}" -gt 1 ] 2>/dev/null; then
  echo "Rerun (attempt ${GITHUB_RUN_ATTEMPT}), no alert"
  exit 0
fi

case "${RUN_ID}${RUN_NUMBER}" in
  *[!0-9]*) RUN_ID=0 RUN_NUMBER=0 ;;
esac

# The current run is still in progress, so status=completed leaves it out.
# Cancelled and skipped runs say nothing about the suite, so look past them.
PREV=$(gh api "repos/${REPO}/actions/workflows/${WF}/runs?branch=main&event=push&status=completed&per_page=50" \
  --jq "[.workflow_runs[] | select(.id != ${RUN_ID} and .run_number < ${RUN_NUMBER} and .conclusion != null and .conclusion != \"cancelled\" and .conclusion != \"skipped\")][0] | select(. != null) | \"\(.id) \(.run_number) \(.conclusion)\"" \
  2>/dev/null) || PREV=""

if [ -z "${PREV}" ]; then
  echo "::warning::Could not read the previous ${WF} push run; alerting anyway"
  alert "${TEXT} (previous state unknown)"
fi

read -r PREV_ID PREV_NUMBER PREV_CONCLUSION <<<"${PREV}"
if [ "${PREV_CONCLUSION}" = "success" ]; then
  echo "Previous run ${PREV_ID} (#${PREV_NUMBER}) was success; red after green, alerting"
  alert "${TEXT}"
fi

echo "Previous run ${PREV_ID} (#${PREV_NUMBER}) was ${PREV_CONCLUSION}; suite already red, no alert"
exit 0
