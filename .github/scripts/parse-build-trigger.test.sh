#!/usr/bin/env bash
# Self-contained test harness for parse-build-trigger.sh (no bats dependency).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${HERE}/parse-build-trigger.sh"
PASS=0; FAIL=0

# run <msg> -> sets RC and OUT (key=value lines on stdout)
run() { OUT="$(COMMIT_MSG="$1" bash "${SCRIPT}" 2>/dev/null)"; RC=$?; }

# assert_kv <key> <expected> ; reads from $OUT
assert_kv() {
  local got; got="$(printf '%s\n' "${OUT}" | grep -E "^$1=" | head -1 | cut -d= -f2-)"
  if [ "${got}" = "$2" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL [$3]: $1 expected '$2' got '${got}'"; fi
}
assert_rc() { if [ "${RC}" = "$1" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL [$2]: exit expected $1 got ${RC}"; fi; }

# --- all four ---
run "(build): back front observability uptime-kuma"
assert_rc 0 "all4"; assert_kv triggered true all4; assert_kv domains "back front observability uptime-kuma" all4
assert_kv app_pipeline true all4; assert_kv app_deploy true all4; assert_kv skip_app_ci false all4

# --- message order is canonicalized ---
run "(build): uptime-kuma back"
assert_kv domains "back uptime-kuma" order; assert_kv has_front false order

# --- dedupe ---
run "(build): back back front"
assert_kv domains "back front" dedupe

# --- observability only => skip app ci ---
run "(build): observability"
assert_kv triggered true obs; assert_kv app_pipeline false obs; assert_kv skip_app_ci true obs; assert_kv app_deploy false obs

# --- no-deploy: valid with app domains ---
run "(build): back front no-deploy"
assert_rc 0 nodeploy; assert_kv app_pipeline true nodeploy; assert_kv no_deploy true nodeploy; assert_kv app_deploy false nodeploy

# --- no-deploy: forbidden without app domain ---
run "(build): observability no-deploy"
assert_rc 1 nodeploy-bad1; assert_kv triggered false nodeploy-bad1

# --- no-deploy: forbidden alongside obs/uk ---
run "(build): front observability no-deploy"
assert_rc 1 nodeploy-bad2

# --- unknown token => hard error ---
run "(build): back database"
assert_rc 1 unknown; assert_kv triggered false unknown

# --- typo without colon-space => hard error (attempted trigger) ---
run "(build):front"
assert_rc 1 typo

# --- normal commit => not a trigger, exit 0 ---
run "fix(editor): cursor jump"
assert_rc 0 normal; assert_kv triggered false normal; assert_kv app_pipeline false normal

# --- conventional build: type is NOT a deploy trigger ---
run "build: bump deps"
assert_rc 0 ccbuild; assert_kv triggered false ccbuild

# --- empty trigger => no-op normal ---
run "(build):"
assert_rc 0 empty; assert_kv triggered false empty

# --- only first line is parsed ---
run "$(printf '(build): front\n\nbody mentions back here')"
assert_kv domains "front" firstline

echo "----"; echo "PASS=${PASS} FAIL=${FAIL}"; [ "${FAIL}" -eq 0 ]
