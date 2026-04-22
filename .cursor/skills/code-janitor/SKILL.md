---
name: code-janitor
description: Reviews and cleans up code in a folder/package or recent git changes by grouping files by intent, then running a 4-chain pipeline (Simplification → Abstraction → Readability → Documentation) per group with parallel supervisor review for a production-ready flag. Use when the user asks to clean up, simplify, polish, organize utils/helpers, fix typos or naming, improve JSDoc, tidy a package, or says "review my files", "cleanup", "polish", "organize", "code janitor", or "tidy".
---

# Code Janitor 🧹

Tactical, principle-driven cleanup pipeline that adapts to any workspace. Reviews a folder/package (or the current git changes) in four ordered chains — Simplification → Abstraction → Readability → Documentation — with three parallel supervisors granting a production-ready flag at the end. The first phase auto-detects the workspace's package manager, scripts, monorepo layout, agent-instructions doc, and adjacent skills, so the same skill works in a Bun/pnpm/yarn/npm repo, a single-package or workspaces layout, with or without a sibling commit-review skill.

> **Heavyweight, by design.** Budget ≈ 30–60 minutes of interactive review per group of ~5 files (multiple sub-agents, per-file approval gates, supervisor pass). For a quick polish on one or two files, use a lighter approach.

## The rules that override everything

1. **Never change runtime behavior.** Any edit that _might_ alter what the code does for any input is forbidden, no matter how clean it would be. Conflicts that would require behavior change → stop and ask the user.
2. **Never commit.** This skill leaves a dirty working tree at exit. If the workspace bootstrap (Phase A.0) detected a `commit-review` (or equivalent) skill, hand off to it; otherwise, stop and let the user commit.
3. **Never create branches or worktrees.** Everything happens in the current directory and current branch. Do not invoke any branch- or worktree-creation flow.
4. **Hesitation gate — when in doubt, ask.** If grouping is ambiguous, a principle conflict isn't clearly resolvable, an edit's safety is uncertain, or a supervisor finding has unclear scope → pause and present a Q&A. Never guess.
5. **Defer to tools.** Anything the workspace's formatter, linter, or type-checker already enforces is out of scope. The skill only touches what tools can't catch.

## Pipeline

```
Phase A — Triage
   A.0  workspace bootstrap (detect package manager, scripts, layout,
        agent-instructions doc, adjacent skills, generated paths)
   A.1  scope discovery → group files (semantic intent / feature / arch fallback)
        → build dependency tree → user approves groups + ownership

Phase B — Per-group execution (sequential; next group's read-only triage pipelined)
   for each approved group:
     Chain 0       Tooling pass        (deterministic; no per-file gate)
     Reasoning     Chains 1 → 4 run conceptually across the whole group
     Application   per-file Model-D gate aggregates all chain proposals for that file
     Validation    group gates (diff-sanity + type-check + lint; opt-in tests)

Phase C — Supervisor review (3 parallel code-reviewer sub-agents)
   Correctness · Principle-Adherence · Production-Readiness
   verdict: PASS | FIX-AND-PROCEED | BLOCK
   on FIX/BLOCK → fresh fix-pass agent → re-supervise (capped 3/2/0)

Phase D — Summary + handoff
   summary report at <skills-output-dir>/YYYY-MM-DD-HH-MM-cleanup.md
   prompt: hand off to detected commit-review skill (if any), else stop
```

## Phase A — Triage

**Invocation flags** — detect from the user's message text: `--with-tests` or "with tests" / "run tests" enables the unit-test gate (off by default). All other escape hatches still require explicit per-prompt approval; there is no `--auto`.

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
4. **Agent-instructions doc** — search in this priority order; first hit wins: `AGENTS.md` → `CLAUDE.md` → `.cursor/rules/*.mdc` (read all) → `.github/copilot-instructions.md` → top-of-`README.md`. Treat its durable rules as workspace facts in conflict resolution. If two docs disagree, surface to user.
5. **Adjacent skills** — list skills under `.cursor/skills/`, `.claude/skills/`, `~/.agents/skills/`. Note presence of: a `commit-review` (or `commit`, `caveman-commit`) skill for Phase D handoff; an architecture/refactor skill (e.g. `improve-codebase-architecture`) to which algorithm changes are deferred.
6. **Generated/excluded paths** — start with the universal list (`node_modules/`, `dist/`, `build/`, `out/`, `.next/`, `.nuxt/`, `coverage/`, `.turbo/`, `.cache/`, `__snapshots__/`, `*.lock`, `*.lockb`) and append any path the workspace's `.gitignore` flags as build/state output. Also exclude any path the agent-instructions doc lists as off-limits (e.g. notes folders, hook state files).
7. **Skills-output dir** — choose `docs/skills-output/` if `docs/` exists, else `.skills-output/` at repo root. Ensure it's in `.gitignore`; add the entry if missing.

If any conflict is detected (e.g. agent-instructions doc has a rule that contradicts a chain principle, or two scripts could plausibly serve one gate), pause and ask the user before continuing.

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

For every file in a group, run an import/export trace to identify **related files** (files imported by or importing the group's files, even if those files are out of scope). The tree must label:

- **Primary** — files the group will edit
- **Related** — read-only context for the group's sub-agent
- **Owner of N** — when a file is a related-context for N>1 groups, exactly one group owns the right to _edit_ it. Owner is the group with the strongest semantic claim. Surfaced in the tree with `← (owner; read by G1, G3)`.

### User approval (Surface 1 + Surface 2)

Render Surface 1 (proposed groups list) followed by Surface 2 (dependency tree). Wait for: `y` / `edit` / `regroup` / `abort`. **Never proceed without explicit approval.**

## Phase B — Per-group execution

Groups run **sequentially**. While the user reviews Group N's per-file proposals, the **read-only triage** of Group N+1 runs in the background (`explore` sub-agent producing the next group's report). Edits are always sequential — there is no parallel writing.

Each group runs through the chains in order. Each chain reshapes inputs for the next; no chain may revisit a chain that has already settled.

### Reasoning vs. Application (how a group actually executes)

Two axes — chain (Chain 0 → 1 → 2 → 3 → 4) and file (1 of K → 2 of K → … → K of K) — are sequenced **differently**:

1. **Chain 0** runs across all files in the group at once. Deterministic. No per-file gate.
2. **Reasoning phase** — the per-group sub-agent loads the whole group into context and runs Chains 1 → 4 _as a single conceptual pass_, in order. Cross-file principles (DRY, naming consistency) work here because the sub-agent sees every file at once. Output: a per-file edit plan containing proposals from all four chains.
3. **Application phase** — render Surface 3 for File 1 with all four chains' proposals listed together. User approves. Apply edits to File 1. Then File 2. Then File 3. Sequential, file-major.
4. **Group validation gates** run once after all per-file applications complete.

Never run "Chain 1 across all files → gate → Chain 2 across all files → gate." That fragments per-file review across four prompts and lets a Chain 1 deletion break a Chain 3 rename mid-flight.

### Chain 0 — Tooling pass

Use the package manager and scripts resolved in A.0. Determine the working directory by group scope:

| Group scope                                                                                  | `cwd` for the commands       |
| -------------------------------------------------------------------------------------------- | ---------------------------- |
| All in-scope files live under one detected package root (e.g. `packages/<pkg>/`)             | run inside that package root |
| Files span multiple packages                                                                 | run from repo root           |
| Files mix package code and repo-root files (e.g. config, agent-instructions doc, `.github/`) | run from repo root           |
| Single-package repo                                                                          | always run from repo root    |

```bash
<pm> run <lint-fix>     # e.g. bun run lint:fix
<pm> run <format>       # e.g. pnpm run format
<pm> run <typecheck>    # e.g. yarn check:types
```

Where `<pm>` and the script names come from A.0. If a package-local `package.json` lacks a script, fall back to the root equivalent. If a tool isn't installed at all (e.g. no Prettier), log `"Chain 0 skipped: no <tool> available"` and proceed without it.

Capture the tooling-produced diff separately from the LLM diff: snapshot `git diff` output before LLM edits start, and treat anything new in `git diff` after edits as the LLM's contribution. Tooling-only changes do not require per-file approval (they're deterministic).

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
| 2.1  | **SoC** — Separation of Concerns               | One file, one concern. Propose splits during per-file gate; **never auto-split**.                                                     |
| 2.2  | **HCLC** — High Cohesion, Low Coupling         | High cohesion within file/module, low coupling across them.                                                                           |
| 2.3  | **LoB** — Locality of Behavior                 | Co-locate single-use helpers (used in exactly one neighbor, < 10 lines).                                                              |
| 2.4  | **LoD** — Law of Demeter                       | No reaching through chains (`a.b.c.d.e`).                                                                                             |
| 2.5  | **MISU** — Make Illegal States Unrepresentable | Discriminated unions over optional flags; non-empty types over runtime checks.                                                        |
| 2.6  | **RoLP** — Rule of Least Power                 | `const` over `let`, pure function over class, etc.                                                                                    |
| 2.7  | **DR** — Dependency Rule                       | Dependencies point inward toward stable code.                                                                                         |
| 2.8  | **CoI** — Composition over Inheritance         | Flag any new `extends` that could be a function or mixin.                                                                             |
| 2.9  | **SOLID**                                      | Audit only objectively detectable parts: SRP (Single Responsibility) and DIP (Dependency Inversion). The other three are review-zone. |

### Chain 3 — Readability

| Step | Principle                                                               | Look for                                                                                           |
| ---- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 3.1  | **NMM** — Naming Matters Most                                           | Rename **internals only** (no exported symbols). Fix typos in identifiers (`recieve` → `receive`). |
| 3.2  | **DOT** — Do One Thing                                                  | One function = one thing. Propose splits, never auto-split.                                        |
| 3.3  | **WNW** — Why, Not What                                                 | Comments explain _why_, never _what_. Delete narrating comments; keep intent.                      |
| 3.4  | **PoLA** — Principle of Least Astonishment                              | Surprising behavior gets a `// Note:` with reason; non-surprising gets nothing.                    |
| 3.5  | **BSR** — Boy-Scout Rule                                                | Micro-improvements within files you're already touching; never expand scope.                       |
| 3.6  | **ROR / RRT** — Readability over Cleverness / Respect the Reader's Time | Meta-check: would a new reader understand this faster than before? If not, revert.                 |

### Chain 4 — Documentation

**Voice — senior technical writer:** active, present-tense, lead with the verb, no "this method" / "this function", never restate the signature.

**Published-library caveat** — for any package the workspace publishes (npm/pnpm/Cargo/PyPI/etc.), JSDoc on exported symbols ships into consumers' installs (for TypeScript, into the bundled `.d.ts`). Verbose preambles measurably bloat install size (often >5% of the typings bundle). Treat any package whose `package.json` has no `"private": true` flag, or that the agent-instructions doc identifies as published, under this caveat: file headers 1–2 lines, per-symbol blocks 1–3 lines, point at `README.md` for option semantics. Preserve only the _why_. Internal/private packages may use longer prose at the author's discretion.

| Step | Principle                             | Action                                                                                                                                                      |
| ---- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | **PAB** — Public APIs Get Boundaries  | Public APIs get docs. Internals usually don't. Default for internal helpers: undocumented.                                                                  |
| 4.2  | **DRS** — Don't Restate the Signature | Never restate the signature. Delete docs that just say `@param url - the URL`.                                                                              |
| 4.3  | **TIT** — Types over Inline Tags      | TS types speak for themselves. JSDoc is for prose only — no `@param {string}` when the type is `string`.                                                    |
| 4.4  | **DTS** — Document the Surprises      | Edge cases, side effects, async behavior, error modes. Never the obvious.                                                                                   |
| 4.5  | **SSL** — Short, Single Line          | Short, single line preferred. Hard cap: 5 lines including `@param`/`@returns`/`@throws`/`@example`. `@example` only when behavior is non-obvious AND short. |

### Cross-cutting guardrails (apply in every chain)

| Guardrail                           | Effect                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **BT** — Boring Technology          | Never propose a new dependency, framework, or build tool.                                                           |
| **RFD** — Reversibility First       | Two equivalent edits → pick the one easier to revert. One-line edits beat moves; moves beat directory restructures. |
| **CvP** — Conventions vs Principles | Anything tools enforce → out of scope.                                                                              |
| **FF** — Fail Fast                  | Validate at boundaries, throw early, never swallow — but don't rewrite working error handling (behavior change).    |
| **RRT** — Respect the Reader's Time | When in doubt between two valid edits, pick the smaller diff.                                                       |

### How conflicts resolve (single source of truth)

When two principles or rules disagree on the same edit, apply this precedence — top wins:

1. **Override-everything rules** (§ The rules that override everything) — beat every chain principle. _Example:_ DRY says "consolidate two copies"; doing so would change behavior → DRY loses.
2. **Workspace agent-instructions doc** (the file resolved in A.0 — `AGENTS.md`, `CLAUDE.md`, etc.) — repo-specific constraints (e.g. preferred logger, banned APIs, package-manager pinning, naming conventions) beat generic principle defaults.
3. **Within Chain 1**: YAGNI > RoT > DRY > KISS. (Deletion beats consolidation; wait for the third occurrence.)
4. **Across chains**: an earlier chain's settled edits are inputs to later chains. Chain 3 may not undo a Chain 1 deletion or a Chain 2 split.
5. **RFD / RRT tie-break** — equivalent edits → pick the smaller, more reversible diff.
6. **Hesitation gate** — if the conflict still isn't clearly resolvable, **stop and ask the user**. Never guess.

### Per-file approval gates (Model D)

Default mode: **report → user approves → execute**, per file. Render Surface 3 (per-file report). Wait for:

- `y` / `select <ids>` / `skip-file` / `auto-rest-of-group` / `abort`

`auto-rest-of-group` (escape hatch) is **forbidden** when any pending edit:

- renames an exported symbol
- moves a file
- changes a public API signature
- adds, removes, or modifies a dependency

In those cases, force per-file approval regardless of `--auto`.

### Group validation gates

After all per-file edits in a group apply, run in sequence using the commands resolved in A.0:

1. **Diff sanity check** (programmatic; non-negotiable) — see [§ Diff sanity check](#diff-sanity-check) below.
2. **Type-check** — `<pm> run <typecheck>` (scoped to the affected package when possible).
3. **Lint** — `<pm> run <lint-check>`.
4. **Affected unit tests** — _only when invoked with `--with-tests`_. Use the bootstrap-resolved unit-test command. **Never run E2E suites** (Cypress, Playwright, Selenium, etc.) — they're slow and behavior-sensitive. On failure: keep edits and surface failed tests for user decision.

Any gate marked `skipped` in A.0 is treated as a soft pass with a note in Surface 4. Render Surface 4 **only on failure or skip**. On PASS, log a single line and move on.

### Shared-file rule

A file appearing in N groups' related-files trees is **owned by exactly one group** for editing. Other groups may _read_ it for context but **cannot propose edits to it**. Owner is set during Phase A approval; the per-group sub-agent is briefed with the ownership map and must respect it.

## Phase C — Supervisor review

After all groups complete Phase B, dispatch **three `code-reviewer` sub-agents in parallel** (read-only):

### Three supervisors

1. **Correctness Supervisor** — re-reads the full aggregated diff. Re-runs the diff sanity check. Re-runs the bootstrap-resolved typecheck and lint commands. Verifies the "no runtime behavior change" rule. Cross-references the Forbidden list against the diff.
2. **Principle-Adherence Supervisor** — re-reads the diff against Chains 1–4. Catches **cross-group misses**: duplications neither local agent could see, naming inconsistency across groups, doc-voice drift, comments that violate WNW, KISS regressions from overzealous Chain 2 work.
3. **Production-Readiness Supervisor** — security regressions (any rule the agent-instructions doc declares for the touched paths — e.g. XSS gates, auth boundaries, secret-handling), published-package doc bloat for any package without `"private": true`, i18n key safety, generated-file bypass attempts, new debug-logger introductions, and any TODO/FIXME/XXX/HACK comments added. **Owns the production-ready flag.**

### Verdict format (each supervisor)

```
findings: [
  {
    severity: BLOCK | FIX | INFO,
    scope: 'group:<group-id>' | 'cross-group' | 'global',
    files: [...],
    rule: 'Q4#1' | 'Chain1.DRY' | 'Chain4.SSL' | ...,
    summary: 'one-line description',
    detail: 'evidence + suggested fix'
  }
]
```

### Aggregate verdict + remediation

| Aggregate verdict   | Trigger                                                                                   | Action                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PASS**            | All three green                                                                           | Production-ready flag granted. Proceed to Phase D.                                                                                                                                                                                    |
| **PASS-WITH-NOTES** | Green except `INFO`-severity findings                                                     | Flag still granted. Notes appear in summary.                                                                                                                                                                                          |
| **FIX-AND-PROCEED** | One or more `FIX`-severity findings                                                       | Dispatch a fresh **fix-pass `generalPurpose` agent** scoped to the supervisor's exact findings. Spawn a brand-new sub-agent on every remediation iteration — never reuse the prior one's context. Re-run Phase C after each fix-pass. |
| **BLOCK**           | Behavior change, FORBIDDEN-list violation, or test regression that survived earlier gates | Identify offending group(s) by `scope`. Re-run that group's chains with the supervisor's findings as brief. **No global revert.** Re-supervise after fix.                                                                             |

### Loop bounds (hard caps)

| Loop                    | Cap                  | Behavior at cap                           |
| ----------------------- | -------------------- | ----------------------------------------- |
| Per-group remediation   | **3**                | Group marked `STUCK`. Batched escalation. |
| Cross-group remediation | **2**                | Marked `STUCK`. Batched escalation.       |
| Global findings         | **0** (no auto-loop) | Immediate batched escalation.             |

### Exit states (skill ends in exactly one)

- **PASS** — all green, flag granted
- **PASS-WITH-NOTES** — flag granted, INFO findings in summary
- **ESCALATED** — one or more groups STUCK, OR a `global`-scope finding hit on first pass. Flag NOT granted. User decides next move.
- **USER-ABORTED** — user halted explicitly. Working tree left in current state with halt-point note in summary.

## Phase D — Summary + handoff

Render **Surface 6 (final summary)** in chat AND save to `<skills-output-dir>/YYYY-MM-DD-HH-MM-cleanup.md` (path resolved in A.0). The bootstrap already ensured the directory exists in `.gitignore`.

The handoff prompt depends on what A.0 detected:

- **A `commit-review` (or equivalent) skill is present** → end with **"Run `<detected-commit-skill>` now? (y/n)"**.
  - `y` → invoke that skill via the `Skill` tool (read its SKILL.md and follow it).
  - `n` → stop. Working tree is dirty; user takes it from here.
- **No commit-related skill detected** → end with **"Working tree has N modified files (uncommitted). Stop here? (y)"**. Do not attempt to commit directly under any circumstances.

## Forbidden taxonomy (override-everything rules)

What's _allowed_ is anything the four chains explicitly call out. This list is what the chains may **never** do, regardless of which principle suggests it:

1. Never change runtime behavior
2. Never rename exported symbols
3. Never move files across packages; intra-package moves require explicit per-file approval
4. Never edit generated files (anything in the bootstrap-detected exclusion list, sibling `.d.ts` for `.ts` source, any lockfile, `CHANGELOG.md`)
5. Never edit test fixtures, snapshots, or recorded HTTP responses
6. Never touch i18n key strings — only the surrounding code
7. Never reformat for style (defer to the workspace's formatter/linter via Chain 0)
8. Never refactor algorithms — defer to the architecture/refactor skill detected in A.0 (e.g. `improve-codebase-architecture`); if none exists, surface as a finding instead
9. Never add new dependencies (BT)
10. Never commit (defer to the detected commit-review skill, or stop and let the user commit)
11. Never introduce new debug/info loggers (`console.log`, `console.debug`, `print`, `println!`, `logger.debug` calls in code paths that didn't have them). Warn/error logs are fine when the workspace's existing pattern uses them. **Never delete pre-existing debug/info loggers** unless the agent-instructions doc explicitly authorises removal on the surrounding paths — they may be load-bearing for runtime debugging, and removing them is a behavior change.

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

## Sub-agent type assignments

| Role                                                                   | subagent_type                                |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| Phase A triage (file enumeration, dependency tracing, transcript scan) | `explore`                                    |
| Phase B per-group **read-only triage preview** (pipelined next group)  | `explore`                                    |
| Phase B per-group **edit phase**                                       | `generalPurpose`                             |
| Phase C supervisors (×3)                                               | `code-reviewer`                              |
| Phase C fix-pass agent (group-scoped or cross-group)                   | `generalPurpose`                             |
| Phase D commit-skill handoff (when detected)                           | invoked via `Skill` tool, runs in main agent |

## Within-session pause-and-continue

User can halt at any gate (Ctrl-C, "stop", "pause"). Record progress in chat as a single line:

> _"Paused at Phase B / Group 2 / File 3 of 5. Say 'continue' to resume from this point."_

On `continue` (same session only), pick up at the recorded gate without re-running prior phases. **No cross-session resume** — working tree drift makes persisted state unreliable.

## Output templates

Render in this exact form. Inconsistency across surfaces makes the skill feel like six tools.

### Surface 1 — Proposed Groups (Phase A)

```
## Proposed Groups (N) — <scope>

[1] <group title>                                              (<n> files)
    Source: <attribution — diff/semantic/transcript ids>
    Files:
      M  <path>                                                (primary)
      M  <path>                                                (primary)
      A  <new path>                                            (primary)
    Related (read-only context):
      -  <path>                                                (owned by Group N)

[2] ...

Approve groups? [y / edit / regroup / abort]
```

### Surface 2 — Dependency Tree (Phase A)

```
## Dependency Tree

<root>/
├─ Group 1: <title>
│  ├─ <primary file>
│  │  └─ imports: <related> [GN owns]
│  ├─ <primary file>
│  └─ <primary file>                                           ← (owner; read by G2, G3)
│
└─ Group N: <title>
   └─ <primary file>
```

### Surface 3 — Per-File Report (Phase B)

```
## Group N / File M of K — <path>

Chain 0 (tooling): <X lint fixes, Y format fixes, tsc clean>

Proposed edits (LLM):
  [1] Chain X / <PRINCIPLE>   <one-line description>
                              → <suggested action>
  [2] ...

Apply? [y / select <ids> / skip-file / auto-rest-of-group / abort]
```

### Surface 4 — Group Validation (Phase B, only on failure)

```
## Group N — Validation

✗ <gate>                                  — <failure detail>
...

Group N result: <STATE>
<remediation note or escalation prompt>
```

### Surface 5 — Supervisor Verdicts (Phase C)

```
## Supervisor Review

### 1. Correctness Supervisor
Verdict: <PASS|FIX-AND-PROCEED|BLOCK>
Findings: <X> BLOCK / <Y> FIX / <Z> INFO
  [<sev>]  <rule>    scope: <scope>
           <summary>
           Files: <list>

### 2. Principle-Adherence Supervisor
...

### 3. Production-Readiness Supervisor
...

## Aggregate verdict: <STATE>
<remediation action or proceed note>
```

### Surface 6 — Final Summary (Phase D, in chat + saved)

```
# Cleanup Summary — YYYY-MM-DD HH:MM

Final verdict: <PASS|PASS-WITH-NOTES|ESCALATED|USER-ABORTED>
Production-ready flag: <GRANTED|WITHHELD>
Snapshot: <stash@{N} or "none — working tree was clean">

Scope: <scope> (<mode>)
Groups: <N>
Files touched: <M modified> + <N new> = <total>
Iterations: Group 1 = <n>, Group 2 = <n>, ...

## Group 1 — <title> (<n> files) — <STATE>
  Chain 0: <tooling summary>
  Chain 1: <simplification summary>
  Chain 2: <abstraction summary>
  Chain 3: <readability summary>
  Chain 4: <docs summary>
  User-rejected proposals: <n>

## Cross-cutting (supervisor-driven)
  <fix-pass summary if any>

## Notes (INFO findings, not blocking)
  - <rule>: <suggestion>

## Next step
<n> modified files in working tree (uncommitted).
<handoff prompt — exact text depends on whether a commit-skill was detected in A.0>
```

## Boundaries

This skill **proposes and applies** cleanup edits, then either hands off to a detected commit skill or stops with the working tree dirty. It does not:

- commit, push, force-push, rebase, amend, or bypass commit hooks
- create branches or worktrees
- modify any file outside the in-scope groups
- run E2E test suites (Cypress, Playwright, Selenium, etc.)
- add or remove dependencies
- refactor algorithms — defer to a detected architecture/refactor skill, or surface as a finding
- review or change behavior (that's the user's job)
