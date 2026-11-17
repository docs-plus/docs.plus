#!/usr/bin/env bash
# Reads the previous push run on stdin as {status, conclusion, jobs}, or `null`
# when there is none. A new push cancels that run, so its files may never be
# path-tested (#759). Force every scope when it ended early, or still runs,
# before all its gate jobs ended. Unreadable input forces too.
set -uo pipefail

emit() { # key value
  [ -n "${GITHUB_OUTPUT:-}" ] && printf '%s=%s\n' "$1" "$2" >> "${GITHUB_OUTPUT}"
  printf '%s=%s\n' "$1" "$2"
}

# Deploy-chain jobs are not gates. A renamed one counts as a gate, which only forces more.
verdict="$(jq -er '
  ["🧱 Build Images", "🚀 Deploy Production", "🧹 Remove Unshipped Images",
   "🔭 Deploy Observability", "🔔 Deploy Uptime Kuma", "📊 Run Report"] as $deploy
  | if . == null then "no-previous-run"
    elif .status == "completed" and .conclusion != "cancelled" then "previous-run-ended"
    else [.jobs[] | select(.name as $n | any($deploy[]; . as $p | $n | startswith($p)) | not)] as $gates
      | if ($gates | length) > 0 and all($gates[]; .status == "completed" and .conclusion != "cancelled")
        then "previous-gates-ended" else "forced-after-cancel" end
    end')" || verdict=forced-unreadable-run

case "${verdict}" in
  forced-*) emit force true ;;
  *) emit force false ;;
esac
echo "reason=${verdict}"
