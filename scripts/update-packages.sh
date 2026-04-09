#!/bin/bash

# Set formatting
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}📦 DOCS.PLUS PACKAGE UPDATER (Bun)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
  echo -e "Usage: ./scripts/update-packages.sh [OPTIONS]"
  echo -e ""
  echo -e "Runs \`bun update\` across all workspaces from the repo root."
  echo -e ""
  echo -e "Options:"
  echo -e "  --target <value>    latest (default) or compatible — latest may bump"
  echo -e "                      across semver ranges; compatible stays within"
  echo -e "                      existing ranges in package.json"
  echo -e "  --interactive, -i   Interactive package selection"
  echo -e "  --dry-run           Show updates without writing package.json / lockfile"
  echo -e "  --prod-only         Only production dependencies (--production)"
  echo -e "  -h, --help          Show this help message"
  exit 0
fi

if ! command -v bun &> /dev/null; then
  echo -e "${RED}❌ Error: bun is not installed. Please install Bun first.${NC}"
  echo -e "   Install from: https://bun.sh"
  exit 1
fi

TARGET="latest"
INTERACTIVE=""
DRY_RUN=""
PROD_ONLY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --interactive|-i)
      INTERACTIVE=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --prod-only)
      PROD_ONLY=1
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

declare -a BUN_ARGS=(update --recursive)

case "$TARGET" in
  latest)
    BUN_ARGS+=(--latest)
    ;;
  compatible|minor|patch|semver|range)
    # Bun resolves to newest versions allowed by current package.json ranges.
    ;;
  *)
    echo -e "${RED}Unknown --target: ${TARGET}${NC}"
    echo -e "   Use: latest | compatible (also: minor, patch, semver, range)"
    exit 1
    ;;
esac

if [ -n "$DRY_RUN" ]; then
  BUN_ARGS+=(--dry-run)
fi
if [ -n "$INTERACTIVE" ]; then
  BUN_ARGS+=(-i)
fi
if [ -n "$PROD_ONLY" ]; then
  BUN_ARGS+=(--production)
fi

echo -e "${GREEN}🔄 Running: bun ${BUN_ARGS[*]}${NC}"

if ! bun "${BUN_ARGS[@]}"; then
  echo -e "${RED}❌ bun update failed${NC}"
  exit 1
fi

echo -e "\n${GREEN}${BOLD}✨ Package update finished.${NC}"

if [ -z "$DRY_RUN" ]; then
  echo -e "\n${YELLOW}${BOLD}⚠️  Review package.json and lockfile changes.${NC}"
  echo -e "   Then refresh installs if needed:"
  echo -e "   ${GREEN}bun install${NC}"
else
  echo -e "\n${YELLOW}${BOLD}ℹ️  Dry run only — no files were modified.${NC}"
  echo -e "   To apply updates: ${GREEN}./scripts/update-packages.sh${NC}"
fi
echo -e ""
