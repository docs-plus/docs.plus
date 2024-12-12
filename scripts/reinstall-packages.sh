#!/bin/bash

echo "🔍 Cleaning up yarn.lock files in packages..."
# Remove all yarn.lock files in packages subdirectories
find ./packages -name "yarn.lock" -type f -delete

echo "🗑️  Removing node_modules from packages..."
# Remove all node_modules directories in packages subdirectories
find ./packages -name "node_modules" -type d -exec rm -rf {} +

echo "🧹 Removing root node_modules..."
# Remove root node_modules
rm -rf node_modules

echo "📦 Installing dependencies using yarn..."
# Install dependencies using yarn
yarn

echo "✨ Packages reinstalled successfully!"
