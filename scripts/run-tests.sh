#!/usr/bin/env bash
# =============================================================================
# Editor Test Suite Runner
# Runs unit tests (Jest) + per-package clean-room suites, plus webapp E2E
# (Cypress), saving results to a report file. The unit block runs:
#   1. @docs.plus/extension-indent (Jest)
#   2. @docs.plus/extension-hyperlink (clean-room Cypress against dist/)
#   3. @docs.plus/webapp (Jest)
#
# Usage:
#   bun run test:all                  # unit + E2E, report saved to Notes/
#   bun run test:unit                 # unit only, report saved to Notes/
#   bun run test:e2e                  # E2E only, report saved to Notes/
#   sh scripts/run-tests.sh           # same as test:all
#   sh scripts/run-tests.sh --unit    # unit only
#   sh scripts/run-tests.sh --e2e     # E2E only
#
# Prerequisites:
#   - For E2E tests: dev server must be running (make dev-local)
#   - Cypress is managed at the monorepo root (bunx cypress)
#
# Output:
#   Notes/test-results-YYYY-MM-DD_HHMMSS.txt
# =============================================================================

set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEBAPP_DIR="$ROOT_DIR/packages/webapp"
EXTENSION_INDENT_DIR="$ROOT_DIR/packages/extension-indent"
EXTENSION_HYPERLINK_DIR="$ROOT_DIR/packages/extension-hyperlink"
REPORT_DIR="$ROOT_DIR/Notes"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
REPORT="$REPORT_DIR/test-results-${TIMESTAMP}.txt"
BASE_URL="${BASE_URL:-http://localhost:3001}"
CYPRESS_PARALLEL="${CYPRESS_PARALLEL:-4}"

RUN_UNIT=false
RUN_E2E=false
UNIT_EXIT=0
E2E_EXIT=0

# ─── Parse arguments ─────────────────────────────────────────────────────────

case "${1:-all}" in
  --unit)  RUN_UNIT=true ;;
  --e2e)   RUN_E2E=true ;;
  all|"")  RUN_UNIT=true; RUN_E2E=true ;;
  *)
    echo -e "${RED}Unknown option: $1${NC}"
    echo "Usage: $0 [--unit | --e2e | all]"
    exit 1
    ;;
esac

# ─── Preflight checks ────────────────────────────────────────────────────────

mkdir -p "$REPORT_DIR"

if $RUN_E2E; then
  if ! curl -s --max-time 3 "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${YELLOW}WARNING: Dev server not reachable at ${BASE_URL}${NC}"
    echo -e "${YELLOW}  Start it with: make dev-local${NC}"
    echo -e "${YELLOW}  Or set BASE_URL env var if running elsewhere.${NC}"
    echo ""
    echo -n "Continue anyway? [y/N] "
    read -r answer
    if [[ ! "$answer" =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 1
    fi
  fi
fi

# ─── Report header ───────────────────────────────────────────────────────────

{
  echo "============================================================================="
  echo " TEST REPORT — docs.plus editor"
  echo " Generated: $(date)"
  echo " Git branch: $(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || echo 'unknown')"
  echo " Git commit: $(git -C "$ROOT_DIR" log -1 --format='%h %s' 2>/dev/null || echo 'unknown')"
  echo "============================================================================="
  echo ""
} > "$REPORT"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD} docs.plus — Editor Test Suite${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Report: ${BLUE}${REPORT}${NC}"
echo ""

# ─── Unit tests (Jest) ───────────────────────────────────────────────────────

if $RUN_UNIT; then
  echo -e "${BOLD}[1/2] Running unit tests (Jest)...${NC}"
  echo ""

  {
    echo "============================================================================="
    echo " UNIT TESTS (Jest)"
    echo " Started: $(date)"
    echo "============================================================================="
    echo ""
  } >> "$REPORT"

  UNIT_EXIT=0

  cd "$EXTENSION_INDENT_DIR"
  echo -e "${DIM}  → @docs.plus/extension-indent (Jest)${NC}"
  if ! bun run test --verbose 2>&1 | tee -a "$REPORT"; then
    UNIT_EXIT=1
    echo ""
    echo -e "${RED}@docs.plus/extension-indent unit tests failed.${NC}"
  fi
  echo ""

  # Clean-room E2E for @docs.plus/extension-hyperlink: boots its own
  # Bun.serve playground (no Vite, no bundler config) against the built
  # dist/ and runs a self-contained Cypress suite. Runs in the unit block
  # because it's a per-package release gate, not part of the webapp's
  # shared-server E2E fleet.
  cd "$EXTENSION_HYPERLINK_DIR"
  echo -e "${DIM}  → @docs.plus/extension-hyperlink (clean-room Cypress)${NC}"
  if ! bun run test 2>&1 | tee -a "$REPORT"; then
    UNIT_EXIT=1
    echo ""
    echo -e "${RED}@docs.plus/extension-hyperlink clean-room E2E failed.${NC}"
  fi
  echo ""

  cd "$WEBAPP_DIR"
  echo -e "${DIM}  → @docs.plus/webapp (Jest)${NC}"

  if bun run test --verbose 2>&1 | tee -a "$REPORT"; then
    if [ "$UNIT_EXIT" -eq 0 ]; then
      echo ""
      echo -e "${GREEN}Unit tests passed.${NC}"
    fi
  else
    UNIT_EXIT=1
    echo ""
    echo -e "${RED}@docs.plus/webapp unit tests failed.${NC}"
  fi

  if [ "$UNIT_EXIT" -ne 0 ]; then
    echo ""
    echo -e "${RED}One or more unit test suites failed.${NC}"
  fi

  {
    echo ""
    echo "Unit tests finished: $(date)"
    echo ""
  } >> "$REPORT"

  cd "$ROOT_DIR"
  echo ""
fi

# ─── Helper: parse Cypress "(Run Finished)" summary table ───────────────────
# Cypress wraps long spec paths across 2 lines. The data line always has the
# numbers; continuation lines only have the filename tail. We also parse the
# totals line ("All specs passed!" / "N of N failed").
# Outputs: STATUS|SPEC_NAME|DURATION|TESTS|PASSING|FAILING|PENDING|SKIPPED
parse_cypress_results() {
  local logfile="$1"

  # Extract only the table section, strip box-drawing chars, keep lines with numbers
  sed -n '/(Run Finished)/,/(All specs passed\|specs\? failed)/p' "$logfile" \
    | sed 's/[│┤├┌┐└┘─]//g' \
    | grep -E '(✔|✖).*[0-9]' \
    | grep -v 'All specs\|failed (' \
    | while IFS= read -r line; do
        local clean
        clean=$(echo "$line" | sed 's/^[ \t]*//')

        local status spec duration tests passing failing pending skipped
        status=$(echo "$clean" | grep -oE '^(✔|✖)' || echo '?')

        # Spec name: everything between status and first time/number field
        spec=$(echo "$clean" | sed 's/^[✔✖][ ]*//' | awk '{
          for(i=1;i<=NF;i++) {
            if($i ~ /^[0-9]+:[0-9]+$/ || $i ~ /^[0-9]+m?s$/) break
            printf "%s", (i>1?" ":"") $i
          }
        }')

        duration=$(echo "$clean" | grep -oE '[0-9]+:[0-9]+|[0-9]+m?s' | head -1)

        # Last 5 fields are always: Tests Passing Failing Pending Skipped
        read -r tests passing failing pending skipped <<< "$(echo "$clean" | awk '{
          n=0
          for(i=1;i<=NF;i++) {
            if($i ~ /^[0-9]+$/ || $i == "-") vals[n++]=$i
          }
          if(n>=5) print vals[n-5], vals[n-4], vals[n-3], vals[n-2], vals[n-1]
        }')"

        [ -n "$spec" ] && [ -n "$tests" ] && \
          echo "${status}|${spec}|${duration}|${tests}|${passing}|${failing}|${pending}|${skipped}"
      done
}

# ─── Helper: format seconds to human readable ──────────────────────────────
fmt_duration() {
  local secs=$1
  if [ "$secs" -ge 60 ]; then
    printf "%dm %02ds" $((secs / 60)) $((secs % 60))
  else
    printf "%ds" "$secs"
  fi
}

# ─── E2E tests (Cypress) ─────────────────────────────────────────────────────

if $RUN_E2E; then
  STEP="[2/2]"
  $RUN_UNIT || STEP="[1/1]"

  E2E_START_EPOCH=$(date +%s)

  echo -e "${BOLD}${STEP} Running E2E tests (Cypress) — ${CYPRESS_PARALLEL} parallel workers...${NC}"
  echo ""

  {
    echo "============================================================================="
    echo " E2E TESTS (Cypress)"
    echo " Started: $(date)"
    echo " Base URL: ${BASE_URL}"
    echo " Parallel workers: ${CYPRESS_PARALLEL}"
    echo "============================================================================="
    echo ""
  } >> "$REPORT"

  E2E_EDITOR_EXIT=0
  E2E_COMMANDS_EXIT=0

  # ── Editor E2E tests — split across parallel workers ──────────────────────
  echo -e "${BOLD}  Running editor E2E tests (${CYPRESS_PARALLEL} workers, with baseUrl)...${NC}"
  echo ""

  EDITOR_PIDS=()
  EDITOR_EXITS=()
  EDITOR_START_EPOCHS=()
  EDITOR_END_EPOCHS=()
  EDITOR_LOGS_DIR="$REPORT_DIR/.e2e-logs-${TIMESTAMP}"
  mkdir -p "$EDITOR_LOGS_DIR"

  EDITOR_WALL_START=$(date +%s)

  for i in $(seq 0 $((CYPRESS_PARALLEL - 1))); do
    EDITOR_START_EPOCHS+=("$(date +%s)")
    SPLIT="$CYPRESS_PARALLEL" SPLIT_INDEX="$i" SPLIT_FILE="cypress/timings.json" \
    bunx cypress run \
      --project "$WEBAPP_DIR" \
      --browser electron \
      --config "baseUrl=${BASE_URL}" \
      --spec "$WEBAPP_DIR/cypress/e2e/editor/**/*.cy.{js,ts}" \
      > "$EDITOR_LOGS_DIR/worker-${i}.log" 2>&1 &
    EDITOR_PIDS+=($!)
    EDITOR_EXITS+=(-)
    EDITOR_END_EPOCHS+=(0)
    echo -e "    ${BLUE}Worker $((i + 1))/${CYPRESS_PARALLEL} started (PID ${EDITOR_PIDS[$i]})${NC}"
  done

  echo ""

  # ── Live progress monitor ───────────────────────────────────────────────
  WORKERS_REMAINING=$CYPRESS_PARALLEL
  while [ $WORKERS_REMAINING -gt 0 ]; do
    sleep 5
    WORKERS_REMAINING=0
    STATUS_LINE=""

    for i in "${!EDITOR_PIDS[@]}"; do
      if [ "${EDITOR_EXITS[$i]}" != "-" ]; then
        continue
      fi

      if ! kill -0 "${EDITOR_PIDS[$i]}" 2>/dev/null; then
        wait "${EDITOR_PIDS[$i]}" 2>/dev/null
        EDITOR_EXITS[$i]=$?
        EDITOR_END_EPOCHS[$i]=$(date +%s)
        cat "$EDITOR_LOGS_DIR/worker-${i}.log" >> "$REPORT"

        local_dur=$(( EDITOR_END_EPOCHS[i] - EDITOR_START_EPOCHS[i] ))
        local_dur_fmt=$(fmt_duration $local_dur)

        if [ "${EDITOR_EXITS[$i]}" -eq 0 ]; then
          echo -e "    ${GREEN}✓ Worker $((i + 1)) passed${NC} ${DIM}(${local_dur_fmt})${NC}"
        else
          echo -e "    ${RED}✗ Worker $((i + 1)) FAILED (exit ${EDITOR_EXITS[$i]})${NC} ${DIM}(${local_dur_fmt})${NC}"
          E2E_EDITOR_EXIT=1
        fi
      else
        WORKERS_REMAINING=$((WORKERS_REMAINING + 1))
        LAST_SPEC=$(grep -oE '[^ ]+\.cy\.(js|ts)' "$EDITOR_LOGS_DIR/worker-${i}.log" 2>/dev/null | tail -1 || true)
        if [ -n "$LAST_SPEC" ]; then
          LAST_SPEC=" → $(basename "$LAST_SPEC")"
        fi
        STATUS_LINE="${STATUS_LINE}W$((i + 1))${LAST_SPEC}  "
      fi
    done

    if [ $WORKERS_REMAINING -gt 0 ]; then
      ELAPSED=$(( $(date +%s) - EDITOR_WALL_START ))
      echo -e "    ${YELLOW}⏳ ${WORKERS_REMAINING} running (${ELAPSED}s elapsed): ${STATUS_LINE}${NC}"
    fi
  done

  EDITOR_WALL_END=$(date +%s)
  EDITOR_WALL_SECS=$(( EDITOR_WALL_END - EDITOR_WALL_START ))

  # ── Command E2E tests — run separately (typically few specs) ──────────────
  echo ""
  echo -e "${BOLD}  Running command E2E tests (no baseUrl)...${NC}"

  CMD_START=$(date +%s)
  CMD_LOG="$EDITOR_LOGS_DIR/commands.log"

  if bunx cypress run \
    --project "$WEBAPP_DIR" \
    --browser electron \
    --spec "$WEBAPP_DIR/cypress/e2e/cypress-commands/**/*.cy.{js,ts}" \
    > "$CMD_LOG" 2>&1; then
    E2E_COMMANDS_EXIT=0
  else
    E2E_COMMANDS_EXIT=$?
  fi

  CMD_END=$(date +%s)
  CMD_SECS=$(( CMD_END - CMD_START ))
  cat "$CMD_LOG" >> "$REPORT"

  if [ $E2E_COMMANDS_EXIT -eq 0 ]; then
    echo -e "    ${GREEN}✓ Command tests passed${NC} ${DIM}($(fmt_duration $CMD_SECS))${NC}"
  else
    echo -e "    ${RED}✗ Command tests FAILED (exit ${E2E_COMMANDS_EXIT})${NC} ${DIM}($(fmt_duration $CMD_SECS))${NC}"
  fi

  E2E_END_EPOCH=$(date +%s)
  E2E_TOTAL_SECS=$(( E2E_END_EPOCH - E2E_START_EPOCH ))

  if [ $E2E_EDITOR_EXIT -eq 0 ] && [ $E2E_COMMANDS_EXIT -eq 0 ]; then
    E2E_EXIT=0
  else
    E2E_EXIT=1
  fi

  {
    echo ""
    echo "E2E tests finished: $(date)"
    echo ""
  } >> "$REPORT"

  # ════════════════════════════════════════════════════════════════════════════
  #  AGGREGATED RESULTS
  # ════════════════════════════════════════════════════════════════════════════

  echo ""
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD} E2E Test Results                                                          ${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # ── Per-worker summary table ────────────────────────────────────────────
  echo -e "${BOLD}  Worker Summary${NC}"
  echo -e "  ┌────────┬────────┬───────┬────────┬─────────┬──────────┐"
  echo -e "  │ Worker │ Status │ Specs │ Passed │ Failed  │ Duration │"
  echo -e "  ├────────┼────────┼───────┼────────┼─────────┼──────────┤"

  TOTAL_SPECS=0
  TOTAL_PASSED=0
  TOTAL_FAILED=0
  TOTAL_PENDING=0
  TOTAL_SKIPPED=0
  TOTAL_TESTS=0
  TOTAL_WORKER_SECS=0
  SLOWEST_WORKER_SECS=0
  FASTEST_WORKER_SECS=999999

  for i in "${!EDITOR_EXITS[@]}"; do
    W_NUM=$((i + 1))
    W_DUR=$(( EDITOR_END_EPOCHS[i] - EDITOR_START_EPOCHS[i] ))
    TOTAL_WORKER_SECS=$(( TOTAL_WORKER_SECS + W_DUR ))
    [ $W_DUR -gt $SLOWEST_WORKER_SECS ] && SLOWEST_WORKER_SECS=$W_DUR
    [ $W_DUR -lt $FASTEST_WORKER_SECS ] && FASTEST_WORKER_SECS=$W_DUR

    W_DUR_FMT=$(fmt_duration $W_DUR)

    W_SPECS=0; W_PASS=0; W_FAIL=0
    while IFS='|' read -r st sp du te pa fa pe sk; do
      W_SPECS=$((W_SPECS + 1))
      te_num=$(echo "$te" | tr -d '[:space:]-'); [ -z "$te_num" ] && te_num=0
      pa_num=$(echo "$pa" | tr -d '[:space:]-'); [ -z "$pa_num" ] && pa_num=0
      fa_num=$(echo "$fa" | tr -d '[:space:]-'); [ -z "$fa_num" ] && fa_num=0
      pe_num=$(echo "$pe" | tr -d '[:space:]-'); [ -z "$pe_num" ] && pe_num=0
      sk_num=$(echo "$sk" | tr -d '[:space:]-'); [ -z "$sk_num" ] && sk_num=0
      TOTAL_TESTS=$((TOTAL_TESTS + te_num))
      W_PASS=$((W_PASS + pa_num))
      W_FAIL=$((W_FAIL + fa_num))
      TOTAL_PASSED=$((TOTAL_PASSED + pa_num))
      TOTAL_FAILED=$((TOTAL_FAILED + fa_num))
      TOTAL_PENDING=$((TOTAL_PENDING + pe_num))
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + sk_num))
    done < <(parse_cypress_results "$EDITOR_LOGS_DIR/worker-${i}.log")
    TOTAL_SPECS=$((TOTAL_SPECS + W_SPECS))

    if [ "${EDITOR_EXITS[$i]}" -eq 0 ]; then
      W_STATUS="${GREEN}  ✓   ${NC}"
    else
      W_STATUS="${RED}  ✗   ${NC}"
    fi

    printf "  │   %d    │%b│  %3d  │  %4d  │  %4d   │ %8s │\n" \
      "$W_NUM" "$W_STATUS" "$W_SPECS" "$W_PASS" "$W_FAIL" "$W_DUR_FMT"
  done

  # Add command tests row
  CMD_SPECS=0; CMD_PASS=0; CMD_FAIL=0
  while IFS='|' read -r st sp du te pa fa pe sk; do
    CMD_SPECS=$((CMD_SPECS + 1))
    te_num=$(echo "$te" | tr -d '[:space:]-'); [ -z "$te_num" ] && te_num=0
    pa_num=$(echo "$pa" | tr -d '[:space:]-'); [ -z "$pa_num" ] && pa_num=0
    fa_num=$(echo "$fa" | tr -d '[:space:]-'); [ -z "$fa_num" ] && fa_num=0
    pe_num=$(echo "$pe" | tr -d '[:space:]-'); [ -z "$pe_num" ] && pe_num=0
    sk_num=$(echo "$sk" | tr -d '[:space:]-'); [ -z "$sk_num" ] && sk_num=0
    TOTAL_TESTS=$((TOTAL_TESTS + te_num))
    CMD_PASS=$((CMD_PASS + pa_num))
    CMD_FAIL=$((CMD_FAIL + fa_num))
    TOTAL_PASSED=$((TOTAL_PASSED + pa_num))
    TOTAL_FAILED=$((TOTAL_FAILED + fa_num))
    TOTAL_PENDING=$((TOTAL_PENDING + pe_num))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + sk_num))
  done < <(parse_cypress_results "$CMD_LOG")
  TOTAL_SPECS=$((TOTAL_SPECS + CMD_SPECS))

  if [ $E2E_COMMANDS_EXIT -eq 0 ]; then
    CMD_STATUS="${GREEN}  ✓   ${NC}"
  else
    CMD_STATUS="${RED}  ✗   ${NC}"
  fi

  echo -e "  ├────────┼────────┼───────┼────────┼─────────┼──────────┤"
  printf "  │  cmds  │%b│  %3d  │  %4d  │  %4d   │ %8s │\n" \
    "$CMD_STATUS" "$CMD_SPECS" "$CMD_PASS" "$CMD_FAIL" "$(fmt_duration $CMD_SECS)"

  echo -e "  └────────┴────────┴───────┴────────┴─────────┴──────────┘"
  echo ""

  # ── Aggregated totals ───────────────────────────────────────────────────
  echo -e "${BOLD}  Totals${NC}"
  echo -e "    Spec files:   ${CYAN}${TOTAL_SPECS}${NC}"
  echo -e "    Tests:        ${CYAN}${TOTAL_TESTS}${NC}"
  echo -e "    Passing:      ${GREEN}${TOTAL_PASSED}${NC}"
  if [ $TOTAL_FAILED -gt 0 ]; then
    echo -e "    Failing:      ${RED}${TOTAL_FAILED}${NC}"
  else
    echo -e "    Failing:      ${GREEN}0${NC}"
  fi
  if [ $TOTAL_PENDING -gt 0 ]; then
    echo -e "    Pending:      ${YELLOW}${TOTAL_PENDING}${NC}"
  fi
  if [ $TOTAL_SKIPPED -gt 0 ]; then
    echo -e "    Skipped:      ${YELLOW}${TOTAL_SKIPPED}${NC}"
  fi
  echo ""

  # ── Timing statistics ──────────────────────────────────────────────────
  echo -e "${BOLD}  Timing${NC}"
  echo -e "    Wall clock:          ${CYAN}$(fmt_duration $E2E_TOTAL_SECS)${NC}"
  echo -e "    Editor tests:        $(fmt_duration $EDITOR_WALL_SECS)"
  echo -e "    Command tests:       $(fmt_duration $CMD_SECS)"
  echo -e "    Slowest worker:      $(fmt_duration $SLOWEST_WORKER_SECS)"
  echo -e "    Fastest worker:      $(fmt_duration $FASTEST_WORKER_SECS)"
  echo -e "    Combined CPU time:   $(fmt_duration $TOTAL_WORKER_SECS)"
  if [ $EDITOR_WALL_SECS -gt 0 ]; then
    SPEEDUP=$(awk "BEGIN { printf \"%.1fx\", $TOTAL_WORKER_SECS / $EDITOR_WALL_SECS }")
    echo -e "    Parallelism factor:  ${CYAN}${SPEEDUP}${NC} ${DIM}(effective speedup vs sequential)${NC}"
  fi
  echo ""

  # ── Failed specs detail ─────────────────────────────────────────────────
  if [ $TOTAL_FAILED -gt 0 ]; then
    echo -e "${BOLD}  Failed Specs${NC}"
    echo ""
    for i in "${!EDITOR_EXITS[@]}"; do
      if [ "${EDITOR_EXITS[$i]}" != "0" ] && [ "${EDITOR_EXITS[$i]}" != "-" ]; then
        while IFS='|' read -r st sp du te pa fa pe sk; do
          fa_num=$(echo "$fa" | tr -d '[:space:]-'); [ -z "$fa_num" ] && fa_num=0
          if [ "$fa_num" -gt 0 ] 2>/dev/null; then
            echo -e "    ${RED}✗${NC} ${sp} ${DIM}(${fa_num} failed, worker $((i + 1)))${NC}"
          fi
        done < <(parse_cypress_results "$EDITOR_LOGS_DIR/worker-${i}.log")
      fi
    done
    echo ""

    echo -e "${BOLD}  Failure Details${NC}"
    echo ""
    for i in "${!EDITOR_EXITS[@]}"; do
      if [ "${EDITOR_EXITS[$i]}" != "0" ] && [ "${EDITOR_EXITS[$i]}" != "-" ]; then
        # Extract the failing test names and their errors
        grep -B 1 -A 3 'AssertionError\|CypressError\|Error:.*Timed out' \
          "$EDITOR_LOGS_DIR/worker-${i}.log" 2>/dev/null | while IFS= read -r eline; do
          echo -e "    ${DIM}W$((i + 1))${NC} $eline"
        done | head -30
        echo ""
      fi
    done
  fi

  echo -e "  ${DIM}Worker logs: ${EDITOR_LOGS_DIR}/${NC}"
  echo ""

  # ── Auto-update timings.json for load balancing ──────────────────────────
  TIMINGS_FILE="$WEBAPP_DIR/cypress/timings.json"
  TIMINGS_TMP=$(mktemp)
  echo '{"durations":[' > "$TIMINGS_TMP"
  FIRST_ENTRY=true
  for i in "${!EDITOR_EXITS[@]}"; do
    while IFS='|' read -r st sp du te pa fa pe sk; do
      [ -z "$sp" ] && continue
      dur_ms=0
      if echo "$du" | grep -q ':'; then
        mins=$(echo "$du" | cut -d: -f1)
        secs=$(echo "$du" | cut -d: -f2)
        dur_ms=$(( (mins * 60 + secs) * 1000 ))
      elif echo "$du" | grep -q 'ms'; then
        dur_ms=$(echo "$du" | tr -dc '0-9')
      else
        dur_secs=$(echo "$du" | tr -dc '0-9')
        dur_ms=$((dur_secs * 1000))
      fi
      spec_clean=$(echo "$sp" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
      if [ "$FIRST_ENTRY" = true ]; then
        FIRST_ENTRY=false
      else
        echo ',' >> "$TIMINGS_TMP"
      fi
      printf '{"spec":"%s","duration":%d}' "$spec_clean" "$dur_ms" >> "$TIMINGS_TMP"
    done < <(parse_cypress_results "$EDITOR_LOGS_DIR/worker-${i}.log")
  done
  echo '' >> "$TIMINGS_TMP"
  echo ']}' >> "$TIMINGS_TMP"
  if [ "$(wc -l < "$TIMINGS_TMP")" -gt 3 ]; then
    mv "$TIMINGS_TMP" "$TIMINGS_FILE"
    echo -e "  ${DIM}Updated timings: ${TIMINGS_FILE}${NC}"
  else
    rm -f "$TIMINGS_TMP"
  fi
  echo ""

  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

# ─── Final Summary ────────────────────────────────────────────────────────────

OVERALL_EXIT=0

echo ""
echo -e "${BOLD} Final Verdict${NC}"
echo ""

if $RUN_UNIT; then
  if [ $UNIT_EXIT -eq 0 ]; then
    echo -e "  Unit tests:  ${GREEN}PASSED${NC}"
    echo "  Unit tests:  PASSED" >> "$REPORT"
  else
    echo -e "  Unit tests:  ${RED}FAILED${NC}"
    echo "  Unit tests:  FAILED (exit code: $UNIT_EXIT)" >> "$REPORT"
    OVERALL_EXIT=1
  fi
fi

if $RUN_E2E; then
  if [ $E2E_EXIT -eq 0 ]; then
    echo -e "  E2E tests:   ${GREEN}PASSED${NC}  ${DIM}(${TOTAL_PASSED} tests across ${TOTAL_SPECS} specs in $(fmt_duration $E2E_TOTAL_SECS))${NC}"
    echo "  E2E tests:   PASSED (${TOTAL_PASSED} tests, ${TOTAL_SPECS} specs, $(fmt_duration $E2E_TOTAL_SECS))" >> "$REPORT"
  else
    echo -e "  E2E tests:   ${RED}FAILED${NC}  ${DIM}(${TOTAL_FAILED} of ${TOTAL_TESTS} tests failed across ${TOTAL_SPECS} specs)${NC}"
    echo "  E2E tests:   FAILED (${TOTAL_FAILED}/${TOTAL_TESTS} failed, ${TOTAL_SPECS} specs)" >> "$REPORT"
    OVERALL_EXIT=1
  fi
fi

{
  echo ""
  echo "  Report file: $REPORT"
  echo ""
  echo "============================================================================="
  echo " END OF REPORT — $(date)"
  echo "============================================================================="
} >> "$REPORT"

echo ""
echo -e "  Report: ${BLUE}${REPORT}${NC}"
echo ""

exit $OVERALL_EXIT
