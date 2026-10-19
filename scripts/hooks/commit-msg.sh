#!/bin/sh

commit_msg=$(cat "$1")
first_line=$(printf '%s\n' "$commit_msg" | head -n 1)

conventional="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,100}"

# A deploy trigger is checked by the CI parser itself, so a typo fails here and not in CI.
case "$first_line" in
    '(build)'*)
        parser="$(git rev-parse --show-toplevel)/.github/scripts/parse-build-trigger.sh"
        if result=$(COMMIT_MSG="$commit_msg" bash "$parser" 2>&1); then
            exit 0
        fi
        echo "❌ Invalid deploy trigger: $(printf '%s\n' "$result" | sed -n 's/^::error:://p')"
        echo ""
        echo "Deploy triggers:"
        echo "   (build): front      → Deploy frontend only"
        echo "   (build): back       → Deploy backend only"
        echo "   (build): front back → Deploy both"
        exit 1
        ;;
esac

if echo "$commit_msg" | grep -qE "$conventional"; then
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

