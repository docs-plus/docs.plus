#!/usr/bin/env bash
# =============================================================================
# Editor Test Suite Runner
# Runs unit tests (Jest) and E2E tests (Cypress), saves results to a report file.
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
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEBAPP_DIR="$ROOT_DIR/packages/webapp"
REPORT_DIR="$ROOT_DIR/Notes"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
REPORT="$REPORT_DIR/test-results-${TIMESTAMP}.txt"
BASE_URL="${BASE_URL:-http://localhost:3001}"

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

  cd "$WEBAPP_DIR"

  if bun run test --verbose 2>&1 | tee -a "$REPORT"; then
    UNIT_EXIT=0
    echo ""
    echo -e "${GREEN}Unit tests passed.${NC}"
  else
    UNIT_EXIT=$?
    echo ""
    echo -e "${RED}Unit tests failed (exit code: $UNIT_EXIT).${NC}"
  fi

  {
    echo ""
    echo "Unit tests finished: $(date)"
    echo ""
  } >> "$REPORT"

  cd "$ROOT_DIR"
  echo ""
fi

# ─── E2E tests (Cypress) ─────────────────────────────────────────────────────

if $RUN_E2E; then
  STEP="[2/2]"
  $RUN_UNIT || STEP="[1/1]"

  echo -e "${BOLD}${STEP} Running E2E tests (Cypress)...${NC}"
  echo ""

  {
    echo "============================================================================="
    echo " E2E TESTS (Cypress)"
    echo " Started: $(date)"
    echo " Base URL: ${BASE_URL}"
    echo "============================================================================="
    echo ""
  } >> "$REPORT"

  E2E_EDITOR_EXIT=0
  E2E_COMMANDS_EXIT=0

  echo -e "${BOLD}  Running editor E2E tests (with baseUrl)...${NC}"
  if bunx cypress run \
    --project "$WEBAPP_DIR" \
    --browser electron \
    --config "baseUrl=${BASE_URL}" \
    --spec "$WEBAPP_DIR/cypress/e2e/editor/**/*.cy.{js,ts}" 2>&1 | tee -a "$REPORT"; then
    E2E_EDITOR_EXIT=0
  else
    E2E_EDITOR_EXIT=$?
  fi

  echo ""
  echo -e "${BOLD}  Running command E2E tests (no baseUrl)...${NC}"
  if bunx cypress run \
    --project "$WEBAPP_DIR" \
    --browser electron \
    --spec "$WEBAPP_DIR/cypress/e2e/cypress-commands/**/*.cy.{js,ts}" 2>&1 | tee -a "$REPORT"; then
    E2E_COMMANDS_EXIT=0
  else
    E2E_COMMANDS_EXIT=$?
  fi

  if [ $E2E_EDITOR_EXIT -eq 0 ] && [ $E2E_COMMANDS_EXIT -eq 0 ]; then
    E2E_EXIT=0
    echo ""
    echo -e "${GREEN}E2E tests passed.${NC}"
  else
    E2E_EXIT=1
    echo ""
    echo -e "${RED}E2E tests failed (editor: $E2E_EDITOR_EXIT, commands: $E2E_COMMANDS_EXIT).${NC}"
  fi

  {
    echo ""
    echo "E2E tests finished: $(date)"
    echo ""
  } >> "$REPORT"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

OVERALL_EXIT=0

{
  echo "============================================================================="
  echo " SUMMARY"
  echo "============================================================================="
  echo ""
} >> "$REPORT"

if $RUN_UNIT; then
  if [ $UNIT_EXIT -eq 0 ]; then
    echo "  Unit tests:  PASSED" >> "$REPORT"
  else
    echo "  Unit tests:  FAILED (exit code: $UNIT_EXIT)" >> "$REPORT"
    OVERALL_EXIT=1
  fi
fi

if $RUN_E2E; then
  if [ $E2E_EXIT -eq 0 ]; then
    echo "  E2E tests:   PASSED" >> "$REPORT"
  else
    echo "  E2E tests:   FAILED (exit code: $E2E_EXIT)" >> "$REPORT"
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
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD} Results${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if $RUN_UNIT; then
  if [ $UNIT_EXIT -eq 0 ]; then
    echo -e "  Unit tests:  ${GREEN}PASSED${NC}"
  else
    echo -e "  Unit tests:  ${RED}FAILED${NC}"
  fi
fi

if $RUN_E2E; then
  if [ $E2E_EXIT -eq 0 ]; then
    echo -e "  E2E tests:   ${GREEN}PASSED${NC}"
  else
    echo -e "  E2E tests:   ${RED}FAILED${NC}"
  fi
fi

echo ""
echo -e "  Report saved to: ${BLUE}${REPORT}${NC}"
echo ""

exit $OVERALL_EXIT
