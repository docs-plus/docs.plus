#!/bin/sh

commit_msg=$(cat "$1")

conventional="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,100}"
deploy_trigger="^\(build\):.*"

if echo "$commit_msg" | grep -qE "$conventional"; then
    exit 0
fi

if echo "$commit_msg" | grep -qE "$deploy_trigger"; then
    exit 0
fi

echo "❌ Invalid commit message format!"
echo ""
echo "Allowed formats:"
echo ""
echo "1. Conventional commits:"
echo "   type(scope): message"
echo "   Examples: feat(webapp): add feature, fix(admin): resolve bug"
echo ""
echo "2. Deploy triggers:"
echo "   (build): front      → Deploy frontend only"
echo "   (build): back       → Deploy backend only"
echo "   (build): front back → Deploy both"
echo ""
exit 1

