#!/bin/sh
set -e

echo "🔍 Running pre-commit checks..."

# Run lint-staged (ESLint, Prettier, Stylelint on staged files).
# Note: `set -e` above propagates any non-zero exit so husky aborts the
# commit instead of letting unformatted/lint-failing files land.
bun run lint:staged

echo "✅ Pre-commit checks passed."

