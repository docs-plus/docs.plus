#!/bin/bash

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Starting package reinstallation...${NC}\n"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
  echo -e "${RED}❌ Error: Bun is not installed${NC}"
  echo -e "   Install it from: https://bun.sh"
  exit 1
fi

# Confirm action
if [ "$1" != "--force" ]; then
  echo -e "${YELLOW}⚠️  This will remove all node_modules and Bun lockfiles${NC}"
  read -p "   Continue? [y/N]: " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

echo -e "${GREEN}🔍 Cleaning up Bun lockfiles in packages...${NC}"
# Remove Bun lockfiles from package subdirectories (shouldn't exist but clean anyway)
find ./packages -depth -name "bun.lockb" -type f -delete 2>/dev/null || true

echo -e "${GREEN}🗑️  Removing node_modules from packages...${NC}"
# Find and remove all node_modules directories
find ./packages -type d -name "node_modules" -prune -exec rm -rf {} \; 2>/dev/null || true

echo -e "${GREEN}🧹 Removing root node_modules and lockfile...${NC}"
# Remove root node_modules and Bun lockfile for fresh install
rm -rf node_modules 2>/dev/null || true
rm -f bun.lockb 2>/dev/null || true

echo -e "\n${GREEN}📦 Installing dependencies using bun...${NC}"
# Install dependencies using bun with error handling
if bun install; then
  echo -e "\n${GREEN}✨ Packages reinstalled successfully!${NC}"

  # Show summary
  echo -e "\n${BLUE}📊 Summary:${NC}"
  bun pm ls 2>/dev/null | head -n 10
  echo -e "\n${YELLOW}💡 Run 'bun pm ls --all' to see all workspace packages${NC}"
else
  echo -e "\n${RED}❌ Installation failed!${NC}"
  exit 1
fi
