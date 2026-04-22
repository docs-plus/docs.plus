---
name: commit-review
description: Review staged/unstaged changes and generate grouped, production-grade commit messages following Conventional Commits. Use when the user asks to review changes, write commits, prepare commits, or says "commit", "review changes", or "what did I change".
---

# Commit Review

Review all changes, group them by intent, and produce Conventional Commit messages terse and exact enough for any company's `git log`. Why over what. No fluff.

## The rule that overrides everything

**Never commit without explicit user approval.** Always present the report first and wait for a "go". No exceptions, no shortcuts, no "this one is obvious".

## Format

```
<type>(<scope>): <imperative summary>

<body — only if "why" isn't obvious from the subject>

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
| `docs`     | Documentation only                    |
| `chore`    | Maintenance that doesn't fit above    |
| `revert`   | Reverts a previous commit             |

### Choosing a scope

Pick the most specific shared thing the change touches. The scope should help a future reader filter `git log` quickly.

- **Single-app repo**: feature or module name — `auth`, `parser`, `cli`, `editor`
- **Monorepo**: derive from the path — files under `packages/foo/*`, `apps/foo/*`, `libs/foo/*`, or `services/foo/*` → scope `foo`
- **Cross-cutting**: a domain noun — `deps`, `build`, `config`, `ci`, `docs`
- **No useful scope**: omit it — write `feat: …` rather than `feat(misc): …`

### Subject line — quality bar

- Imperative mood: `add`, `fix`, `remove` — never `added`, `fixed`, `updated`, `adding`
- ≤ 50 characters when possible, **hard cap 72**
- No trailing period
- Match the project's capitalization convention after the colon (check `git log --oneline -20`)
- Atomic — if the summary needs "and", it's two commits
- Don't restate the filename when the scope already says it
- After drafting, count characters — if > 72, rewrite before proposing

### Body — only when needed

**Skip the body entirely** when the subject is self-explanatory. Padding noise into a body is worse than no body.

**Add a body only for:**

- Non-obvious _why_ (the diff already shows _what_)
- Breaking changes and migration notes
- Security fixes
- Data migrations
- Reverts of prior commits
- Linked issues or trade-offs worth recording

**Body rules:**

- Wrap at 72 chars
- Bullets use `-`, not `*`
- Reference issues at the end: `Closes #42`, `Refs PROJ-17`
- Breaking changes use `!` in the subject **and** a `BREAKING CHANGE:` footer

### Strictly forbidden

**In the message:**

- `I`, `we`, `now`, `currently`, `This commit does X`, `As requested by …` — the diff says what
- Past tense (`added`, `fixed`, `updated`) or gerunds (`adding`, `fixing`)
- Tautology (`refactor: refactor code`, `fix(editor): fix issue`)
- Filler: `just`, `simply`, `basically`, `actually`
- Vague summaries: `update files`, `fix bug`, `misc`, `stuff`, `various changes`
- Emoji, unless the project's existing `git log` uses them
- Documentation links inside the message body

**Attribution / tooling:**

- Any mention of AI, agent, Cursor, Copilot, ChatGPT, Claude, or any tool — in summary, body, or footer
- Auto-generated trailers (`Made-with: …`, `Generated-by: …`, `Co-authored-by: AI`, etc.) — strip them entirely
- Use `Co-authored-by:` only for real human collaborators

**Process:**

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
- Use `git log --oneline -20` to detect project conventions: capitalization after colon, scope style, whether bodies are common.
- If the diff includes anything that looks like a secret or machine-local file — `.env*`, `credentials*`, `*.pem`, `*.key`, `id_rsa*`, `*secret*`, `*token*`, or paths normally listed in `.gitignore` that slipped in — **exclude them from every group** and flag them in the report so the user can decide.

### 2. Propose

Group by intent: one logical concern per group, regardless of file count. Each group must be revertable on its own without breaking unrelated work. Tests and supporting config belong with the change they support, not in a separate `chore`.

**Single group?** Use the compact form:

```
<type>(<scope>): <summary>
Files: <list>
Why: <one sentence — or "obvious from subject">

<full message; omit body if subject is self-explanatory>
```

**Two or more groups?** Use the full report:

```
## Commit Review Report

### Group 1: <type>(<scope>): <summary>
Files:
- path/to/file1
- path/to/file2
Why: <one sentence — or "obvious from subject">

Message:
<full commit message — body omitted when not needed>

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
2. **Commit with a HEREDOC** so multi-line bodies keep their newlines. For subject-only commits, a `-m` flag is fine:

   ```bash
   git commit -m "$(cat <<'EOF'
   feat(auth): add passkey enrollment

   Replaces the optional SMS step, which had a 12% failure rate
   on cold-launch screens.

   Closes #128
   EOF
   )"
   ```

3. **If a pre-commit hook auto-modifies files**, re-stage those files and amend that single commit (`git commit --amend --no-edit`). Only amend the commit you just created.
4. **If a hook rejects the commit**, fix the underlying issue and create a **new** commit — do not amend, do not pass `--no-verify`.

After all commits, run `git status` and `git log --oneline -<N>` and report the result.

## Examples

### Subject-only is enough

```
fix(parser): handle empty input
```

```
docs(readme): correct install command
```

```
test(auth): cover expired-token branch
```

```
chore(deps): bump zod to 3.23.8
```

### Body earns its keep

```
feat(editor): add inline code formatting toggle

Toolbar button and Cmd+E shortcut wrap the current selection.
Matches Notion/Slack muscle memory users were already trying.
```

```
fix(tab-bar): restore active tab highlight after navigation

The route-change handler was overwriting the active state
before the highlight effect read it.

Closes #412
```

```
perf(build): lazy-load extension bundles on first use

Cuts initial bundle by ~40% on cold load. Table and image
extensions now resolve only when their nodes appear.
```

### Breaking change

```
feat(api)!: rename /v1/orders to /v1/checkout

BREAKING CHANGE: clients on /v1/orders must migrate to
/v1/checkout before 2026-06-01. Old route returns 410 after
that date.
```

### Bad — do not produce

```
update files                          # zero information
fix: fixed the bug in the component   # past tense, vague, no scope
chore: stuff                          # meaningless
refactor: refactor code               # tautology
fix(editor): fix issue                # what issue?
docs: update per AI suggestion        # mentions a tool
feat: now adds a new endpoint         # "now", and diff already shows it
feat(api): I added GET /users/:id     # "I"
```

## Boundaries

This skill **proposes** and, after approval, **executes** commits. It does not push, force-push, rebase, amend prior commits, or run `git commit --no-verify`. If the user wants any of those, they ask explicitly.
