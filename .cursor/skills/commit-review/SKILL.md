---
name: commit-review
description: Review staged/unstaged changes and generate grouped, production-grade commit messages following Conventional Commits. Use when the user asks to review changes, write commits, prepare commits, or says "commit", "review changes", or "what did I change".
---

# Commit Review

Review all changes, group them by intent, and produce Conventional Commit messages clean enough for any company's `git log`.

## The rule that overrides everything

**Never commit without explicit user approval.** Always present the report first and wait for a "go". No exceptions, no shortcuts, no "this one is obvious".

## Format

```
<type>(<scope>): <imperative summary>

<body — what changed and WHY, not how>

<footer — breaking changes, issue refs>
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

### Choosing a scope

Pick the most specific shared thing the change touches. The scope should help a future reader filter `git log` quickly.

- **Single-app repo**: feature or module name — `auth`, `parser`, `cli`, `editor`
- **Monorepo**: derive from the path — files under `packages/foo/*`, `apps/foo/*`, `libs/foo/*`, or `services/foo/*` → scope `foo`
- **Cross-cutting**: a domain noun — `deps`, `build`, `config`, `ci`, `docs`
- **No useful scope**: omit it — write `feat: …` rather than `feat(misc): …`

### Quality bar

- Imperative mood: `add`, `fix`, `remove` — never `added`, `fixed`, `updated`
- Plain language a new hire would understand without reading the diff
- Atomic — if the summary needs "and", it's two commits
- Summary ≤ 72 characters, no trailing period; body wraps at 72
- Body explains **why**, not how
- Breaking changes use `!`: `feat(api)!: drop legacy /v1`
- Internal issue refs go in the footer: `Closes #123`, `Refs PROJ-42`
- After drafting each summary, count characters — if > 72, rewrite before proposing

### Strictly forbidden

- Any mention of AI, agent, Cursor, Copilot, ChatGPT, Claude, or any tool — in summary, body, or footer
- Auto-generated trailers (`Made-with: …`, `Co-authored-by: AI`, etc.) — strip them entirely
- Vague summaries: `update files`, `fix bug`, `misc`, `stuff`
- Past tense, tautology (`refactor: refactor code`), filler (`just`, `simply`, `basically`)
- Documentation links inside the message
- Combining unrelated changes in one commit
- `--no-verify` to skip hooks

## Workflow

### 1. Gather

Run in parallel:

```bash
git status
git diff
git diff --cached
git log --oneline -10
```

- If there is nothing to commit, stop and tell the user.
- If the diff includes anything that looks like a secret or machine-local file — `.env*`, `credentials*`, `*.pem`, `*.key`, `id_rsa*`, `*secret*`, `*token*`, or paths normally listed in `.gitignore` that slipped in — **exclude them from every group** and flag them in the report so the user can decide.

### 2. Propose

Group by intent: one logical concern per group, regardless of file count. Each group must be revertable on its own without breaking unrelated work. Tests and supporting config belong with the change they support, not in a separate `chore`.

**Single group?** Use the compact form:

```
<type>(<scope>): <summary>
Files: <list>
Why: <one sentence>

<full message, including body if any>
```

**Two or more groups?** Use the full report:

```
## Commit Review Report

### Group 1: <type>(<scope>): <summary>
Files:
- path/to/file1
- path/to/file2
Why: <one sentence>

Message:
<full commit message>

---

### Group 2: …

---

Total: X commits across Y files
Excluded: N files (<reason>)   ← only if anything was flagged
```

Then wait. Ask the user to:

1. **Approve all** — proceed to commit
2. **Edit** — adjust specific messages
3. **Regroup** — merge or split groups
4. **Drop** — skip specific groups
5. **Reject all** — discard and start over

### 3. Execute (only after approval)

For each approved group, in order:

1. **Stage exactly that group's files** — `git add <paths>`. Never `git add -A` or `git add .` during sequential commits; that destroys the grouping.
2. **Commit with a HEREDOC** so multi-line bodies keep their newlines:

   ```bash
   git commit -m "$(cat <<'EOF'
   feat(auth): add passkey enrollment

   Allow users to register a WebAuthn credential during onboarding,
   replacing the optional SMS step that had a 12% failure rate.
   EOF
   )"
   ```

3. **If a pre-commit hook auto-modifies files**, re-stage those files and amend that single commit (`git commit --amend --no-edit`). Only amend the commit you just created.
4. **If a hook rejects the commit**, fix the underlying issue and create a **new** commit — do not amend, do not pass `--no-verify`.

After all commits, run `git status` and `git log --oneline -<N>` and report the result.

## Examples

**Good:**

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
perf(build): lazy-load extension bundles on first use

Defer loading of table and image bundles until the user
activates them, cutting initial load time by ~40%
```

**Bad:**

```
update files                          # zero information
fix: fixed the bug in the component   # past tense, vague, no scope
docs: update per AI suggestion        # mentions AI
chore: stuff                          # meaningless
refactor: refactor code               # tautology
fix(editor): fix issue                # what issue?
```
