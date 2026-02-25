#!/bin/sh

echo "🔍 Running pre-commit checks..."

# Run lint-staged (ESLint, Prettier, Stylelint on staged files)
bun run lint:staged

echo "✅ Pre-commit checks passed."

