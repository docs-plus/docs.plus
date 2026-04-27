---
name: commit-review
description: Review staged/unstaged changes and generate grouped, production-grade commit messages following Conventional Commits. Use when the user asks to review changes, write commits, prepare commits, or says "commit", "review changes", or "what did I change".
---

# Commit Review

Review all changes, group them by intent, and produce Conventional Commit messages terse and exact enough for any company's `git log`. Why over what. No fluff.

## The rule that overrides everything

**Never commit without explicit user approval.** Always present the report first and wait for a "go". No exceptions, no shortcuts, no "this one is obvious".

## Step 0 — detect repo conventions

Before drafting anything, learn what this repo actually accepts:

- Read `scripts/hooks/commit-msg.sh`, `.husky/commit-msg`, `commitlint.config.*`, or `package.json` `commitlint` block — note the regex and any non-conventional shapes (e.g. deploy triggers like `(build): front`).
- `git log --oneline -50` to detect: capitalization after the colon, scope style (`feat(webapp)` vs `feat:`), body habits, and whether the repo's local hooks inject trailers (`Made-with: …`, `Generated-by: …`) — those are repo policy, leave them alone.
- If the hook rejects the Conventional `!` breaking-change marker (regex without an `!` slot — common), use the `BREAKING CHANGE:` footer only. Never `feat!:` / `feat(scope)!:` until Step 0 confirms the regex accepts it.
- If the repo defines extra shapes (e.g. `^\(build\):.*` deploy trigger), accept them as first-class. Don't force everything into Conventional.

## Step 1 — context depth (tier the work)

Default is fast: current conversation + working-tree diff + `AGENTS.md`. Most commits don't need more.

**Escalate to session archaeology (tier 2) when any of:**

- This session has < 3 user messages but the diff is large
- Branch has been worked on > 48h (see anchor below)
- User explicitly asks for "full context" / "session-aware" review
- You're picking up a branch you weren't part of in this session

### Tier 2 recipe — session archaeology

1. **Anchor on git history, not file `mtime`.** Pick anchor by scope — `mtime` is reset by `git checkout`, formatters, `bun install`, and pre-commit hooks; never use it.
   - **Reviewing only uncommitted changes** (the common case):

     ```bash
     ANCHOR=$(git log -1 --format=%cI HEAD)
     ```

   - **Reviewing the entire branch** (less common — usually for PR-prep):

     ```bash
     MERGE_BASE=$(git merge-base origin/HEAD HEAD)
     ANCHOR=$(git log -1 --format=%cI "$MERGE_BASE")
     ```

2. **Candidate sessions** — transcript directories with folder mtime ≥ `$ANCHOR`:

   ```bash
   find <transcripts-root> -maxdepth 1 -type d -newermt "$ANCHOR"
   ```

3. **Index pass — don't read whole transcripts.** Per candidate, one ripgrep pass each:
   - First user message — `rg -m1 '<user_query>' <session>.jsonl` (the brief)
   - Last user message — `rg '<user_query>' <session>.jsonl | tail -1` (final state)
   - Edited file paths — `rg -o '"path":"[^"]+"' <session>.jsonl | sort -u`
   - **Delegation paths** — when a session is small (< 50 lines) but contains `"name":"Task"`, the real work happened in an inaccessible subagent transcript. The parent has 0 `"path"` keys but the user's brief is still high-signal. Extract path-shape strings from the parent's Task prompt and Shell command bodies as a substitute for the edited-file list:

     ```bash
     rg -o '(packages/[a-zA-Z0-9_/.+-]+|\.cursor/[a-zA-Z0-9_/.+-]+|src/[a-zA-Z0-9_/.+-]+)' <session>.jsonl | sort -u
     ```

4. **Filter — by overlap strength, not single hits.** Single-file overlap is noisy: a long-lived file like `TipTap.tsx` is touched by every editor feature for years. Score each session:
   - **Strong**: edited-file set covers ≥ 30% of `git status` filelist, **or** session is < 48h old AND covers ≥ 1 file
   - **Weak**: 1 file overlap, session > 48h old → false-positive risk, drop
   - **Delegation-parent**: brief mentions a feature folder present in the diff → keep, treat as low-confidence brief

   If 0 sessions score Strong, **escalate to fallback (below) immediately** — don't waste tokens reading Weak ones.

5. **Read survivors selectively** — user-message slices and final tool-call summaries only. Skip the agent's exploratory monologue, abandoned approaches, and code-reading rabbit holes.

6. **The "why" is the user's stated brief, not the agent's narrative.** Reconcile brief vs diff: if they disagree (user said "refactor", diff adds new endpoints = `feat`), flag the mismatch in the report rather than parroting the user's framing.

### Tier 2 fallback (used freely, not "only when archaeology fails")

These three sources together give a HoE-grade picture in seconds and are the _correct_ answer when:

- All candidate sessions are delegation-parents (no local edits)
- Work is iterative across many sessions touching the same files
- Branch is older than ~5 days
- Archaeology returned only Weak-scored sessions
- Work was pulled from a teammate (no local sessions at all)

```bash
git log --oneline origin/HEAD..HEAD     # the branch's prior commit messages tell the story arc
git status --porcelain                   # diff already groups itself by feature folder
cat AGENTS.md                            # workspace context for the why
```

Use this **whenever** it's sufficient. Tier 2 archaeology is for when conversation history actually carries unique signal that git + AGENTS.md don't.

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

Repo-specific shapes detected in Step 0 are also valid — e.g. `(build): front`, `(build): back`, `(build): front back` as deploy triggers (no scope, no body, exact phrasing).

### Choosing a scope

Pick the most specific shared thing the change touches. The scope should help a future reader filter `git log` quickly.

- **Single-app repo**: feature or module name — `auth`, `parser`, `cli`, `editor`
- **Monorepo**: derive from the path — files under `packages/foo/*`, `apps/foo/*`, `libs/foo/*`, or `services/foo/*` → scope `foo`
- **Cross-cutting**: a domain noun — `deps`, `build`, `config`, `ci`, `docs`
- **No useful scope**: omit it — write `feat: …` rather than `feat(misc): …`

### Subject line — quality bar

- Imperative mood: `add`, `fix`, `remove` — never `added`, `fixed`, `updated`, `adding`
- ≤ 50 characters when possible, **editorial cap 72** (hooks often allow up to 100 — go past 72 only when wrapping makes the subject worse)
- No trailing period
- Match the project's capitalization convention after the colon (from Step 0)
- Atomic — if the summary needs "and", it's two commits
- Don't restate the filename when the scope already says it

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
- Issue refs at the end. Use `Closes #N` **only** on the commit that actually fixes the issue (usually the last in the group); other commits in the same PR use `Refs #N` so GitHub doesn't close on the first-merged commit.
- Breaking changes: `BREAKING CHANGE: <description>` footer. Use the `!` subject marker only if Step 0 confirmed the hook accepts it.

### Strictly forbidden

- Past tense (`added`, `fixed`, `updated`) or gerunds (`adding`, `fixing`)
- `I`, `we`, `now`, `currently`, `This commit does X`, `As requested by …`
- Tautology (`refactor: refactor code`, `fix(editor): fix issue`)
- Filler: `just`, `simply`, `basically`, `actually`
- Vague summaries: `update files`, `fix bug`, `misc`, `stuff`, `various changes`
- Emoji, unless the project's existing `git log` uses them
- Authoring tool-attribution trailers (`Made-with: …`, `Generated-by: …`, `Co-authored-by: AI`) or mentioning AI / Cursor / Copilot / ChatGPT / Claude in the message. **Repo-injected trailers added post-commit are not yours to police — leave them alone.** Use `Co-authored-by:` only for real human collaborators.
- Reproducing agent monologue, exploration, or abandoned approaches in the body. The body summarizes the **decision**, not the journey.
- Combining unrelated changes in one commit
- `--no-verify` to skip hooks; `--no-gpg-sign` to skip signing

## Workflow

### 1. Gather

Run in parallel:

```bash
git status
git diff --stat            # cost gate — paginate per-group if huge
git diff
git diff --cached
git diff --check           # whitespace / unresolved conflict markers
git log --oneline -20
```

- Default scope follows the user's ask: "review my staged changes" → skip unstaged; "review changes" → both.
- If there's nothing to commit, stop and tell the user.
- If the diff includes anything that looks like a secret or machine-local file — `**/.env*`, `**/credentials*.json`, `**/service-account*.json`, `**/*.pem`, `**/*.key`, `**/id_rsa*`, `**/*.p12`, `**/*.pfx`, `**/*.kubeconfig`, or paths normally listed in `.gitignore` that slipped in — **exclude them from every group** and flag them so the user can decide. Do **not** substring-match `*token*` / `*secret*` (false-positives on `tokenizer.ts`, `secretRotation.test.ts`).

### 2. Propose

Group by intent: one logical concern per group, regardless of file count. Each group must be revertable on its own without breaking unrelated work. Tests and supporting config belong with the change they support, not in a separate `chore`.

Both forms use the same fields — `Files / Why / Message`.

**Single group?** Compact form:

```
### <type>(<scope>): <summary>
Files:
- path/to/file
Why: <one sentence — or "obvious from subject">

Message:
<full commit message — body omitted when not needed>
```

**Two or more groups?** Full report:

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

3. **If a pre-commit hook auto-modifies files**, run `git diff --name-only` to see what it touched, re-stage those files, then amend — but **only** when all of: (a) you created the commit in this session, (b) `git status` still shows "Your branch is ahead" (not pushed), (c) it's the most recent commit. Otherwise create a follow-up commit.
4. **If a hook rejects the commit**, fix the underlying issue and create a **new** commit — never amend, never `--no-verify`, never `--no-gpg-sign`.

### 4. Self-check before reporting "done"

For each created commit, verify:

- Subject ≤ 72 chars, imperative mood, no trailing period
- Scope present where the rest of the log uses scopes
- No tool / AI mention you authored (repo-injected trailers are fine)
- Atomic — every group reverts cleanly on its own

Then run `git status` and `git log --oneline -<N>` and report the result.

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

### Breaking change (footer-only — works on every hook)

```
feat(api): rename /v1/orders to /v1/checkout

BREAKING CHANGE: clients on /v1/orders must migrate to /v1/checkout
before 2026-06-01. Old route returns 410 after that date.
```

Use the Conventional `feat(api)!:` form **only** if Step 0 confirmed the repo's commit-msg regex includes an `!` slot.

## Boundaries

This skill **proposes** and, after approval, **executes** commits. It does not push, force-push, rebase, amend prior commits, or run `git commit --no-verify` / `--no-gpg-sign`. If the user wants any of those, they ask explicitly.
