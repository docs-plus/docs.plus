#!/bin/sh

echo "🔍 Pre-push checks starting..."
echo ""

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
    echo "❌ Could not resolve repository root. Push aborted."
    exit 1
fi

# check:ci skips webapp build:ci when a Next development server is live.
# A green skip is not the GitHub job. A live server plus a production
# build also corrupts .next.
if ps -ax -o command= | grep -E '[n]ext (dev|start)' >/dev/null; then
    echo "❌ A Next development server is running."
    echo "   Stop the webapp development server, then push again."
    echo "   After the push: restart the development server."
    echo "   check:ci already removes the production .next after build:ci."
    echo ""
    echo "❌ Push aborted."
    exit 1
fi

REMOTE_NAME="$1"
echo "🧪 Running bun run check:ci for push to ${REMOTE_NAME:-unknown}"
echo "   This is the local replica of the prod quality gates."

if (cd "$REPO_ROOT" && bun run check:ci); then
    echo ""
    echo "🚀 bun run check:ci passed. Proceeding with push."
    exit 0
fi

echo ""
echo "❌ bun run check:ci failed. Push aborted."
exit 1
