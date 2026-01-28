#!/bin/sh

# Auto-install dependencies after pulling changes
# Only runs if package.json or bun.lock changed

changed_files=$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)

if echo "$changed_files" | grep -qE "(package\.json|bun\.lock)"; then
    echo "📦 Dependencies changed, running bun install..."
    bun install
    echo "✅ Dependencies updated"
fi

