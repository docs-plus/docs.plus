#!/bin/sh
# Script to verify PM2 is running inside the container

echo "🔍 Checking PM2 status..."
echo ""

# Check if PM2 processes are running
PM2_LIST=$(bun pm2 list)

if [ -z "$PM2_LIST" ]; then
  echo "❌ PM2 is not running any processes!"
  exit 1
fi

echo "✅ PM2 is running!"
echo ""
echo "$PM2_LIST"
echo ""

# Show logs
echo "📝 Recent logs:"
bun pm2 logs --lines 20 --nostream

