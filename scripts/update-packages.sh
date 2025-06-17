#!/bin/bash

# Set formatting
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Suppress npm warnings by setting log level to error only
export NPM_CONFIG_LOGLEVEL=error

# Set base options for all npm-check-updates commands
NCU_OPTIONS="--format group --color $UPGRADE --target $TARGET $INTERACTIVE $DEP_FLAG"

echo -e "${GREEN}🔄 Updating root package dependencies...${NC}"
npx npm-check-updates $NCU_OPTIONS 2>/dev/null

echo -e "\n${GREEN}📦 Updating workspace packages...${NC}"

# Get all package directories from workspaces (including private packages)
PACKAGES=$(npx lerna list --all --json 2>/dev/null | jq -r '.[].name')

# Loop through each package
for PACKAGE in $PACKAGES; do
  echo -e "\n${YELLOW}→ Checking ${BOLD}$PACKAGE${NC}"
  npx lerna exec --scope=$PACKAGE -- npx npm-check-updates $NCU_OPTIONS 2>/dev/null
done

# Clean up environment variable
unset NPM_CONFIG_LOGLEVEL

echo -e "\n${GREEN}${BOLD}✨ Package check completed!${NC}"

if [ -n "$UPGRADE" ]; then
  echo -e "\n${YELLOW}${BOLD}⚠️  IMPORTANT: Please review the updated versions in package.json files.${NC}"
  echo -e "   Once you've verified there are no incompatible versions,"
  echo -e "   run the following command to install the new dependencies:"
  echo -e ""
  echo -e "   ${GREEN}yarn reinstall:all-packages${NC}"
else
  echo -e "\n${YELLOW}${BOLD}ℹ️  This was a dry run. No package.json files were modified.${NC}"
  echo -e "   To actually update the dependencies, run:"
  echo -e ""
  echo -e "   ${GREEN}./update-packages.sh${NC}"
fi
echo -e ""
