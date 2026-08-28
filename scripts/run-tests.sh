#!/usr/bin/env bash
# Unit + clean-room + webapp E2E. Gate order: scripts/publishable-extensions.ts.
# Usage: bash scripts/run-tests.sh [--unit | --extensions | --e2e | all]
# Needs bash (process substitution). E2E needs make dev-local. Report → Notes/.

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
WEBAPP_DIR="$ROOT_DIR/apps/webapp"
REPORT_DIR="$ROOT_DIR/Notes"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
REPORT="$REPORT_DIR/test-results-${TIMESTAMP}.txt"
BASE_URL="${BASE_URL:-http://localhost:3001}"
CYPRESS_PARALLEL="${CYPRESS_PARALLEL:-4}"

# Clean-room suites own unique ports (5173-5177), so they can run side by side.
# Measured 2026-08-27 on Bun 1.4.0 with dist built: 209s serial, 89s parallel.
# Each suite writes its own log and they merge in gate order, so $REPORT stays
# parseable. Set EXTENSION_PARALLEL=0 to read output live while debugging one.
EXTENSION_PARALLEL="${EXTENSION_PARALLEL:-1}"

RUN_EXTENSION_GATES=false
RUN_WEBAPP_UNIT=false
RUN_E2E=false
EXTENSION_GATES_EXIT=0
E2E_EXIT=0

# Set by CI after scripts/build-extensions.sh — skips per-package pretest rebuilds.
EXTENSION_DIST_READY="${EXTENSION_DIST_READY:-0}"

case "${1:-all}" in
  --unit)  RUN_EXTENSION_GATES=true; RUN_WEBAPP_UNIT=true ;;
  --extensions) RUN_EXTENSION_GATES=true ;;
  --e2e)   RUN_E2E=true ;;
  all|"")  RUN_EXTENSION_GATES=true; RUN_WEBAPP_UNIT=true; RUN_E2E=true ;;
  *)
    echo -e "${RED}Unknown option: $1${NC}"
    echo "Usage: $0 [--unit | --extensions | --e2e | all]"
    exit 1
    ;;
esac

# One extension's gate command. The caller owns cwd, logging and exit handling,
# so the serial and parallel paths cannot drift apart.
extension_gate_cmd() {
  local has_unit="$1"

  if [ "$EXTENSION_DIST_READY" = "1" ]; then
    if [ "$has_unit" = "1" ]; then
      bun run test:unit && bun run test:e2e
    else
      bun run test:e2e
    fi
  else
    bun run test
  fi
}

record_extension_gate() {
  local label="$1"
  local dir="$2"
  local has_unit="$3"

  cd "$dir"
  echo -e "${DIM}  → ${label}${NC}"

  if ! extension_gate_cmd "$has_unit" 2>&1 | tee -a "$REPORT"; then
    EXTENSION_GATES_EXIT=1
    echo ""
    echo -e "${RED}${label} release gate failed.${NC}"
  fi
  echo ""
}

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

if $RUN_EXTENSION_GATES; then
  if $RUN_WEBAPP_UNIT; then
    echo -e "${BOLD}[1/2] Running extension release gates + webapp Jest...${NC}"
  else
    echo -e "${BOLD}Running extension release gates...${NC}"
  fi
  echo ""

  {
    echo "============================================================================="
    echo " EXTENSION RELEASE GATES"
    echo " Started: $(date)"
    echo " EXTENSION_DIST_READY=${EXTENSION_DIST_READY}"
    echo "============================================================================="
    echo ""
  } >> "$REPORT"

  EXTENSION_GATES_EXIT=0

  ONLY_ARGS=()
  if [ -n "${EXT_ONLY:-}" ]; then
    for e in $EXT_ONLY; do ONLY_ARGS+=(--only "$e"); done
  fi

  if ! GATE_LIST=$(bun "$ROOT_DIR/scripts/publishable-extensions.ts" "${ONLY_ARGS[@]}" --gates); then
    EXTENSION_GATES_EXIT=1
    echo -e "${RED}Could not resolve the extension gate list (EXT_ONLY='${EXT_ONLY:-}').${NC}"
  elif [ "$EXTENSION_PARALLEL" = "1" ] && [ "$(grep -c . <<< "$GATE_LIST")" -gt 1 ]; then
    # One gate has nothing to overlap, and buffering would cost CI its live log.
    # Prod runs one extension per matrix job (EXT_ONLY), so those keep streaming.
    EXT_LOGS_DIR="$REPORT_DIR/.ext-logs-${TIMESTAMP}"
    mkdir -p "$EXT_LOGS_DIR"
    EXT_LABELS=(); EXT_PIDS=(); EXT_LOGS=()

    while IFS=$'\t' read -r ext_rel has_unit label; do
      ext_log="$EXT_LOGS_DIR/${label##*/}.log"
      ( cd "$ROOT_DIR/$ext_rel" && extension_gate_cmd "$has_unit" ) > "$ext_log" 2>&1 &
      EXT_PIDS+=("$!"); EXT_LABELS+=("$label"); EXT_LOGS+=("$ext_log")
      echo -e "${DIM}  → ${label} started${NC}"
    done <<< "$GATE_LIST"

    # Reaped in gate order, so the report reads the same as a serial run.
    for i in "${!EXT_PIDS[@]}"; do
      if wait "${EXT_PIDS[$i]}"; then
        echo -e "${GREEN}  ✔ ${EXT_LABELS[$i]}${NC}"
      else
        EXTENSION_GATES_EXIT=1
        echo -e "${RED}  ✖ ${EXT_LABELS[$i]} release gate failed.${NC}"
      fi
      cat "${EXT_LOGS[$i]}" >> "$REPORT"
    done
    echo -e "  ${DIM}Extension logs: ${EXT_LOGS_DIR}/${NC}"
  else
    while IFS=$'\t' read -r ext_rel has_unit label; do
      record_extension_gate "$label" "$ROOT_DIR/$ext_rel" "$has_unit"
    done <<< "$GATE_LIST"
  fi

  if $RUN_WEBAPP_UNIT; then
    cd "$WEBAPP_DIR"
    echo -e "${DIM}  → @docs.plus/webapp (Jest)${NC}"

    if bun run test --verbose 2>&1 | tee -a "$REPORT"; then
      [ "$EXTENSION_GATES_EXIT" -eq 0 ] && echo -e "\n${GREEN}Extension gates and webapp Jest passed.${NC}"
    else
      EXTENSION_GATES_EXIT=1
      echo -e "\n${RED}@docs.plus/webapp unit tests failed.${NC}"
    fi
  elif [ "$EXTENSION_GATES_EXIT" -eq 0 ]; then
    echo -e "\n${GREEN}Extension release gates passed.${NC}"
  fi

  [ "$EXTENSION_GATES_EXIT" -ne 0 ] && echo -e "\n${RED}One or more extension release gates failed.${NC}"

  {
    echo ""
    echo "Extension gates finished: $(date)"
    echo ""
  } >> "$REPORT"

  cd "$ROOT_DIR"
  echo ""
fi

# Cypress wraps long spec paths across 2 lines. The data line has the numbers;
# continuation lines only have the filename tail. Also parse the totals line.
# Outputs: STATUS|SPEC_NAME|DURATION|TESTS|PASSING|FAILING|PENDING|SKIPPED
parse_cypress_results() {
  local logfile="$1"

  sed -n '/(Run Finished)/,/(All specs passed\|specs\? failed)/p' "$logfile" \
    | sed 's/[│┤├┌┐└┘─]//g' \
    | grep -E '(✔|✖).*[0-9]' \
    | grep -v 'All specs\|failed (' \
    | while IFS= read -r line; do
        local clean
        clean=$(echo "$line" | sed 's/^[ \t]*//')

        local status spec duration tests passing failing pending skipped
        status=$(echo "$clean" | grep -oE '^(✔|✖)' || echo '?')

        spec=$(echo "$clean" | sed 's/^[✔✖][ ]*//' | awk '{
          for(i=1;i<=NF;i++) {
            if($i ~ /^[0-9]+:[0-9]+$/ || $i ~ /^[0-9]+m?s$/) break
            printf "%s", (i>1?" ":"") $i
          }
        }')

        duration=$(echo "$clean" | grep -oE '[0-9]+:[0-9]+|[0-9]+m?s' | head -1)

        # Last 5 fields: Tests Passing Failing Pending Skipped
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

fmt_duration() {
  local secs=$1
  if [ "$secs" -ge 60 ]; then
    printf "%dm %02ds" $((secs / 60)) $((secs % 60))
  else
    printf "%ds" "$secs"
  fi
}

if $RUN_E2E; then
  STEP="[2/2]"
  $RUN_EXTENSION_GATES || STEP="[1/1]"

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

  E2E_WORKER_EXIT=0

  echo -e "${BOLD}  Running webapp E2E tests (${CYPRESS_PARALLEL} workers, with baseUrl)...${NC}"
  echo ""

  WORKER_PIDS=()
  WORKER_EXITS=()
  WORKER_START_EPOCHS=()
  WORKER_END_EPOCHS=()
  WORKER_LOGS_DIR="$REPORT_DIR/.e2e-logs-${TIMESTAMP}"
  mkdir -p "$WORKER_LOGS_DIR"

  WORKER_WALL_START=$(date +%s)

  for i in $(seq 0 $((CYPRESS_PARALLEL - 1))); do
    WORKER_START_EPOCHS+=("$(date +%s)")
    SPLIT="$CYPRESS_PARALLEL" SPLIT_INDEX="$i" SPLIT_FILE="cypress/timings.json" \
    bunx cypress run \
      --project "$WEBAPP_DIR" \
      --browser electron \
      --config "baseUrl=${BASE_URL}" \
      --spec "$WEBAPP_DIR/cypress/e2e/**/*.cy.{js,ts}" \
      > "$WORKER_LOGS_DIR/worker-${i}.log" 2>&1 &
    WORKER_PIDS+=($!)
    WORKER_EXITS+=(-)
    WORKER_END_EPOCHS+=(0)
    echo -e "    ${BLUE}Worker $((i + 1))/${CYPRESS_PARALLEL} started (PID ${WORKER_PIDS[$i]})${NC}"
  done

  echo ""

  WORKERS_REMAINING=$CYPRESS_PARALLEL
  while [ $WORKERS_REMAINING -gt 0 ]; do
    sleep 5
    WORKERS_REMAINING=0
    STATUS_LINE=""

    for i in "${!WORKER_PIDS[@]}"; do
      if [ "${WORKER_EXITS[$i]}" != "-" ]; then
        continue
      fi

      if ! kill -0 "${WORKER_PIDS[$i]}" 2>/dev/null; then
        wait "${WORKER_PIDS[$i]}" 2>/dev/null
        WORKER_EXITS[$i]=$?
        WORKER_END_EPOCHS[$i]=$(date +%s)
        cat "$WORKER_LOGS_DIR/worker-${i}.log" >> "$REPORT"

        local_dur=$(( WORKER_END_EPOCHS[i] - WORKER_START_EPOCHS[i] ))
        local_dur_fmt=$(fmt_duration $local_dur)

        if [ "${WORKER_EXITS[$i]}" -eq 0 ]; then
          echo -e "    ${GREEN}✓ Worker $((i + 1)) passed${NC} ${DIM}(${local_dur_fmt})${NC}"
        else
          echo -e "    ${RED}✗ Worker $((i + 1)) FAILED (exit ${WORKER_EXITS[$i]})${NC} ${DIM}(${local_dur_fmt})${NC}"
          E2E_WORKER_EXIT=1
        fi
      else
        WORKERS_REMAINING=$((WORKERS_REMAINING + 1))
        LAST_SPEC=$(grep -oE '[^ ]+\.cy\.(js|ts)' "$WORKER_LOGS_DIR/worker-${i}.log" 2>/dev/null | tail -1 || true)
        if [ -n "$LAST_SPEC" ]; then
          LAST_SPEC=" → $(basename "$LAST_SPEC")"
        fi
        STATUS_LINE="${STATUS_LINE}W$((i + 1))${LAST_SPEC}  "
      fi
    done

    if [ $WORKERS_REMAINING -gt 0 ]; then
      ELAPSED=$(( $(date +%s) - WORKER_WALL_START ))
      echo -e "    ${YELLOW}⏳ ${WORKERS_REMAINING} running (${ELAPSED}s elapsed): ${STATUS_LINE}${NC}"
    fi
  done

  WORKER_WALL_END=$(date +%s)
  WORKER_WALL_SECS=$(( WORKER_WALL_END - WORKER_WALL_START ))

  E2E_END_EPOCH=$(date +%s)
  E2E_TOTAL_SECS=$(( E2E_END_EPOCH - E2E_START_EPOCH ))

  E2E_EXIT=$E2E_WORKER_EXIT

  {
    echo ""
    echo "E2E tests finished: $(date)"
    echo ""
  } >> "$REPORT"

  echo ""
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD} E2E Test Results                                                          ${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

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

  for i in "${!WORKER_EXITS[@]}"; do
    W_NUM=$((i + 1))
    W_DUR=$(( WORKER_END_EPOCHS[i] - WORKER_START_EPOCHS[i] ))
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
    done < <(parse_cypress_results "$WORKER_LOGS_DIR/worker-${i}.log")
    TOTAL_SPECS=$((TOTAL_SPECS + W_SPECS))

    if [ "${WORKER_EXITS[$i]}" -eq 0 ]; then
      W_STATUS="${GREEN}  ✓   ${NC}"
    else
      W_STATUS="${RED}  ✗   ${NC}"
    fi

    printf "  │   %d    │%b│  %3d  │  %4d  │  %4d   │ %8s │\n" \
      "$W_NUM" "$W_STATUS" "$W_SPECS" "$W_PASS" "$W_FAIL" "$W_DUR_FMT"
  done

  echo -e "  └────────┴────────┴───────┴────────┴─────────┴──────────┘"
  echo ""

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

  # A narrower spec glob drops files silently; totals then hide the shortfall.
  # Editor-only globbing hid 10 specs for two months — compare against the tree.
  # Skip `manual-browser-test` to match excludeSpecPattern in cypress.config.ts.
  DISCOVERED_SPECS=$(find "$WEBAPP_DIR/cypress/e2e" \
    \( -name '*.cy.js' -o -name '*.cy.ts' \) -type f \
    -not -path '*manual-browser-test*' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$DISCOVERED_SPECS" -eq 0 ]; then
    echo -e "  ${RED}✗ Found no spec files under ${WEBAPP_DIR}/cypress/e2e${NC}"
    echo "  E2E found no spec files under ${WEBAPP_DIR}/cypress/e2e" >> "$REPORT"
    E2E_EXIT=1
    echo ""
  elif [ "$TOTAL_SPECS" -lt "$DISCOVERED_SPECS" ]; then
    echo -e "  ${RED}✗ Spec coverage gap: ran ${TOTAL_SPECS} of ${DISCOVERED_SPECS} spec files${NC}"
    echo -e "  ${DIM}  A narrowed --spec glob or a crashed worker both look like this.${NC}"
    echo "  E2E coverage gap: ran ${TOTAL_SPECS} of ${DISCOVERED_SPECS} spec files" >> "$REPORT"
    E2E_EXIT=1
    echo ""
  fi

  echo -e "${BOLD}  Timing${NC}"
  echo -e "    Wall clock:          ${CYAN}$(fmt_duration $E2E_TOTAL_SECS)${NC}"
  echo -e "    Worker pass:         $(fmt_duration $WORKER_WALL_SECS)"
  echo -e "    Slowest worker:      $(fmt_duration $SLOWEST_WORKER_SECS)"
  echo -e "    Fastest worker:      $(fmt_duration $FASTEST_WORKER_SECS)"
  echo -e "    Combined CPU time:   $(fmt_duration $TOTAL_WORKER_SECS)"
  if [ $WORKER_WALL_SECS -gt 0 ]; then
    SPEEDUP=$(awk "BEGIN { printf \"%.1fx\", $TOTAL_WORKER_SECS / $WORKER_WALL_SECS }")
    echo -e "    Parallelism factor:  ${CYAN}${SPEEDUP}${NC} ${DIM}(effective speedup vs sequential)${NC}"
  fi
  echo ""

  if [ $TOTAL_FAILED -gt 0 ]; then
    echo -e "${BOLD}  Failed Specs${NC}"
    echo ""
    for i in "${!WORKER_EXITS[@]}"; do
      if [ "${WORKER_EXITS[$i]}" != "0" ] && [ "${WORKER_EXITS[$i]}" != "-" ]; then
        while IFS='|' read -r st sp du te pa fa pe sk; do
          fa_num=$(echo "$fa" | tr -d '[:space:]-'); [ -z "$fa_num" ] && fa_num=0
          if [ "$fa_num" -gt 0 ] 2>/dev/null; then
            echo -e "    ${RED}✗${NC} ${sp} ${DIM}(${fa_num} failed, worker $((i + 1)))${NC}"
          fi
        done < <(parse_cypress_results "$WORKER_LOGS_DIR/worker-${i}.log")
      fi
    done
    echo ""

    echo -e "${BOLD}  Failure Details${NC}"
    echo ""
    for i in "${!WORKER_EXITS[@]}"; do
      if [ "${WORKER_EXITS[$i]}" != "0" ] && [ "${WORKER_EXITS[$i]}" != "-" ]; then
        grep -B 1 -A 3 'AssertionError\|CypressError\|Error:.*Timed out' \
          "$WORKER_LOGS_DIR/worker-${i}.log" 2>/dev/null | while IFS= read -r eline; do
          echo -e "    ${DIM}W$((i + 1))${NC} $eline"
        done | head -30
        echo ""
      fi
    done
  fi

  echo -e "  ${DIM}Worker logs: ${WORKER_LOGS_DIR}/${NC}"
  echo ""

  TIMINGS_FILE="$WEBAPP_DIR/cypress/timings.json"
  TIMINGS_TMP=$(mktemp)
  # Cypress wraps long names in its summary table, and the parser reads only the
  # first line. cypress-split then matches nothing and every spec weighs the
  # same, so resolve each truncated prefix back to a real spec path.
  SPEC_PATHS=$(cd "$WEBAPP_DIR" && find cypress/e2e \
    \( -name '*.cy.js' -o -name '*.cy.ts' \) -type f | sed 's|^cypress/e2e/||')
  echo '{"durations":[' > "$TIMINGS_TMP"
  FIRST_ENTRY=true
  for i in "${!WORKER_EXITS[@]}"; do
    while IFS='|' read -r st sp du te pa fa pe sk; do
      [ -z "$sp" ] && continue
      # Cypress prints zero-padded durations (00:08), and bash reads a leading
      # zero as octal, so `08` aborts the arithmetic and the timing lands as 0.
      # Every spec then weighs the same and the split stops balancing. Force base 10.
      dur_ms=0
      if echo "$du" | grep -q ':'; then
        mins=$(echo "$du" | cut -d: -f1)
        secs=$(echo "$du" | cut -d: -f2)
        dur_ms=$(( (10#$mins * 60 + 10#$secs) * 1000 ))
      elif echo "$du" | grep -q 'ms'; then
        dur_ms=$(echo "$du" | tr -dc '0-9')
      else
        dur_secs=$(echo "$du" | tr -dc '0-9')
        dur_ms=$(( 10#${dur_secs:-0} * 1000 ))
      fi
      spec_clean=$(echo "$sp" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
      if ! echo "$spec_clean" | grep -qE '\.cy\.(js|ts)$'; then
        spec_full=$(echo "$SPEC_PATHS" | grep -F -m1 -- "$spec_clean" || true)
        [ -n "$spec_full" ] && spec_clean="$spec_full"
      fi
      if [ "$FIRST_ENTRY" = true ]; then
        FIRST_ENTRY=false
      else
        echo ',' >> "$TIMINGS_TMP"
      fi
      printf '{"spec":"%s","duration":%d}' "$spec_clean" "$dur_ms" >> "$TIMINGS_TMP"
    done < <(parse_cypress_results "$WORKER_LOGS_DIR/worker-${i}.log")
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

OVERALL_EXIT=0

echo ""
echo -e "${BOLD} Final Verdict${NC}"
echo ""

if $RUN_EXTENSION_GATES; then
  if [ $EXTENSION_GATES_EXIT -eq 0 ]; then
    if $RUN_WEBAPP_UNIT; then
      echo -e "  Extension gates + webapp Jest:  ${GREEN}PASSED${NC}"
      echo "  Extension gates + webapp Jest:  PASSED" >> "$REPORT"
    else
      echo -e "  Extension gates:  ${GREEN}PASSED${NC}"
      echo "  Extension gates:  PASSED" >> "$REPORT"
    fi
  else
    echo -e "  Extension gates:  ${RED}FAILED${NC}"
    echo "  Extension gates:  FAILED (exit code: $EXTENSION_GATES_EXIT)" >> "$REPORT"
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
