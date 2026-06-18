#!/usr/bin/env bash
# Evaluates AGENTS.md deploy commit-message triggers. Writes deploy=true|false to
# GITHUB_OUTPUT when set; otherwise prints deploy status to stdout and exits 0/1.
set -euo pipefail

usage() {
  echo "usage: evaluate-deploy-trigger.sh <prod|uptime-kuma>" >&2
  exit 2
}

MODE="${1:-}"
COMMIT_MSG="${COMMIT_MSG:-}"

[ -n "${MODE}" ] || usage
[ -n "${COMMIT_MSG}" ] || usage

emit() {
  local value="$1"
  local reason="$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "deploy=${value}" >> "${GITHUB_OUTPUT}"
    echo "reason=${reason}" >> "${GITHUB_OUTPUT}"
  fi
  echo "${reason}"
  [ "${value}" = "true" ]
}

case "${MODE}" in
  prod)
    if printf '%s' "${COMMIT_MSG}" | grep -Eq '(^|[[:space:]])\(build\):[[:space:]]+(front([[:space:]]+back)?|back([[:space:]]+front)?)([[:space:]]|$)'; then
      emit true '(build): prod trigger matched'
    else
      emit false 'no (build): prod trigger'
      exit 1
    fi
    ;;
  uptime-kuma)
    if printf '%s' "${COMMIT_MSG}" | grep -Eq '(^|[[:space:]])\(build\):[[:space:]]+uptime-kuma([[:space:]]|$)'; then
      emit true '(build): uptime-kuma trigger matched'
    else
      emit false 'no (build): uptime-kuma trigger'
      exit 1
    fi
    ;;
  *)
    usage
    ;;
esac
