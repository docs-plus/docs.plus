#!/bin/sh

echo "🔧 DocPlus Docker Migration Fix Script"
echo "======================================"

# Fix the migration
echo "🔧 Fixing failed migration..."
bun fix-migration.js

if [ $? -eq 0 ]; then
    echo "✅ Migration fixed successfully!"
    echo "🔄 You can now restart the container or PM2 processes"
else
    echo "❌ Failed to fix migration. Check the logs above."
    exit 1
fi
