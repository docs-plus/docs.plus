#!/bin/sh

# Git runs this hook before it cleans the message, so drop the -v diff, comments, CRs and trailing spaces first.
commit_msg=$(sed '/^# -\{24\} >8 -\{24\}$/,$d' "$1" | git stripspace --strip-comments)
first_line=$(printf '%s\n' "$commit_msg" | head -n 1)

conventional='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9][a-z0-9.-]*\))?: [^ ]'
max_subject=72

# Maintainer ruling, 2026-11-02: no AI credit in commits. A human co-author may stay, so "Claude Monet" or "Gemini Jones" passes.
# The banner must start its line, so a body that quotes it in prose passes.
ai_coauthor='^[[:space:]]*co-authored-by[[:space:]]*:[[:space:]]*(claude[[:space:]]+(code|opus|sonnet|haiku|fable|[0-9])([[:space:]<]|$)|(cursor( agent)?|codex|chatgpt|copilot|github copilot|gemini)[[:space:]]*(<|$)|.*(@anthropic\.com|@cursor\.(com|sh)|@openai\.com|cursoragent))'
tool_line='^[[:space:]]*(generated-by|made-with|assisted-by)[[:space:]]*:|^[^[:alnum:]]*generated with \[(claude code|codex|cursor)\]'
if printf '%s\n' "$commit_msg" | grep -qiE "$ai_coauthor|$tool_line"; then
    echo "❌ Remove the AI attribution line. Commits here carry no AI Co-authored-by line,"
    echo "   no Generated-by, Made-with or Assisted-by line, and no \"Generated with\" banner."
    echo "   A Co-authored-by line for a human co-author is fine."
    exit 1
fi

# Git writes these subjects itself, for a merge and for a fixup that a rebase folds away.
case "$first_line" in
    'Merge branch '*|'Merge remote-tracking branch '*|'Merge pull request #'*|'Merge tag '*|'Merge commit '*) exit 0 ;;
    'fixup! '*|'squash! '*|'amend! '*) exit 0 ;;
esac

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

# Only the subject is checked. A body line that looks like a subject must not pass a bad one.
if printf '%s\n' "$first_line" | grep -qE "$conventional"; then
    # Count UTF-8 lead bytes, so an em dash is one character in any locale.
    length=$(printf '%s' "$first_line" | LC_ALL=C tr -d '\200-\277' | wc -c)
    if [ "$length" -le "$max_subject" ]; then
        exit 0
    fi
    echo "❌ Subject is $((length)) characters. The limit is $max_subject."
    echo "   Move the detail into the body."
    exit 1
fi

echo "❌ Invalid commit message format!"
echo ""
echo "Allowed formats:"
echo ""
echo "1. Conventional commits, on the first line, $max_subject characters at most:"
echo "   type(scope): message"
echo "   Examples: feat(webapp): add feature, fix(admin): resolve bug"
echo "   A scope is lowercase letters, digits, dots and hyphens."
echo "   To revert, use revert(scope): ... and not git's default Revert \"...\" line."
echo ""
echo "2. Deploy triggers (full list in .github/scripts/parse-build-trigger.sh):"
echo "   (build): front      → Deploy frontend only"
echo "   (build): back       → Deploy backend only"
echo "   (build): front back → Deploy both"
echo ""
exit 1
