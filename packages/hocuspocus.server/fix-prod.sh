#!/bin/bash

echo "🔧 DocPlus Production Migration Fix Script"
echo "=========================================="

# Stop PM2 processes
echo "🛑 Stopping PM2 processes..."
pm2 stop all

# Fix the migration
echo "🔧 Fixing failed migration..."
bun fix-migration.js

if [ $? -eq 0 ]; then
    echo "✅ Migration fixed successfully!"

    # Restart PM2 processes
    echo "🚀 Restarting PM2 processes..."
    pm2 start pm2.config.cjs --only stage_rest,stage_ws

    echo "✅ Production server restarted successfully!"
    echo "📊 PM2 Status:"
    pm2 status
else
    echo "❌ Failed to fix migration. Check the logs above."
    exit 1
fi
