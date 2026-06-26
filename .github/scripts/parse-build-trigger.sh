#!/usr/bin/env bash
# Semantic deploy-trigger tokenizer. Parses the FIRST LINE of COMMIT_MSG against
# the grammar `(build): <domain> [<domain> ...] [no-deploy]` and emits the active
# domain set + flags to GITHUB_OUTPUT. Single source of truth for all deploy gating.
set -uo pipefail

COMMIT_MSG="${COMMIT_MSG:-}"
FIRST_LINE="$(printf '%s\n' "${COMMIT_MSG}" | head -1)"
# Trim leading/trailing whitespace.
FIRST_LINE="${FIRST_LINE#"${FIRST_LINE%%[![:space:]]*}"}"
FIRST_LINE="${FIRST_LINE%"${FIRST_LINE##*[![:space:]]}"}"

emit() { # key value
  [ -n "${GITHUB_OUTPUT:-}" ] && printf '%s=%s\n' "$1" "$2" >> "${GITHUB_OUTPUT}"
  printf '%s=%s\n' "$1" "$2"
}

emit_all() { # triggered domains has_back has_front has_obs has_uk app_pipeline no_deploy app_deploy skip_app_ci
  emit triggered "$1"; emit domains "$2"
  emit has_back "$3"; emit has_front "$4"; emit has_observability "$5"; emit has_uptime_kuma "$6"
  emit app_pipeline "$7"; emit no_deploy "$8"; emit app_deploy "$9"; emit skip_app_ci "${10}"
}

fail() { # message
  echo "::error::$1"
  emit_all false "" false false false false false false false false
  exit 1
}

# Not an attempted trigger at all -> normal commit (exit 0).
case "${FIRST_LINE}" in
  '(build)'*) : ;;                       # attempted trigger -> validate strictly
  *) emit_all false "" false false false false false false false false; exit 0 ;;
esac

# Strict prefix: literal "(build): " (colon + single space).
case "${FIRST_LINE}" in
  '(build): '*) REST="${FIRST_LINE#'(build): '}" ;;
  '(build):')  emit_all false "" false false false false false false false false; exit 0 ;;  # empty -> no-op
  *) fail "malformed deploy trigger (need '(build): ' with a colon and single space): ${FIRST_LINE}" ;;
esac

# Empty token list after the prefix -> no-op normal commit.
[ -n "${REST}" ] || { emit_all false "" false false false false false false false false; exit 0; }

# Reject any separator that is not a single space (tabs / double spaces / commas / slashes).
case "${REST}" in
  *$'\t'*|*'  '*|*','*|*'/'*) fail "tokens must be single-space separated (no commas, slashes, tabs, or double spaces): ${REST}" ;;
esac

has_back=false; has_front=false; has_obs=false; has_uk=false; no_deploy=false
for tok in ${REST}; do
  case "${tok}" in
    back)         has_back=true ;;
    front)        has_front=true ;;
    observability) has_obs=true ;;
    uptime-kuma)  has_uk=true ;;
    no-deploy)    no_deploy=true ;;
    *) fail "unknown build domain '${tok}' (allowed: back front observability uptime-kuma no-deploy)" ;;
  esac
done

app_pipeline=false
{ [ "${has_back}" = true ] || [ "${has_front}" = true ]; } && app_pipeline=true

# no-deploy validation.
if [ "${no_deploy}" = true ]; then
  [ "${app_pipeline}" = true ] || fail "'no-deploy' requires at least one app domain (back/front)"
  { [ "${has_obs}" = true ] || [ "${has_uk}" = true ]; } && fail "'no-deploy' cannot be combined with observability/uptime-kuma"
fi

# Canonical-ordered domain string.
domains=""
[ "${has_back}" = true ] && domains="${domains} back"
[ "${has_front}" = true ] && domains="${domains} front"
[ "${has_obs}" = true ] && domains="${domains} observability"
[ "${has_uk}" = true ] && domains="${domains} uptime-kuma"
domains="${domains# }"

app_deploy=false
{ [ "${app_pipeline}" = true ] && [ "${no_deploy}" = false ]; } && app_deploy=true
skip_app_ci=false
{ [ "${app_pipeline}" = false ]; } && skip_app_ci=true   # triggered here is always true at this point

emit_all true "${domains}" "${has_back}" "${has_front}" "${has_obs}" "${has_uk}" "${app_pipeline}" "${no_deploy}" "${app_deploy}" "${skip_app_ci}"
echo "✅ trigger: domains=[${domains}] app_deploy=${app_deploy} skip_app_ci=${skip_app_ci}"
exit 0
