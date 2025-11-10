#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Building extensions...${NC}"
cd "$(dirname "$0")/../../.."

# Build extensions sequentially (webapp depends on them)
for ext in extension-hyperlink extension-hypermultimedia extension-indent extension-inline-code; do
  echo -e "${YELLOW}  → Building $ext${NC}"
  cd "packages/$ext" && bun run build && cd ../..
done

echo -e "${GREEN}✓ Extensions built${NC}"

echo -e "${BLUE}🏗️  Building Next.js (standalone mode)...${NC}"
cd packages/webapp
NODE_ENV=production bun run build

echo -e "${GREEN}✅ Next.js built successfully!${NC}"
echo ""
echo "Build artifacts ready at:"
echo "  → packages/webapp/.next/standalone/"
echo "  → packages/webapp/.next/static/"
echo ""
echo "Next: Run 'make deploy-fast' to build Docker image"

