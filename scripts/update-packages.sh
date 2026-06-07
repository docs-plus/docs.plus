#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  echo "Usage: bun run update [--upgrade] [--dry-run] ..."
  echo ""
  echo "Default: bump package.json ranges for patch + minor only (no major jumps)."
  echo "Pass --upgrade to allow major version upgrades (target latest)."
  echo "Root catalog + every packages/* workspace. Then run bun install."
  echo ""
  echo "Options:"
  echo "  --upgrade           Include major upgrades (ncu --target latest)"
  echo "  --interactive, -i   Pick upgrades interactively"
  echo "  --dry-run           Preview only; do not write package.json"
  echo "  --prod-only         Production dependencies only"
  echo "  -h, --help          This message"
  exit 0
fi

if ! command -v bunx &>/dev/null; then
  echo -e "${RED}❌ bunx not found. Install Bun: https://bun.sh${NC}"
  exit 1
fi

TARGET="minor"
INTERACTIVE=""
UPGRADE="--upgrade"
DEP_FLAG=""
FULL_UPGRADE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --upgrade)
      FULL_UPGRADE=true
      TARGET="latest"
      shift
      ;;
    --interactive | -i)
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
    --target)
      echo -e "${RED}--target is not supported; use default (minor) or --upgrade (latest).${NC}" >&2
      exit 1
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}" >&2
      exit 1
      ;;
  esac
done

NCU=(bunx npm-check-updates --format group --color "$UPGRADE" --target "$TARGET")
[[ -n "$INTERACTIVE" ]] && NCU+=("$INTERACTIVE")
[[ -n "$DEP_FLAG" ]] && NCU+=($DEP_FLAG)

if [ "$FULL_UPGRADE" = true ]; then
  MODE_LABEL="latest (patch, minor, major)"
else
  MODE_LABEL="minor (patch + minor only)"
fi

echo -e "${BLUE}${BOLD}📦 DOCS.PLUS PACKAGE UPDATER (npm-check-updates)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Mode: ${MODE_LABEL}${NC}"

echo -e "${GREEN}🔄 Root (devDependencies + catalog)${NC}"
"${NCU[@]}" || {
  echo -e "${RED}❌ Failed at repo root${NC}"
  exit 1
}

PACKAGES=()
for d in apps/*/ extensions/*/ packages/*/; do
  [ -f "${d}package.json" ] && PACKAGES+=("${d%/}")
done
PACKAGE_COUNT=${#PACKAGES[@]}

echo -e "\n${GREEN}📦 Workspaces (${PACKAGE_COUNT} under apps/ + extensions/ + packages/)${NC}\n"

CURRENT=0
for PACKAGE_DIR in "${PACKAGES[@]}"; do
  CURRENT=$((CURRENT + 1))
  if command -v jq &>/dev/null; then
    PACKAGE_NAME=$(jq -r '.name // "unknown"' "$PACKAGE_DIR/package.json")
  else
    PACKAGE_NAME=$(grep -m 1 '"name"' "$PACKAGE_DIR/package.json" | sed 's/.*"name"[^"]*"\([^"]*\)".*/\1/')
  fi
  echo -e "${YELLOW}→ [${CURRENT}/${PACKAGE_COUNT}] ${BOLD}${PACKAGE_NAME}${NC} ${BLUE}(${PACKAGE_DIR})${NC}"
  (cd "$PACKAGE_DIR" && "${NCU[@]}") || echo -e "${RED}  ⚠️  Skipped ${PACKAGE_NAME}${NC}"
done

echo -e "\n${GREEN}${BOLD}✨ Done.${NC}"
if [ -n "$UPGRADE" ]; then
  echo -e "${YELLOW}Review package.json + root catalog, then:${NC} ${GREEN}bun install${NC}"
  if [ "$FULL_UPGRADE" = false ]; then
    echo -e "${YELLOW}Major upgrades:${NC} ${GREEN}bun run update --upgrade${NC}"
  fi
else
  echo -e "${YELLOW}Dry run only. Apply:${NC} ${GREEN}bun run update${NC}"
  echo -e "${YELLOW}With majors:${NC} ${GREEN}bun run update --upgrade${NC}"
fi
