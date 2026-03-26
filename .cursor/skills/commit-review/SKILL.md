---
name: commit-review
description: Review staged/unstaged changes and generate grouped, production-grade commit messages following Conventional Commits. Use when the user asks to review changes, write commits, prepare commits, or says "commit", "review changes", or "what did I change".
---

# Commit Review

Act as a **Head of Engineering** with a **Senior Technical Writer** at your side. Your job: review all changes, group them by intent, and produce commit messages that belong in a Fortune 500 engineering org's git history.

## Standard

All commit messages **must** follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This is non-negotiable.

### Format

```
<type>(<scope>): <imperative summary>

<body — what changed and WHY, not how>

<footer — breaking changes, ticket refs>
```

### Allowed types

| Type       | When to use                           |
| ---------- | ------------------------------------- |
| `feat`     | New user-facing capability            |
| `fix`      | Bug or broken behavior corrected      |
| `refactor` | Code restructured, no behavior change |
| `perf`     | Performance improvement               |
| `style`    | Formatting, whitespace, naming only   |
| `test`     | Test additions or corrections         |
| `build`    | Build system or dependency changes    |
| `ci`       | CI/CD pipeline changes                |
| `chore`    | Maintenance that doesn't fit above    |
| `revert`   | Reverts a previous commit             |

### Message quality bar

- **Intuitive and descriptive** — a product manager or new hire should understand the intent without reading the diff
- **Plain language** — avoid jargon, acronyms, and overly technical words
- **Imperative mood** — "add", "fix", "remove" (not "added", "fixes", "removed")
- **Atomic** — each commit does exactly one thing
- **Summary ≤ 72 characters**, no trailing period
- **Body wraps at 72 characters**, explains the "why" not the "how"
- **Breaking changes** use `!` suffix: `feat(api)!: remove legacy endpoints`

### Strictly forbidden

- Mentioning AI, agent, Cursor, copilot, ChatGPT, or any tool — anywhere in the message (summary, body, or footer)
- Trailers like `Made-with: Cursor`, `Co-authored-by: AI`, or any machine-generated footer — **strip them entirely**
- Documentation references or links in the message
- Vague summaries ("update files", "fix bug", "misc changes")
- Combining unrelated changes in one commit
- Past tense ("added", "fixed", "updated")
- Filler words ("just", "simply", "basically", "actually")

## Workflow

### Step 1: Gather changes

Run in parallel:

```bash
git status
git diff
git diff --cached
git log --oneline -10
```

### Step 2: Understand the full picture

Before grouping, answer internally:

1. What was the **user's intent** across all changes?
2. Are there **logical boundaries** between changes (different features, different bug fixes)?
3. Would a future engineer doing `git log --oneline` get a **clear story** of what happened?
4. Could any change be **split further** into a more atomic commit?

### Step 3: Group by intent

Group changes by **action and purpose**, not by file or directory. Each group must represent a single logical change that could be reverted independently without breaking anything else.

Principles:

- One concern per commit — if you need "and" in the summary, it's probably two commits
- Config changes that support a feature belong with that feature, not in a separate `chore` commit
- Test changes belong with the code they test, unless they're standalone test improvements

### Step 4: Write commit messages

For each group, craft the message. Before finalizing, run this mental checklist:

- [ ] Would this message make sense in a CHANGELOG?
- [ ] Could a new team member understand it on day one?
- [ ] Does it tell the reader **why** this change matters?
- [ ] Is it specific enough to distinguish from similar past commits?
- [ ] Is it free of any tool/AI references?

### Step 5: Generate report for review

**Do NOT commit anything yet.** First, present a full report for the user to review.

Format the report as:

```
## Commit Review Report

### Group 1: <type>(<scope>): <summary>
**Files:**
- path/to/file1.tsx
- path/to/file2.ts

**What changed:** <1-2 sentence plain-language explanation>

**Proposed commit message:**
<full commit message with body if applicable>

---

### Group 2: ...
(repeat for each group)

---

**Total: X commits across Y files**
```

After presenting the report, **wait for explicit user approval** before committing anything. Ask the user to:

1. Approve all — proceed to commit sequentially
2. Edit — adjust specific messages
3. Regroup — merge or split groups
4. Drop — skip specific groups
5. Reject all — discard and start over

## Examples

**Excellent — production-grade:**

```
feat(editor): add inline code formatting toggle

Allow users to wrap selected text in inline code blocks
using the toolbar button or Cmd+E shortcut
```

```
fix(tab-bar): restore active tab highlight after navigation

The active indicator was lost when switching between tabs
due to a missing state update in the route change handler
```

```
refactor(auth): consolidate token refresh into single entry point

Reduce three separate refresh paths to one shared utility,
eliminating inconsistent expiry handling across the app
```

```
perf(editor): lazy-load extension bundles on first use

Defer loading of table and image extensions until the user
activates them, reducing initial editor load time by ~40%
```

**Bad — would be rejected in code review:**

```
update files                          # zero information
fix: fixed the bug in the component   # past tense, vague, no scope
docs: update per AI suggestion        # mentions AI
feat: add feature (see docs#123)      # doc reference, vague
chore: stuff                          # meaningless
refactor: refactor code               # tautology
fix(editor): fix issue                # what issue?
```
