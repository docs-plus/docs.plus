# Monorepo toolchain (Bun)

This document is the **single source of truth** for how we install dependencies, run quality gates, and evolve the stack. It matches what CI and Husky run.

## Phase 0 — Baseline

- **Package manager and runner:** Bun only (`bun install`, `bun add`, `bun run`, `bunx`). Do not introduce npm / yarn / pnpm for app workflows.
- **Workspaces:** Root `package.json` + `packages/*`; lockfile is `bun.lock`.
- **CI:** GitHub Actions use `.github/actions/setup-bun` and `bun install --frozen-lockfile`.
- **Engines:** Respect `package.json` `engines` (Node + Bun minimums) for local and deploy images.

## Phase 1 — Version policy (no heroics)

- **Own versions at the root** for shared dev tools: ESLint, Prettier, TypeScript, Stylelint, `@typescript-eslint/*`, `lint-staged`, **Jest** (`jest`, `babel-jest`, `jest-environment-jsdom`, `@types/jest`, `@babel/preset-typescript`), etc.
- **Library Jest:** each package that needs unit tests keeps a **local** `jest.config.cjs` (Jest deps stay at repo root only). Extract a shared preset when two or more packages would otherwise duplicate the same Jest block (see `.cursor/rules/monorepo-jest.mdc`).
- **Do not bump** those independently in leaf packages unless a package truly needs a different major (rare); prefer one PR that updates root + lockfile and re-runs `bun run check:full`.
- **Workspace packages** may list `eslint` / `typescript` for editor resolution; keep ranges aligned with root.

### Quality scripts (DRY)

| Script         | What it runs                                             |
| -------------- | -------------------------------------------------------- |
| `check:lint`   | ESLint repo root (`eslint .`)                            |
| `check:format` | Prettier check                                           |
| `check:types`  | `tsc --noEmit` in webapp, admin-dashboard, hocuspocus    |
| `check`        | `check:lint` + `check:format` + `check:types`            |
| `lint:styles`  | Stylelint on `packages/**/*.{css,scss}`                  |
| `check:static` | `check:lint` + `check:format` + `lint:styles` (no `tsc`) |
| `check:full`   | `check` + `lint:styles` (matches pre-push final gate)    |

**Local before a PR:** `bun run check:full` (same bar as git pre-push after conditional builds).

**CI:** Lint job runs `check:static`; typecheck job runs extension builds then `check:types` (unchanged).

**Pre-commit:** `lint-staged` (staged files only). Commands resolve `eslint` / `prettier` / `stylelint` from the repo root `node_modules` when you run via `bun run lint:staged`.

## Phase 2 — Bun-native execution

- **Prefer Bun to run TS:** `bun scripts/doctor.ts`, `bun scripts/pre-push.ts`, backend scripts where Bun is the runtime.
- **Hocuspocus:** `bun test` for server unit tests (reference pattern).
- **Webapp unit tests:** Jest + Cypress today; migrating to `bun test` is a **separate project** (RTL, mocks, NYC/coverage). Not required for toolchain health.

## Phase 3 — Typecheck strategy

- **Today:** Three explicit projects — Next apps (`moduleResolution: bundler`) and Bun backend differ enough that we use per-package `tsc --noEmit` chained from `typecheck`, not a single root `tsc -b` solution.
- **Extensions:** CI builds extension packages before typecheck so webapp path/types to `dist` resolve.
- **Future:** Revisit root `tsconfig.json` / project references when Next + TS composite story is clearly safe for this repo.

## Phase 4 — Upstream (Bun) asks

Useful things to request or watch from Bun for this monorepo shape:

1. **Workspace filters:** Documented, reliable patterns for “run script X in every workspace that defines it” (avoid empty `*` filters).
2. **Monorepo recipes:** Next.js + shared `packages/*` + root typecheck / lint.
3. **Testing:** Guidance or tooling for Jest → `bun test` migration with coverage for React codebases.

---

## Related files

- Root `package.json` — scripts above
- `packages/eslint-config` — shared ESLint config
- `.lintstagedrc.js` — pre-commit staged rules
- `scripts/hooks/pre-commit.sh`, `scripts/hooks/pre-push.sh` — Husky entrypoints
- `.github/workflows/*.yml` — CI gates
