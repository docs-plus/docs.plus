---
name: code-janitor
description: Reviews and cleans up code in a folder/package or recent git changes by grouping files by intent, then running a 4-chain pipeline (Simplification → Abstraction → Readability → Documentation) per group with one supervisor granting a production-ready flag. Use when the user asks to clean up, simplify, polish, organize utils/helpers, fix typos or naming, improve JSDoc, tidy a package, or says "review my files", "cleanup", "polish", "organize", "code janitor", or "tidy".
---

# Code Janitor 🧹

Tactical, principle-driven cleanup pipeline that adapts to any workspace. Reviews a folder/package (or the current git changes) in four ordered chains — Simplification → Abstraction → Readability → Documentation — with one supervisor granting a production-ready flag at the end. Phase A auto-detects the workspace's package manager, scripts, monorepo layout, agent-instructions doc, and adjacent skills, so the same skill works in a Bun/pnpm/yarn/npm repo, a single-package or workspaces layout, with or without a sibling commit-review skill.

> **Autonomous by default; opt-in review.** Auto-applies edits, prints one terse line per file. Pass `--review` to gate every file or `--with-tests` to run unit tests. The skill always stops on its own for the six gated edit types (see § Constraints) regardless of flags.
>
> **Senior-level scope.** Performs real cleanup — rename exported symbols, fix typos in identifiers and i18n keys, split overgrown files, move files, bump dep versions — when the new shape is materially better. Algorithm rewrites and net-new dependencies remain forbidden.

## Constraints

Single source of truth. Two tiers: **Forbidden** (absolute, no escape) and **Gated** (allowed via the forced-approval mechanism in Phase B).

### Forbidden — no flag, gate, or supervisor verdict overrides these

1. **Change runtime behavior** for any input the program currently handles.
2. **Edit generated files** — bootstrap-detected exclusion list, sibling `.d.ts` for `.ts` source, lockfiles, `CHANGELOG.md`.
3. **Edit test fixtures, snapshots, or recorded HTTP responses.**
4. **Reformat for style** — defer to the workspace's formatter/linter via Chain 0.
5. **Refactor algorithms** — defer to a detected architecture skill (e.g. `improve-codebase-architecture`); else surface as INFO. Naming/structure cleanup is fine; replacing a sort or rewriting a loop's logic is not.
6. **Add net-new dependencies, frameworks, or build tools** (Boring Technology). Bumping or removing an _existing_ dep is gated, not forbidden.
7. **Commit** — defer to the detected commit-skill, or stop and let the user commit.
8. **Create branches or worktrees** — work happens in the current branch only.
9. **Introduce new debug/info loggers** in paths that didn't have them. Warn/error logs are fine when the workspace's existing pattern uses them.
10. **Delete pre-existing debug/info loggers** unless the agent-instructions doc explicitly authorises removal on the surrounding paths.

### Gated — allowed via Phase B forced-approval, with one discipline rule

Six edit types stop the skill regardless of flags:

1. Rename an exported symbol (function, class, type, interface, const, default).
2. Rename an i18n key — only when every translation file in the repo can be updated in the same diff. If any appears externally managed (Phrase, Crowdin, Lokalise), skip and surface as INFO.
3. Move a file (intra-package or across-package).
4. Split a file or function.
5. Change a public API signature.
6. Bump or remove a dependency version.

**Discipline rule (non-negotiable for all six)** — every call site, import, re-export, doc reference, and test reference must update in the **same diff** as the edit. The forced-approval prompt shows the change + every dependent edit as one atomic unit. If the skill can't enumerate all dependents, it skips the edit and surfaces it as INFO.

### Default behavior

- **Autonomous.** Apply edits silently with one-line status. Stop only on the six gated edit types, on diff-sanity violations, or when the hesitation gate fires.
- **Hesitation gate.** Stop and ask only when there's no clear, cohesive decision: grouping is a coin-flip, or a principle conflict can't be broken by the resolution ladder. Routine progress = no prompt.

## Pipeline

```
Phase A — Triage
   A.0  workspace bootstrap (detect package manager, scripts, layout,
        agent-instructions doc, adjacent skills, generated paths)
   A.1  scope discovery → group files (semantic intent / feature / arch fallback)
        → build dependency tree → auto-proceed (only stop if grouping is ambiguous)

Phase B — Per-group execution (sequential; next group's read-only triage pipelined)
   for each group:
     Chain 0       Tooling pass        (deterministic; no per-file gate)
     Chains 1→4    plan across whole group, then apply per file
     Validation    group gates (diff-sanity + type-check + lint; opt-in tests)

Phase C — Supervisor review (one fresh code-reviewer; three checklists)
   Correctness · Principle-Adherence · Production-Readiness
   verdict: PASS | FIX | BLOCK
   on FIX/BLOCK → fresh fix-pass agent → re-supervise (cap: 2 per group)

Phase D — Summary + handoff
   summary report at <skills-output-dir>/YYYY-MM-DD-HH-MM-cleanup.md
   prompt: hand off to detected commit-review skill (if any), else stop
```

## Phase A — Triage

**Invocation flags** — detect from the user's message text:

- `--with-tests` / "with tests" / "run tests" → enables the unit-test gate (off by default).
- `--review` / "let me review" / "ask me each file" → enables per-file approval (off by default; the skill auto-applies otherwise).

### A.0 — Workspace bootstrap (run first, every invocation)

Before scope discovery, detect the workspace toolchain and conventions. Cache the results for the session and surface them to the user as a one-block summary.

1. **Package manager** — pick one based on the lockfile in repo root:
   - `bun.lock` / `bun.lockb` → `bun run`
   - `pnpm-lock.yaml` → `pnpm run`
   - `yarn.lock` → `yarn`
   - `package-lock.json` → `npm run`
   - none → assume `npm run` and note in the summary
2. **Available scripts** — read root `package.json` `"scripts"`. Resolve each gate's command by intent, picking the first match found:
   - **lint-fix**: `lint:fix` → `lint --fix` → `eslint . --fix` (only if `eslint` is a dep)
   - **format**: `format` → `format:write` → `prettier --write .` (only if `prettier` is a dep)
   - **typecheck**: `check:types` → `typecheck` → `type-check` → `tsc --noEmit` (only if `typescript` is a dep)
   - **lint-check**: `check:lint` → `lint`
   - **unit-test**: `test:unit` → `test` (only if Jest/Vitest config detected; never E2E runners like Cypress/Playwright)
   - If a gate has no resolvable command → mark that gate `skipped` and proceed.
3. **Monorepo layout** — read `package.json` `"workspaces"` or `pnpm-workspace.yaml` to identify package roots (commonly `packages/*`, `apps/*`, `libs/*`). Single-package repos skip per-package scoping in Chain 0.
4. **Agent-instructions doc** — search in this priority order; first hit wins: `AGENTS.md` → `CLAUDE.md` → `.cursor/rules/*.mdc` (read all) → `.github/copilot-instructions.md` → top-of-`README.md`. Treat its durable rules as workspace facts in conflict resolution.
5. **Adjacent skills** — list skills under `.cursor/skills/`, `.claude/skills/`, `~/.agents/skills/`. Note any skill whose name matches `*commit*` (for Phase D handoff) and any architecture/refactor skill (e.g. `improve-codebase-architecture`, to which algorithm changes are deferred).
6. **Generated/excluded paths** — start with the universal list (`node_modules/`, `dist/`, `build/`, `out/`, `.next/`, `.nuxt/`, `coverage/`, `.turbo/`, `.cache/`, `__snapshots__/`, `*.lock`, `*.lockb`) and append any path the workspace's `.gitignore` flags as build/state output. Also exclude any path the agent-instructions doc lists as off-limits (e.g. notes folders, hook state files).
7. **Skills-output dir** — choose `docs/skills-output/` if `docs/` exists, else `.skills-output/` at repo root. Ensure it's in `.gitignore`; add the entry if missing.

### A.1 — Scope discovery

- **Folder mode** — user names a folder or package. Enumerate every source file under it, applying the bootstrap-detected exclusion list plus generated `.d.ts` siblings (any `*.d.ts` whose sibling `*.ts` exists).
- **Git-diff fallback** — when no path is given, sweep every file in `git status --porcelain` (staged + unstaged + untracked) and apply the same exclusion list.

Take an audit snapshot **only when the working tree is dirty**:

```bash
if [[ -n "$(git status --porcelain)" ]]; then
  git stash push --include-untracked --keep-index -m "code-janitor-snapshot-$(date +%Y%m%d-%H%M%S)" && git stash apply
fi
```

The stash is for audit reference only; **never restore from it automatically**.

### Grouping (resolution order)

For the in-scope files, build groups using this resolution order:

1. **Semantic intent** — preferred when a diff exists. Read each file's diff, infer one or more themes (e.g. _"auth hardening"_, _"payment-flow refactor"_, _"i18n cleanup"_). Cross-reference with `git log --oneline -20` for commit themes. If the bootstrap detected an agent-transcripts directory for the host tool (e.g. `~/.cursor/projects/<workspace>/agent-transcripts/`, `~/.claude/projects/`), use semantic search over recent transcripts to surface prior decisions touching these files. If no such directory exists, skip this input.
2. **Feature/concern** — when no diff exists, use `SemanticSearch` over the in-scope files to cluster by domain concept (e.g. a "user-creation flow" cluster might span an entry-point handler, a validator, a persistence helper, and tests).
3. **Architectural layer — last resort** — if intent and concern can't yield coherent clusters, group by directory (e.g. handlers, models, utils, helpers, tests, docs) and surface this fallback explicitly to the user.

Each group's source attribution **must** be shown (e.g. _"derived from git diff + 2 prior transcripts"_) so the user can audit the reasoning.

### Dependency tree

For every file in a group, run an import/export trace to find **related files** — files importing or imported by the group's files, even if out of scope. Mark each as **primary** (the group will edit it) or **related** (read-only context for the group's sub-agent). If the same file is primary in two groups, collapse those groups or assign editing rights to the group with the stronger semantic claim — never let two groups edit one file.

### Auto-proceed (Surface 1)

Render Surface 1 (one-line group summary) and proceed immediately to Phase B. **Only stop and ask** when the grouping is genuinely ambiguous — e.g. the in-scope files split equally between two themes with no diff or transcript to break the tie, or a file plausibly belongs to two groups and the editing-owner pick is a coin-flip. Otherwise, just go.

## Phase B — Per-group execution

Groups run sequentially; the next group's read-only triage is pipelined in the background (`explore` sub-agent). Edits are always sequential — no parallel writing.

For each group: run Chain 0, then load all files into one sub-agent and plan Chains 1 → 4 as a single conceptual pass (cross-file principles like DRY and naming consistency need the whole-group view), then apply the resulting edit plan file-by-file. Each chain's settled edits are inputs to later chains; no chain revisits a settled one.

### Chain 0 — Tooling pass

Use the package manager and scripts resolved in A.0. Run from the smallest scope that contains all in-scope files: a package root if every file lives under one detected package, otherwise repo root.

```bash
<pm> run <lint-fix>     # e.g. bun run lint:fix
<pm> run <format>       # e.g. pnpm run format
<pm> run <typecheck>    # e.g. yarn check:types
```

If a package-local `package.json` lacks a script, fall back to the root equivalent. If a tool isn't installed (e.g. no Prettier), log `"Chain 0 skipped: no <tool> available"` and proceed.

Snapshot `git diff` before LLM edits start so the tooling-produced diff is distinguishable from the LLM's contribution. Tooling-only changes never need per-file approval.

### Chain 1 — Simplification

Order matters. **Internal precedence:** YAGNI overrides DRY (deletion beats consolidation). RoT overrides DRY (don't consolidate the second occurrence — wait for the third). AED overrides everything (no abstractions designed; only earned).

| Step | Principle                                       | Look for                                                                       |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| 1.1  | **DRY** — Don't Repeat Yourself                 | Same _decision_ duplicated across files. Skip incidental syntactic similarity. |
| 1.2  | **RoT** — Rule of Three                         | Don't extract on the second occurrence. Wait for the third.                    |
| 1.3  | **AED** — Abstractions Are Earned, not Designed | Don't _design_ abstractions; surface one only if real patterns demand it.      |
| 1.4  | **YAGNI** — You Aren't Gonna Need It            | Delete code paths, options, hooks, and types added "just in case."             |
| 1.5  | **KISS** — Keep It Simple, Stupid               | Collapse needless wrappers, flatten nesting > 3 levels.                        |

### Chain 2 — Abstraction & Boundaries

| Step | Principle                                      | Look for                                                                                                                              |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | **SoC** — Separation of Concerns               | One file, one concern. File splits go through the forced-approval gate (all imports updated in the same diff).                        |
| 2.2  | **HCLC** — High Cohesion, Low Coupling         | High cohesion within file/module, low coupling across them.                                                                           |
| 2.3  | **LoB** — Locality of Behavior                 | Co-locate single-use helpers (used in exactly one neighbor, < 10 lines).                                                              |
| 2.4  | **LoD** — Law of Demeter                       | No reaching through chains (`a.b.c.d.e`).                                                                                             |
| 2.5  | **MISU** — Make Illegal States Unrepresentable | Discriminated unions over optional flags; non-empty types over runtime checks.                                                        |
| 2.6  | **RoLP** — Rule of Least Power                 | `const` over `let`, pure function over class, etc.                                                                                    |
| 2.7  | **DR** — Dependency Rule                       | Dependencies point inward toward stable code.                                                                                         |
| 2.8  | **CoI** — Composition over Inheritance         | Flag any new `extends` that could be a function or mixin.                                                                             |
| 2.9  | **SOLID**                                      | Audit only objectively detectable parts: SRP (Single Responsibility) and DIP (Dependency Inversion). The other three are review-zone. |

### Chain 3 — Readability

| Step | Principle                                                               | Look for                                                                                                                                                                                                                                                |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | **NMM** — Naming Matters Most                                           | Rename internals freely. Rename exported symbols and i18n keys when materially clearer or to fix a typo (`recieve` → `receive`) — these go through the forced-approval gate with all-usages-updated discipline. Skip if dependents can't be enumerated. |
| 3.2  | **DOT** — Do One Thing                                                  | One function = one thing. Splits go through the forced-approval gate (all imports/calls updated in the same diff).                                                                                                                                      |
| 3.3  | **WNW** — Why, Not What                                                 | Comments explain _why_, never _what_. Delete narrating comments; keep intent.                                                                                                                                                                           |
| 3.4  | **PoLA** — Principle of Least Astonishment                              | Surprising behavior gets a `// Note:` with reason; non-surprising gets nothing.                                                                                                                                                                         |
| 3.5  | **BSR** — Boy-Scout Rule                                                | Micro-improvements within files you're already touching; never expand scope.                                                                                                                                                                            |
| 3.6  | **ROR / RRT** — Readability over Cleverness / Respect the Reader's Time | Meta-check: would a new reader understand this faster than before? If not, revert.                                                                                                                                                                      |

### Chain 4 — Documentation

**Voice — senior technical writer:** active, present-tense, lead with the verb, no "this method" / "this function", never restate the signature. Canonical voice rules live in the [`tech-writer`](../tech-writer/SKILL.md) skill — invoke it whenever Chain 4 work needs more than the table below (e.g. file-header rewrites, README touch-ups inside the in-scope group).

**Published-library caveat** — for any package the workspace publishes (npm/pnpm/Cargo/PyPI/etc.), JSDoc on exported symbols ships into consumers' installs (for TypeScript, into the bundled `.d.ts`). Verbose preambles measurably bloat install size (often >5% of the typings bundle). Treat any package whose `package.json` has no `"private": true` flag, or that the agent-instructions doc identifies as published, under this caveat: file headers 1–2 lines, per-symbol blocks 1–3 lines, point at `README.md` for option semantics. Preserve only the _why_. Internal/private packages may use longer prose at the author's discretion.

| Step | Principle                             | Action                                                                                                                                                      |
| ---- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | **PAB** — Public APIs Get Boundaries  | Public APIs get docs. Internals usually don't. Default for internal helpers: undocumented.                                                                  |
| 4.2  | **DRS** — Don't Restate the Signature | Never restate the signature. Delete docs that just say `@param url - the URL`.                                                                              |
| 4.3  | **TIT** — Types over Inline Tags      | TS types speak for themselves. JSDoc is for prose only — no `@param {string}` when the type is `string`.                                                    |
| 4.4  | **DTS** — Document the Surprises      | Edge cases, side effects, async behavior, error modes. Never the obvious.                                                                                   |
| 4.5  | **SSL** — Short, Single Line          | Short, single line preferred. Hard cap: 5 lines including `@param`/`@returns`/`@throws`/`@example`. `@example` only when behavior is non-obvious AND short. |

### How conflicts resolve

Top wins:

1. **§ Constraints (Forbidden) and the workspace agent-instructions doc** beat any chain principle. Repo-specific rules (preferred logger, banned APIs, naming conventions) beat generic defaults.
2. **Within and across chains** — Chain 1 internal precedence is YAGNI > RoT > DRY > KISS. Earlier chains' settled edits are inputs to later chains; later chains may not undo them. Equivalent options → pick the smaller, more reversible diff.
3. **Hesitation gate** — if still unresolved, stop and ask. Never guess.

### Per-file application

**Default (auto):** apply silently, log one Surface 3 line per file.

**Forced approval:** stop on any of the six gated edit types in § Constraints. The prompt shows the change plus every dependent edit as one atomic unit (the discipline rule). If dependents can't be enumerated, skip and surface as INFO.

**`--review` mode:** prompt on every file. The per-file prompt lists each proposed edit by chain (e.g. `1.1 DRY`, `3.3 WNW`); reply `y` (apply all), `select <ids>`, `skip-file`, or `abort`.

### Group validation gates

After all per-file edits in a group apply, run in sequence using the commands resolved in A.0:

1. **Diff sanity check** (programmatic; non-negotiable) — see [§ Diff sanity check](#diff-sanity-check) below.
2. **Type-check** — `<pm> run <typecheck>` (scoped to the affected package when possible).
3. **Lint** — `<pm> run <lint-check>`.
4. **Affected unit tests** — _only when invoked with `--with-tests`_. Use the bootstrap-resolved unit-test command. **Never run E2E suites** (Cypress, Playwright, Selenium, etc.) — they're slow and behavior-sensitive. On failure: keep edits and surface failed tests for user decision.

Any gate marked `skipped` in A.0 is treated as a soft pass with a note in Surface 4. Render Surface 4 **only on failure or skip**. On PASS, log a single line and move on.

## Phase C — Supervisor review

After all groups complete Phase B, dispatch **one fresh `code-reviewer` sub-agent** (read-only) to audit the full aggregated diff against three checklists:

1. **Correctness** — re-run diff sanity check, the resolved typecheck and lint commands; verify no runtime behavior change; cross-reference § Constraints (Forbidden) against the diff.
2. **Principle-Adherence** — re-read against Chains 1–4. Catches cross-group misses neither per-group agent could see: duplications across groups, naming inconsistency, doc-voice drift, KISS regressions from overzealous Chain 2 work.
3. **Production-Readiness** — security regressions per agent-instructions doc rules for the touched paths (XSS gates, auth boundaries, secret handling), published-package doc bloat for any package without `"private": true`, i18n key safety, generated-file bypass attempts, new debug loggers, TODO/FIXME/XXX/HACK comments. **Owns the production-ready flag.**

The supervisor returns a list of findings; each is `severity` (`BLOCK` | `FIX` | `INFO`), `scope` (group id, `cross-group`, or `global`), and a one-line summary with evidence.

### Verdict and remediation

- **PASS / PASS-WITH-NOTES** (all green, or only INFO) → flag granted, proceed to Phase D.
- **FIX** → dispatch a fresh `generalPurpose` fix-pass agent scoped to the offending group(s) or `cross-group` (never reuse a prior agent's context). Re-supervise after each fix-pass.
- **BLOCK** (behavior change, Forbidden violation, surviving test regression) → same as FIX, but the group is marked at risk. No global revert.

**Cap: 2 remediation iterations per group.** At the cap, mark `STUCK` and escalate. A `global`-scope finding escalates immediately (no auto-loop).

### Exit states

- **PASS** / **PASS-WITH-NOTES** — flag granted.
- **ESCALATED** — at least one STUCK group or first-pass global finding. Flag not granted; user decides next move.
- **USER-ABORTED** — explicit halt. Working tree left as-is with halt-point note in the disk report.

## Phase D — Summary + handoff

Save the full **Surface 6 (final summary)** to `<skills-output-dir>/YYYY-MM-DD-HH-MM-cleanup.md` (path from A.0; directory already in `.gitignore`). The disk report follows the [`tech-writer`](../tech-writer/SKILL.md) **Report / status / summary** spine. Print only the **one-line chat summary** (see Surface 6 below) — never paste the full report into chat.

Then hand off automatically:

- **Commit-skill detected in A.0** → invoke it directly via the `Skill` tool. The detected skill has its own approval gates; the user can interrupt there.
- **No commit-skill detected** → stop. Print one line: _"N files modified. Working tree dirty — commit when ready."_ Do not commit directly under any circumstances.

## Diff sanity check

Programmatic post-check on the diff before any group is declared PASS. Each rule runs against `git diff` over the group's files. Any failure → revert this group's edits and surface to user.

```
✗ diff modifies any path in the bootstrap-detected exclusion list   → abort
✗ diff modifies *.d.ts that has a sibling .ts source                → abort
✗ diff modifies CHANGELOG.md or any release-notes file              → abort
✗ diff modifies package.json `dependencies`/`devDependencies`/`peerDependencies`/`optionalDependencies`  → abort
✗ diff modifies any lockfile (bun.lock(b), pnpm-lock.yaml, yarn.lock, package-lock.json, Cargo.lock, poetry.lock, etc.)  → abort
✗ diff removes a top-level export whose name doesn't appear in any added line  → abort
   (scan `^-\s*export\s+(const|function|class|type|interface|default)\s+(\w+)`; if that name has no matching `^+` line, it's a rename or deletion of a public symbol)
✗ diff modifies any test-fixtures or snapshot directory             → abort
   (cypress/fixtures/, __snapshots__/, __fixtures__/, test/fixtures/, etc.)
✗ diff modifies any path the agent-instructions doc flags as off-limits  → abort
✗ diff modifies cosmetic-only YAML alignment in CI workflow files   → abort  (formatter silently undoes)
✗ diff introduces new console.log / console.debug / print / println debug calls  → abort  (warn / error are fine)
✗ diff introduces TODO / FIXME / XXX / HACK comment                 → abort
✗ diff adds new files outside in-scope groups (Phase A claimed scope) → abort
```

## Output templates

Chat output is **terse one-liners**. The full audit report is written to disk (Surface 6 file) — never pasted into chat. Only `--review` mode uses long-form Surface 3.

### Surface 1 — Phase A status (one line per group)

```
Scope: <N> files in <path-or-git-status>. Groups: G1 <title> (<n>f) · G2 <title> (<n>f) · G3 <title> (<n>f). Proceeding.
```

(If grouping is ambiguous, append: _"Ambiguous — pick: <option a> | <option b>?"_ and stop.)

### Surface 3 — Phase B per-file (one line per file, default mode)

```
G<n>/F<m>: <basename> — <chain summary, e.g. DRY×1 NMM×2 SSL×1> → applied
```

On a forced-approval edit (export rename, i18n-key rename, file move, split, public-API change, dep bump):

```
G<n>/F<m>: <basename> — STOP: <edit type> on <symbol>. Apply? [y/skip/abort]
```

In `--review` mode, expand each file's status into its proposed-edit list (one row per edit, prefixed with the chain step like `1.1 DRY` or `3.3 WNW`) and wait for `y / select <ids> / skip-file / abort`.

### Surface 4 — Phase B validation (only printed on failure)

```
G<n> validation FAIL: <gate> — <one-line detail>. Remediating.
```

Pass case prints nothing.

### Surface 5 — Phase C supervisor (one line)

```
Supervisor: ✓ Correctness · ✓ Principles · <flag> Production (<n> findings). Verdict: <PASS|PASS-WITH-NOTES|FIX|BLOCK>.
```

If FIX/BLOCK, follow with one line per remediation iteration: `Fix-pass <i>: <scope> — <action>`.

### Surface 6 — Phase D final (one line in chat; full report on disk)

**Chat (one line):**

```
Done. <M> files cleaned across <G> groups, <E> edits, <S> STUCK. Flag: <GRANTED|WITHHELD>. Report: <skills-output-dir>/<file>.md. <handoff line>
```

**Disk report** (`<skills-output-dir>/YYYY-MM-DD-HH-MM-cleanup.md`) keeps the longer per-group breakdown for audit. Format:

```
# Cleanup — YYYY-MM-DD HH:MM
Verdict: <STATE> · Flag: <GRANTED|WITHHELD>
Scope: <scope> · Groups: <N> · Files: <M> · Edits: <E> · Iterations: G1=<n> G2=<n>
Snapshot: <stash@{N} or none>

## G1 <title> — <STATE>
  Chains: 0=<tooling> · 1=<n edits> · 2=<n edits> · 3=<n edits> · 4=<n edits>
  Rejected: <n>  Notes: <list or none>

## Cross-cutting
  <fix-pass summary or none>

## INFO findings
  - <rule>: <suggestion>
```
