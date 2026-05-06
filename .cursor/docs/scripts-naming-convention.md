# Scripts and Make Targets — Naming Convention

> **Status.** Authoritative, timeless rule for `package.json` script keys (root and every workspace), `Makefile` targets, and file names under `scripts/` and `packages/<pkg>/scripts/` across the docs.plus monorepo.
>
> **Companion docs.** [AGENTS.md](../../AGENTS.md) carries docs.plus operational invariants and points back here. [.cursor/rules/scripts-naming.mdc](../rules/scripts-naming.mdc) is the auto-attached agent card. One-shot migration docs (e.g. a `scripts-naming-cutover.md`) may live alongside as siblings and are deleted with the cutover PR that completes them.

## Why this exists

`package.json` scripts and `Make` targets are the most-typed surface of any monorepo, and script files are the most-clicked. Inconsistent names — `dev:full` vs `dev:local` vs `dev:all`, `cy:run` vs `cypress:run`, `validate-prod-build` vs `build-prod-ci`, `emergency-rollback.sh` vs `rollback-prod` — create real friction:

- Search-replace drift across CI workflows, Dockerfiles, husky hooks, and prose docs.
- Onboarding tax: new contributors guess names that "should" exist.
- Hidden duplication: the same intent expressed three ways across workspaces.
- One-shot panic-named scripts (`fix-production-images.sh`, `temp-rollback.sh`) accumulating in `scripts/` until nobody knows which still work.

This document codifies a single grammar and a closed vocabulary for all three surfaces.

## Industry precedents

The convention is a synthesis of patterns every senior contributor will recognize:

- **Bare canonical verbs** for the most-frequent local-dev case — Next.js / Vercel (`dev`, `build`, `start`, `lint`), Vite (`dev`, `build`, `preview`, `test`), Babel monorepo, facebook/react, Microsoft TypeScript, Cargo (`build`, `run`, `test`, `check`, `clean`).
- **Colon-separated axes** for variants and scopes — npm-scripts ecosystem convention (`<verb>:<axis>`), as used in every major Node monorepo.
- **`pre*` / `post*` lifecycle hooks** — npm-scripts spec (`prepare`, `postinstall`, `pretest`, `prepublishOnly`).
- **POSIX/GNU Make canonical targets** — `all`, `clean`, `check`, `install`, `dist`. Kebab-case for compound names.
- **Closed-vocabulary modifiers** — Bazel/Buck-inspired explicitness: a fixed list of suffix words, not free-text adjectives. Ad-hoc names like `:full`, `:complete`, `:everything`, `:local` are rejected by construction.
- **Kebab-case verb-first script files** — Linux coreutils (`run-parts`, `update-grub`), Git porcelain (`git-rebase-todo`), Kubernetes (`kubectl-...`).

## Grammar

### npm/Bun script keys

```text
<verb>                          bare canonical (most-frequent local-dev case)
<verb>:<axis>                   2-axis: verb + one closed-vocabulary segment
<verb>:<scope>:<modifier>       3-axis: verb + scope + modifier (rare)
<tool>:<subcommand>             tool-grouped namespace (prisma, cypress)
<noun>-<noun>                   reserved for upstream package names only (lint-staged, pre-push)
pre<verb> / post<verb>          npm lifecycle hooks
```

**Examples:**

```text
dev                  bare canonical
lint:fix             verb + modifier
test:e2e             verb + scope
test:e2e:watch       verb + scope + modifier
prisma:generate      tool + subcommand
cypress:run:coverage tool + subcommand + modifier
```

### Make targets

```text
<verb>                                bare POSIX canonical (build, clean, ps, restart, logs, down)
<verb>-<env>-<scope>-<modifier>       all parts optional, this fixed left-to-right order
<scope>-<verb>                        permitted only for grouped families (infra-up, infra-down, infra-logs)
```

**Rules:**

- Kebab-case only. No colons (Make uses `:` for prerequisites).
- `.PHONY` declared explicitly.
- Verb-first preferred; scope-first only for grouped families like `infra-*`.

**Make-side closed vocabularies** (different from npm/Bun — Make orchestrates Docker, so its axis values reflect deploy targets, not script-runtime envs):

- Envs: `prod`, `dev`, `local` (`local` distinguishes native-on-host orchestration from Docker `dev`/`prod`).
- Scopes: `backend`, `webapp`, `traefik`, plus `infra` as a grouped family.
- Modifiers: `ci` (clean-room build with stub env).

**Examples:**

```text
build                bare
build-dev            verb + env
dev-local            verb + env       (canonical local-dev orchestrator)
dev-backend          verb + scope     (REST + WS + Worker)
build-prod-backend   verb + env + scope
build-prod-ci        verb + env + modifier
infra-up             scope-first family member
```

### Script file names (`scripts/`, `packages/<pkg>/scripts/`)

Six rules. Together they prevent the `scripts/archive/` graveyard from refilling.

1. **Case & form.** Kebab-case. Verb-first when the script does an action (`run-tests.sh`, `release-family.ts`, `migrate-nested-to-flat.ts`, `update-packages.sh`). Bare nouns are permitted when the script _is_ the named thing (`doctor.ts`, `preflight.ts`).
2. **Extension policy.** `.ts` for new scripts — Bun runs them natively and TypeScript catches typos at compile time. `.sh` only when the script is genuinely shell-only (Docker compose orchestration, `psql` invocation, native CLI glue). `.mjs` reserved for JS-tooling configs already wired into a JS toolchain (e.g. `generate-icons.mjs`). No `.bash` or `.zsh` (portability).
3. **Lifecycle/upstream-named files.** Husky hook filenames (`pre-commit.sh`, `pre-push.sh`, `commit-msg.sh`, `post-merge.sh`) keep their upstream-mandated names. These are _not_ in scope for this rule — they're upstream contracts. Note: the _npm script keys_ `prepack` and `prepublishOnly` are upstream-mandated names too, but their _implementations_ live in `@docs.plus/release-tooling` (one shared copy across the monorepo); they are not per-package script files.
4. **Path policy.** Repo-wide concerns live in `scripts/`. Workspace-local concerns live in `packages/<pkg>/scripts/` or `packages/<pkg>/src/scripts/` when the script needs the package's TypeScript source paths. Subdirectories (`scripts/hooks/`, `scripts/traefik/`) only when 3+ related files cluster naturally.
5. **Banned filename traps.** `validate-*` (use `check-*` or fold into `bun run check`), `*-emergency*`, `fix-production-*`, `temp-*`, `quick-*`, `wip-*`, `final-*`, `v2-*`, date prefixes (`2026-04-rollback.sh`), author prefixes. These are exactly the names that filled `scripts/archive/`.
6. **Archive policy.** When a script becomes one-shot or retired, prefer deletion — `git log` is the historical record. Move it to `scripts/archive/<original-name>` only if it documents a real operation worth preserving outside git history (failed deploys, schema-migration playbooks). When the directory is repopulated, add a `scripts/archive/README.md` recording why each survivor stays.

## Closed vocabularies

### Reserved verbs

`dev`, `start`, `stop`, `build`, `test`, `lint`, `format`, `typecheck`, `check`, `clean`, `release`, `update`, `doctor`, `migrate`, `seed`, `reset`, `types`, `run`, `up`, `down`, `restart`, `logs`, `ps`, `stats`, `scale`, `deploy`, `rollback`, `status`, `playground`.

> `styles` is **not** a verb. Stylelint is a sub-axis of `lint`, written `lint:styles`.

### Reserved tool prefixes

`prisma`, `cypress`. Tool-as-prefix is permitted only when the tool exposes multiple subcommands the developer cares about. Single-subcommand tools should be wrapped under the relevant verb.

**Single-tool wrapper workspaces.** When a workspace's entire purpose is wrapping one CLI (e.g. `@docs.plus/supabase_back` wraps `supabase`), the workspace name is itself the tool prefix; bare verbs are correct (`start`, `stop`, `status`, `reset`, `seed`, `types`). Adding `supabase:` inside would be redundant — `bun --filter @docs.plus/supabase_back start` already reads as "supabase start".

### Reserved modifiers (orthogonal axes)

- `:fix` — mutate (paired with a report-only verb).
- `:ci` — clean-room run, env supplied by caller (CI workflow, Docker compose `environment:`).
- `:watch` — continuous mode.
- `:coverage` — instrumented run.
- `:dry` — read-only / dry-run variant of a mutating script.

### Reserved environments

`:prod`, `:stage`, `:dev` (suffix only; the bare _script name_ `dev` is unrelated).

### Reserved scopes

- Test scopes: `:unit`, `:e2e`.
- Workspace scopes: `:webapp`, `:admin`, `:backend`.
- Process scopes: `:rest`, `:ws`, `:worker`.
- Tool/asset scopes: `:styles` (Stylelint sub-axis of `lint`), `:family` (lockstep release), `:screenshots` (docs scope), `:nested-to-flat` (migration scope).

### Allowed lifecycle hooks (closed list)

`prepare`, `postinstall`, `pretest`, `prepack`, `prepublishOnly`, plus the generic `pre<verb>` / `post<verb>` form for any verb in the reserved list.

Do **not** invent new lifecycle hooks. No `prebuild`, `postlint`, `prestart`. If you find yourself reaching for one, the task usually belongs inside the verb's own script (chained with `&&`) or in `scripts/run-tests.sh`-style orchestration.

### Banned suffixes

For npm/Bun script keys: `:all`, `:full`, `:everything`, `:complete`, `:local`. Bare = local-dev default; aggregates are bare verbs (`check`, `test`).

> Make grammar is independent. `local` is a legitimate Make _env_ (`make dev-local`, distinguishing native-on-host orchestration from Docker dev/prod) and is not banned. The npm-side ban applies to npm/Bun script keys only.

### Banned verbs / common traps

| Tempting                 | Use instead                                            | Why                                                                                            |
| ------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `validate`               | `check`, or `<verb>:ci` for clean-room                 | "Validate" overlaps `lint`/`format`/`typecheck`/`build`; `check` is the established aggregate. |
| `serve`                  | `start`                                                | Two verbs for the same idea. `start` is the npm canonical.                                     |
| `watch` (as a bare verb) | `<verb>:watch` modifier                                | The watch dimension is orthogonal to the action — it's a modifier, not a verb.                 |
| `audit`                  | tool-specific (e.g. `bun audit`), or fold into `check` | Vague. Pick the actual tool.                                                                   |
| `compile`                | `build`                                                | Two verbs for the same idea.                                                                   |
| `all` (bare or suffix)   | bare `build` / `check` / `test`                        | "All" is the default, not a variant.                                                           |

## Documented exceptions and corner cases

Five deliberate corner cases. The first three depart from the bare-canonical rule; the last two are codified elsewhere in this doc and listed here so an agent finds the full set in one place.

- **`@docs.plus/hocuspocus` has no bare `dev`.** It's a service trio (`dev:rest`, `dev:ws`, `dev:worker`) with no single "most-frequent local-dev case." The orchestrator for "all three at once" is `make dev-backend`.
- **Webapp `start` runtime asymmetry.** Bare `start` runs on Node (`next start`-style standalone preview); `start:prod` and `start:stage` run on Bun as container/process-manager entry points. Container env comes from compose `environment:`, not from a script-level `dotenv`. This is the one place runtime choice is encoded in a modifier, and it is deliberate.
- **`migrate:nested-to-flat` and `migrate:nested-to-flat:dry`.** `nested-to-flat` is a kebab-cased migration scope (the noun being migrated); `:dry` is the closed-vocab dry-run modifier. Conforms to the 3-axis grammar.
- **Single-tool wrapper workspaces use bare verbs** (e.g. `@docs.plus/supabase_back` exposes `start`, `stop`, `status`, `reset`, `seed`, `types`). The workspace name itself is the tool prefix. Canonical clause: §"Reserved tool prefixes".
- **Upstream-mandated filenames.** Husky hook files (`pre-commit.sh`, `pre-push.sh`, `commit-msg.sh`, `post-merge.sh`) keep their upstream-mandated names. The `prepack` / `prepublishOnly` npm hooks delegate to `@docs.plus/release-tooling`'s `release-prepack` / `release-preflight` bins — one shared implementation, not per-package script files. Canonical clause: §"Script file names" rule 3 and AGENTS.md "Shared Library Config".

## Aggregates and primitives

### Primitives (report mode is bare; mutation is `:fix`)

- `lint` / `lint:fix` — ESLint over JS/TS.
- `lint:styles` / `lint:styles:fix` — Stylelint over CSS/SCSS.
- `format` / `format:fix` — Prettier over JS/TS/JSON/MD/YAML/etc.
- `typecheck` — TypeScript `tsc --noEmit` (report-only; no `:fix`).

### Aggregates

- `check` = `lint && lint:styles && format && typecheck`. Report-only gate used by `pre-push` and the PR template.
- `check:fix` = `lint:fix && lint:styles:fix && format:fix`.

### Tests

- `test` — full suite via `scripts/run-tests.sh`.
- `test:unit`, `test:e2e` — partial scopes.
- `CYPRESS_PARALLEL=N` controls Cypress worker count; do not introduce per-N convenience scripts.

## Package types and script contracts

Every workspace under `packages/` belongs to exactly one of five **types**. The type determines which scripts are **Required**, **Recommended**, and **Forbidden**. New packages must adopt their type's contract on day one; existing packages must converge on it.

> **Why types.** Without a taxonomy, every new package re-litigates "should I add `test`?", "do I need `prepack`?", "is `start` an app-only thing?". The grammar tells you what names _look like_; the type contract tells you what names _should exist_.

### Type 1: App

> **Definition.** A user-facing application bundled and deployed as a runtime. Today: `@docs.plus/webapp`, `@docs.plus/admin-dashboard`. Always Next.js in this monorepo, but the contract is framework-agnostic.

| Script                                                | Required?      | Notes                                                                                                                                                                 |
| ----------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev`                                                 | ✅ Required    | Loads `.env.local` via `dotenv -e ../../.env.local --`.                                                                                                               |
| `dev:ci`                                              | ✅ Required    | Clean-room, no `dotenv` wrapper.                                                                                                                                      |
| `build`                                               | ✅ Required    | Loads `.env.production`.                                                                                                                                              |
| `build:ci`                                            | ✅ Required    | Clean-room.                                                                                                                                                           |
| `start`                                               | ✅ Required    | Local production preview. Runtime per app (Next.js → Node `next start`).                                                                                              |
| `lint`, `lint:fix`                                    | ✅ Required    | ESLint over the workspace.                                                                                                                                            |
| `typecheck`                                           | ✅ Required    | `tsc --noEmit`.                                                                                                                                                       |
| `test`, `test:coverage`                               | 🟡 Recommended | Required as soon as the app has any test. Use `--passWithNoTests` so empty suites stay green.                                                                         |
| `dev:coverage`                                        | 🟡 Optional    | Only when instrumented dev mode is needed (Cypress code coverage).                                                                                                    |
| `cypress:open`, `cypress:run`, `cypress:run:coverage` | 🟡 Conditional | Required if and only if the app has its own Cypress E2E suite.                                                                                                        |
| `start:prod`, `start:stage`                           | 🟡 Conditional | Required if the app ships in containers (webapp does; admin-dashboard does the bare `start` only). Run on Bun under container env supplied by compose `environment:`. |
| `playground`, `prepack`, `prepublishOnly`             | ❌ Forbidden   | Apps don't publish to npm.                                                                                                                                            |
| `release:*`, `seed`, `migrate:*`                      | ❌ Forbidden   | Belongs in the service or supabase workspace.                                                                                                                         |

### Type 2: Service

> **Definition.** A backend service running on Bun (or Node), shipped in a container. Today: `@docs.plus/hocuspocus`. Multi-process services use the documented exception of no bare `dev`.

| Script                                                            | Required?            | Notes                                                                                                                 |
| ----------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `dev` _(single-process)_ OR `dev:<process>` _(multi-process)_     | ✅ Required (one of) | Multi-process pattern: `dev:rest`, `dev:ws`, `dev:worker`. Use `bun --env-file=<path> --watch <entry>`.               |
| `start` _(single-process)_ OR `start:<process>` _(multi-process)_ | ✅ Required (one of) | Production entry. Runs on Bun under container env.                                                                    |
| `build`                                                           | ✅ Required          | `bun build` to `dist/`.                                                                                               |
| `lint`, `lint:fix`                                                | ✅ Required          |                                                                                                                       |
| `typecheck`                                                       | ✅ Required          |                                                                                                                       |
| `test`                                                            | ✅ Required          | Bun native runner is fine.                                                                                            |
| `test:watch`, `test:coverage`                                     | 🟡 Recommended       |                                                                                                                       |
| `<tool>:<sub>`                                                    | 🟡 As-needed         | E.g. `prisma:generate`, `prisma:migrate`, `migrate:<scope>[:dry]`. Tool prefix only when multiple subcommands matter. |
| `cypress:*`                                                       | ❌ Forbidden         | Services don't run Cypress.                                                                                           |
| `prepack`, `prepublishOnly`                                       | ❌ Forbidden         | Services don't publish to npm.                                                                                        |

### Type 3: Tool-wrapper workspace

> **Definition.** A workspace whose entire purpose is wrapping one external CLI. Today: `@docs.plus/supabase_back` (wraps `supabase`). The workspace name encodes the tool prefix; bare verbs are correct.

| Script                                | Required?           | Notes                                                                                                                                      |
| ------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Verbs matching the tool's subcommands | ✅ Required         | `start`, `stop`, `status`, `reset`, `types`, `seed` for supabase; equivalents for any other wrapped CLI.                                   |
| Env-loading wrapper around each verb  | ✅ Required         | `dotenv -e <path> -- <tool> <subcommand>` for Node-binary CLIs.                                                                            |
| `lint`, `typecheck`, `build`, `test`  | ❌ Forbidden unless | Forbidden unless the workspace contains actual TS source beyond the tool wrapping. Adding them on a pure-wrapper workspace is dead weight. |
| `<tool>:<sub>` prefix grammar         | ❌ Forbidden        | Redundant — workspace name is the tool prefix.                                                                                             |

### Type 4: Publishable library

> **Definition.** An npm-published package under `@docs.plus/<name>`. Today: all `@docs.plus/extension-*` packages. Subject to the publishing contract codified in `AGENTS.md` under "Publishing And Releases".

| Script                                     | Required?                  | Notes                                                                                                                                                                                                          |
| ------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`                                    | ✅ Required                | `tsup` via the shared `tsup.base.ts` factory. `NODE_ENV=production bunx tsup`.                                                                                                                                 |
| `dev`                                      | ✅ Required                | `bunx tsup --watch`.                                                                                                                                                                                           |
| `lint`, `lint:fix`                         | ✅ Required                |                                                                                                                                                                                                                |
| `prepack`                                  | ✅ Required                | `release-prepack` — shared bin from `@docs.plus/release-tooling`. Copies the root `LICENSE` into the package before `bun pm pack` / `bun publish`. Never copy the implementation per-package.                  |
| `prepublishOnly`                           | ✅ Required                | `release-preflight` — shared bin from `@docs.plus/release-tooling`. Asserts publisher UA, dist freshness (derived from the consumer's `exports` map), and no `catalog:` leaks.                                 |
| `test`                                     | 🟡 Required-if-tests-exist | If the package has any test, the script must exist and pass. Bun native runner (`bun test src`), Jest (`jest --config jest.config.cjs`), or Cypress harness — pick one and stay consistent within the package. |
| `test:unit`, `test:e2e`, `test:unit:watch` | 🟡 Required-if-split       | If the package splits unit and E2E (e.g. `extension-hyperlink`), use these scoped names. Otherwise just `test`.                                                                                                |
| `playground`                               | 🟡 Optional                | Clean-room dev/test server when the package has one (`extension-hyperlink`).                                                                                                                                   |
| `docs:screenshots`                         | 🟡 Optional                | Screenshot-generation for docs when applicable.                                                                                                                                                                |
| `start`, `stop`, `dev:<process>`           | ❌ Forbidden               | Libraries don't run as services.                                                                                                                                                                               |
| `cypress:*` at root                        | n/a                        | Not applicable — the package owns its own Cypress harness if any (e.g. via `playground` + `start-server-and-test`).                                                                                            |
| `typecheck`                                | 🟡 Optional                | Library packages typecheck via `tsup` build. A separate `typecheck` is fine but not required.                                                                                                                  |

### Type 5: Internal library

> **Definition.** A workspace consumed only by other workspaces in this repo, never published to npm. Today: `@docs.plus/eslint-config` (config exporter, ESM source), `@docs.plus/email-templates` (template source).

| Script                      | Required?                     | Notes                                                                                                                     |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `test`                      | 🟡 Recommended-if-tests-exist | If the workspace has any testable behavior, add it.                                                                       |
| `lint`, `typecheck`         | 🟡 Optional                   | Add if and only if the workspace has TS source that benefits. Internal libs that just re-export config don't need either. |
| `build`                     | ❌ Forbidden                  | Internal libraries are exported as source via `exports` map. No `dist/` step.                                             |
| `prepack`, `prepublishOnly` | ❌ Forbidden                  | Not published.                                                                                                            |
| `dev`, `start`              | ❌ Forbidden                  | No runtime entry.                                                                                                         |

### Cross-type rules

These apply to every package regardless of type:

- **Each script obeys the grammar in §3.** Closed verbs, closed modifiers, closed scopes. No `:full`, no `validate-*`, no invented lifecycle hooks.
- **Env-loading shim matches the script's runtime** per §"Env-loading mechanism". Don't import `dotenv-cli` into a Bun-only workspace.
- **Workspace-local script files** live in `packages/<pkg>/scripts/` (or `packages/<pkg>/src/scripts/` when the script needs the package's TS source paths). They follow §3.3.
- **Package metadata.** `name` is `@docs.plus/<kebab-case>`. `version` follows the contract in `AGENTS.md` "Extension Version Doctrine" for publishable libraries; private packages are free of lockstep.
- **Catalog references.** Workspaces use `"package": "catalog:"` for any dep listed in the root `catalog:`; do not pin local versions when a catalog entry exists.

## Adding a new package

When you add `packages/<new-pkg>/`, run this checklist before opening the PR:

1. **Pick the type.** App / Service / Tool-wrapper / Publishable library / Internal library. If you can't pick, the package is doing too much — split it.
2. **Copy the type's required script set** from §"Package types and script contracts" into the new `package.json`. Use one of the existing same-type packages as the template (e.g. copy `extension-indent`'s `package.json` shape for a new publishable extension).
3. **Wire env loading** to match the runtime: `dotenv -e ../../.env.local --` for Node-binary scripts, `bun --env-file=../../.env.local` for Bun scripts. The env file path is workspace-relative.
4. **For publishable libraries**, also: depend on `@docs.plus/release-tooling` (`workspace:*` in `devDependencies`); wire `"prepack": "release-prepack"` and `"prepublishOnly": "release-preflight"` from day one (don't ship as a "laggard" and don't copy script bodies per-package); add `publishConfig.access: "public"`; add `homepage` / `bugs` / `keywords`; ignore `/LICENSE` in the package's `.gitignore`; `extends` the root `tsconfig.base.json`; `tsup.config.ts` calls `defineTiptapExtensionConfig()` (or its non-Tiptap equivalent).
5. **Run `bun install` at the repo root** to refresh `bun.lock` and the workspace tree. Do not run parallel `bun update` in the new package; the lockfile is shared and `EEXIST` will bite.
6. **Verify.** `bun run --filter @docs.plus/<new-pkg> typecheck` (if applicable), then `bun run check` at the root. If a workflow file or root script needs to fan out into the new package, update it now — don't ship a half-wired workspace.

If your new package legitimately needs a verb / scope / modifier not in the closed vocabularies in §"Closed vocabularies", that's a rule change, not a workaround. Open a PR that updates this document and `.cursor/rules/scripts-naming.mdc` together; don't sneak the name in.

## Env-loading mechanism (loader matches runtime)

The loader must match the runtime, not aesthetics:

- **Node-binary scripts** (`next dev`, `next build`, `next start`, `supabase`) wrap with `dotenv -e <path> -- <command>`. Smallest portable shim that gets vars into Node's `process.env` before the binary loads.
- **Bun-only scripts** (`bun --watch src/...`, `bun src/scripts/...`, `bun x prisma ...`) use `bun --env-file=<path> <subcommand>`. Bun's native flag loads vars into `process.env` and is inherited by `Bun.spawn` and `child_process` children alike. Forcing `dotenv-cli` into a Bun-only workspace just to chase uniformity adds a devDep that has to be hoisted into that workspace's `node_modules/.bin`; if the symlink is missing the script dies with `bash: dotenv: command not found`.
- Today: `webapp`, `admin-dashboard`, `supabase_back` use `dotenv -e -- next|supabase` (Node binaries); `hocuspocus.server` uses `bun --env-file=...` (Bun binary).

## One runner per concern

- **Bun** for code, workspace fan-out, single-process dev, and tool delegation: `bun --filter`, `bun run --filter '*'`.
- **Make** for Docker orchestration only and for multi-process dev stacks (`make dev-local`, `make dev-backend`, `make up-*`, `docker compose` wrappers).
- **No `cypress:*` at root.** Webapp owns `cypress:run` / `cypress:open`; `extension-hyperlink` owns its own playground-bound pair. Type the extra `--filter <ws>` once and learn the workspace boundary.
- **No third axis:** no `cd packages/<x> && bun run …` from root or Makefile, ever. Root scripts delegate via `bun --filter` directly.

## Out of scope (deliberate non-goals)

- **Unifying Make and npm grammars.** Make uses kebab; npm uses colon. Trying to unify creates uglier names in both.
- **Per-workspace lint/format/typecheck across the board.** Each workspace owns `typecheck`; the root fans out via `--filter '*'`. ESLint and Prettier run from the root in one process across the whole monorepo (the Babel/TypeScript/React monorepo pattern). Per-workspace lint/format would 4× the process overhead for marginal modular benefit.
- **Adding a root `clean` script.** No artifact lives at the root; `bun run --filter '*' clean` would need each workspace to own one and none currently do.
- **Root `pretest` / `posttest` lifecycle hooks.** The full test suite is orchestrated by [scripts/run-tests.sh](../../scripts/run-tests.sh); injecting hidden lifecycle hooks would obscure that.
- **Touching `lint-staged` (kebab) or `pre-push` (kebab).** Both are upstream-facing names — `lint-staged` is the npm package name, `pre-push` matches husky's hook filename. The kebab is a feature, not a violation.
- **Governing script _contents_.** Shebangs, `set -euo pipefail`, exit-code conventions, internal env-loading inside individual scripts — out of scope. This rule covers names, not bodies.
- **A naming linter.** Prose + AGENTS.md + the `.cursor/rules/scripts-naming.mdc` card are the enforcement today. Revisit a `scripts/check-script-names.ts` only if regressions actually appear in PRs.
