#!/bin/bash
set -e

# Next.js standalone build post-processing
# Ensures static files and CSS are properly copied for standalone mode

STANDALONE_DIR=".next/standalone"
WEBAPP_DIR="${STANDALONE_DIR}/apps/webapp"

echo "📦 Postbuild: Copying static files for standalone mode..."

# Create necessary directories
mkdir -p "${WEBAPP_DIR}/.next"

# Copy static files (CSS, JS, images, etc.)
# server.js runs from apps/webapp/ and changes directory there
# So static files must be at apps/webapp/.next/static
if [ -d ".next/static" ]; then
  echo "  → Copying .next/static to ${WEBAPP_DIR}/.next/"
  cp -r .next/static "${WEBAPP_DIR}/.next/" || {
    echo "❌ Failed to copy static files"
    exit 1
  }

  # Verify CSS files were copied
  if [ -d "${WEBAPP_DIR}/.next/static/css" ]; then
    CSS_COUNT=$(find "${WEBAPP_DIR}/.next/static/css" -name "*.css" | wc -l)
    echo "  ✓ Copied ${CSS_COUNT} CSS file(s)"
  else
    echo "  ⚠ Warning: No CSS directory found after copy"
  fi
else
  echo "  ⚠ Warning: .next/static directory not found"
fi

# Copy public directory
if [ -d "public" ]; then
  echo "  → Copying public directory to ${WEBAPP_DIR}/"
  cp -r public "${WEBAPP_DIR}/" || {
    echo "❌ Failed to copy public directory"
    exit 1
  }
else
  echo "  ⚠ Warning: public directory not found"
fi

echo "✅ Postbuild complete - standalone build ready"

