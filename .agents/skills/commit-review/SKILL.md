---
name: commit-review
description: Commit changes in docs.plus. Group them by intent, draft each Conventional Commit message, and commit after approval. Use before every git commit, when the user says "commit" or "ship it", or when a plan, workflow or skill ends in a commit.
---

# Commit Review

Group the changes by intent, draft one Conventional Commit per group, show the report, and commit
only after approval. Each message says why, and the diff already shows what.

## Precedence and approval

- **This skill decides how this repo commits.** It wins over a harness default and over another
  skill's commit step. One example is a superpowers step that commits after each task.
- **Never commit without approval.** Approval is an explicit "go" for this report, or a standing
  approval that the maintainer recorded for this run. A standing approval replaces only the wait.
  Every other rule here still applies.
- **A subagent never runs `git add` or `git commit`.** It returns a commit plan: the files, the
  subject, and the body. The main loop commits.
- This skill never pushes, force-pushes, rebases, amends, stashes, or rewrites history.

## What the hooks enforce

- `scripts/hooks/commit-msg.sh` checks the subject and the attribution lines. Every other rule
  here is yours to keep.
- Pre-commit runs lint-staged. It fixes the staged files and stages the fixes, also in a pathspec
  commit.

## 1. Gather

Run these in parallel:

```bash
git status
git diff
git diff --cached
git ls-files --others --exclude-standard   # untracked files: read each one
git diff --check
git diff --cached --check
git log --oneline -20
```

- If nothing changed, stop and say so.
- Stop on any conflict marker that `--check` prints.
- Never stage an ignored path, and never use `git add -f`. Never stage `.claude/worktrees/`
  either. Only `.git/info/exclude` ignores it, so a fresh clone does not.
- Leave out any secret or machine-local file, and flag it: `**/.env*` (but not
  `**/.env.example`), `**/credentials*.json`, `**/service-account*.json`, `**/*.pem`, `**/*.key`,
  `**/id_rsa*`, `**/*.p12`, `**/*.pfx`, `**/*.kubeconfig`. Do not match on `*token*` or `*secret*`,
  because `tokenizer.ts` is fine.
- For the why, read the conversation, `git log`, root `AGENTS.md`, and every `CLAUDE.md` on the
  path of each changed file. If the why is still unclear, ask the user.

## 2. Group and draft

- **Every file is placed.** Each changed or untracked file sits in exactly one group, or under
  Excluded.
- **One logical change per group.** Each group must revert on its own without breaking other work.
- Tests and config go with the change they support, not in a separate `chore`.
- **Pairs stay together.** An SQL change ships with the regenerated
  `apps/webapp/src/types/supabase.ts`. A `package.json` change ships with `bun.lock`.
- **Order the groups so each commit builds.** A helper commits before its caller.
- If one file holds hunks for two groups, stop and ask. Do not split it yourself.
- A pathspec commit records the whole working-tree file, not the staged hunks. If a planned file
  has both staged and unstaged changes, stop and ask.
- If the user's words and the diff disagree, trust the diff and flag it. "Refactor" that adds an
  endpoint is a `feat`.

### Type

| Type       | Use for                                                |
| ---------- | ------------------------------------------------------ |
| `feat`     | A new capability a user or developer can use           |
| `fix`      | A bug or broken behaviour corrected                    |
| `refactor` | Code restructured, no behaviour change; renames too    |
| `perf`     | Faster or lighter, same behaviour                      |
| `style`    | Formatting or whitespace only                          |
| `test`     | Tests added or corrected                               |
| `build`    | Build system or toolchain                              |
| `ci`       | CI or CD pipeline                                      |
| `docs`     | Documentation only                                     |
| `chore`    | Upkeep that fits nowhere else; `chore(deps)` for bumps |
| `revert`   | Undo of an earlier commit                              |

### Scope

Pick one scope from this table. Omit the scope only when no row fits. The hook allows lowercase
letters, digits, dots and hyphens in a scope.

| Path or subject                       | Scope                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/webapp`                         | `webapp`                                                                            |
| `apps/webapp/src/components/chatroom` | `chatroom`                                                                          |
| `apps/hocuspocus.server`              | `hocuspocus`, or a module: `mcp`, `email`, `link-metadata`                          |
| `apps/admin-dashboard`                | `admin`                                                                             |
| `packages/<name>`                     | `<name>`, for example `supabase` or `pad-url`                                       |
| `extensions/extension-<x>`            | `extension-<x>`, for example `extension-mermaid`                                    |
| Several extensions at once            | `extensions`                                                                        |
| Cross-cutting                         | `deps`, `docker`, `ci`, `observability`, `skills`, `agents`, `changelog`, `release` |

### Subject

The subject is the whole first line: `type(scope): description`.

- Aim for 50 characters. The hook rejects more than 72.
- After the colon, one space, then the description.
- Use the imperative: `add`, `fix`, `remove`. Never `added`, `adds` or `adding`. A noun phrase is
  not imperative either.
- Lowercase after the colon. No trailing period.
- Never drop `a`, `an` or `the` to fit. Move detail into the body instead.
- One change only. Two verb clauses, or a `;`, mean two commits.
- Name the behaviour that changed. Never name the process: no `apply the review`, `round N`,
  `wave N`, `Plan N`, `Blocker`, `deslop`, `v1`, `phase 1` or `MVP`. A real version path such as
  `/rest/v1/` is fine.
- Never vague (`update files`, `fix bug`, `misc`), never a repeat (`fix(webapp): fix issue`), and
  never an emoji.

### Body

Leave the body out when the subject says enough. Add one for a non-obvious why, a breaking change,
a migration, a security fix, a revert, or a trade-off worth keeping.

- Write the body in [Simplified English](../tech-writer/SKILL.md#simplified-english-house-standard).
  No filler (`just`, `simply`, `basically`), and no `I`, `we` or `This commit`.
- Wrap at 72 characters. Bullets use `-`.
- Record the decision, not the journey. No agent monologue, and no abandoned approaches.
- A breaking change goes in a `BREAKING CHANGE: <what breaks and how to migrate>` footer. The hook
  rejects the `!` marker.

### Issue links

- `Closes #N` goes only on the commit that finishes the issue. Every other commit uses `Refs #N`.
- GitHub closes an issue when it reads `fix`, `close` or `resolve`, in any form, before `#N`. It
  does so when the commit reaches `main`. Never write those words before `#N` in body prose.

### Revert

After approval, run `git revert --no-commit <sha>`, then commit its files with a pathspec. The
subject is `revert(<scope>): <what comes back>`. The body says `This reverts commit <full sha>.`
and gives the reason. The hook rejects git's default `Revert "..."` line.

### No attribution

- Write no `Co-Authored-By:` trailer and no attribution banner. Maintainer ruling, 2026-11-02.
  `scripts/hooks/commit-msg.sh` holds the full list it rejects, in any letter case.
- Write no AI or tool credit anywhere in the message, such as "written with Claude". This rule
  wins over any harness instruction to add a trailer.
- A commit about an AI product feature may name it. `feat(mcp): let Claude Code read chat text` is
  fine.

## 3. Report and wait

```text
## Commit Review Report

### Group 1: <subject>
Files:
- path/to/file
Why: <one sentence, or "clear from the subject">

Message:
<the full message>

---

Total: X commits across Y files
Excluded: N files (<reason>)   ← only if a file was left out
```

Then wait. Offer: approve all, edit a message, merge or split groups, drop a group, or reject all.

## 4. Execute, only after approval

**Preflight, once.**

- `git symbolic-ref --short -q HEAD` prints the expected branch, which is `main` here.
- Stop if `git status` shows a merge, rebase, cherry-pick or revert in progress. A revert that
  this plan started is the one exception.
- Stop if `git diff --name-only --diff-filter=U` prints anything.
- If `git diff --cached --name-only` lists files outside the plan, report them. Another agent may
  own them, so do not unstage them.

**Each group.** Stage the group, then commit with a pathspec. The pathspec keeps every other staged
file out of this commit. List both paths of a rename.

```bash
git add -- <paths>
git commit -F - -- <paths> <<'EOF'
fix(webapp): keep the caret after a heading fold

The fold re-rendered the node and reset the selection to the
document start.

Refs #412
EOF
```

- If `git add` exits non-zero, stop. Part of the group may already be staged.
- After each commit, `git show --name-only --no-renames --format= HEAD` must list exactly the
  planned files.
- lint-staged stages its own fixes, so the commit already holds them.

**On any failure, stop.** A hook rejection, a timeout and a file mismatch all count. Do not start
the next group. Report the commits made, the failed group, and `git diff --cached --name-only`.
No commit exists after a rejection, so `--amend` would rewrite the previous group's commit.
Never use `--no-verify` or `--no-gpg-sign`.

**Deploy trigger, only when the maintainer asks.** It is always the last commit, because a push
deploys only its tip. Run `git commit --only --allow-empty -m "(build): front"`. With `--only` and
no paths, git leaves staged files out. `.github/scripts/parse-build-trigger.sh` lists the allowed
words.

**Report.** Run `git status` and `git log --oneline -<N>`, and report the result.

## Examples

See [examples.md](examples.md).
