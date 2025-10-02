#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 Hocuspocus Server Setup (Bun + Hono)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${YELLOW}⚠️  Bun is not installed. Installing now...${NC}"
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

echo -e "\n${GREEN}✓ Bun is installed${NC}"
bun --version

# Install dependencies
echo -e "\n${BLUE}📦 Installing dependencies...${NC}"
bun install

# Generate Prisma client
echo -e "\n${BLUE}🔧 Generating Prisma client...${NC}"
bunx prisma generate

# Check if .env exists
if [ ! -f .env.development ]; then
    echo -e "\n${YELLOW}⚠️  No .env.development file found${NC}"
    echo -e "${YELLOW}   Please create one based on your existing configuration${NC}"
else
    echo -e "\n${GREEN}✓ Environment configuration found${NC}"
fi

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${BLUE}Next steps:${NC}"
echo -e "1. Set up your .env.development file"
echo -e "2. Run migrations: ${YELLOW}bunx prisma migrate deploy${NC}"
echo -e "3. Start development:"
echo -e "   - REST API: ${YELLOW}bun run dev:rest${NC}"
echo -e "   - WebSocket: ${YELLOW}bun run dev:ws${NC}"

echo -e "\n${BLUE}Documentation:${NC}"
echo -e "- Quick start: ${YELLOW}./README_NEW.md${NC}"
echo -e "- Migration guide: ${YELLOW}./MIGRATION_GUIDE.md${NC}"

