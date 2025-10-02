#!/bin/bash

# Set formatting
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}📦 DOCS.PLUS PACKAGE UPDATER${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Add help message if -h or --help is passed
if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
  echo -e "Usage: ./update-packages.sh [OPTIONS]"
  echo -e ""
  echo -e "Options:"
  echo -e "  --target <value>    Update target: latest, minor, patch, semver (default: latest)"
  echo -e "  --interactive, -i   Run in interactive mode"
  echo -e "  --dry-run           Show updates without modifying package.json files"
  echo -e "  --prod-only         Only check production dependencies"
  echo -e "  -h, --help          Show this help message"
  exit 0
fi

# Check if required commands exist
if ! command -v bunx &> /dev/null; then
  echo -e "${RED}❌ Error: bunx is not installed. Please install Bun first.${NC}"
  echo -e "   Install from: https://bun.sh"
  exit 1
fi

# Default options
TARGET="latest"
INTERACTIVE=""
UPGRADE="--upgrade"
DEP_FLAG=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --interactive|-i)
      INTERACTIVE="--interactive"
      shift
      ;;
    --dry-run)
      UPGRADE=""
      shift
      ;;
    --prod-only)
      DEP_FLAG="--dep prod"
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Set base options for all npm-check-updates commands
NCU_OPTIONS="--format group --color $UPGRADE --target $TARGET $INTERACTIVE $DEP_FLAG"

echo -e "${GREEN}🔄 Updating root package dependencies...${NC}"
bunx npm-check-updates $NCU_OPTIONS 2>/dev/null || {
  echo -e "${RED}❌ Failed to update root dependencies${NC}"
  exit 1
}

echo -e "\n${GREEN}📦 Updating workspace packages...${NC}"

# Better: Use bun to list workspaces or find with depth control
# This handles any package.json depth and avoids parsing issues
PACKAGES=$(find packages -type f -name "package.json" -not -path "*/node_modules/*" | sed 's|/package.json$||' | sort)

# Count packages
PACKAGE_COUNT=$(echo "$PACKAGES" | wc -l | tr -d ' ')
echo -e "${BLUE}Found ${PACKAGE_COUNT} workspace packages${NC}\n"

# Loop through each package
CURRENT=0
for PACKAGE_DIR in $PACKAGES; do
  CURRENT=$((CURRENT + 1))

  # Better JSON parsing - check if jq is available, otherwise fallback
  if command -v jq &> /dev/null; then
    PACKAGE_NAME=$(jq -r '.name // "unknown"' "$PACKAGE_DIR/package.json" 2>/dev/null)
  else
    # Fallback to grep but with better pattern
    PACKAGE_NAME=$(grep -m 1 '"name"' "$PACKAGE_DIR/package.json" | sed 's/.*"name"[^"]*"\([^"]*\)".*/\1/')
  fi

  echo -e "${YELLOW}→ [$CURRENT/$PACKAGE_COUNT] Checking ${BOLD}$PACKAGE_NAME${NC} ${BLUE}($PACKAGE_DIR)${NC}"

  (cd "$PACKAGE_DIR" && bunx npm-check-updates $NCU_OPTIONS 2>/dev/null) || {
    echo -e "${RED}  ⚠️  Warning: Failed to check $PACKAGE_NAME${NC}"
  }
done

echo -e "\n${GREEN}${BOLD}✨ Package check completed!${NC}"

if [ -n "$UPGRADE" ]; then
  echo -e "\n${YELLOW}${BOLD}⚠️  IMPORTANT: Please review the updated versions in package.json files.${NC}"
  echo -e "   Once you've verified there are no incompatible versions,"
  echo -e "   run the following command to install the new dependencies:"
  echo -e ""
  echo -e "   ${GREEN}bun run reinstall:all-packages${NC}"
else
  echo -e "\n${YELLOW}${BOLD}ℹ️  This was a dry run. No package.json files were modified.${NC}"
  echo -e "   To actually update the dependencies, run:"
  echo -e ""
  echo -e "   ${GREEN}./scripts/update-packages.sh${NC}"
fi
echo -e ""
