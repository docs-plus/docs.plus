#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "Supabase Local Development (CLI Method)"
echo "============================================"
echo ""

# Use the Supabase CLI from the project directory
SUPABASE_PROJECT_DIR="$(cd "$(dirname "$0")/../packages/supabase" && pwd)"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo -e "${YELLOW}Install it with: brew install supabase/tap/supabase${NC}"
    exit 1
fi

cd "$SUPABASE_PROJECT_DIR"

# Parse command line arguments
COMMAND="${1:-start}"

case "$COMMAND" in
  up|start)
    echo ""
    echo -e "${GREEN}🚀 Starting Supabase via CLI...${NC}"
    supabase start

    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}✅ Supabase is running!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "📊 Supabase Studio: http://localhost:54323"
    echo "🔌 API Gateway: http://localhost:54321"
    echo "🗄️  PostgreSQL: localhost:54322"
    echo ""
    echo "Run 'supabase status' for full details"
    ;;

  down|stop)
    echo ""
    echo -e "${YELLOW}🛑 Stopping Supabase services...${NC}"
    supabase stop
    echo -e "${GREEN}✅ Supabase stopped${NC}"
    ;;

  logs)
    echo -e "${YELLOW}Use: docker logs -f <container-name>${NC}"
    echo "Available containers:"
    docker ps --filter "name=supabase" --format "  - {{.Names}}"
    ;;

  restart)
    echo -e "${YELLOW}🔄 Restarting Supabase services...${NC}"
    supabase stop
    supabase start
    echo -e "${GREEN}✅ Supabase restarted${NC}"
    ;;

  clean)
    echo -e "${RED}⚠️  This will destroy all Supabase data!${NC}"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      supabase stop --no-backup
      supabase db reset
      echo -e "${GREEN}✅ Supabase data cleaned${NC}"
    fi
    ;;

  status)
    supabase status
    ;;

  update)
    echo -e "${YELLOW}📥 Updating Supabase CLI...${NC}"
    brew upgrade supabase
    echo -e "${GREEN}✅ Supabase CLI updated${NC}"
    ;;

  studio)
    echo -e "${GREEN}🎨 Opening Supabase Studio...${NC}"
    open http://localhost:54323 2>/dev/null || xdg-open http://localhost:54323 2>/dev/null || echo "Open http://localhost:54323 in your browser"
    ;;

  help|*)
    echo "Usage: ./scripts/run-supabase.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up|start   - Start Supabase services (default)"
    echo "  down|stop  - Stop Supabase services"
    echo "  restart    - Restart Supabase services"
    echo "  logs       - View available container logs"
    echo "  status     - Show Supabase status and URLs"
    echo "  studio     - Open Supabase Studio in browser"
    echo "  update     - Update Supabase CLI"
    echo "  clean      - Stop and remove all data (destructive!)"
    echo "  help       - Show this help"
    echo ""
    ;;
esac

