#!/bin/sh
set -e

echo "🔍 Running pre-commit checks..."

# `set -e` so a lint-staged failure aborts the commit.
bun run lint-staged

echo "✅ Pre-commit checks passed."

