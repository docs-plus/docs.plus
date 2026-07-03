# AGENTS.md

Persistent memory for AI agents working on **docs.plus**. Preserve these rules unless a maintainer explicitly changes them.

## Agent Operating Rules

### Memory And Rule Boundaries

- `AGENTS.md` stores durable docs.plus-specific invariants, maintainer preferences, and regression guardrails.
- Keep large vendor or mechanical references in focused Cursor rules, not copied here:
  - `.cursor/rules/daisyui.mdc`: daisyUI/Tailwind reference.
  - `.cursor/rules/react-floating-ui.mdc`: React 19 ref and Floating UI interaction patterns.
  - `.cursor/rules/supabase.mdc`: SQL authoring style and focused Supabase file warnings.
  - `.cursor/rules/tiptap.mdc`: upstream Tiptap/ProseMirror reference workflow.
  - `.cursor/rules/scripts-naming.mdc`: scripts and Make-target naming convention; auto-attaches when editing `package.json`, `Makefile`, workflows, or files under `scripts/`.
- Long-form policy docs that an `.mdc` rule points at live in `.cursor/docs/`: `scripts-naming-convention.md` (timeless rule, source of truth for scripts naming), `extension-version-cutover.md` (rotating per-package cutover state; see §Extension Version Doctrine), and `panel-feed-seams.md`. One-shot migration docs may live alongside as siblings and are deleted with the cutover PR that completes them.
- Package-internal rules that don't generalize to the repo live in **package-local `AGENTS.md`** files next to the package. Today: `extensions/extension-hyperlink/AGENTS.md` for that extension's schema, commands, safety, click/preview, and clean-room harness. Cross-package rules (release flow, scripts naming, monorepo toolchain) stay in this root file; the package file is read in addition to the root file when working inside its package.
- When guidance overlaps, keep the project-specific policy in `AGENTS.md` or `.cursor/docs/`, and the detailed authoring/reference material in the relevant `.mdc` file.
- New rules land in the topical section that owns the subject. `## Learned User Preferences` and `## Learned Workspace Facts` at the end of this file are inboxes only: append there when no section fits, one rule per bullet, and file inbox entries into their owning section on the next tidy.

### Package Manager

- Use Bun for package management, scripts, binaries, packing, and publishing: `bun install`, `bun add`, `bun add -d`, `bun run`, `bunx`, `bun publish`, `bun pm pack`.
- Never use npm, yarn, pnpm, `npx`, `npm publish`, or package-lock/yarn-lock flows.
- Keep `bun.lock` as the only lockfile. Do not create `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`.
- The user sometimes prefers local command instructions over agent-run installs; ask or provide the command when dependency changes are not clearly part of the requested task.
- Use root workspace commands:
  - `bun run --filter @docs.plus/webapp dev`
  - `bun run --filter '*' build`
- Required engines: Node >= 24.11.0 and Bun >= 1.3.7.

### Git And Commits

- Do not commit unless the user explicitly asks.
- When **authoring** implementation or execution plans (e.g. superpowers `writing-plans`, documents under `docs/superpowers/plans/`), do **not** include commit messages, `git commit`, `git add`, or generic “commit the changes” steps. End with review and verification only; the developer inspects the diff and commits manually.
- When executing multi-task plans from `docs/superpowers/plans/`, every task ends in a "Review checkpoint" step: surface the touched files and a short summary for review, then stop. Do not run `git add`, `git commit`, `git push`, `git stash`, or amend. Quality gates (`bun run … typecheck|test|build`) still run between tasks.
- Execute plans only in the **current** workspace (this git worktree). Do not switch execution to another worktree, path, or parallel checkout; all edits, shell commands, and tests must run against the open repo root.
- **Work on `main` only. Never create a new branch or worktree for any task, step, plan, or subagent.** Do not run `git checkout -b`, `git switch -c`, `git worktree add`, or pass `isolation: "worktree"` to the Agent tool. No "feature branch", no "isolated worktree per task", no "let's branch off main for this fix". All edits happen on the currently checked-out `main` working tree. The user manages branching themselves outside the agent session.
- **This rule applies to every agent and subagent without exception.** When dispatching any subagent (`Agent` tool, `general-purpose`, `Explore`, `Plan`, specialized agents like `code-reviewer`, `frontend-developer`, `tdd-orchestrator`, etc.), the dispatching prompt must explicitly state "work on the current `main` working tree; do not create branches or worktrees." Never set `isolation: "worktree"`. Skills (`superpowers:using-git-worktrees`, `superpowers:executing-plans`, `superpowers:subagent-driven-development`, etc.) that suggest isolating per-task are overridden — stay on `main`. Supervisor, orchestrator, and parallel-agent flows all share the same `main` working tree.

### Code Quality

- Keep production code DRY, KISS, YAGNI, SOLID, and industry-standard. Avoid overengineering.
- Export names must match file names. Fix typos in identifiers during refactors.
- **Component naming — no `Chrome` in symbols or filenames.** “UI chrome” (toolbars, borders, shells around content) is industry jargon, not a React role name; here it reads as the browser or an opaque wrapper. Use names that state the job: `*Layout` for responsive shells, `*Bar` for toolbars, `*Surface` for anchored panels. Reserve `Editor` / `EditorContent` for the TipTap/ProseMirror host only — not for a mobile/desktop layout switch. In comments, say “shell”, “frame”, or “toolbar”; avoid “chrome” unless quoting an external spec. Chat composer canonical exports: `ComposerLayout`, `ComposerDesktopLayout`, `ComposerMobileLayout`, and `MessageComposer.EditorContent` (TipTap). Do not reintroduce `ComposerDesktopChrome`, `ComposerMobileChrome`, or `MessageComposer.Editor` for the layout picker.
- **Popover vs toolbar — two axes, never one word for both.** "Popover" names the positioning container only (anchored, floating, light-dismiss — the `floating-popover` engine; shells are role-less by default because ARIA has no popover role). Content words name what's inside and carry the matching role: `toolbar` for action rows (the hypermultimedia media bar, hyperlink's preview), `dialog` for floating forms (hyperlink create/edit). Compose when both axes apply (`openToolbarPopover`). Popover controller `kind`s are consumer-namespaced open strings (e.g. `media-…`). Do not rename the `popovers.*` / `mediaToolbar` option surfaces onto a single shared word — they correctly name different species. Glossary: `extensions/README.md` §Vocabulary.
- **No `*Classes.ts` / `*Styles.ts` / `*ClassNames.ts` modules for Tailwind className constants.** Extracting `'pointer-events-none shrink-0 stroke-[1.75]'` into a named export is over-engineering: Tailwind atoms are already the design tokens, and a second naming layer adds an indirection the reader has to chase without adding meaning. Inline className strings at the point of use (and accept the visual repetition across sibling components — it is locality of behavior, not a DRY violation). The same rule applies to local module-scope `const FOO_BTN = '...'` for single-file use. If two or more components genuinely share a non-trivial composite, lift to a shared component (`<IconButton variant="composer-icon">`) or a CVA-style helper — never to a bare-strings module. Pad and chat composer canonical: each toolbar/action button file owns its own className literal; the parent layout file (`FormattingToolbar.tsx`) owns the layout literals. Do not reintroduce `formatToolbarClasses.ts`, `composerActionClasses.ts`, or analogous files.
- Feature folders use one central type module: `types.ts` or `types/index.ts`. Do not scatter feature-owned `type` / `interface` declarations across `hooks/`, `commands/`, `utils/`, `stores/`, or `components/`.
- Keep feature layers separate and navigable: `index.ts` -> `types.ts` -> `hooks/` / `commands/` / `utils/` / `stores/` / `components/`.
- Treat performance and memory leaks as part of production readiness, not follow-up work. Audit Tiptap/ProseMirror changes for re-render storms, unsubscribed listeners, and detached views.
- Any `editor.on(...)` or `getDefaultController().subscribe(...)` call must return and call its unsubscribe on unmount unless it is intentionally module-scoped and guarded.
- Keep debug/info loggers on editor core paths. Do not strip them during cleanup.

### Testing And Verification

- **Default: do not write new tests.** Add a test only when (a) the user explicitly asks for it, (b) the change pins down a regression that has actually shipped or been reported, or (c) the failure mode is a real branching / ordering / race / parsing / projection bug that is hard to verify by hand. If you cannot name the specific failure mode in one sentence, do not write the test. "It seemed like a good idea to add coverage" is not a reason.
- **Prefer integration over unit.** When a test is warranted, default to Cypress E2E or real-stack integration that exercises actual user behavior end-to-end. Reach for a unit test only when the unit has branching logic dense enough that an E2E could not isolate a regression to it — parsers, projections, schema validators, pure utilities, message-grouping projections, scroll-mode state machines.
- **Never write these test shapes** (delete on sight, do not generate): type assertions that re-prove what `tsc` already proves; framework-behavior tests ("React renders", "Tiptap commands return truthy", "Supabase client exists", "useEffect runs"); mock-only flows where every dependency is faked and the assertion is "the mock was called with X"; snapshots of unstable output (full DOM trees, formatted JSON dumps, ProseMirror node JSON); "renders without crashing" smoke tests; trivial props-passthrough / getter / setter tests; coverage-chasing tests with no named behavior.
- **TDD is opt-in, not default.** Follow strict TDD discipline only when the user explicitly asks for it ("write a test first", "let's TDD this", "/tdd"). This overrides any subagent skill that defaults to TDD on every fix or feature. Otherwise: design the change, ship it, verify with `bun run build` / `bun run check` and the relevant Cypress suite, and stop.
- **Observe tests pass before declaring done.** Any test added in a change must be run locally and observed green — "should pass" is not evidence. Pre-existing tests that fail are fixed in the same change or explicitly `.skip`'d with a one-line reason and an issue link; never silently disabled.
- **When unsure, ask.** If you are mid-test and cannot articulate in one sentence which user-visible failure it prevents, stop and ask whether the test is wanted at all. The cost of a low-value test (review burden, maintenance, false confidence) is higher than the cost of a missing one we can add later when a real bug appears.
- Run `bun run build` after major refactors before claiming completion — but never run `next build` (or any production build) while a dev server is running against the same `.next` directory: the production `BUILD_ID` corrupts the turbopack dev server into `Internal Server Error`. With a live dev server, verify with `tsc --noEmit` plus the running app instead.
- Validate full-document paste (`⌘A` -> `⌘V`) on editor changes that can affect paste or document transforms.
- Authoring conventions and naming live under §Tests (Monorepo Toolchain).
- Do not call URL, router-adjacent, floating-menu, landing mobile-keyboard, bookmark/notification panel, or chatroom/slug skeleton UI production-ready or "ship" until the real interaction path is checked in the browser, light and dark, on iOS Safari and Android Chrome.
- On `/`, verify hero+card vertical centering with the keyboard closed, compact repositioning when the mobile keyboard opens (keyed to keyboard visibility, not slug-input focus), and expansion back when the keyboard dismisses even if focus stays on the slug input.
- `history.pushState` can leave `h`/`id` in the URL bar where stripping only bookmark-style params no-ops — verify URL cleanup the same way. Context menus need pointer cursor, hover contrast, and full-width dividers verified in the browser too.
- When driving these checks, `window._store` (like `window._editor`) is exposed only on the editor playground route — not `/` or document routes — so toggle theme via `data-theme` on `<html>` and apply the component's compact/active classes directly rather than poking the store. Confirm the Next webapp dev port first; it isn't always 3000 under `make dev-local`, where 3000 may be a backend.

### Skills And Prose

- Cleanup/review skills (the `.cursor/skills/code-janitor` pipeline and kin; its `SKILL.md` defines `--review` and the gated-approval mechanism) are autonomous by default. Do not gate every step; stop only when a decision is genuinely ambiguous.
- `--review` is opt-in. Default cleanup applies edits and prints one terse line per file.
- Reports are terse next-step outlines, not detailed plans.
- Real senior-level refactors are in scope under the gated-approval mechanism: exported symbol renames, typo fixes, file moves, file splits, and dependency bumps.
- True safety rules remain absolute: do not change runtime behavior for handled inputs, edit generated files, or commit directly.
- All prose work routes through `.cursor/skills/tech-writer`: README, CHANGELOG, reports, post-mortems, design docs, PR descriptions, and JSDoc/docstrings.
- The rules in §Git And Commits apply to skills without exception: skills never create branches or worktrees, and they operate in the current directory and branch.

### Documentation And Comments

- Comments and JSDoc explain non-obvious _why_, never narrate _what_. Names, types, and structure are the contract.
- Hard cap: **≤ 4 lines** per JSDoc or block comment. If you need more, the code or the name is wrong — fix that instead. No section banners, no "Why X, not Y" preambles, no restating signatures or union members in prose.
- Cleanup includes deleting comments that violate this. "I didn't write it" is not a reason to keep them.

### Workflow And Review Expectations

- When Task/subagent output is already visible in the UI, avoid repeating or summarizing it unless the user asks or multi-task synthesis requires it; an optional brief third-person completion line is fine — vary wording instead of identical confirmations every time.
- Do not carry plan or brainstorm labels into durable memory, commit messages, JSDoc, or inline comments — no "v1", "v2", "phase 1", "MVP", or "green doc" shorthand. Describe shipped behavior and intent in plain product/engineering terms; reserve version suffixes for real wire formats (API paths, schema types like `CommentAnchorV1`, motion token names).
- When the user asks for a review-first workflow (e.g. "wire a plan", approve-before-execute), draft the plan and pause for explicit approval before implementing. For UI/design tasks (toolbar redesigns, popover/URL-chip variants), the review artifact they expect before any code is a **visual preview** — a Cursor canvas or a standalone interactive HTML demo, one mock per variant/URL type — so they can approve the look first; produce it as part of the plan rather than jumping to implementation.
- After substantive chatroom/webapp, landing/app-shell, Supabase, or extension-package work, expect a cohesive DRY/KISS pass (dead-file import-graph sweep, redundant store fields, code-simplifier, thermo-nuclear review when invoked) before treating the work as production-ready — not optional follow-up polish. Landing/shell work also demands a performance pass (route-scoped JS/CSS, deferred auth, no duplicate viewport listeners) before ship.
- Keep `AGENTS.md` in full human-readable prose; do not caveman-compress it or commit token-budget rewrites unless the user explicitly asks — restore from backup if an agent compresses without approval.
- For large HoE-style reviews (landing page, app shell, chatroom, TOC, sheets, composer, toolbar panels), build cohesive context from related modules first, then wait for the explicit task before implementing; avoid overengineering and overthinking in review output and refactor plans.
- When the user approves a numbered audit or wishlist backlog ("work on all of them"), implement the full list with a validation checkpoint per item — full coverage does not justify extra abstraction layers; keep each step minimal.

### UI And Theme

- Theme/UI color consistency is first-class. Every surface, including third-party pickers, must follow design tokens.
- On DaisyUI-backed surfaces, prefer DaisyUI + Tailwind over bespoke nested hover/active stacks that fight parent controls.
- Use `.cursor/rules/daisyui.mdc` for daisyUI/Tailwind reference details and `.cursor/rules/react-floating-ui.mdc` for generic React/Floating UI pitfalls.
- **Floating overlays and modal scrims** follow §Webapp UI Systems → **Floating Surfaces And Modal Scrims** (black-based scrims, unified panel chrome, blur rules). Do not invent per-feature backdrop colors or `base-content` full-screen washes.
- **Desktop pad workspace** (TOC column, editor well, document sheet, docked chat) follows §Webapp UI Systems → **Pad Workspace Surfaces** — borders for docked regions; shadows only on floating overlays and dark-theme sheet lift.

## Monorepo Toolchain

### Workspace

- **docs.plus** is a Bun monorepo. Root `package.json` workspaces are `"apps/*"`, `"extensions/*"`, `"packages/*"`: deployables (`webapp`, `hocuspocus.server`, `admin-dashboard`) under `apps/`; the five publishable `@docs.plus/extension-*` under `extensions/`; shared internals and tooling (`floating-popover`, `floating-tooltip`, `eslint-config`, `release-tooling`, `playground`, `supabase`, `email-templates`) under `packages/`.
- Path-resolution invariants of that layout: every extension resolves `../../tsup.base` and `../../tsconfig.base.json` against the repo root, `apps/webapp/next.config.js` keeps the repo root as its tracing root, and the per-package eslint shims import `../../packages/eslint-config/*`.
- `@docs.plus/playground` is a dev/test-only clean-room harness the extension Cypress suites consume as a `workspace:*` devDependency: a `docs-playground` bin (generates the page shell + serves it, symlinking the consumer's `main.ts` into a temp dir so Bun's HTML bundler resolves it) plus a browser `setupPlayground` helper (personalizes title/heading/tokens, wires the theme toggle, returns `#editor`). Each extension's `test/playground/` holds only `main.ts` (the editor fixture) and a 1-line `tsconfig.json` that extends `@docs.plus/playground/tsconfig.json`; `cypress/tsconfig.json` extends `@docs.plus/playground/cypress/tsconfig.json` with a local `include`. The package ships raw source (no build), is never published, and is never imported by any `src/`, so it stays out of every `dist`; its manifest is COPY'd into each Dockerfile so `--frozen-lockfile` resolves the devDep.
- Main app: `@docs.plus/webapp` (Next.js Pages Router).
- Backend: `@docs.plus/hocuspocus` (workspace dir `apps/hocuspocus.server`).
- Admin UI: `@docs.plus/admin-dashboard`.
- Editor code lives under `apps/webapp/src/components/TipTap/`.
- Shared webapp utilities live in `apps/webapp/src/utils/`; `src/lib/` was removed. Keep feature-local helpers colocated. **Layer placement rules** (utils vs `ui/` vs layout shells vs feature folders) live under §Webapp UI Systems → Webapp Module Layers — follow them before adding or promoting helpers.
- When trimming playground-harness redundancy, limit to dead CLI, derived manifest fields, and small shell extractions (`extension-preflight.sh`) — no shared Cypress factories or root screenshot wrappers.

### Dependencies

- Root `package.json` owns shared devtool versions: ESLint, TypeScript, Prettier, Stylelint, Jest, `babel-jest`, `jest-environment-jsdom`, `@types/jest`, `@babel/preset-typescript`, and related tooling.
- Root `catalog:` centralizes pins where used. Workspaces reference matching deps as `"package": "catalog:"`.
- Do not duplicate Jest/Babel dev dependencies in package workspaces unless there is an exceptional documented reason.
- `@tanstack/react-query` is root-cataloged at v5 for webapp and admin-dashboard. Use object syntax; mutation pending state is `isPending`, while query `isLoading` remains valid.
- Toolchain split (deliberate): root `package.json` devDependencies run TypeScript 6 and ESLint 10 by maintainer decision, while the `catalog:` pins stay on TypeScript 5.x / ESLint 9.x pending a dedicated full-monorepo migration. `tsconfig.base.json` carries `"ignoreDeprecations": "5.0"` — required for extension dts builds under TS 6; do not remove it.
- **Root `overrides` pins the whole metascraper family — `metascraper`, `@metascraper/helpers`, and the nine `metascraper-*` plugins — to `5.50.6`; do not remove or bump any of the eleven without verifying.** `@metascraper/helpers` `5.51.1` (the latest at pin time) depends on `mime@4` (ESM-only) and `require()`s it; Bun (1.3.14 at pin time) throws `require() async module … unsupported` when a CJS module `require()`s it. Because `apps/hocuspocus.server` loads metascraper at REST startup (link-metadata module), this crashes the REST server, which cascades to the webapp slug page (SSR `documentServerSideProps` → `fetchDocument` → REST down → redirect to `/500`). `5.50.6` is the newest `helpers` still on nested `mime@3` (CJS) — the break landed in `5.51.1` (no `5.51.0` was published). There was no forward fix to "upgrade into" at pin time: `helpers`/`mime`/Bun were all already latest, and Bun's `require(esm)` fix (PR #30016) was canary-only. hocuspocus's own `import mime from 'mime'` (v4 ESM) is unaffected — only metascraper's CJS `require` of mime breaks. Drop the overrides once metascraper ships a CJS-safe `helpers` or a stable Bun lands the require(esm) fix. After any metascraper bump, verify `cd apps/hocuspocus.server && bun -e "await import('metascraper')"` loads before shipping.
- Dependency update flow:
  - Bump version ranges: `bun run update` (patch + minor only; root catalog + every `apps/*`, `extensions/*`, `packages/*` via `scripts/update-packages.sh`). Majors: `bun run update --upgrade`. Preview: `bun run update --dry-run`. The underlying tool is `npm-check-updates` — not `npm-check`, and not a verbose `bun update --recursive` wrapper; keep `scripts/update-packages.sh` minimal.
  - After `update`, run `bun install` at the repo root. Do not run parallel `bun update` / installs inside individual packages; shared `bun.lock` can race with `EEXIST`.
  - When adding a workspace package, keep `bun.lock` diffs scoped to that package's graph — avoid unrelated root devDependency churn from a blind full `bun install`; surgically merge lockfile entries if needed.
- Removed tools/scripts stay removed: per-package `update:packages`, `scripts/reinstall-packages.sh`, `reinstall:all-packages`, `update:all-packages`.

### Tests

- Unit + E2E stack: Jest and Cypress. Script names and `CYPRESS_PARALLEL` semantics are defined in the naming convention doc; this section captures docs.plus-specific orchestration, Jest wiring, and authoring conventions. Policy (when to write a test, what shapes to avoid) is in §Testing And Verification.
- Run order in `run-tests.sh` (the unit block; each extension runs its own `bun run test`):
  1. `@docs.plus/extension-indent` — Jest (local `jest.config.cjs`) then clean-room Cypress against built `dist/`.
  2. `@docs.plus/extension-hyperlink` — clean-room Cypress against built `dist/` (preceded by `bun test src` units).
  3. `@docs.plus/extension-hypermultimedia` — clean-room Cypress against built `dist/`.
  4. `@docs.plus/extension-inline-code` — clean-room Cypress against built `dist/`.
  5. `@docs.plus/extension-placeholder` — clean-room Cypress against built `dist/`.
  6. `@docs.plus/webapp` Jest (`jest --passWithNoTests`, so an empty or temporarily absent suite does not fail CI/local runs). **CI:** `stage.docs.plus.yml` and `prod.docs.plus.yml` run `bun run --filter @docs.plus/webapp test` in the quality-gate stage.
- Clean-room ports are unique per extension: hyperlink 5173, hypermultimedia 5174, indent 5175, inline-code 5176, placeholder 5177.
- Jest wiring:
  - `@docs.plus/webapp` keeps `next/jest` in `jest.config.js`.
  - Library packages that need Jest use a local `jest.config.cjs`. Configure `roots`, `testMatch`, `transform`, and `testEnvironment` there.
  - Prefer inline `babel-jest` options in `jest.config.cjs`; do not add per-package `babel.config.cjs` unless package-specific Babel behavior is required.
  - Add a library package test script as `"test": "jest --config jest.config.cjs"`.
  - Do not add package-local Jest stacks to `package.json`; use the root dev dependencies.
  - Jest 30 uses the plural flag `--testPathPatterns`, not the singular `--testPathPattern` from older docs/snippets. Correct it on sight.
  - `bun test` is Bun's native runner — not a substitute for Jest where Next/Jest or local Jest configs are used.
  - Slice unit tests must call `enableMapSet()` from `immer` at module scope. Slice files do not enable it themselves (only `useChatStore.ts` does at production load), so isolated slice instantiations otherwise fail with "MapSet plugin not loaded".
- Cypress conventions:
  - Split tests by concern and include a README for scope.
  - Use `it()`, not `test()`. Consolidate overlapping tests.
  - ProseMirror `handleDOMEvents.click` is not triggered by Cypress `realClick()` / `.click()`. Dispatch a native `MouseEvent('click', { bubbles: true, clientX, clientY })` using `getBoundingClientRect()` coordinates. Use the same pattern for floating-toolbar `keydown` Escape dismissal.
  - ProseMirror **input rules** (`markInputRule` / `markPasteRule`) do not fire on `cy.type()` — drive typing with `cy.realType()` (cypress-real-events) so the real `beforeinput` pipeline runs. **Keymap** handlers (Tab / Shift-Tab, arrow-key mark exit) fire from a synthetic `cy.get('#editor [contenteditable="true"]').trigger('keydown', { key, keyCode, shiftKey, bubbles: true })` — same family as the click note above. Programmatic `insertContent` does not trigger input rules; HTML parsing collapses leading whitespace, so build indented/space-led fixtures with real keypresses, not `setContent('<p>  x</p>')`.
- Naming:
  - Cypress E2E directories and files use kebab-case (`copy-paste/`, `keyboard-shortcuts/`, `clipboard-validation.cy.js`); no `e2e-` or numeric ordering prefixes unless the reason is documented.
  - Unit test files use camelCase and match the source module: `<moduleName>.test.ts`; performance tests use `<moduleName>.performance.test.ts`.
  - Cypress support modules use camelCase; fixture files use kebab-case; fixture directories may use camelCase when mirroring a command name.
  - Avoid sprint, phase, audit, or ticket names. Test descriptions describe behavior, not ticket IDs — within a file, use either `should ...` phrasing or bare verbs consistently.

### ESLint Config

- `packages/eslint-config` is ESM with `"type": "module"`.
- Three-layer config:
  - `index.js`: base TypeScript + Prettier + `simple-import-sort`; no React.
  - `next.js`: base + React + hooks; used by webapp/admin-dashboard.
  - `library.js`: base + `explicit-module-boundary-types` + `no-console: warn`; used by `extension-*` packages.
- Consumers use 2-line ESM imports. Do not add `createRequire` bridges.
- React plugins load only in `next.js`, never in library or backend configs.
- `packages/eslint-config` uses only `eslint-config-prettier`; its flat config does not load `eslint-plugin-prettier`.
- **Flat-config shim naming:** root / webapp / admin-dashboard use `eslint.config.mjs` (packages without `"type": "module"`). `hocuspocus.server` and `extension-*` use `eslint.config.js` (they declare `"type": "module"`). See `packages/eslint-config/README.md`.
- **Lint gate:** root `bun run lint` is `eslint . --max-warnings=0`. `bun run check` (CI) includes it plus format; pre-push runs `check:push` (lint + styles + typecheck, no full-repo Prettier). Pre-commit `lint-staged` formats staged files and enforces zero ESLint warnings on those files.
- **Pre-push selective builds:** `scripts/hooks/pre-push.sh` diffs `origin/main...HEAD` (full unpushed range), not only `HEAD~1`, so empty deploy commits do not skip extension/app `build:ci` when prior commits touched those paths.

### Shared Library Config

- Keep root-level shared config as the single source of truth.
- `tsconfig.base.json` applies to all `extension-*` packages. Package `tsconfig.json` files only declare local `outDir`, `rootDir`, `include`, and `exclude`.
- Package `exclude` must list colocated test paths: `src/**/__tests__/**`, `src/**/*.test.ts`. Otherwise tsc can expand the computed source root above `src` and trip `TS6059`.
- `tsup.base.ts` exports `defineTiptapExtensionConfig(overrides?)`.
  - The factory is intentionally Tiptap-specific. It hardcodes `@tiptap/core` and `@tiptap/pm` externals.
  - Build shape: ESM + CJS, dts, production sourcemaps/minify, and `esbuildOptions.pure = ['console.log', 'console.debug']` in production.
  - Do not use `drop: ['console']`; it strips `console.warn` and `console.error`.
  - A package's `tsup.config.ts` should call `defineTiptapExtensionConfig()` through `defineConfig(...)`; pass overrides only for package-specific behavior.
  - Overrides are shallow. Function-valued options such as `esbuildOptions`, `external`, and `dts` replace the base value. If a caller overrides `esbuildOptions`, it must preserve the base pure policy manually.
- `extension-hypermultimedia` intentionally preserves `console.error` from its `Logger` wrapper (`src/utils/logger.ts`, error-only by design — do not reintroduce `warn`/`debug`) under the shared tsup factory. Note logger changes in its CHANGELOG.
- **`@docs.plus/floating-popover` and `@docs.plus/floating-tooltip` are bundled into each consuming extension's `dist`, never externalized.** Both are `private` workspace packages (never published), wired as `devDependencies` `workspace:*` in `extension-hyperlink` and `extension-hypermultimedia`. Their `tsup.config.ts` `external` must stay `['@tiptap/core', '@tiptap/pm']` — do **not** add a `'@docs.plus/floating-*'` entry, or tsup emits a bare import into the published bundle that throws `MODULE_NOT_FOUND` for external npm consumers. `@floating-ui/dom` stays external (real published dep). Verify after any tsup change: built `dist/index.{js,cjs}` must contain no `@docs.plus/floating-*` import/require. Neither package ships CSS. Consumers carry lockstep skins with one split rule: `.floating-popover*` shell blocks use each package's own tokens, but the `.floating-tooltip` block is identical `light-dark()` **literals** by contract — both bundles style that one global class, and per-package tokens would let cascade order pick one bundle's look for every bubble (`scripts/extension-preflight.sh` enforces the byte parity).
- Root `LICENSE` is the single committed license.
  - Each publishable package adds `/LICENSE` to package `.gitignore`.
  - `prepack` copies the root `LICENSE` before `bun publish` or `bun pm pack`.
  - Symlinks fail because Bun pack drops them. Hard links fail because git stores independent copies.
- **Shared release scaffolding lives in `@docs.plus/release-tooling`** — an internal workspace package exposing `release-prepack` and `release-preflight` as `bin` commands. The scripts are data-driven: they derive the consumer's package name and dist-artifact list from its own `package.json` (`name` + `exports` map), so there is no per-consumer parameterization. Same DRY principle as `@docs.plus/eslint-config`, `tsconfig.base.json`, and `tsup.base.ts` — cross-package scaffolding is hoisted, never copied. Publishable libraries wire `prepack` / `prepublishOnly` to these bins per the Type 4 contract in the naming convention doc.
- Do not centralize package-specific files: `README.md`, `CHANGELOG.md`, package source, 3-line `eslint.config.mjs` / `eslint.config.js` shims, or `package.json` fields.

### Docker

- Use one Docker base tag everywhere: `oven/bun:1-slim`.
- Do not mix `1-alpine`, `1-slim`, or hardcoded patch tags.
- Do not copy `node_modules` between Docker stages. Bun uses symlinks into a virtual store; copied installs can break module resolution.
- Any stage that runs `next build`, extension builds, or config that requires deps must run `bun install --frozen-lockfile`.
- Copy only `package.json`, `bun.lock`, and the workspace tree between stages.
- Any Dockerfile stage that runs `bun run build` for `@docs.plus/extension-*` must also `COPY` the root-level shared configs `tsconfig.base.json` and `tsup.base.ts` into the build context. Each extension's `tsconfig.json` extends `../../tsconfig.base.json` and each `tsup.config.ts` imports `from '../../tsup.base'`; missing either file fails the extension build with `Could not resolve "../../tsup.base"`. Affected Dockerfiles: `apps/hocuspocus.server/docker/Dockerfile.bun` and `apps/webapp/docker/Dockerfile.bun` (`build-extensions` stage must copy them via `--from=deps`).
- **A stage that rebuilds the workspace from a prior stage must copy all three roots, not just `packages/`.** The `apps/* + extensions/* + packages/*` layout splits the workspace, so any `COPY --from=<stage> /app/packages ./packages` must be followed by `COPY --from=<stage> /app/apps ./apps` and `COPY --from=<stage> /app/extensions ./extensions` before `bun install --frozen-lockfile`. Without the `apps/*` and `extensions/*` members the frozen install fails with `lockfile had changes, but lockfile is frozen`. Stages that wire this: webapp `build-extensions` + `builder`, admin-dashboard `builder`, hocuspocus.server `production`. A `builder` that imports the extensions needs the **built** `extensions/` (with `dist/`) from the build stage; manifests alone are not enough.
- **Build `@docs.plus/floating-popover` and `@docs.plus/floating-tooltip` before the extensions that bundle them — inside Docker too.** hyperlink and hypermultimedia bundle both (not external; see §Shared Library Config), so any stage that runs their `bun run build` must first `COPY` and build both `packages/floating-*` packages. Wired in webapp `build-extensions` and hocuspocus.server `base`; `scripts/build-extensions.sh` and the `.github/actions/build-extensions` dist-cache key cover both. admin-dashboard builds no extensions but still copies both packages' `package.json`, or the extensions' `workspace:*` references fail to resolve under `--frozen-lockfile`.

### Standalone Bun Scripts

- Root `tsconfig.json` does not include `scripts/`. IDE lint errors such as missing `node:fs` or `import.meta.dir` in `scripts/*.ts` are usually noise.
- Smoke-check standalone Bun scripts with:

```bash
bun build scripts/<file>.ts --target=bun --outfile=/tmp/out.js
```

- Avoid ad-hoc `bunx tsc --noEmit <file>` unless passing `--ignoreConfig`; otherwise `TS5112` can fire when `tsconfig.json` exists.

## Publishing And Releases

### Extension Package Contract

- Publish workspace extensions under the org-owned `@docs.plus` scope.
- `exports.require.types` must point to `./dist/index.d.cts`, not `.d.ts`.
- `sideEffects` must include CSS, e.g. `['**/*.css']`; do not use bare `false`.
- Every scoped package needs `publishConfig.access: "public"` or `bun publish` defaults to private and can 402.
- Package metadata should include `homepage`, `bugs`, and discovery-oriented `keywords`.
- **Public-facing docs follow the family install policy and stay cohesive.** Every `extensions/extension-*/README.md` and `CHANGELOG.md` uses Bun commands (`bun add` / `bun remove`), never `npm`/`yarn`/`pnpm` — even though external consumers could use npm. Install blocks show the plain `bun add <pkg>` line only — no `@next` soak lines, and never an Install block led by `npm install <pkg>` — mirroring `extensions/README.md`. Keep the five READMEs at structural parity: shared Install/Contributing/Family boilerplate, framework-neutral `new Editor` (from `@tiptap/core`) Quickstart — not React `useEditor` — no per-package marketing taglines, and no `chrome` in shipped prose (use "UI"/"shell"/"toolbar", same as the §Code Quality rule).
- Extension publish audits expect all five packages at parity: package-local `CONTRIBUTING.md`, `bunx` release lifecycle hooks, README gallery assets via `docs:screenshots` (hero + `<details>`/`<picture>` scenes — no JS carousels; GitHub/npm READMEs are static HTML only), CI extension tests, and harness docs centralized in `extensions/README.md` with cutover/e2e READMEs linking — not duplicating ports/scripts. Preview collapsible README galleries on GitHub or `bunx grip <readme>` — VS Code's default Markdown preview often won't render `<details>`/`<picture>`.
- Adding any root re-export through `src/index.ts` or `src/utils/index.ts` is a minor release, not a patch.
- Resolve `[Unreleased]` to a real version before `bun run build`, `bun pm pack`, and `bun publish`.
- `prepublishOnly` runs `release-preflight`; it asserts:
  - publisher user-agent is `bun/*`;
  - every `dist/...` path in the consumer's `exports` map exists on disk;
  - no literal `catalog:` leaks into built bundles.

### Release And Publish

- `RELEASE_POLICY.md` is authoritative for versioning doctrine, cutover phase, lockstep activation, `release:family`, CHANGELOG style, soak/promotion, CI guards, and readiness checklists. Bullets below are the operational subset agents need at the keyboard.
- Phase 1 cutover: each extension can ship its first `2.0.0` to `@next` independently. Lockstep activates only through an explicit switch-flip commit in `AGENTS.md` / `RELEASE_POLICY.md`, not automatically when versions align.
- Lockstep release entry:

```bash
bun run release:family
```

The only root release/publish script is `"release:family": "bun scripts/release-family.ts"`. Do not reintroduce the removed `release`, `release:major`, `release:minor`, `release:patch`, `version*`, or parallel `publish` scripts.

- Publishing happens on the maintainer laptop because npm 2FA-on-write requires OTP. Do not put `NPM_TOKEN` in CI for publishing:

```bash
bun publish --tag <next|latest> --otp <6-digit>
```

- Major bumps go to `@next` for soak; stable patches/minors go to `@latest`. Promote later with `npm dist-tag add <pkg>@<ver> latest` when appropriate.
- Release tags are `<package-name>@<semver>` (e.g. `@docs.plus/extension-hyperlink@2.0.0`). `v<semver>` is reserved only as a fallback for future repo-wide releases.
- Release notes use the state-machine `awk` slice; the range form fails because both ends can match the same heading:

```bash
awk '/^## \[/{ if (found) exit; if (/^## \[<ver>\]/) found=1 } found' extensions/<pkg>/CHANGELOG.md
```

- Announcement happens after npm publish:
  - GitHub Releases are the announcement gate.
  - Discord push activity: `secrets.DISCORD_WEBHOOK` via `.github/workflows/discord-activity.yml`.
  - Discord releases: `secrets.DISCORD_RELEASE_WEBHOOK` via `.github/workflows/discord-release.yml`. Reserve unqualified `DISCORD_WEBHOOK` for the original push channel.
  - Release embeds color-code stability: green `#22c55e` for stable, orange `#f97316` for pre-release.
  - Install hints switch on `is_pre` — stable uses `bun add <pkg>@<version>`, pre-release uses `bun add <pkg>@next`. Do not hard-code per-package paths in the workflow.

### Extension Version Doctrine

- All five publishable `@docs.plus/extension-*` packages share the same major, tracking the docs.plus product line.
- `1.x` = 2023 product line.
- `2.x` = docs.plus alpha v2.
- Extensions are leaf packages; lockstep is policy, not graph-forced.
- Rotating per-package cutover state lives in [`.cursor/docs/extension-version-cutover.md`](./.cursor/docs/extension-version-cutover.md) and is deleted with the lockstep switch-flip PR.
- Family-release script invariants in `scripts/release-family.ts`:
  - Use `spawnSync` helper calls, no shell strings, so OTP never lands in `ps aux` or shell history.
  - GitHub release creation is idempotent across resumes: iterate `[...published, ...skipped]` and guard each with `gh release view <tag>`.
  - Push an explicit tag list only. Never run `git push --tags`.
- CLI flags: `--dry-run`, `--tag <next|latest>`, `--allow-noop`, `--generate-noop-changelogs`, `--help`.
- Preflight aggregates errors before any OTP prompt:
  1. lockstep;
  2. CHANGELOG entries;
  3. `dist/` freshness against `src/`;
  4. per-package `prepublishOnly`;
  5. clean working tree and `HEAD` matches `origin/main`;
  6. `npm whoami` and `git user.email`;
  7. local and remote tag collisions;
  8. no-op detection via `git diff <prevTag>..HEAD -- extensions/<pkg>/src/`.
- CHANGELOG style guide:
  - Themed sections per major: Highlights, Breaking, Added, Changed, Fixed, Security, Removed, Documentation, Internal.
  - Include code-diff migration guides and one-shot rename scripts for mechanical changes.
  - Disclose mispublishes/unpublishes honestly.
  - Add a brief pre-X.0 development history when public versions diverge from internal milestones.
  - Never auto-generate entries from commit subjects. Lerna/Changesets/Release-Please are not adopted.

## Extension Workflow

### Standalone Extension Development

- Standalone packages: `extension-hyperlink`, `extension-hypermultimedia`, `extension-indent`, `extension-inline-code`, `extension-placeholder`.
- Shared structure: TypeScript + tsup build + `@tiptap/core` peer dep.
- GFM markdown uses `@tiptap/markdown`; paste lives at `apps/webapp/src/components/TipTap/extensions/markdown-paste/`; import/export lives in `apps/webapp/src/utils/markdown.ts` and `toolbar/desktop/DocumentSettingsPanel`.
- `sanitizeJsonContent` runs on paste and import paths.
- After modifying any `extensions/extension-*` source:
  1. Run `bunx tsup` in that package.
  2. Clear `.next/cache` or remove `.next`.
  3. Restart the dev server and hard-refresh the browser.
- Next.js HMR does not reliably detect changes in Bun workspace-symlinked packages.
- If an extension playground is running via `bun run playground` (`bun --hot docs-playground`), restart it after `bun run build`; tsup `clean: true` can wipe `dist/` and leave the hot server serving 500 for `dist/styles.css`.
- Import/export for hyperlink and every hypermultimedia kit node (all nine, including Spotify) is not complete until clean-room Cypress covers both markdown **and** HTML round-trips (`getHTML()` → `setContent()`). The shared spec `cypress/e2e/serialization/html-round-trip.cy.ts` covers all kit nodes; when fixing one node's copy/paste, extend it for all kit nodes, not only the broken one. The HTML leg matters because `renderHTML` emits iframe widget URLs that each node must unwrap back to canonical page URLs (see §Hypermultimedia Extension).

### Hyperlink Extension

Extension-internal rules (schema, commands, click handling, safety/normalization, metadata/preview, the `specialUrls` catalog, public API surface, floating toolbar, clean-room Cypress harness) live in [`extensions/extension-hyperlink/AGENTS.md`](./extensions/extension-hyperlink/AGENTS.md). Read that file before touching anything under `extensions/extension-hyperlink/src/`. The webapp-side popover integration is below.

### Webapp-Owned Hyperlink Popovers

- The extension stays host-agnostic. `popovers.createHyperlink` / `popovers.editHyperlink` are callbacks returning `HTMLElement | null`.
- Desktop create/edit entries create an empty host and set only `host.dataset.testid`. Never set `host.className`.
- Register `{ kind, host, props }` via `setActivePopover` in `hyperlinkPopoverStore.ts`.
- Return the host so the extension's floating controller positions it.
- A single React `<HyperlinkPopoverPortal>` (mounted by `DesktopEditor.tsx`; also `pages/editor.tsx` for the standalone playground) reads the active popover via `useActivePopover` and portals `<HyperlinkEditor>` with `<HyperlinkSuggestions>` into the host. Never mount a second `HyperlinkPopoverPortal` inside `MessageComposer` when `DesktopEditor` already mounts the page-level one.
- Tests select by `data-testid` only. Do not restore legacy class selectors.
- `hyperlinkPopoverStore.ts` subscribes once at module load to `getDefaultController().subscribe((state) => state.kind === 'idle')`.
- The idle discriminator is `idle`, not `closed`.
- The subscription is guarded by `globalThis.__hyperlinkControllerSubscribed` (`SUBSCRIPTION_FLAG`) so HMR/Jest module-cache replays do not stack listeners.
- Legacy `.hyperlink-create-popover` and `.hyperlink-edit-popover` SCSS blocks were removed from `styles/styles.scss`.
- Only `.hyperlink-preview-popover` keeps SCSS because preview is still rendered by imperative DOM.
- Create popover UX is minimal: one inline `[URL input] [Add]` row plus suggestions; no header and no Cancel.
- Edit popover keeps back arrow, URL/Text labels, and Update.
- Mobile `LinkEditorSheet` dismisses through drag/backdrop and also has no Cancel.
- Controls use DaisyUI: `input input-sm`, `input-error`, `btn btn-primary btn-sm`, `btn btn-ghost btn-sm btn-square`.
- Suggestions data:
  - headings from top-level `doc.content` children, same source as `useTocActions.copyLink`;
  - current-workspace bookmarks, both active and archived via parallel `getUserBookmarks` calls;
  - active bookmarks sort before archived.
- Suggestion URLs are absolute and reuse `useTocActions.copyLink` and `BookmarkItem.handleCopyUrl` shapes:
  - headings: `?h=...&id=<headingId>`;
  - bookmarks: `?msg_id=...&chatroom=...`.
- Picker command contract: choosing a heading/bookmark during create applies only `href` when text is selected; choosing a suggestion during edit updates only URL unless the user explicitly edited the Text field.
- Suggestion states are collapsed -> browsing -> searching.
- Desktop default state is `collapsed`; mobile default state is `browsing`.
- Webapp icon catalog:
  - `hyperlinkPopovers/iconList.ts` was deleted.
  - `previewShared.ts::TYPE_TO_ICON` maps `SpecialUrlType` to Lucide icons from `Icons` (`@components/icons/registry`), typed `Partial<Record<SpecialUrlType, IconType>>` (`IconType` from `react-icons`).
  - It is intentionally partial so domain-catalog types such as `meet` or web `github` can be absent; favicon wins for `https://` URLs.
  - Use Lucide React components only.
  - `createSvgIcon(Icon)` renders with `renderToStaticMarkup(createElement(Icon, { size: 20, 'aria-hidden': true }))`.
  - Do not reintroduce per-platform `Fa*` / `Si*` icons or hard-coded SVG strings.

### Composer Link Dialog And Internal Links

- **Surface routing.** Pad desktop → `createHyperlinkDesktop` + the page-level `HyperlinkPopoverPortal` above; pad mobile → `createHyperlinkMobile` → `linkEditor` / `linkPreview` sheets via `useSheetStore` (see §Mobile Bottom Sheets And Overlays). The mobile **chat composer** is a separate surface: `getHyperlinkPopoverConfig(isMobile, surface)` with `HyperlinkSurface = 'pad' | 'composer'` routes `composerMobilePopoverEntries` (return `null`, open `composerLinkDialogStore`) and a portaled `ComposerLinkDialog` in `MobileLayout` — not the pad `linkEditor`.
- Composer `useTiptapEditor` uses `getHyperlinkPopoverConfigAtInvoke(() => isComposerMobileRef.current, () => 'composer')` so the frozen `useEditor([], …)` reads layout at invoke time (`variant === 'mobile'` via ref, not `settings.editor.isMobile`).
- Snapshot selection in `composerLinkSelectionRef` before modal focus steal (toolbar create + iOS save).
- All composer link dialog paths (preview tap on `<a>`, edit/add open, Cancel, dismiss) must preserve keyboard state — open stays open, closed stays closed. Never call the pad's `previewHyperlink.dismissSoftKeyboard`; snapshot `keyboardWasOpenAtOpen` at open and refocus on close only when the keyboard was open (Cancel must not collapse an open keyboard).
- `ComposerLinkModalShell` centers in the visual viewport on iOS and Android via `--visual-viewport-height` / `--visual-viewport-offset-top`, not `fixed inset-0` or top-clamped placement.
- The URL field is a `<textarea>` (not `<input>`) with Tailwind v4 `field-sizing-content` + `max-h-24` so long URLs auto-grow within the row instead of overflowing horizontally; pad `HyperlinkEditor` and composer `ComposerLinkEditorDialog` share the shape, the daisyUI `.input` wrapper around the textarea owns the border/focus ring (it has no built-in textarea styling), and the popover shell is responsive (`min-w-[26rem]` floor, `max-w-[min(34rem,calc(100vw-2rem))]`), not a fixed `w-[24rem]`.
- **Internal document links (smart link popover).** One pure resolver `internalDocumentLink.ts` — `classifyInternalDocumentLink(href, pathname)` → `InternalDocumentLink | null` (union `document | heading | chat | filter | history`; `null` = external/another doc) + `describeInternalDocumentLink(link, editor)` → `{ label, icon }`. The side-effecting `runInternalDocumentLink` lives in sibling `internalDocumentLinkActions.ts` (PubSub/scroll/history), split from the resolver so `classify` unit-tests (`internalDocumentLink.test.ts`) without dragging the `@utils/index` barrel → supabase graph (which throws in Jest without env). `navigateHref` (`hrefEventHandler.ts`) = classify → if internal `run()` (closes the popover uniformly first) → else `window.open`; the old inline per-dialect `if` ladder is deleted.
- Bookmark/notification links need no special kind — they already build canonical `?chatroom=&msg_id=` so they resolve to `kind: 'chat'`; cross-document docs.plus links stay external (exact doc-slug match, not `startsWith`); internal links skip the metadata fetch/favicon entirely. The heading kind keys on `?id=` (the `?h=` breadcrumb is written/shared but never read for navigation).
- The internal-link chip renders two ways mirroring the existing split — imperative `createInternalLinkChip` (desktop `previewShared.ts`/`previewHyperlink.ts`) + React `<InternalLinkChip>` (mobile `LinkPreviewSheet`/`linkPreviewActions`, composer `ComposerLinkPreviewDialog`) — primary action "Go to destination"/"Go"; Copy always yields the raw canonical href; desktop chip SCSS (`.is-internal`) lives in `document-styles.scss` (token-based, light + dark).

### Hypermultimedia Extension

- When changing embed behavior (paste rules, oEmbed/iframe params, node attrs) **or toolbar host hooks** (`mediaActions`, `mediaToolbarIcons`, hover/open hot paths), update the per-node README and package README for end users in the same change.
- Toolbar work is performance-critical: reuse via `existingToolbar` when possible; otherwise doc-cached `resolveMediaActions` + one DOM build per mount — no extra caching/indirection beyond that without measured hot-path justification.
- On multi-item embed work ("work on all of them"), honor explicit scope exclusions the user states (e.g. skip toolbar/player-param UI for YouTube when they say "do not work on the toolbar"). When the user scopes a task to **webapp-only**, leave publishable `extension-*` packages untouched and wire icons/Comment/host behavior through existing kit hooks from the webapp — do not "helpfully" refactor the extension until they ask.
- Cypress resize/loading specs must assert rendered DOM size (inline `style` width/height or `getBoundingClientRect` on `img` / iframe / `.hm-media-host`), not ProseMirror node attrs alone — attrs can commit while the node view still paints the old pixel box. Gripper-drag specs on iframe embeds: the loading shell keeps the slot at `opacity: 0` until load — assert the iframe stays mounted with computed `display`/`visibility` not hidden, not Cypress `be.visible`.
- HTML copy/paste round-trips through `renderHTML` iframe widget URLs — each embed node must unwrap widget URLs back to canonical page URLs in `src.parseHTML` and embed builders (SoundCloud was the missing `parseSoundCloudTrackUrl`; YouTube/Vimeo/Loom already normalize; X emits blockquote+anchor). Cover all kit nodes in `cypress/e2e/serialization/html-round-trip.cy.ts` (see §Standalone Extension Development).
- **SoundCloud:** the iframe UI does not scale with the loading shell `aspect-ratio` — floor display height to the widget minimum (120px compact / 166px visual) via `syncSoundCloudResponsiveHost` and `fitSoundCloudLayoutToEditorColumn`; gripper/resize min heights must read live SoundCloud extension options (`visual`), not kit defaults alone — consolidate node-specific resize floors in one helper, not duplicated `if (soundcloud)` branches in shared decoration code.
- **X** leaf oEmbed: `omit_script=1`, single `widgets.js` via `whenTwttrReady`, seed blockquote+anchor on oEmbed failure, height watcher until node-view destroy, `overflow: visible` when ready, sanitizer `hrefHosts: ['x.com', 'twitter.com']`.
- **Spotify** (the 9th kit node, `src/nodes/spotify/`) is fixed-height like SoundCloud — the player UI does not scale, so pin host height via `syncSpotifyResponsiveHost` + `fitSpotifyLayoutToEditorColumn` (fit width to column, keep height); `theme` is `0` dark / `1` light; `defaultSpotifyHeight` is 152px for `track`, 352px otherwise. `parseSpotifyEntity` accepts `open.spotify.com/{track,album,playlist,artist,show,episode}/{id}` (plus `intl-xx`, `embed/`, and `spotify:type:id` URIs) and a `parseHTML` rule + plain-text paste rule both accept the bare URL **and** the "Copy embed" `<iframe src*="open.spotify.com/embed">` markup, canonicalizing `src` back to the share URL (drops `utm_source`/`si`).
- **Adding any new iframe-embed media node requires allowlisting its host in `IFRAME_EMBED_HOSTS` (`apps/webapp/config/security/third-party-hosts.js`)** — that list feeds CSP `frame-src` in `next.config.js`, so a missing host makes Next.js block the iframe (the symptom looks like "a Next.js error"); `next.config.js` is read only at startup, so the dev server must restart to apply it. Webapp wiring is the `MEDIA_INSERT_REGISTRY` entry in `mediaPopovers/mediaInsert.ts` (`setSpotify`, `FaSpotify`, `unfurl: true`).
- Pad editor file uploads hit the hocuspocus doc-media endpoint — size cap, env pitfalls, and floor behavior live in §Hocuspocus Server.

### Indent Extension

- Keep pad `TipTap.tsx` and chat composer `useTiptapEditor` on the same `Indent.configure({ indentChars: '\t' })`, or widen both together.
- Literal indent/outdent is gated by `allowedIndentContexts`, an allowlist of `{ textblock, parent }` TipTap type-name pairs.
- Default literal indent contexts: paragraphs under `doc` and `blockquote`.
- `[]` disables literal indent.
- Tab / Shift-Tab order:
  1. sink/lift list (`listItem` / `taskItem` when schema supports it);
  2. table cell navigation when table extension exists;
  3. literal indent/outdent.
- Extension priority is 25 plus delegation.
- Other textblocks need explicit `allowedIndentContexts` rules.
- Cypress: webapp suite under `apps/webapp/cypress/e2e/editor/indent/` plus the package clean-room suite (see §Tests for ports and the run order); Jest lives under `extensions/extension-indent`.

## Editor Architecture

### Document Model And Migrations

- Server-side `TiptapTransformer.toYdoc` / nested-to-flat migrations must use an extension set that covers every node/mark in stored docs.
- Include `TaskList` / `TaskItem` from `@tiptap/extension-list` aligned with the webapp. StarterKit alone is not enough.
- Missing node/mark types fail encode; they are not flattening issues.
- Batch migrations fail closed. Never overwrite stored Yjs bytes when transform/encode fails; keep prior bytes and surface the doc id.
- Run the migration CLI from `apps/hocuspocus.server` after root `bun install`:

```bash
bun run migrate:nested-to-flat
```

- Invoking the script path from an arbitrary cwd can break Bun resolution of `yjs` for `@hocuspocus/transformer`.

### Heading Schema

- Editor uses a flat heading schema: `heading block*`.
- Sections are decoration-based.
- `attrs['toc-id']` renders as `data-toc-id`.
- Shared heading utilities live in `TipTap/extensions/shared/`: `computeSection`, `moveSection`, `canMapDecorations`, `transactionAffectsNodeType`, `matchSections`.
- Section reorder is TOC-only via `useTocDrag` / `moveHeading` + `moveSection`. There is no in-editor heading drag handle extension.

### HeadingScale

- `apps/webapp/src/components/TipTap/extensions/heading-scale/heading-scale.ts` is a mandatory spec.
- Heading font size is dynamic by rank within a section, not fixed per HTML level and not a Google-style ladder.
- Each H1 starts a new section.
- Within a section, distinct heading levels are sorted and sizes interpolate evenly between 20pt max and 12pt min.
- The same heading level repeated in one section gets the same visual size.
- A section with one distinct heading level uses 20pt.
- The title, first top-level H1, is part of section 1.
- Use decorations only: `--hd-size`, `--hd-rank`, `--hd-total`. Never write sizes into the document.
- Plugin state is `{ fingerprint, decorations }`.
- Fingerprint is top-level heading levels in order, e.g. `1,2,4,1,3`.
- Rebuild fully when the fingerprint changes or `y-sync$` meta is present; otherwise map the decoration set.
- Do not replace this with fixed per-level point maps.

### Editor Performance

- Editor jank is usually React/Zustand re-renders, not ProseMirror.
- Never put UI flags in `useEditor` deps.
- Use `shouldRerenderOnTransaction: false` on collaboration editors.
- Decoration plugins should avoid full rebuilds on every keystroke. Use `transactionAffectsNodeType(tr, 'heading')` or a cheaper structural check.
- HeadingScale uses a heading-level fingerprint, not only `transactionAffectsNodeType`.
- Placeholder uses `@docs.plus/extension-placeholder` with O(1) state `init/apply`. Do not replace it with Tiptap's built-in placeholder, which scans with `doc.descendants`.
- **Foreign attribute mutations inside the editor recreate node views (media embeds reload).** ProseMirror's `DOMObserver` watches every attribute on every descendant (no `attributeFilter`) and reconciles non-PM mutations by re-rendering the dirty range — destroying+recreating the affected node views (`NODE_DIRTY` set by `docView.markDirty` over the unioned range; `CustomNodeViewDesc.update` returns `false` before consulting `spec.update`, so a node-view's own `ignoreMutation`/`update` can NOT veto a range-set dirty — sibling mutations recreate it as collateral). Consequences and wiring:
  - **Never render a persistent `[role="status"]` / `[aria-live]` / `output` ARIA live-region inside `.ProseMirror`.** `@floating-ui/react` `FloatingFocusManager.markOthers()` runs on every popover/dialog open (regardless of `modal`; it sets the `data-floating-ui-inert` marker even when no `inert`/`aria-hidden` is applied), collects live-regions as keep-targets, recurses into the editor, and stamps `data-floating-ui-inert` across the whole doc → every iframe embed reloads. Use `aria-busy` or a live-region OUTSIDE the editor.
  - **Leaf/atom node-views must not expose `contentDOM`** — PM treats it as an editable content hole and re-parses async iframe/widget mutations.
  - Fixes in place: `extension-hypermultimedia/src/loading/defaultShell.ts` dropped role=status/aria-live and the iframe embeds are leaf node-views (no `contentDOM`, like `x`/`video`/`audio`); webapp `PopoverInsideElementsProvider` (exported from `@components/ui/Popover`, supplied once at `DesktopLayout` as `() => [editor.view.dom]`) keeps the editor inside `markOthers` for every `ui/Popover` — which is non-modal, so excluding the editor costs no a11y (it only drops the cosmetic marker).
  - `Dialog` / `ContextMenu` are MODAL focus traps (their `FloatingFocusManager` defaults `modal=true`): excluding the editor from THEIR `markOthers` would also drop its `aria-hidden`/`inert` behind the modal — an a11y regression — so they deliberately rely on the no-editor-internal-live-region invariant instead (audited clean; do NOT add `getInsideElements` to modal surfaces).
  - Related latent footgun: `UNREAD_SYNC` writes `dataset`/`style` to `.ha-chat-btn` every unread tick — safe ONLY because those are `Decoration.widget` DOM (DOMObserver ignores widget attribute mutations); keep them widget DOM, never a schema node / NodeView content child.

### Editor State And References

- **Store discipline.** `useStore` (the main app store in `stores/useStore.ts`) combines six slices: `workspaceStore`, `usersPresence`, `history`, `notification`, `virtualKeyboardStore`, `dialogStore`. Standalone stores (`authStore`, `focusedHeadingStore`, `sheetStore`, `themeStore`, the chat-domain `useChatStore`) live alongside but are not folded in. All `useStore` calls must use leaf selectors; never select `(state) => state` or `(state) => state.settings`.
- **Canonical editor handle:**

```ts
useStore((state) => state.settings.editor.instance)
```

- Registered by `useEditorAndProvider.ts` via `setWorkspaceEditorSetting('instance', editor)`.
- Consumers: `EditorContent.tsx`, `useTocActions.tsx`, the toolbar, collaboration-document features.
- `window._editor` and `window._store` are set only by `pages/editor.tsx` (standalone playground); both are undefined on real document/collab routes. Do not add new `window._editor` readers to document-route features.
- React mobile sheets that need an editor reference use typed `SheetDataMap` payloads (e.g. `linkPreview`, `linkEditor`), not globals.
- **ProseMirror state pitfalls:**
  - `doc.nodeAt(pos)` can throw `RangeError` for out-of-range positions. Guards must not assume null-only.
  - `transaction.before` is the pre-step document `Node`, not `EditorState`. Never call `PluginKey.getState(transaction.before)`.
  - For fold-driven UI such as TOC, snapshot heading-fold plugin state from `editor.state` and diff across transactions.

## Webapp UI Systems

### Webapp Module Layers

Webapp code is split by **responsibility**, not by “whatever folder the first consumer lived in.” Pick the layer before adding a file; do not colocate a pure helper under `@components/ui/` just because a UI component imports it.

- **`apps/webapp/src/utils/`** — app-wide **pure** code: formatters (`formatCappedCount`, `formatTime`), layout/spacing **tokens** (`sheetBodyPadding.ts`), parsers, metrics, URL helpers with no feature owner. No React, no JSX, no DOM. Re-export new shared utils from `utils/index.ts` when other packages might import them.
- **`apps/webapp/src/components/ui/`** — reusable **presentational** React components only: buttons, badges, inputs, `PanelTabBar`, `RollingNumber`, `ScrollArea`, etc. A file here must export a component (or a type props-only module tightly coupled to one). **Never** put standalone `.ts` formatters, string builders, or bleed/pad maps in `ui/`.
- **`apps/webapp/src/components/` (root, not `ui/`)** — cross-feature **layout shells and composites**: `SheetLayout`, `SheetHeader`, `SheetFooter`, `SheetActionFooter`, `PanelSurfaceShell`, `TabbedPanelBody`, `BottomSheet`. These orchestrate children and variant forks; they are not generic atoms.
- **Feature folders** (e.g. `TipTap/hyperlinkPopovers/utils/`, `chatroom/utils/`) — logic owned by one feature (`urlFieldInput`, `postgresErrors`, `collectHeadings`). Promote to `@utils/` only when **two or more unrelated features** need it with no feature-specific contract.
- **Shared types** — cross-surface variants in `apps/webapp/src/types/` (e.g. `PanelSurfaceVariant` in `types/ui.ts`). Feature-owned types stay in that feature's `types.ts`.

**DRY for formatters and caps:** one canonical implementation (today: `formatCappedCount` for display caps like `99+`). Do not inline `count > 99 ? '99+' : String(count)` in new code; wire existing call sites when touching them.

**Tailwind token maps:** pad/bleed class strings that must stay JIT-literal live in a utils module (`sheetBodyPadding.ts`: `sheetBodyPadClassName`, `horizontalPadBleedClass`, `sheetBodyBleedClassName`), not on a React shell (`SheetLayout`). Shell components import tokens from `@utils/sheetBodyPadding`.

**Panel stack (canonical):** `PanelSurfaceShell` (popover vs sheet header fork) → `TabbedPanelBody` (tab bar + infinite scroll list) → feature panel (`BookmarkPanel`, `NotificationPanel`). `PanelTabBar` stays in `ui/`; `TabbedPanelBody` stays next to `PanelSurfaceShell`, not in `ui/`.

**Cross-feature component imports:** chatroom → `hyperlinkPopovers` is an established boundary for hyperlink commands/types/widgets; do not invent a second parallel URL-field stack in composer. Prefer feature-owned widgets (`HyperlinkUrlTextarea`) + feature or shared utils over copy-paste.

### TipTap Styling

- TipTap pad-only SCSS lives under `apps/webapp/src/styles/editor/`.
- Load path: `styles.scss` -> `components/_index.scss` -> `@use '../editor'`.
- Do not add parallel `.scss` files next to TipTap extensions.
- Pad chrome:
  - `PadTitle` has `border-b` for header-to-toolbar.
  - `.tiptap__toolbar` uses `border-b` only; no `border-t` against `PadTitle`.
  - Pad sheet top border comes from `_blocks.scss` for toolbar-to-editor.
  - Mobile `.m_mobile .tiptap__toolbar` lives in `_blocks.scss`.
- Scrollbars:
  - Shared `:root` tokens live in `globals.scss`.
  - Use `scrollbar-custom scrollbar-thin` on `.editorWrapper` and TOC `ScrollArea`.
  - Avoid ad-hoc scrollbar styling on the pad column.
- Document sheet border/radius/shadow: §Pad Workspace Surfaces — not ad-hoc `box-shadow` in `_blocks.scss`.

### Pad Workspace Surfaces (desktop)

Distinguish **docked** pad regions from **floating** overlays. Docked = TOC column, editor scroll well, document sheet (`.tiptap__editor`), docked chat (`ChatroomPanelLayout`). Floating = popovers, context menus, TOC drag card, extension toolbars — those keep `shadow-xl` / drag shadows per §Floating Surfaces And Modal Scrims.

- **Canonical CSS tokens** in `apps/webapp/src/styles/globals.scss` (`:root`; dark overrides on `[data-theme='docsplus-dark']` / `docsplus-dark-hc`):
  - `--pad-divider` / `--pad-sheet-border` → `var(--color-base-300)`.
  - `--pad-sheet-radius: 0.375rem`.
  - `--pad-sheet-shadow: none` in light; dark only → `0 1px 2px color-mix(in oklch, var(--color-base-content) 6%, transparent)`.
  - `--resize-sash-hit` (8px), `--resize-sash-size` (4px), `--resize-sash-idle` (= `--pad-divider`), `--resize-sash-hover` (= primary).
- **Light theme workspace contrast:** docsplus `base-200` is `#edf0f5` (workspace well); `base-100` is the sheet/chat surface. Do not collapse them back to near-identical neutrals — light docked UI reads via border + background step, not shadow.
- **Document sheet** (`_blocks.scss` `.pad .editor .tiptap__editor`): `border` + `border-radius` + `box-shadow` must use `--pad-sheet-*` tokens. Do not reintroduce per-theme `box-shadow` literals on the sheet in light mode.
- **Docked chat** (`ChatroomPanelLayout.tsx`): `border-t border-base-300` only — no `shadow-lg` (or any drop shadow) on the docked panel.
- **Heading-action chips** (`_heading-actions.scss` `$ha-btn-surface` + expanded `.ha-group` tray): same `--pad-sheet-border` / `--pad-sheet-shadow` — flat in light, subtle lift in dark only.
- **TOC column layout** (`DesktopEditor.tsx`): editor column `flex-1 min-w-0`; TOC `shrink-0` + explicit width — **no** `border-r` on the column (double-divider with the sash). No `justify-around`, no `width: calc(100% - tocWidth)` on the editor column — that regresses a pixel gap at the TOC↔chat junction.
- **TOC resize** (`useTocResize.tsx`, `ResizeHandle.tsx`, `SlugPageLoader.tsx`): max width `TOC_MAX_WIDTH_RATIO = 0.46` of `.editor` row; clamp on drag + window resize. Vertical sash stradds the split (`right-[calc(var(--resize-sash-hit)/-2)]`), `z-40` above `TocHeader`, and is the **sole** divider — always draws a 1px idle hairline (`--resize-sash-idle`); widens/recolors to primary on hover/drag. Do not reintroduce column `border-r` or idle `after:opacity-0`. Horizontal chat sash: **`bottom-full`** on the panel top edge — never `top-0 -translate-y-1/2` (overlaps chat toolbar and steals clicks).
- **Do not** add ad-hoc `box-shadow` / `shadow-*` on docked pad chrome in light theme to “add depth” — depth belongs on floating species and dark sheet lift only.

### Mobile Bottom Sheets And Overlays

- The canonical mobile sheet system is `apps/webapp/src/components/BottomSheet.tsx`, wrapping `react-modal-sheet`.
- Sheets register through `useSheetStore` with `SheetType` + `SheetDataMap`.
- New mobile UI surfaces add a `SheetType` variant, a typed `SheetDataMap` entry, and a React subscriber.
- Tiptap extension imperative-DOM popovers connect to React sheets through extension `popovers` config, gated by `settings.deviceDetect.isMobile` in `TipTap.tsx`.
- Do not build parallel sheet systems — imperative-DOM or otherwise — next to the React + Zustand sheet system. Extend new mobile action panels via a `SheetType` variant plus the `SHEET_CONTENT` / `SHEET_PROPS` registries.
- Keyboard dismissal is a per-sheet entry-point decision. Do not globalize it in `useSheetStore` or `BottomSheet`.
- Keep the keyboard up for chatroom composer and `linkEditor`. The composer emoji panel mounts inline (not as a sheet variant); `emojiPicker` is no longer a `SheetType` / `SheetDataMap` entry / `useBottomSheet.openEmojiPicker` flow. `CHATROOM_OVERLAY_SHEETS` is gone with it. Do not reintroduce an `emojiPicker` sheet variant for the composer surface.
- Dismiss the keyboard for `linkPreview` and chatroom open paths: `CHAT_OPEN` (`services/eventsHub.ts`) / `CHAT_COMMENT` (`services/chatEvents.ts`).
- A single synchronous `editor.view.dom.blur()` is not reliable; it can lose the race against queued ProseMirror focus.
- Proven dismiss patterns:
  - `useClipboard.ts` style: collapse selection, then `setTimeout(50)` and `editor.view.dom.blur()`.
  - `exitDocEditModeForSheet` in `services/openHeadingChatroom.ts`: `editor.setEditable(false)` plus `editor.view.dom.blur()`.
- `editor.setEditable(false)` synchronously flips `contenteditable` through `view.updateState` (verified in Tiptap 3.20; re-verify on Tiptap major bumps); a separate DOM attribute write is not load-bearing for that timing.
- Always early-return when `isKeyboardOpen` is false.
- **Unified sheet shell.** `SheetLayout` (`@components/SheetLayout`) is the canonical mobile sheet body: a `SheetHeader` title that states the sheet's purpose, a scrollable `flex-1 min-h-0 overflow-y-auto` body, and an optional sticky footer (`fillHeight` toggles `h-full min-h-0` vs `max-h-[min(85dvh,100%)]`). Form sheets pin actions with `SheetActionFooter` (built on `SheetFooter`): an optional square ghost Back (`btn-square min-h-12 w-12`) on the left plus a primary `flex-1` Apply that is deliberately heavier (`btn-primary min-h-12 text-base font-semibold`) — add flows show Apply full-width, edit flows show Back + Apply. The hyperlink add/edit and link-preview sheets, plus the bookmark, document-settings, filter, and notification sheets, all adopt this shell; desktop popovers keep their inline layout. Layer placement for these shells follows §Webapp Module Layers.
- Mobile pad has two overlay systems: **`ModalDrawer`** (checkbox + label; left TOC via `TocModal`) and **`BottomSheet`** (chatroom, notifications, filters, bookmarks, documentSettings, pad link sheets). `BottomSheet` mounts outside `mobileLayoutRoot` in `MobileLayout`.
- Opening a sheet from inside `TocModal` must `closeModal()` before `openSheet()` — the drawer is `z-30` and stacks above the sheet (same pattern as filters).
- Chatroom sheet: on composer `focusin`, `isKeyboardOpen`, or `useComposerEmojiPanelStore.isOpen`, snap full height (`CHATROOM_TOP_SNAP_INDEX`) + `avoidKeyboard`; the emoji panel must OR into the same trigger.
- Desktop **`BookmarkPanel`** / **`DocumentSettingsPanel`** popovers (`w-[28rem]`, `bottom-end`) mirror the mobile TocModal footer sheets. **`SettingsPanel`** (user account) stays separate from **`DocumentSettingsPanel`** (per-doc metadata/markdown I/O).

### Mobile Document Pad

- iOS Safari rules live under `apps/webapp`, mainly `html.m_mobile` in `styles/_mobile.scss`.
- `html` and `body` are `position: fixed`.
- `.mobileLayoutRoot` tracks `window.visualViewport` through `syncVisualViewportToCssVars` and `AppProviders` visualViewport `resize` + `scroll`, coalesced with rAF.
- Do not skip CSS sync when height deltas are small. WebKit can emit sub-threshold steps after a large keyboard resize.
- `useVisualViewportCssSyncOnFocus` listens for captured `focusin` on `.mobileLayoutRoot .tiptap__editor.docy_editor` and reruns viewport CSS sync when a final resize is missing.
- Do not use `transform: translateZ(0)` on `.editor.editorWrapper`.
- Do not use `contain` or `will-change: height` on `.mobileLayoutRoot`; WebKit can mis-paint the contenteditable caret.
- Use `scrollElementInMobilePadEditor` for headings, TOC, and deep links. Avoid raw `Element.scrollIntoView` on doc nodes.
- `innerHeight - visualViewport.height` can stay 0 while the keyboard is up. Use `applyVirtualKeyboardToStore` in `utils/virtualKeyboardMetrics.ts`.
- `useVirtualKeyboard` and `nudgeVirtualKeyboardOpenFromVisualViewport` both call that metrics path. Listen to visualViewport `scroll` and `resize`.
- In `useEditableDocControl`, never set `isEditable = isKeyboardOpen` on every effect. Keyboard opens before resize; only clear `isEditable` on keyboard close.
- The 500ms DOM sync must not set `contenteditable=false` while `settings.editor.isEditable` is still true.
- Read-mode `contenteditable` leak fix:
  - Keyboard-close store updates alone are not enough.
  - Add/keep a reconcile effect that mirrors `isEditable -> false` to both `editor.setEditable(false)` and `view.dom.contenteditable`.
  - Guard false-direction only and only when `editor.isEditable` is currently true.
  - Do not remove legacy entry-edit-mode behavior or the 500ms grace.
- Removing the JS `.focus()` call from `extension-hyperlink/clickHandler.ts` is not enough; the user tap itself can focus a lingering `contenteditable=true` host.
- In `AppProviders`, if `.mobileLayoutRoot`, `visualViewport.offsetTop > 0`, and `window.scrollY > 0`, call `window.scrollTo(0, 0)`.
- Edit entry:
  - `EditFAB` and double-tap share `enableAndFocus()` from `hooks/useCaretPosition.ts`.
  - FAB uses `onTouchEnd` and suppresses synthetic `click`.
  - `enableAndFocus()` uses `editor.commands.focus()` only. Do not chain Tiptap `scrollIntoView()` with `ensureCaretVisible` / `scrollCaretIntoView`.
  - Mobile caret scroll uses `behavior: 'auto'`.
  - `ensureCaretVisible` uses 2x rAF plus one ~300ms retry.

### Floating Surfaces And Modal Scrims

Follow industry overlay UX (Material, Apple HIG, Radix/shadcn) and dim-not-lift depth principles: **scrims dim the page; they never lighten it.** A modal/sheet backdrop pushes content back in depth; a white fog on dark UI breaks hierarchy and reads immature.

- **`base-content` is text ink, not scrim ink.** Low-opacity `color-mix(… base-content …)` is fine for muted copy, borders, and placeholders (~8–16%). **Never** use `base-content` at high opacity for full-screen modal/sheet/lightbox scrims — on dark themes it becomes a milky `#fff` wash. Scrim color is always **black + opacity** (`color-mix(in oklch, black …, transparent)`), theme-tuned via CSS vars not `base-content`.
- **Canonical scrim tokens** live in `apps/webapp/src/styles/globals.scss` (`:root` + `[data-theme='docsplus-dark']` / `docsplus-dark-hc` overrides):
  - `--modal-scrim` — dialogs + bottom sheets (light: black 45%; dark/HC: black 55%).
  - `--modal-scrim-heavy` — full-bleed media lightbox (light: black 72%; dark/HC: black 80%).
- **React exports** in `@components/ui/Dialog.tsx` — import these; do not duplicate Tailwind/hex scrims at call sites:
  - `modalBackdropClassName` → `bg-[var(--modal-scrim)] motion-safe:backdrop-blur-sm` (centered modals: Share, Profile, GlobalDialog, chatroom confirms, etc.).
  - `modalBackdropHeavyClassName` → `bg-[var(--modal-scrim-heavy)] motion-safe:backdrop-blur-sm` (e.g. `ChatMediaGallery`).
  - `modalPanelChromeClassName` → border + shadow + `bg-base-100` only (small portaled cards, e.g. composer link dialog).
  - `modalPanelClassName` → chrome + `flex max-h-[90vh] flex-col overflow-hidden` (full `ModalContent` shells).
- **Unified floating panel chrome** — popovers, context menus, and modal cards share one elevation language:
  - `popoverPanelClassName` (`Popover.tsx`), `contextMenuPanelClassName` (`ContextMenu.tsx`), `modalPanelChromeClassName` / `modalPanelClassName` (`Dialog.tsx`): **`rounded-xl`**, **1px `border-base-300`**, **`shadow-xl`**, **`bg-base-100`**. Do not reintroduce ad-hoc `rounded-box` on `ModalContent` / `PopoverContent` or per-feature `PANEL_CLASS` string modules. The full popover export is `rounded-xl border border-base-300 bg-base-100 shadow-xl overflow-hidden p-0 w-[28rem]`; every desktop toolbar/pad `PopoverContent` (bookmarks, document-settings, filter, `PadTitle`) wraps in it — deliberately the sibling of `contextMenuPanelClassName`, so popovers and context menus speak one floating-surface language in light and dark.
- **Modal height ownership** — default max height lives on `modalPanelClassName` (`90vh`). Compact dialogs (e.g. profile peek) override once via `openDialog` / `ModalContent` `className` (`userProfileDialogOpenConfig`: `max-h-[min(80vh,28rem)]`); do not stack a second cap on the inner content shell.
- **Blur policy:** **Dialogs** — frosted scrim (`motion-safe:backdrop-blur-sm` on `modalBackdropClassName`). **Bottom sheets** — same `--modal-scrim`, **no blur** (`.react-modal-sheet-backdrop` in `document-styles.scss`). **Popovers / context menus** — no page scrim (anchored dismiss only). Blur does not fix wrong scrim color; fix color first.
- **New overlay surfaces** must pick the existing species (popover panel, context menu, modal, sheet, extension imperative popover) and reuse its tokens + motion tier from §Motion System — not a third border radius or shadow stack.

### Motion System (motion v1)

- **Tokens live in two lockstep homes.** CSS: `:root` in `apps/webapp/src/styles/_entry.scss` (`--motion-overlay-in: 120ms`, `--motion-overlay-out: 80ms`, `--motion-panel: 200ms`, `--motion-region: 220ms`, `--motion-ease-enter: ease-out`, `--motion-ease-exit: ease-in`). JS mirror: `apps/webapp/src/utils/motion.ts` (`MOTION_*_MS`, `MOTION_DIALOG_IN_MS` 180 / `OUT` 150, `PANEL_TWEEN`, `prefersReducedMotion()`) — the `--motion-region` token is CSS-only (no JS mirror). Update the mirrored tokens together; do not invent new duration/easing values per surface.
- **Tiers.** Overlays (popovers, menus, selects): 120ms ease-out enter, opacity + scale 0.96 from the anchored side; exit 80ms ease-in opacity-only (context menus and tooltips dismiss instantly). Tooltips: 100ms opacity-only, never scale. Dialogs: backdrop 150ms fade, card 180ms scale-0.96 from center, exits 150ms. In-page panels / status chrome: 200ms. Content/region reveals: 180–240ms via the shared keyframes `doc-region-in` (opacity + 4px rise) and `doc-content-in` (opacity only), applied as `motion-safe:animate-[…]` Tailwind utilities.
- **Shared primitives, not bespoke wiring.** Every React Floating UI surface animates through `apps/webapp/src/components/ui/useOverlayTransition.ts` (`useOverlayTransition`); hosts that animate scale MUST pass `transform: false` to `useFloating` (left/top positioning) or the scale clobbers translate positioning. Conditional mounts that need an exit fade use `apps/webapp/src/hooks/useEntryExitTransition.ts` (double-rAF enter so the from-frame paints; transitionend + fallback-timer exit — transitionend never fires under `display:none` or reduced motion).
- **Hard rules.** Opacity-only on/above ProseMirror hosts and sticky/visualViewport shells — no transforms (containing-block + caret hazards). Never `transition-all`; always an explicit property list. One-shot reveals must not replay on re-render (gate with an `onAnimationEnd` flag or a deliberate keyed remount; display-toggles restart CSS animations). `.animate-badge-entry` keeps `animation-fill-mode: backwards` — `forwards` sticks the end transform and clobbers co-existing translate utilities.
- **Reduced motion is layered, not one switch.** CSS entries: `motion-safe:`. JS-driven motion (Floating UI transition styles, framer-motion): `prefersReducedMotion()` / `<MotionConfig reducedMotion="user">` in `_app.tsx` (covers `motion/react` consumers including react-modal-sheet — `motion` is its peer dep), because inline styles beat CSS PRM rules. Functional delays keep their timing under PRM and drop only the motion (the skeleton pill's 1.5s anti-flash hold has a PRM keyframe override in `_entry.scss`). daisyUI vendor motion overrides (countdown roll, drawer) live in one auditable block in `_daisyui.scss`. Decorative infinite loops are PRM-gated; `.loading` spinners stay (status, not decoration).
- **floating-popover engine contract (published).** `hide()` plays the skin's exit: removes `.visible`, defers `root.remove()` until transitionend with a 150ms fallback, and `show()` during an in-flight exit cancels the pending removal; `destroy()` removes immediately. `updatePosition()` sets `transform-origin` from the resolved placement. The skins in `extension-hyperlink/src/styles.css` and `extension-hypermultimedia/src/styles/media-toolbar.css` restate 120/80/0.96 + a PRM block as literals (publish boundary — webapp tokens never cross into extension CSS); the webapp re-skin in `styles.scss` stays lockstep. Any engine/skin change rebuilds both extensions and gets a CHANGELOG entry each. The hypermultimedia toolbar appends before flagging `hm-has-toolbar` (rAF) and defers removal 100ms, or its fades never play.

### Slug Page Entry And Skeletons

- **The page gate is provider presence only.** `DocumentPage` renders the layout when `settings.hocuspocusProvider` is set (synchronously at provider creation; nulled on destroy). Channel fetches, `join_workspace`, profile arrival, and sync state must never re-gate the tree — once mounted, the editor is never unmounted for the same document. `joinedWorkspace` means the join RPC _succeeded_, not started.
- **Pre-sync mounts.** The layout exists before first `onSynced`. Any hook under `useEditorAndProvider` that reads the Ydoc/ymetadata once (not event-driven) must early-return while `settings.editor.providerSyncing` is true — wired in `useInitializeNewDocument`, `useHandleDraftOnFocus`, `useCheckUrlAndOpenHeadingChat`.
- **Provider lifecycle on doc switch.** Recreate the provider AND the Y.Doc (`useYdocAndProvider` nulls `providerRef` in cleanup and tags the ydoc by documentId) — a reused Y.Doc merges the old document's content and its `needsInitialization=false` into the new room. A 15s first-sync watchdog (per documentId, skipped while status is `offline`) sets `providerStatus: 'error'`; `SyncErrorCard` in `EditorContent` renders on `providerSyncing && status ∈ {error, offline}` and self-heals on a later `onSynced`.
- **Skeleton doctrine.** `SlugPageLoader` is server-rendered as a page sibling keyed on `!hasProvider`, prop-pure (`isMobile`, `isAuthed` from GSSP — never store reads, which land post-paint). Its geometry mirrors the real layout pixel-exact: headers are `h-14`, `ToolbarSkeleton` bones match the real control sizes (select 160×32 `rounded-field`, buttons `size-8`), the document bones carry the `_blocks.scss` sheet styling (`max-w-4xl mx-auto bg-base-100 border rounded-md`), the wrapper carries `overflow-y-auto scrollbar-custom scrollbar-thin`, and `TableOfContentsLoader` mirrors the TocHeader row. `EditorContentSkeleton` is the single bones component shared by the page skeleton and `EditorContent`, so the S0→S1 swap doesn't move a pixel. Verify skeleton↔real geometry in the browser at ≥1280px and as both anon and authed — narrow viewports and the anon header mask real drift.
- **Skeleton visual language.** Text-line bones: bare `.skeleton` (base 0.25rem radius). Control-shaped bones: `rounded-field`. Circles: `rounded-full`. Media/card bones: `rounded-box`. Square bones use `size-*`, not `h-* w-*`. The `_daisyui.scss` base-radius override MUST stay scoped `:not([class*='rounded-'])` — it is unlayered CSS and otherwise silently squares every `rounded-*` bone (layers lose to unlayered regardless of order). `EditorContentSkeleton`'s root is a layout shell, NOT a `.skeleton` — a root slab swallows its own bones on surfaces without a bg override (mobile has no `.pad .editor` sheet SCSS). The status pill is CSS-delayed (`doc-region-in … 1500ms both`) — never JS timers, which cannot run in the pre-hydration window the pill exists to cover.
- **emoji-mart never loads at page module scope.** `utils/ensureEmojiData.ts` owns init (idle-scheduled; `ensureEmojiData(true)` from CHAT_OPEN / CHAT_COMMENT) and must be the first init emoji-mart sees, or its components self-fetch data from a CDN.

### Collab Provider Status

- `ProviderStatus` lives in `types/collab.ts`: `saved`/`synced`/`saving`/`error`/`offline`/`unauthenticated` — no fake `online` state.
- Shared helpers, wired only by `useYdocAndProvider`: `@utils/providerCollabStatus.ts` (predicates + `getNeedsAuthCopy()` — "Session expired" copy only when the auth store had a profile), `@utils/openInlineSignInDialog.tsx` (the one pad/document sign-in shell; do not fork through the profile modal), and `@utils/collabProviderLifecycle.ts` (auth/disconnect constants + pure helpers).
- Pre-sync terminal states render `SyncErrorCard` (render condition and self-heal in §Slug Page Entry And Skeletons); post-sync auth-stops render the shared `SessionExpiredBanner` (document + history parity). Keep the pre-/post-sync split.
- `ProviderSyncStatus` stays outside the editor (`role="status"` is OK there — never inside `.ProseMirror`, per §Editor Performance).

### Landing Page Shell And PWA

- Landing `/` is SSG with deferred anon auth via `routePolicy.ts`; `document-styles.scss` is dynamic-import only when `documentShell`.
- Mobile landing compact layout tracks keyboard visibility via `useVirtualKeyboard({ activeMq: HOME_MOBILE_MQ, clearStoreOnDisable: true })` + global `isKeyboardOpen` from `applyVirtualKeyboardToStore()` — **not** slug input focus; slug-focus scroll-into-view stays in `useVisualViewportCssSync` only. Do not reintroduce `useHomeKeyboardCompact` or a second `matchMedia` gate when `activeMq` already owns the mobile breakpoint.
- The mobile landing shell is pinned to the visual viewport (`max-sm:fixed` + `--visual-viewport-offset-top/left` / `--visual-viewport-width`, the same `.mobileLayoutRoot` pattern) so the iOS keyboard can't scroll it off-screen; `useVisualViewportCssSync` extends its iOS `scrollTo(0,0)` reset to the landing route and dropped the focus `scrollIntoView` centering.
- Reject `interactive-widget=resizes-content` — it's a global viewport-meta change that fights the editor's overlay machinery and is unreliable on iOS.
- `HomeCollapseRegion` collapses via `grid-template-rows` `0fr↔1fr` (not `max-height`) with `min-h-0` so the footer flex child reaches `0px`, using direction-aware easing `homeRegionEase(compact)` (collapse → `--motion-ease-exit`, expand → `--motion-ease-enter`) + `HOME_REGION_DURATION`.
- **PWA Workbox + CSP:** service-worker `fetch()` for cross-origin images/audio/video is gated by `connect-src`, not `img-src`/`media-src` — default next-pwa rules can break any remote avatar/embed URL despite `img-src https:`. Fix in `config/pwa/workbox-runtime-caching.js` only: rule 13 (cross-origin catch-all) skipping `image`/`audio`/`video`/`script` is load-bearing (the `script` skip stops the SW `NetworkFirst` from throwing an uncaught `no-response` when an ad blocker/CSP rejects a cross-origin `gtag.js`/`widgets.js` — GA `<script onError>` swallows the plain load failure); same-origin-only rewrites on rules 3/5/6 are defense-in-depth — do not enumerate OAuth/media CDNs in `connect-src`. `next/image` (`/_next/image`) stays SW-cached same-origin; raw cross-origin `<img>` bypasses the SW and uses browser HTTP cache only.
- Workbox `urlPattern` matchers must be self-contained (next-pwa serializes via `Function.toString()` — no module-scope refs); verify a matcher change under **Node** (the actual Next build runtime), never `bun -e` — Bun's `Function.prototype.toString()` re-serializes with `const` bindings inlined, so a matcher that reads `const isSameOrigin = …; return !isSameOrigin` reads back mutated and throws a false serialization/assertion failure that Node (source-accurate) passes.
- Deploy-boundary chunk/SW GlitchTip noise: `chunkLoadRecovery.ts` one-shot reload (10s `sessionStorage` cooldown) + `instrumentation-client.ts` `beforeSend` drops SW-lifecycle and auto-recovered chunk errors — keep the chunk pattern lists in sync across both. Rebuild the webapp for `sw.js` changes.

## Document Features

### Document Version History

- Hocuspocus history uses stateless `history.list` / `history.watch`.
- Server unicasts `{ msg: 'history.response', type, response }` to the requesting connection. Do not use `broadcastStateless`.
- Prisma always uses the collab room document id (`document.name`).
- If the client sends a different `documentId`, respond `history_failed`.
- Current `history.list` returns `{ versions, latestSnapshot }` in one RTT. Client still accepts legacy plain `HistoryItem[]`.
- `applyHistoryItemToEditor` is the single TipTap hydration path.
- `loadingHistory` clears only after successful apply, not merely after a network response.
- `useHistoryEditorApplyWhenReady` applies when the editor mounts after data arrives.
- While `pendingWatchVersion` is set, do not re-apply stale `activeHistory`.
- Late `history.list` must not reset pending watch state or hydrate from `latestSnapshot` over that watch.
- On `history_failed`, clear `pendingWatchVersion` so the next watch is not dropped.
- Shareable revision URLs use same pathname/query plus `#history?version=<n>`, where `<n>` is `HistoryItem.version`.
- URL helpers live in `components/pages/history/historyShareUrl.ts`: `parseHistoryHash`, `buildHistoryShareUrl`, `replaceHistoryHashVersion`.
- Without `#history?version=`, the sidebar treats the latest version as active.
- Every entry to history page, including editor <-> history navigation, must resync sidebar selection from current hash + store.

### TOC And Heading Chrome

- TOC code lives under `components/toc/`.
- Keep `tocClasses.ts` in sync with `styles/components/_tableOfContents.scss`.
- `--color-docsy` equals `var(--color-primary)` in both `@theme` and `:root`; it tracks DaisyUI light/dark/high-contrast themes.
- Heading widgets live in `TipTap/extensions/HeadingActions/plugins/`.
- Heading-action styling lives in `styles/components/_heading-actions.scss`.
- **Sheet-edge dock for heading chat + body-selection comment (half in / half out on the pad outline).** Heading hover uses `.ha-wrap` (PM decoration on each `h1–h6[data-toc-id]`); non-heading text selection uses desktop-only `selectionChatPlugin` (`HeadingActions/plugins/selectionChatPlugin.ts`), which appends a direct child of `.tiptap__editor` with classes `ha-comment-btn` + `ha-selection-comment-dock` (`HEADING_ACTIONS_CLASSES.selectionCommentDock`). Both species must straddle the same vertical sheet border — chip center on the 1px outline, not floating in the prose gutter or fully outside the sheet.
  - Shared horizontal math lives in `_heading-actions.scss` as `$ha-sheet-border-straddle-x`: `translateX(calc(var(--tiptap-inline-pad-end) + 0.5px + 50%))` where `50%` is half the chip width (`$ha-hit-size` / `size-11` = 2.75rem).
  - **Anchor reference differs by mount point:** `.ha-wrap` uses `right: 0` on the full-width heading (prose column right edge); `.ha-selection-comment-dock` must use `right: var(--tiptap-inline-pad-end)` on `.tiptap__editor` — same prose edge, because `right: 0` on the sheet is already one pad-end inset. Reusing the straddle transform from the wrong anchor double-counts pad-end and misplaces the chip. Vertical: the selection dock sets `top` in JS from selection `from`/`to` viewport coords vs `.tiptap__editor.getBoundingClientRect()`.
  - **When changing pad sheet outline, editor horizontal padding, or chip size, update together:** `--tiptap-inline-pad-end` on `.tiptap__editor` in `_blocks.scss` (must stay in lockstep with `EditorContent` `px-6` / `sm:p-8`), `$ha-hit-size` + `$ha-sheet-border-straddle-x`, `.editorWrapper` `padding-inline-end` straddle gutter in `_blocks.scss`, heading `padding-right: $heading-chat-gutter`, and verify both heading hover + body selection in the browser.
  - Do not mount the selection chip on `ProseMirror`'s parent or use inline `right: 9px` — that regresses to selection-adjacent placement. `overflow-x: visible` on `.editorWrapper` is load-bearing so the outside half paints. History read-only hides both `.ha-wrap` and `.ha-selection-comment-dock` (`_blocks.scss` `.history_editor`).
- `$ha-hit-size` is shared with plugins.
- `$ha-group-has-unread` owns the DRY `:has()` selector for unread tray visibility.
- `_unread-badge.scss` only styles `[data-unread-count]` on `.ha-chat-btn` (the notification bell uses the React `<UnreadBadge>`). Do not add `.toc__chat-trigger` or `.ha-group` rules there.
- TOC uses React `UnreadBadge` only.
- `UNREAD_SYNC` clears `data-unread-count` on `.toc__chat-trigger`.
- Active chat icon uses `toc__chat-icon--active` with `fill: none`; Lucide icons are stroke-based.
- When nested `ul.toc__children` lives under the parent `li`, folded subtrees hide with `&.closed > .toc__children { display: none }`.
- Fold state still comes from editor state, not CSS alone.
- TOC data path:
  - `components/toc/hooks/useToc.ts` throttles heading-driven rebuilds with `lodash/throttle`;
  - flat heading list converts to recursive `NestedTocNode` through `buildNestedToc`;
  - `TocDesktop` / `TocMobile` own roots;
  - `useHeadingScrollSpy.ts` debounces scroll/active-heading work with `lodash/debounce`.
- **TOC trailing rail.** `TocHeader` and `TocItemDesktop` share `TocRowTrail.tsx`: chat/unread is pinned at `--toc-trail-inset` (12px); avatars sit left of chat in a `flex-row-reverse` cluster so icon x-position never shifts with presence or unread width. A width-only spacer (`tocTrailingRailPx`) keeps titles from underlapping the cluster. Nested rows pass `data-depth` on `.toc__row`; `_tableOfContents.scss` extends width/margin via `--toc-scrollbar-gutter` (11px), `--toc-nest-indent` (16px), and `--toc-list-inset` (16px) on `.tiptap__toc`. TOC `ScrollArea` uses `preserveWidth={false}` + `hideScrollbar` so the list client width matches the header. Do not reintroduce chat at `left-0` of a variable rail, inline row width math in TS, or `data-present-users-count` width loops.
- **TOC chat trigger is `<button type="button">`** (was `<span onClick>` inside `<a>`) for keyboard + a11y semantics; same pattern as mobile. The desktop row shell is `.toc__row` in `TocItemDesktop` — drag handle, title link, and chat trigger are **siblings** (never nest `<button>` inside `<a>`). The chat hover SCSS selector is `&:hover > .toc__row .toc__chat-icon`, NOT the deeper `&:hover > a > span > .toc__chat-icon` — the rail DOM broke the original deeper selector. `usePresentUsers` MUST filter `profile?.id` and `useMemo` (matches `PresentUsers.tsx`); without it the row gets an extra avatar and the rail width inflates.
- **TOC menus + drag.** Right-click/long-press menus share `@components/ui/ContextMenu` primitives (`contextMenuPanelClassName`, `ContextMenuRow`, `ContextMenuDivider`, `MenuItem`); mobile uses the same row/divider shell via `ContextActionsMenu`. The panel is Tailwind `flex flex-col list-none`, not daisyUI `menu` — `.menu` only styles direct `button`/`a` children, so `<span>` rows need `group`/`cursor-pointer`/`group-hover:bg-base-300`. Dividers are empty `<li role="separator">` with `bg-base-300 h-px my-[4px]` on the li — never inner divs, daisyUI `divider`, or `border-t` under `.menu`. The drag grip is inline `shrink-0`, **hover-only** (same pattern as `.toc__chat-icon`; keyboard via `:focus-visible` only). The level picker is shared `TocLevelPicker` (H1–H6). Flat-schema `moveSection` moves the whole section — drag E2E order assertions belong on `h2[data-toc-id]`. The TOC rebuild gate is `transactionRequiresTocRebuild` in `components/toc/utils/headingTransaction.ts`.

### Heading Fold Crinkle

- Crinkle uses widget decorations with `data-fold-phase` for CSS animation.
- Unique `Decoration.widget` keys per phase force ProseMirror remount so animation fires:
  - `fold-${id}-folding`;
  - `fold-${id}-unfolding`;
  - `fold-${id}`.
- Width spans the full sheet with `margin-left/right: calc(-1 * var(--tiptap-inline-pad-end))`.
- Timing uses SCSS variables `$crinkle-fold-duration` and `$crinkle-easing`, not CSS custom properties.
- `Decoration.node` on heading-section was removed; animations live on the widget.
- Strip count uses `MIN_FOLD_STRIPS`, `MAX_FOLD_STRIPS`, and `CONTENT_HEIGHT_PER_STRIP` in `heading-fold-plugin.ts`.
- If `MIN_FOLD_STRIPS === MAX_FOLD_STRIPS`, strip count is fixed regardless of content height.

### Document Comments

- Document comments are first-class `messages.type = 'comment'` rows with `metadata.comment` holding `CommentAnchorV1` (`v:1`, `text`|`media` kinds). File map: types in `types/comment.ts`, anchor helpers in `services/commentAnchor.ts`, preview parsing in `utils/commentPreview.ts` with the TipTap adapter in `mediaPopovers/buildCommentPreview.ts`, reference chrome in `utils/commentReferenceTheme.ts`.
- Send via `sendCommentMessage`; the composer draft is `CommentMessageMemory` (`Profile | null` user). `publishDocumentComment` → `CHAT_COMMENT` (`services/chatEvents.ts`) → `openCommentComposer` in `services/openHeadingChatroom.ts` — distinct from `CHAT_OPEN` browse via `openHeadingChatBrowse`.
- Pad comment entry: heading hover/selection widgets + the media toolbar (`mediaComment.ts`) → `publishDocumentComment`. Desktop body-selection chip positioning is coupled to the sheet-edge dock geometry — see §TOC And Heading Chrome.
- **Jump-to-doc targets the anchored content, not the heading:** `ReferenceJumpButton.onJump` → `scrollToCommentAnchor(anchor)` (`utils/scrollToCommentAnchor.ts`) finds the media node by `node_type`+`src` (ring-selects it with a PM `NodeSelection` — PM-managed, so no foreign DOM mutation / node-view reload, and no `editor.focus()` so no iOS keyboard) or the text run by content, centers it, and only falls back to `scrollToHeading(heading_id)` when the editor is unmounted or the target is unresolved. Do not revert to heading-only scroll.
- Feed/composer chrome: shared `ReferenceJumpButton` — reply = `border-l-info` + `Icons.reply`; comments = `Icons.comment` with border/surface/emphasis from `commentReferenceTheme(anchor)` (text selection → primary; media → per-`MediaNodeType` brand tokens in `MEDIA_COMMENT_META`, e.g. YouTube `#FF0000`, X `base-content`). Media preview goes through the shared `CommentPreviewVisual` at `components/CommentPreviewVisual.tsx`; `CommentAnchorPreview` stacks thumbnail above label/excerpt (the parent passes `theme`; text anchors ignore it). Feed cards stay compact and non-interactive (no inline players in Virtuoso).

### Document Filters

- Active filter terms live in URL path segments after the doc slug (`/docSlug/term1/term2?mode=and`); `useApplyFilters` bridges `router.query.slugs` + `mode` → the HeadingFilter PM plugin (`applyFilter` / `clearFilter`) and mirrors chips in `settings.editor.filterResult`.
- Apply when `router.isReady`, the editor instance exists, `!loading`, and `!providerSyncing` — **never** poll the DOM for `.pad.tiptap … [data-toc-id]` readiness; the mobile pad is `mobileLayoutRoot tiptap` without `.pad`, so that selector silently blocks mobile sheet apply.
- All shallow filter URL math belongs in `@utils/filterRoute` (append/remove/reset/mode, deduped segments); shallow `router.push` uses pathname+search+hash via `shallowPathFromAsPath`, not a full origin URL.
- Typeahead suggestions use PM `matchSections` in `filterTypeahead.ts` (same section rule as the filter engine), not a heading-only DOM scan.
- Surfaces: desktop `FilterPanel` popover; mobile TocModal footer → `filters` sheet (`FilterSheet` reuses `FilterPanel` with `variant="sheet"`, dismiss via `useDismissPanel` after apply/clear); active chips + mobile-visible Reset on `FilterBar` (`MobilePadTitle`); active-state indicators on the desktop toolbar and TocModal footer (`filter-active-indicator*`). No `filter-mode` body-class toggle — filter state is URL-only.

### Bookmark And Notification Panels

- Shared stack: `PanelSurfaceShell` → `TabbedPanelBody` + `PanelPopoverHeader`, `PanelFeedItem`, `useDismissPanel`, `useFeedItemExit` (80ms `MOTION_OVERLAY_OUT_MS` exit before row removal).
- Mark-as-read/remove/archive: optimistic tab badge + header count first, API in parallel — the exit micro-animation must show and tab/header badges must drop immediately, not after the API round-trip or a global loading lock. Notification `readDedupe` skips the double realtime decrement.
- Notification store: `setNotifications` replaces (never prepends); the pagination effect must not depend on the `notifications` Map.
- Bookmark tab badges come from `get_bookmark_stats`: **unread = non-archived + unmarked** (In Progress only); `get_user_bookmarks` is tab-scoped (`p_marked_as_read` / archived flags). Badge mutations use ±1 (`adjustBookmarkTabCount` / `decrementNotificationCounts`), never loaded list length.
- The sheet `variant` dismisses on View via `closeSheet()`; `BookmarkItem` "View in chat" dispatches `CHAT_OPEN` only — no `closeSheet()` / `activeSheet` checks (`NotificationItem` parity). Feed modules: `useBookmarkPanelFeed`, `useNotificationPanelFeed`.
- The mobile sheet variant adds swipe-between-tabs via `usePanelTabSwipe` wired into `TabbedPanelBody` (sheet-only; the desktop popover path stays `if (!isSheet) return body`): finger-follow `translateX`, commit past ~22%/48px, rubber-band at edges (no wrap), scroll lock during the horizontal drag, `transitionend` + fallback at `MOTION_PANEL_MS`, reduced-motion skips transforms. Keep `key={activeTab}` stable (gate the fade by class, not key) so a mid-swipe horizontal lock never remounts the list.

## Chatroom And Messaging

### Optimistic Message Lifecycle

- Client generates a UUID v4 via `crypto.randomUUID()` in `utils/clientMessageId.ts` and carries it from optimistic insert through Postgres INSERT to realtime echo. The same ID is reconciled in place; there is no remove + re-add.
- Do not reintroduce the literal `'fake_id'` placeholder. Two rapid sends collide in the store map and corrupt the optimistic UI.
- `MessageStatus = 'pending' | 'sent' | 'failed'` lives in `types/message.ts`. Server-fetched rows omit the field and are treated as `sent` (`status === 'sent' || !status`). No runtime `MESSAGE_STATUS` const; the literal type alone gives compile-time safety.
- `useReadCursor.advance` skips rows where `status !== 'sent'`; pending/failed optimistic rows must not advance the read cursor. The hook is monotonic (greatest()-on-server) and 1s-debounced, so callers can fire on every scroll tick.
- **Read-cursor advance is viewport-driven, not at-bottom-only.** `ChatList.onScroll` calls `advance(seq)` for the last fully-visible message on every scroll tick; `useChannelMessages.onInitialVisible` fires one rAF-polled seed after `data.replace` settles. Reducing this to an at-bottom-only signal regresses the Telegram-style UX (messages read while scrolling up never clear).
- **`advance_read_cursor` recomputes `unread_message_count`** in the same UPDATE that bumps `last_read_seq` (plus stamps `last_read_update_at`); without the recompute the TOC badge desyncs forever. The TOC `<UnreadBadge>` and `<JumpToPresentButton>` both read `useUnreadCount(channelId)` (not raw `channels.*.unread_message_count` alone). `useUnreadCount` prefers `optimisticUnreadStore` while the user is reading in-view; `ChatroomContext` decrements on viewport cursor advance and `useCatchUserPresences` reconciles via `setOptimisticUnread` on `channel_members` postgres_changes — clear the map entry when the server count lands. `JumpToPresentButton` renders `max(unreadCount, newCount)` so persisted unread and session-local arrivals stack onto one chip.
- **`lastOptimisticSeqRef` MUST seed from `channel_members.last_read_seq`** once `isChannelDataLoaded` flips true. The ref tracks "highest seq the user has visually crossed in this session"; if it starts at `0`, the first `onLastVisibleIndexChange` walk-backward counts every loaded message as newly crossed and decrements `optimisticUnread` by the entire window — opening a chatroom with many unread instantly zeros the badge. Seed from the persisted server cursor (`useChatStore.channelMembers.get(channelId).get(userId).last_read_seq`) so the walk only counts messages past the cursor (actual unread). Guard the seed with `if (lastOptimisticSeqRef.current > 0) return` so a later effect re-run doesn't undo session progress. Also: the store is named `optimisticUnreadStore` — never reintroduce `optical*` spellings.
- Send path: composer routes through `ChatroomContext.send` → `useSendMessage.send`, which appends a `pending` row to Virtuoso's `data` and INSERTs directly via `persistChatMessage()` in `sendChatMessage.ts` (no `sendMessage` API on first send). On error, flips to `failed`; the postgres_changes INSERT echo flips it to `sent` via `useChannelRealtime`'s in-place merge. **Media sends:** `validate_message_medias()` requires each path to exist in `storage.objects` before INSERT/UPDATE — upload-then-send is load-bearing. Gate with `composerSendGate` / `isUploading` in the composer; confirm storage with `ensureChatMediaInsertReady()` in `chatMediaStorageReadiness.ts` inside `persistChatMessage` / `retryChatMessage`; edit/comment paths probe via `ensureOutboundStorageReady()` in `outboundMessagePipeline.ts`.
- **Own-send always scrolls to tail.** `data.append([optimistic], () => 'smooth')` is unconditional — the user follows their own message down even when scrolled up to re-read history. The `atBottom`-gated "don't yank" rule applies ONLY to others' arrivals in `useChannelRealtime`. Reverting to `({ atBottom }) => atBottom ? 'smooth' : false` here regresses Discord/Slack/Telegram parity for own sends.
- Duplicate-key classification is centralized in `components/chatroom/utils/postgresErrors.ts::isDuplicateKeyError`. Both `persistChatMessage` and `retryChatMessage` import it; do not inline PgError code/message checks.
- Retry path: failed-row tap → `ChatroomContext.retry(clientId)` → `useSendMessage.retry` → `retryChatMessage()` in `sendChatMessage.ts` (the only remaining caller of the `sendMessage` API). Re-issues with the original client UUID; 23505 duplicate-key is treated as success (the row was already persisted on a prior attempt). Returns `PersistChatMessageResult`; the caller (`useSendMessage.retry`) owns the pending/sent/failed UI flip against Virtuoso's data.

### Message Grouping Projection

- `TGroupedMsgRow = TMsgRow & { isGroupStart, isGroupEnd, isNewGroupById, isOwner }`. Grouping flags are computed render-time in `ChatList/ItemContent.tsx::samePrev` against Virtuoso's `prevData`; never persisted, never written into `api/messages/*` types.
- Do not reintroduce a projection utility (`utils/projectMessageGroups.ts` and `utils/groupMessages.ts` are both gone) or an in-store mutation that writes grouping flags back onto rows. Out-of-order realtime arrivals and pagination merges corrupt flags whenever they're materialised.
- **Notification rows break grouping.** `ItemContent.tsx::samePrev` excludes `prevData.row.type === 'notification'` — without that exclusion, a notification chip between two same-author messages renders the post-notification message in `compact` mode (no avatar/header). The chip itself is `ChatList/SystemNotifyChip.tsx`, dispatched on `data.row.type === 'notification'`; `metadata.type` branches `user_join_workspace` / `channel_created` / `user_join_channel` (last one returns null — the workspace-join chip already records first appearance).
- Virtuoso's `data` store is the single source of truth for in-view message rows; there is no parallel Zustand `channelMessagesStore`. Derive the newest seq from `useChannelMessages.newestSeqRef`; do not re-walk the list to compute it on hot paths.
- `MessageCardContext` must memoize its context value object (`useMemo`). A fresh object identity on every parent render cascades re-renders through every `MessageCard`.
- `MessageFooter` self-hides on `status === 'failed'`. Consumers (`DesktopEditor`, `ChatContainerMobile`) render `MessageCard.FailedRow` for owner rows and must not re-gate on `status`.
- **Desktop author-group left edge:** `DesktopMessageBody` always renders a fixed `w-10 shrink-0` leading rail (avatar on group-start, hover timestamp on compact) beside a shared `flex-1` content column — compact rows must not drop the rail; mobile non-owner compact rows keep a `size-10` spacer (`MobileMessageBody`). Every desktop card is full-width/cohesive (`w-full px-3` + hover/bookmark); media tiles self-cap via `CHAT_MEDIA_MAX_WIDTH_CLASS` — do not reintroduce the bespoke media-only card (`w-fit max-w-[min(400px,90%)] px-0 hover:bg-transparent`). Chat-bubble grouping is mobile-only.

### Chatroom List (Virtuoso)

- **`ItemLocation` is index-based.** `VirtuosoMessageList`'s `data.replace` and `scrollToItem` accept `{ index: number | 'LAST', align, behavior }`; the string `'lastItem'` and id-based `{ id, … }` shapes silently no-op behind the EmptyPlaceholder. Resolve a numeric index from the items array via `findIndex`; never wallpaper the call with `as any`.
- **Layout contract.** `.message-feed` is `flex min-h-0 flex-1 flex-col overflow-hidden`; Virtuoso owns the scroll, not the wrapper. `<VirtuosoMessageList style={{ height: '100%' }}>` so the scroller fills the parent. Reverting `.message-feed` to a plain block + `overflow-y-auto` re-introduces an ~9000 px scroller stretch with items rendered far below the visible panel.
- **Panel resize bypasses React during drag.** `useResizeContainer.doDrag` writes `containerRef.current.style.height` directly and dispatches `CustomEvent('chat-panel-resize-tick', { detail: height })`; `useAdjustEditorSizeForChatRoom` listens and mirrors to the editor wrapper's `marginBottom`. Single `setOrUpdateChatPanelHeight(lastHeight)` commit on `stopDrag` drives localStorage + the post-drag Virtuoso re-measure. Per-mousemove Zustand writes cascade through every `state.chatRoom` subscriber → Virtuoso ResizeObserver → `bottom-smooth` thrash at 60Hz; direct-DOM avoids that.
- **Sticky day chip uses `getBoundingClientRect`, not `offsetTop`.** `StickyDayHeader` reads the topmost visible `[data-msg-date]` element via rAF-throttled `querySelectorAll` against the scroller. Virtuoso positions each item `absolute` inside a per-item wrapper, so `node.offsetTop` is 0 relative to that wrapper and the topmost-detection loop would always return the first item regardless of scroll. Visibility is scroll-driven with a `HIDE_AFTER_MS = 1500` idle fade — `data-msg-date` is stamped on the message card outer div + inline `DateChip` + `SystemNotifyChip` wrappers.
- **Hover-menu integration (Floating UI + Virtuoso).** The four pieces are coupled and easy to misdiagnose individually — keep all of them in mind when any one breaks:
  1. **Visibility tracking → `IntersectionObserver`, not `getBoundingClientRect` polling.** Virtuoso items mount with transient/zero rects; a one-shot mount-time rect check sticks at `false`, which gates `useHover.enabled`, which silently disables the menu until the user scrolls. Bookmarked rows that mutate after mount (BookmarkIndicator + reactions render late) have the same failure mode without the scroll workaround. IntersectionObserver fires on initial paint _and_ on layout-driven intersection changes; both bugs collapse into one fix. Use `threshold: [0, 0.5, 1]` (not just `0.5`) so the first callback fires regardless of starting ratio.
  2. **`boundary` on `flip`/`shift` → `.message-feed`, not `.group/chat`.** The boundary defines the rectangle the floating menu cannot physically extend past. The panel-wide rect includes the toolbar and composer; a menu sitting _over_ the toolbar still fits inside the panel and won't trigger flip. `.message-feed` excludes both — top-of-feed messages flip to `bottom-end`. `position: fixed` can't be constrained by z-index or `overflow: hidden`; this is the only thing that actually keeps the menu inside the visual feed.
  3. **Portal target → `<div id="chat-hover-portal">` inside `ChatroomPanelLayout`.** Default `FloatingPortal` mounts at body root, which puts the menu in the root stacking context where nothing inside the panel can compete. Portaling inside the panel lets `JumpToPresentButton` (`z-40`) sit above the menu (`menuClassName="z-30"`) when both occupy the bottom-right region.
  4. **`safePolygon({ buffer: 8 })` + `delay.open: 100ms`.** `buffer: 1` required pixel-precise mouse paths from message → menu and felt broken; the user-visible complaint is "I have to exact-focus the message." 8px is the Floating UI example range. 100ms open beats 200ms perceptually without admitting accidental hovers.
- **`Header` / `Footer` slots require stable, module-scope component refs; changing values flow through the `context` prop, NOT through closures.** Toggling the component reference itself (`Header={loadingOlder ? Loader : undefined}`) silently fails — Virtuoso re-mounts the slot but the closure captured before the remount never updates, so the inner spinner never reaches the DOM even though the `loading` state cycles correctly for the full RTT. `ChatList.tsx` defines `ChatListHeader` / `ChatListFooter` at module scope, adds `loadingOlder` / `loadingNewer` to `ChatListContext`, and reads them via `{ context }` in the slot props to drive `PaginationLoader` (top for older, bottom for newer). `MessageFeed.tsx` threads both flags through. Do not revert to inline-`useMemo` Header/Footer factories.

### Chatroom Realtime

- **Per-channel topic.** `useChannelRealtime` subscribes to `chatroom:${channelId}` for postgres_changes (INSERT/UPDATE on `messages`) plus broadcast events. Anon viewers receive the same events as authed — the source-table RLS (`messages_visible_select` / `messages_public_anon_select`) gates per-row, and anon's anon-JWT carries `role = 'anon'` so the `TO anon` policy matches. If realtime appears broken globally on `chatroom:*` topics, suspect `realtime.messages` RLS (`07-3-notification-broadcast.sql:109`) — a missing topic policy can block subscription authorization at the WS layer.
- **Own-send rise (Telegram-style).** `msg-send-in` (transform-only `translateY(8px)→none`, layout-neutral so Virtuoso measurement is untouched) plays on `DefaultMessageBody` while `status === 'pending'` — the discriminator that excludes history, pagination, and others' arrivals for free; retry re-adding `pending` replays it (wanted). Opacity stays owned by the pending dim. Do not animate Virtuoso item wrappers (they position via transform).
- **Row-merge preserves RPC-computed columns.** `useChannelRealtime`'s drain uses `incomingRow.user_details != null` as the discriminator: present → RPC-hydrated row (`fetch_message_window` / `fetch_messages_since`), authoritative; absent → raw `postgres_changes` payload, graft `user_details` + `is_bookmarked` + `bookmark_id` from the existing in-memory row. Those columns are JOIN-computed in the RPCs, never on the `messages` table, so postgres_changes UPDATEs (reactions, edits, soft-deletes) can't carry them — without the graft, reactions blank the avatar AND wipe the bookmark indicator. Both merge sites (UPDATE drain + optimistic→echo arrival merge) must stay in lockstep.
- **Catchup is paginated.** On `SUBSCRIBED` / `online` / `focus`, `useChannelRealtime.catchUp` loops `fetch_messages_since(p_since_seq = newestSeqRef)` until a page returns fewer than `CATCHUP_PAGE = 100` rows or `MAX_PAGES = 20` (2000-row cap) fires. A single-shot 100-row call silently drops gaps on busy channels after multi-hour disconnects. On cap-overflow the loop warn-logs and bails; the next user-initiated `snapToPresent()` resyncs from tail.
- **Soft-delete broadcast contract.** `handle_message_soft_delete` trigger emits `realtime.send({id, channel_id}, 'message:deleted', 'chatroom:' || channel_id, FALSE)` on the `NULL → NOT NULL` transition only. `private=FALSE` because anon viewers can't observe the postgres_changes UPDATE — the anon SELECT policy filters `deleted_at IS NULL`, so the realtime layer drops the event whose NEW row state fails the policy. Authed members receive both signals; `deleteBufferRef` is a `Set` so the duplicate is idempotent. The PRIVATE-channel info-leak (id-only payload to anyone who knows the channel UUID) is accepted; revisit if private-channel activity timing ever becomes sensitive. Topic and event name must not change without bumping the FE listener in `useChannelRealtime`.
- **Deep-link bridge.** `Chatroom.tsx` resolves the Virtuoso anchor as `deepLinkMessageId ?? store.chatRoom.fetchMsgsFromId ?? URL.msg_id`. All four in-app entry points (`BookmarkItem`, `hrefEventHandler`, `NotificationItem`, `usePushNotifications`) feed `fetchMsgsFromId` through `setChatRoom`; shared links land via `?msg_id=`. Without any source, anchor falls back to `first_unread`. `useChannelMetadata` independently passes the same `startMsgId` to `fetchChannelInitialData` for anchor-existence validation — the duplication is intentional, surfaces invalid deep-links as a user-visible error rather than silently falling back to tail.
- **Peer read cursor for sender check-marks.** Seed `peerReadSeq` from `get_channel_aggregate_data.peer_max_read_seq` at bootstrap; advance on private realtime topic `chatroom-read:{channelId}` event `read:advanced` (emitted by `advance_read_cursor`). `MessageSeen` uses `message.seq <= peerReadSeq` — do not drive check-marks from per-message `readed_at`. Reconnect catch-up re-seeds `peer_max_read_seq` via the same aggregate RPC (`useChannelRealtime.refetchPeerSeq` on the `online` window event).
- **`chatroom-read:{channelId}` topic split is load-bearing.** Two channels per chatroom: public `chatroom:{id}` carries postgres_changes + `message:deleted` broadcast (so anon PUBLIC readers receive them); private `chatroom-read:{id}` carries the `read:advanced` broadcast only. `realtime.send(..., 'chatroom-read:...', true)` requires the `chatroom_read_topic_access` RLS policy on `realtime.messages` (members-only via `substr(topic, 15)` → `channel_members.channel_id`). Folding `read:advanced` back onto the public topic leaks per-user read positions to anyone holding a channel UUID; merging postgres_changes onto the private topic breaks anon PUBLIC-channel realtime. The FE `useChannelRealtime` subscribes both channels independently; the readChannel is gated on `currentUserId` (anon doesn't subscribe).
- **`peer_max_read_seq` is members-only.** `get_channel_aggregate_data` gates the `MAX(last_read_seq)` query inside `IF is_member_result THEN ... END IF;` so anon viewers + authed non-members on PUBLIC channels receive `NULL` — not a leak of who's actively reading. The corresponding FE seed in `bootstrapStore` ignores non-numeric values.
- **`advance_read_cursor` uses `FOR UPDATE`.** Without the row lock, two concurrent calls (open tab + mobile, double-click) can interleave SELECT/UPDATE and write a stale `unread_message_count`. The `greatest(last_read_seq, p_up_to_seq)` keeps `last_read_seq` itself monotonic, but the recomputed unread can flap. Pair the lock with the existing 1s FE debounce in `useReadCursor` — both layers are required.

### MessageComposer

- **Canonical row (mobile + desktop): `[ + ] field [ 😊 ] [ 🎤/✈ ]`** — no `@` or separate Aa/attach buttons in the row (type `@`; mention is also in the format toolbar). The left **`ComposerInsertMenu`** opens on mobile tap / desktop hover; rows = Attach file, Text formatting (toggles the format bar), Record voice when send is showing. **`ComposerPrimaryAction`** switches mic ↔ filled **`variant="primary"`** send when `canSend`, and renders `null` during voice preview (the bar owns attach). **`VoiceNoteButton`** / **`ComposerOverflowMenu`** stay deleted.
- Voice: **`useVoiceRecorder`** + **`VoiceRecordingBar`** — hold to record, slide-left cancel, slide-up lock, inline preview → **`AttachmentStrip`**; local state only.
- Mobile shell is flat (no composer `border-t` / format-panel `border-b`): **`.composer-bar--mobile`** — `items-center`, `min-h-11`, ProseMirror **`2.75rem`** scoped under that class (not viewport `sm:`); touch targets via **`isMobile`** → 44px mobile / 32px desktop; compact **`AttachmentStrip`** with full-tile retry on failed uploads.
- Format toolbar: shared **`components/Toolbar/formatToolbarLayout.ts`** — groups **B I S `</>` | Link @ | • 1. | Quote CodeBlock**; mobile **`ComposerFormatPanel`** is a 5×2 grid; desktop uses inline **`FormattingToolbar`**; format tooltips use **`placement: top`**.
- Attach: **`useComposerAttachInput`** is shared by **`AttachButton`** and the insert menu.
- After submit, refocus the editor only if it was the active element. Otherwise `editor.chain().clearContent(true).focus('start').run()` force-opens the iOS keyboard right after a `SendButton` tap and produces a visible bounce. Enter-key submits keep focus naturally.
- `useEditor(...)` in `components/chatroom/components/MessageComposer/hooks/useTiptapEditor.ts` captures `workspaceId` / `channelId` / `isToolbarOpen` in the `onUpdate` closure. This is masked only because `Chatroom.ChannelComposer` remounts on channel key change and drafts never cross. If the composer mount is ever made persistent (a tempting perf win), drafts will silently corrupt across channels — fix with a refs pattern or lift `setComposerStateDebounced` into a `useEffect` keyed on the ids.
- `prepareContent` must return a stable `chunks` shape (`{ htmlChunks: string[], textChunks: string[] }`) on both the happy and empty paths so callers never need an `as` cast.
- **Draft vs mode memory.** Text/HTML drafts live only in IndexedDB (`messageComposerDB` via `syncComposerDraft` / `discardComposerDraft`); Zustand `*MessageMemory` holds reply/edit/comment UI modes only — do not reintroduce `messageDraftMemory`.
- **Post-send draft clear.** Successful send must call `discardComposerDraft` (cancels trailing debounced IDB writes, then deletes the row). A trailing debounced write after clear resurrects sent text when the user reopens the chatroom.
- **Formatting toolbar session scope.** Toolbar defaults closed; expanded state is `sessionStorage` via `composerToolbarSession.ts` (per workspace+channel, current tab session only) — not IndexedDB.
- **Anon Enter opens sign-in.** `useComposerSubmit` calls `openComposerSignIn(channelId)` when `!user` — same entry as `SignInToJoinChannel`; do not let Enter silently no-op for visitors.
- **No per-keystroke state in `MessageComposerContext`.** Context exposes transition-only `canSend` (via `composerSendGate` in `MessageComposer` — text, ready attachment count, edit-with-media, upload/error flags), plus stable handles (`editor`, `submitMessage`, attachment callbacks) and reply/edit/comment memory. Never put the `attachments` array or upload progress in context — `AttachmentStrip` subscribes to `composerAttachmentsStore` directly. `SendButton` reads `disabled={!canSend}`; `useComposerSubmit.isSubmittable` re-checks at click-time. Never re-add `text` or `html` to the context type.
- **`composerAttachmentsStore` read paths:** use exported `selectComposerAttachmentsByKey(key)` (private module `emptyAttachments` fallback) — never inline `state.byKey[key] ?? []` in Zustand selectors; a fresh `[]` each snapshot triggers React `useSyncExternalStore` infinite-loop (#185). `useComposerAttachmentList` is the canonical read hook; `useComposerAttachments` reuses it.
- **`EmojiPanel` is host-agnostic.** The shared `chatroom/components/EmojiPanel/` accepts `{ variant: 'desktop' | 'mobile', onSelect: (native: string) => void }`. The old `usage` discriminator (`composer-inline | reaction | desktop`) and its central exhaustiveness `switch` are deleted; `Selector.tsx` reads only `{ variant, onSelect }` from `EmojiPanelContext` and never imports `useComposerEmojiPanelStore` or `emojiReaction`. Each call site owns its own dispatch: `DesktopLayout` (desktop picker, two-mode `emojiPicker.eventType` reactToMessage vs caret insert with click-time `getState()` for stable callback identity), `ChatContainerMobile` (reaction overlay → `emojiReaction(selectedMessage, native)` + `closeEmojiPicker`), and `ComposerEmojiPanel` (composer-inline → `editor.chain().insertContent(native).run()` + auto-collapse to peek). Adding a new emoji surface = a new `<EmojiPanel variant=… onSelect={…}>` mount; do not re-add a central usage discriminator.
- **`ComposerEmojiPanel` is composer-owned, not a sheet.** Lives at `MessageComposer/components/ComposerEmojiPanel/`, driven by `composerEmojiPanelStore` (`MessageComposer/stores/composerEmojiPanelStore.ts`; `peek` ↔ `expanded` mode, idempotent `open()` that snapshots `useStore.keyboardHeight` once into `peekHeightPx` so the panel renders at the right height after `blur()` resets keyboard-height to 0, plus `history.pushState({ composerEmojiPanel: true })` for back-button dismiss). The store deliberately lives in the composer subtree, not in `EmojiPanel/` — moving it back re-couples the host-agnostic panel to composer dispatch.
- **Animated panel + emoji-mart grid: animate outer height, fixed inner shell.** `ComposerEmojiPanel` animates `motion.div` `height: 0 → targetHeight` (`PANEL_TWEEN` from `@utils/motion`, 200ms ease-out) so the parent flex column absorbs the change cleanly via `flex-1` on the chatroom feed; the inner content is wrapped in a `style={{ height: expandedHeight }}` div so emoji-mart's grid measures its container once and never reflows during the tween. Animating height directly on the picker subtree thrashes layout/paint on the emoji-mart grid every frame. Apply the same outer-tween + fixed-inner-shell pattern to any future animated surface that hosts a measurement-sensitive virtualized grid.
- **Mobile formatting-toolbar taps.** The composer editor runs `shouldRerenderOnTransaction: false`, so `FormattingToolbar` must call `useReRenderOnEditorTransaction(editor)` or mark buttons (Bold / Code block / etc.) keep a stale `isActive` highlight after a toggle. The composer toolbar `ui/Button` (`ToolbarButton`) wires `onTouchEnd` (gated on `editor && type && onPress`) alongside `onClick`, because on iOS a tap on a toolbar button while the editor is focused often never fires the synthesized `click`; `handleClick` dedupes via a `touchPressRef` so touch + click never double-run, and `SendButton` (`type="submit"`, no `editor`) intentionally skips the touch path. `ToggleToolbarButton` (the format-bar toggle) stays plain `onPress={toggleToolbar}` — never `preventDefault` on `pointerdown`, which suppresses the synthesized click on iOS WebKit and leaves the bar stuck open.
- **Overlay contention (Escape and Enter).** Composer overlays are mutually exclusive — `dismissComposerOverlays.ts` (which includes `stopComposerVoiceRecording()`) closes the others when one opens. Escape unwinds in order: link dialog → emoji → mention → reply/edit. `useHandleEscKey` (composer reply/edit/comment) bails when `isMentionSuggestionPopupVisible()` is true so the first Escape closes the picker and the second clears reply/edit; the same helper gates Enter-send blocking. Do NOT `stopPropagation` Enter in `useTiptapEditor` — Mention's own `onKeyDown` needs the key; only `preventDefault` the send while the popup is `isConnected` and visible. Mention active state comes from `getMentionPickerActive()` (Floating UI visibility) — `getMentionPickerActive()` and `isMentionSuggestionPopupVisible()` are distinct helpers; keep both.

### Chat Media Attachments

- Slack/Discord/Telegram pattern — pre-upload to storage, path-only `medias jsonb` at INSERT (`messageMediasForInsert` in `messageMediaPaths.ts`); signed URLs are resolved lazily in `chatMediaUrl.ts` via `useMediaSignedUrl` / `useFeedMediaDisplayUrl`; `uploadChatMedia.ts` stores path-only (no upload-time sign). Upload-then-send is load-bearing — gating and readiness probes are specified in §Optimistic Message Lifecycle.
- Limits: 10 MB / 10 files / 3 concurrent uploads. MIME + extension allowlists stay in lockstep across `chatMediaMime.ts`, `12-buckets.sql`, and `validate_message_medias()` (no SVG); bucket `allowed_mime_types` must be **NULL** for "allow all" — `{*/*}` only matches the literal type and rejects real uploads.
- The hocuspocus doc-media endpoint (`apps/hocuspocus.server/src/api/services/media.service.ts` `ALLOWED_MIME_TYPES`) must stay a **superset** of the chat allowlist, or **copy-to-doc** re-host (`copyChatMediaToDocument.ts` → `POST /plugins/hypermultimedia/:documentId`) 415s for any chat type the doc rejects (this is what broke voice-note / non-PDF copy-to-doc — the doc list was images+video+audio+PDF only).
- **Copy-to-doc node building has two further traps:** build the doc media node from the chat media's authoritative `media.type` (`copyChatMediaToDocument.ts`), never re-detect from the re-hosted blob's content-type — a `.webm` voice note re-classifies as `video` (the `webm` extension maps to `video/webm`), producing a `video` doc node and a wrong comment-anchor `node_type`; and only append the message-body text node to the copy-to-doc paragraph when it is non-empty (`useCopyMessageToDocHandler`), since ProseMirror's `schema.text('')` throws `Invalid JSON content` for media-only messages (voice/image/file with no caption). Also send the storage upload's content-type as the bare MIME (`resolveChatMediaMime` strips `;codecs=…`), since `MediaRecorder` voice notes are `audio/webm;codecs=opus` and the bucket matches the bare type only.
- `GifPickerButton` / `MediaFilterToggle` are **temporarily unmounted** — re-enable by restoring the mounts; `cypress/e2e/chatroom/attachments.cy.ts` still clicks `[data-testid="chat-media-filter"]` until then.
- `AttachButton` disables at the 10-file cap; uploads run via `useComposerAttachments` + `chatMediaUploadRunner.ts` with client downscale (inline in `chatMediaUploadRunner.ts`, max 2048px, skip gif/heic, 512KB threshold); drafts live in IndexedDB; runtime state in `composerAttachmentsStore`. `AttachmentStrip` and `AttachButton` subscribe via `useComposerAttachmentList` / the store — never via `MessageComposerContext`; attachment **actions** go through `ComposerAttachmentActionsContext` / `useComposerAttachmentActions()`. Per-key store isolation on channel switch — do not blanket-clear attachments.
- Feed: `MessageMedia*` tiles + `deriveMessagePresentation` in `messagePresentation.ts`; media-only mode in `channelFeedProjection.ts` (`feedMode`, `shouldIncludeMessageInFeed`, `feedWindowRpc`, `feedCatchupRpc`) wired through `useChannelRealtime`, `useChannelMessages`, and `useSendMessage` optimistic gating.
- Multi-image collage: up to **4** tiles + `+N` via `getChatMediaCollageLayout` (Telegram/Discord layouts, `object-cover` cells). Lightbox/player: root `ChatMediaGallery` via `chatMediaGalleryStore` (`openGallery` / `openVideo`); signed-URL failures surface `MediaUnavailable` + retry. Reply/edit bars use `ContextBarMediaThumb`.
- Soft-delete GC is server-only (`internal.delete_chat_media_paths` trigger) — no client storage delete on persisted message soft-delete. The storage-DELETE `set_config` requirement, the 10 GB workspace quota trigger, the media-storage stats RPC typing, and the daily orphan-cleanup pg_cron job live in §Supabase.

### Mention Picker

- **4-layer split (mirror hyperlink, do not import across features).** `MessageComposer/helpers/suggestion.ts` owns the popup host + `autoUpdate` + `ReactRenderer` create/destroy + TipTap key routing; `MentionList.tsx` owns debounced RPC + selection + keyboard API; `MentionSuggestions.tsx` + `MentionSuggestionRow.tsx` own the Discord-style listbox + a11y; `mentionTypes.ts` owns shared types, `EVERYONE_ENTRY` (`id: 'everyone'`), and helpers `showEveryoneForQuery` / `isMentionSuggestionPopupVisible` / `mentionOptionId` / `MENTION_LISTBOX_ID`. Do not add a Zustand store, SQL function, or shared suggestion package for it.
- **Popup anchors to `[data-chat-composer-surface]`** (set on the desktop inner composer card and mobile composer wrapper), `placement: 'top-start'`, width 98% of the surface with 1% inset each side; `autoUpdate` tracks the surface, NOT the `@` caret. Discord/Telegram-style wide picker above the editor. When the surface marker is missing, log a warning so `@` doesn't fail silently. Do not bring back caret-following `bottom-start` / `shift` or `min-w-[280px]`.
- **`@tiptap/suggestion` Escape contract.** The plugin runs `onExit` / `dispatchExit` ONLY when `onKeyDown` returns `false`. Returning `true` for Escape leaves the plugin alive (`state.active === true`) even after manual DOM removal — the picker silently won't reopen. Always return `false` for Escape and route ALL teardown through `onExit` → single `destroyPopup()` path; never manually remove the DOM on Escape.
- **RPC contract.** Direct `searchWorkspaceUsers({ workspaceId, username: query })` with 150ms debounce + a `cancelled` flag for stale-response guard — NOT `useApi`. Anon / non-member visitors skip the RPC entirely (Notify-only row when query matches `everyone`). Members list filters `u.id !== currentUserId` so the user never sees themselves; `@everyone` Notify is unaffected. Type the response as `PostgrestResponse<FetchMentionedUsersRow>` from the generated `Database` types — NOT the `[][]` generic (Supabase RPC typing pitfall). On RPC error, set `fetchError` and surface "Couldn't load members" in the Members section instead of empty list. Insert payload stays `command({ id, label: item.username })` — `label` MUST be username (or `'everyone'`), never display name; notification SQL matches plain text.
- Window-level Escape/Enter contention with reply/edit and send is owned by the merged overlay-contention rule in §MessageComposer; Mention's `onKeyDown` behavior above is one half of that contract.
- **Mention notifications (SQL).** Chat mention and `@everyone` notifications are driven by plain-text `messages.content` (composer `getText()` / sanitized text), not TipTap mention HTML attrs — SQL in `10-func-notifications.sql` regex-matches **full** `@username` tokens with word boundaries (`@harvey` does not match `harvey_marzban`) and `@everyone` there.
- `sanitizeMessageContent` / `sanitizeChunk` allow only `href`, `target`, and `rel` on spans — not `data-id`, `data-type`, or `class` — so stored message HTML may not retain mention attrs; feed tap-to-profile via `useMentionClick` needs an explicit DOMPurify allowlist extension, not picker UI alone.
- A Postgres `42501` on `notifications` INSERT during an @mention send means a trigger function lost `SECURITY DEFINER` — see §Supabase.

### Anonymous Chat Read Path

- **Anon visitors get read-only PUBLIC chat.** Anon can call every read path — `fetch_message_window`, `fetch_messages_since`, `get_channel_aggregate_data`, channel/user/message SELECTs — and hydrate the local Zustand store; the anon RLS policies and SQL functions handle `auth.uid() IS NULL` explicitly so the read path renders cleanly without any FE early-return.
- **Media tiles need storage SELECT, not just message RPCs.** Anon lurkers and non-member authed viewers on PUBLIC channels resolve `createSignedUrl` against `storage.objects` — the `"Anon can read public channel chat media"` / authed lurker twin policies in `12-buckets.sql` must qualify `objects.name` (see §Supabase storage EXISTS rule). Message hydration succeeding while thumbnails show `MediaUnavailable` usually means storage RLS denied the sign, not a webapp gate.
- **Writes must gate on `auth.uid()` at the entry point.** `useChannelMetadata` skips `upsertChannel` + `joinChannel`, `useSendMessage` short-circuits via `onAuthRequired`, and `useReadCursor.advance` no-ops when uid is null. Do not gate inside the RPC bodies; do not let RLS 403s reach the FE as toasts. Authenticated writes assume the channel/member rows exist.
- **Anon-only UI is hidden, not disabled.** The Bookmarks popover in `EditorToolbar.tsx` is gated `{user && <Popover>…</Popover>}`; `ChatroomToolbar/components/NotificationToggle.tsx` early-returns `null` when `useAuthStore.profile?.id` is falsy. Hide at the component (or wrapping popover) so the trigger never invokes an RPC that would 401 — don't render a disabled button that toasts on click.
- **Async-handshake success paths resolve their own loading state.** `useOnAuthStateChange.signInAnonymously` calls `useAuthStore.setSession(data.user, true)` on success (which flips `loading: false` in the store) — it does NOT wait for the post-signin `SIGNED_IN` event. The `onAuthStateChange` handler intentionally omits `SIGNED_IN` from its branches to avoid profile-refetch thrash on tab focus / token refresh in older Supabase versions; relying on it would leave anon visitors stuck on "Loading workspace" forever. General rule: when a sign-in / handshake call returns the resulting session data, terminate the loading state at the call site, not via a secondary event listener.
- **Anon viewers subscribe to the same `workspace:${workspaceId}` realtime channel** as authenticated users (handled in `useCatchUserPresences.ts`) so presence join/leave + broadcast events flow into `useStore.usersPresence` and every `AvatarStack` surface — TOC header, TOC items, pad header `PresentUsers`, chatroom `ParticipantsList`, message `UserReadStatus` — renders the same set of online users an authed viewer would see. Anon must NOT call `track()`: they observe only, never broadcast themselves into presence state. Do not split anon onto a separate `anonymous:*` channel — presence is per-channel-name and a parallel channel would silently miss every broadcast. **TOC heading avatars key on broadcast `channelId`, not native presence track** — cold-open tabs (anon or authed) must handle `presence` `sync`, and on subscribe / `requestPresenceSync` / peer `join` existing viewers re-broadcast open chat via `shareHeadingPresenceWithRoom` in `services/workspacePresenceSync.ts` (600ms debounce per channel topic — do not remove or late joiners miss heading stacks until someone switches chat). `buildPresenceSyncPayload` must seed the responder's open `headingId` into the sync payload when their row is missing from `usersPresence` (native Supabase presence track carries no `channelId`). **`settings.broadcaster`** is set only after a guarded authed `track()` in `useCatchUserPresences` and cleared on effect teardown/offline — chat open/switch uses `sendPresenceBroadcast` in `workspacePresenceSync.ts` (not a duplicate store helper).
- **`AvatarStack` consumers filter the current user out, never gate on `usersPresence.size`.** Authed `track(profile)` puts self in the map; anon never tracks so the map is already just other viewers. Size-based guards (`size <= 1`) hide the stack from anon when one auth peer is present. The right shape is `Array.from(usersPresence.values()).filter(u => u.id !== profile?.id)` then render when the remainder is non-empty — works for both auth (drops self) and anon (no-op).
- **Clear `usersPresence` on every (re)subscribe.** `useCatchUserPresences` calls `clearUsersPresence()` at the top of its subscribe effect before opening either the anon or authed channel. This drops stale `ONLINE` entries from the previous channel (anon→authed sign-in, workspace switch, `online`-event reconnect) so the next subscription's `presence` `sync` snapshot is the authoritative state.
- **Anon's TOC badge re-purposes `unread_message_count` as a channel-activity hint** because anon has no per-user read cursor. Both `useMapDocumentAndWorkspace.fetchChannels` (initial) and `channelMessageCountsUpsert` (realtime) write `channel_message_counts.message_count` (channel TOTAL) into the store's `unread_message_count` field. This is intentional — don't "fix" it. Both write paths must auth-gate (`if (profile?.id) return`) so authenticated users keep the real per-user value from the `channel_members` subscription.
- **`fetch_message_window` returns `anchor_seq=null` for `first_unread` when no real unread exists** — anon viewers (no `channel_members` row) and authed users caught up to tail. SQL still windows around tail (so the view loads correctly); the FE only inserts the "Unread messages" sentinel when `win.anchor_seq != null`. Reverting this so anon/caught-up users see a sentinel before their tail message is a regression — the divider is meaningless without a read cursor.

### Chatroom Staged Skeleton

- Toolbar chrome renders immediately; feed + composer show skeleton until bootstrap completes. The sole public gate is **`isFeedReady = isChannelDataLoaded && !messagesLoading && !errorMsg`** in **`ChatroomContext`** — **`initLoadMessages`**, **`isFeedLoading`**, and **`messagesLoading`** were removed from the context contract.
- During load, mount the real **`ChatList`** under an absolute skeleton overlay so Virtuoso **`listRef`** attaches (avoids a load deadlock).
- Skeleton palette (chatroom feed/composer and slug-page skeletons alike — see §Slug Page Entry And Skeletons): doc-style neutral **`.skeleton`** bars plus **at most one** pale `color-info` accent per feed via **`color-mix(in oklch, var(--color-info) ~18–20%, var(--color-base-300))`** — never media-tinted, bubble-shaped, or brand-colored media bones.
- Mobile: top-anchored scrollable ~15 rows; desktop: bottom-anchored panel. Modules live under **`components/chatroom/components/skeleton/*`**; breadcrumbs come from **`buildHeadingPath.ts`** / **`resolveHeadingBreadcrumbs()`**.
- On RPC error, skeletons drop with the error badge — no skeleton/error mismatch.

## Backend And Infrastructure

### HTTP Modules

- New backend HTTP features go to the `hocuspocus.server` app (`@docs.plus/hocuspocus`, Hono), not webapp `pages/api/`.
- New endpoints live under `apps/hocuspocus.server/src/modules/<feature>/`:
  - `domain/`: pure logic and pipeline stages.
  - `http/`: controller, router, zod schema.
  - `infra/`: Redis cache and external SDK adapters.
  - `__tests__/`: unit and integration tests.
- A `module.ts` exports `init({ deps }): { router }`.
- `src/index.ts` mounts with `app.route('/api/<path>', module.init({ ... }).router)`.
- Modules must have no top-level side effects.
- The link-metadata feature was migrated out of `webapp/src/pages/api/metadata.ts`; do not reintroduce server endpoints there.
- Link-metadata vocabulary is `stage`, never `tier`.
- Stages are cache -> oembed -> special (host handlers) -> htmlScrape -> fallback.
- `STAGE_TIMEOUT_MS` and the base User-Agent constant live in `domain/types.ts`.
- Host handlers live under `domain/stages/handlers/`.
- `htmlScrape` appends `facebookexternalhit/1.1`; Reddit uses the plain base UA `DocsplusBot/1.0`. Keep them intentionally different.
- Test files mirror source filenames one-to-one, e.g. `htmlScrape.ts` -> `htmlScrape.test.ts`.

### Hocuspocus Server

- `HOCUSPOCUS_THROTTLE_BANTIME` is **minutes** (`@hocuspocus/extension-throttle` multiplies ×60×1000 — `60000` ≈ a 41.7-day ban).
- The BullMQ `store-document` `jobId` includes a Yjs state fingerprint so a final disconnect flush is not deduped away inside the 10s window.
- Pad editor file uploads hit `POST /plugins/hypermultimedia/:documentId` — the cap is `DO_STORAGE_MAX_FILE_SIZE` (bytes) on `rest-api`; canonical **`10485760`** (10 MB, matches `mediaUploadLimits.ts`). Mis-set **`0`** or tiny values like **`4000`** (~4 KB, a port/unit mix-up) yield `PAYLOAD_TOO_LARGE` / "0.00MB max" — verify live via `docker compose … exec rest-api env | grep DO_STORAGE_MAX_FILE_SIZE` (`.env.production` on the server is source of truth; `Notes/` backups may differ).
- Compose gives shell env vars precedence over `--env-file`, and a running container keeps its baked value until recreated, so a corrected env only takes effect on `up -d --force-recreate rest-api` (or the next deploy).
- `media.service.ts` `resolveMediaMaxFileSize` **floors any value under 1 MB** (`MIN_PLAUSIBLE_MEDIA_MAX_FILE_SIZE`) to the 10 MB default with a startup warn — a mis-set env can no longer brick uploads; `env.schema.ts` still coerces `0`/invalid as the outer layer.

### Admin API And Dashboard

- Admin media-storage REST: `GET /api/admin/audit/media-storage/summary` (standalone rollup) and `GET /api/admin/audit/media-storage` (Zod `mediaStorageQuerySchema`; one fleet RPC returns `{ summary, data, pagination }`; `scope=all` exports the filtered fleet, capped at 10k rows). List/search/sort/paginate logic lives in `adminMediaStorage.service.ts`.
- **`@docs.plus/admin-dashboard`** `/storage` uses summary + paginated list — the same `StatCard` / `DataTable` / `useTableParams` shell as the dashboard's other audit pages (e.g. `pages/documents/stale.tsx`); it talks to hocuspocus REST on `NEXT_PUBLIC_API_URL` (port 4000 locally).
- Admin access is a `public.admin_users` row checked via the `is_admin` RPC.

### Production And Docker Compose

- Production uses `docker-compose.prod.yml` with Traefik.
- Dev compose backend services need `context: .` at repo root to match `Dockerfile.bun`.
- Hocuspocus image:
  - `migration-extensions.ts` imports `@docs.plus/extension-hypermultimedia` and `@docs.plus/extension-inline-code` at runtime.
  - Root `.dockerignore` excludes `**/dist`.
  - Those packages must be built inside the image; copying only package.json stubs is not enough.
  - Other `@docs.plus/extension-*` packages may stay stubs for lockfile/workspace only.
- For prod WebSocket issues, check `hocuspocus` container health and `docker logs` before chasing Traefik.
- Traefik's no-router response is `HTTP/2 404`, `text/plain`, `content-length: 19`, body `404 page not found`; distinguish it from backend 404s.
- Traefik access-log filters are combined with AND. Keep `statusCodes: 400-599` alone; adding retry/min-duration filters hides fast 5xxs.
- SSR URL split:
  - `SERVER_RESTAPI_URL`: internal Docker-network base, e.g. `http://rest-api:4000/api`.
  - `NEXT_PUBLIC_RESTAPI_URL`: public browser base, e.g. `https://prodback.docs.plus/api`.
- Verify container env with:

```bash
docker compose -p docsplus -f docker-compose.prod.yml --env-file .env.production exec webapp env | grep -E 'SERVER_RESTAPI_URL|NEXT_PUBLIC_RESTAPI'
```

- `DocumentFetchError "Network error while fetching document"` only fires when `fetch()` throws: DNS, connection refused/reset, abort, or 10s timeout. It does not fire for HTTP 4xx/5xx.
- The common cause is an SSR startup race before `rest-api` accepts traffic.
- Probe SSR connectivity from inside `webapp`:

```bash
docker compose -p docsplus -f docker-compose.prod.yml --env-file .env.production exec webapp bun -e "fetch('http://rest-api:4000/health').then(r=>r.text().then(t=>console.log(r.status,t)))"
```

- Log env vars:
  - `LOG_LEVEL` / `HTTP_LOG_LEVEL`: all services.
  - `REST_LOG_LEVEL`: most important for REST route logging; set to `debug`.
  - `WS_LOG_LEVEL`: hocuspocus server.
  - `WORKER_LOG_LEVEL`: hocuspocus worker.
  - `HOCUSPOCUS_LOGGER=true`: only for collab noise debugging.
- Prisma `P3009` failed migration in REST logs is independent of WebSocket/fetch failures. Resolve it through Prisma's failed-migration flow, but it does not block traffic because entrypoint continues starting the service.
- Supabase cloud prod project ref: `tglymsfloxmouzjuoycu`.
- The observability stack lives in `docker-compose.observability.yml` (Grafana/GlitchTip/Telegram); add `GLITCHTIP_DSN` + `NEXT_PUBLIC_GLITCHTIP_DSN` to the prod `.env` after bootstrap.
- Deploy commit subject is `(build): <domains>` — canonical order `back → front → observability → uptime-kuma` (`.github/WORKFLOWS.md`).

### Supabase

- **Never edit `packages/supabase/seed.sql`.** Agents and routine changes must not modify it; use `packages/supabase/migrations/` and `packages/supabase/scripts/` only.
- **Never edit `apps/webapp/src/types/supabase.ts`.** It is generated by the Supabase CLI via `packages/supabase` script `types` (`bunx supabase gen types typescript --local` → that path).
- **Webapp types convention.** `apps/webapp/src/types/supabase.ts` is the generated source of truth; the rest of `apps/webapp/src/types/*.ts` (`api.ts`, `domain.ts`, `history.ts`, `message.ts`, `stores.ts`, `tiptap.ts`, `toc.ts`) is where derived/expanded types are authored and re-exported. Build new shared types there and import them — do not redeclare row/payload aliases inline in hooks, components, or stores. SDK types (`@supabase/supabase-js` — `PostgrestError`, `PostgrestResponse`, `AuthError`) come from the SDK directly and bypass this folder.
- **After any SQL change, regenerating types is required, not optional.** Any work that touches `packages/supabase/migrations/**` or `packages/supabase/scripts/**` ends with running `bun run --filter @docs.plus/supabase_back types` from the repo root (local Supabase + root `.env.local`) and including the regenerated `apps/webapp/src/types/supabase.ts` in the same change — the agent runs this command itself; never hand-edit the generated file.
- SQL authoring style lives in `.cursor/rules/supabase.mdc`; keep this section focused on project architecture and safety policy.
- Pages Router Supabase architecture:
  - Browser singleton: `utils/supabase/index.ts`.
  - Factory: `component.ts`.
  - GSSP: `server-props.ts`.
  - API route client: `api.ts`.
  - URL resolver: `url.ts`.
  - DB types file: `types/supabase.ts` (generated only; see above).
- Browser code imports the `supabaseClient` singleton.
- Apply a single migration locally without resetting (preserves shared local state across worktrees) with `docker exec -i supabase_db_docsplus_supabase psql -U postgres -d postgres < packages/supabase/migrations/<file>.sql`. `bunx supabase db reset` wipes everyone else's state; `supabase db query -f` does not handle multi-statement files (`SQLSTATE 42601: cannot insert multiple commands into a prepared statement`).
- **Editing an uncommitted migration file requires re-apply.** When iterating on an unmerged migration (or making behaviour-only changes to its paired `scripts/*.sql`), the file on disk diverges silently from what's running in `supabase_db_docsplus_supabase` until you re-apply. Symptoms of forgetting: FE realtime channels that subscribe with `{ config: { private: true } }` thrash retries because the server lacks the matching `realtime.messages` policy; FE features that call new RPCs / new return columns silently see the old behaviour. Re-apply via the `docker exec -i ... psql ... < migrations/...sql` form above (idempotent `drop policy if exists` / `create or replace function` make re-runs safe). If only the script changed, prefer `docker exec ... < scripts/<file>.sql` so a later `db reset` reproduces the same state.
- **Migrations and `scripts/*` are paired.** Every change applied via a migration must be mirrored in the corresponding source-of-truth `scripts/*.sql` file so `db reset` (which seeds from `seed.sql`, generated from `scripts/*.sql` by `generate-seed.ts`) reproduces the production state. Do not land migration-only or scripts-only changes for the same invariant.
- **Remote `db push` vs local reset.** `[db.migrations] enabled` in `packages/supabase/config.toml` stays `false` for day-to-day local dev (`db reset` seeds from `scripts/00-bootstrap.sql` + the generated `seed.sql`, per `[db.seed].sql_paths`). Toggle `true` only while pushing to remote, then set it back to `false` (never commit it `true`). Never delete a migration file that remote has already applied — use `supabase migration repair --status reverted <version>` if consolidating history. Bulk function catch-up for prod gaps: edit `scripts/`, run `bun run --filter @docs.plus/supabase_back generate:functions-parity-migration` (writes a timestamped migration from an allowlisted script subset; adds `DROP TRIGGER IF EXISTS` before bare `CREATE TRIGGER`). One-shot data backfills stay hand-written migrations, not in `scripts/`.
- **`db push` history divergence — repair vs push.** The remote `supabase_migrations.schema_migrations` table drifts from local `migrations/` (prod gets objects via `scripts/*` + parity migrations without a history row), so `db push` refusing with "remote versions not found" / "does not match local files" is normal, not corruption. Ground truth is `bunx supabase migration list` (Local | Remote columns; empty `remote` = not applied) — run it BEFORE any repair. `supabase migration repair --status applied <v>` only edits the history table, it does NOT run the SQL: mark-applied ONLY versions whose objects are already live on prod (the pre-last-deploy prefix). A genuinely-new migration (empty `remote`) must be **pushed**, never repaired-applied — marking it applied makes `db push` skip it forever so its objects silently never get created. Phantom remote-only versions (in remote history but never in git — check `git log --all -- migrations/<v>_*`) come from out-of-band pushes; `repair --status reverted <v>` removes the bogus row (its schema changes become untracked drift). All repo migrations are idempotent, so a clean push over partially-present objects is safe; an "already exists" error means non-idempotent SQL applied out-of-band. Do NOT blindly follow the CLI's blanket "mark applied" suggestions.
- **Migrations must ship dependencies they call.** If a migration `create or replace`s a function that calls `internal.*` helpers, those helpers must appear in the same migration or an earlier one — not only in `scripts/` (prod never runs `db reset`). Trigger functions that write other users' `channel_members` rows must end with `SECURITY DEFINER` in both `scripts/` and the migration path, or RLS column grants block inserts after `13-RLS.sql`.
- **`supabaseClient.rpc(...)` is lazy.** It returns a `PostgrestBuilder`; the request only leaves the browser when `.then(...)` / `await` / `.single()` / `.maybeSingle()` is attached. Fire-and-forget calls that drop the result (e.g. a debounced cursor advance) MUST attach `.then((res) => { if (res.error) console.warn(...) })`, or the network call silently never dispatches. Any `supabaseClient.rpc(` without a continuation is a bug.
- **Storage RLS is path-based, not column-based.** Bucket policies for `user_avatars` / `channel_avatars` check `(storage.foldername(name))[1] = (select auth.uid()::text)`, NOT `owner` (uuid) or `owner_id` (text). Storage-api v1.54.1 doesn't reliably auto-populate either column on insert; predicates against them evaluate `NULL = …` → false → 403 "new row violates RLS policy". The FE writes paths as `{userId}/{filename}` (`useAvatarUpload` uses `${user.id}/avatar.png`; `Config.app.profile.getAvatarURL` emits the matching read URL). Encoding ownership in the path is Supabase's canonical pattern and matches Slack/Discord/Linear conventions.
- **Storage bucket policies are CRUD-complete, not write-only.** Migrations that re-declare INSERT / UPDATE / DELETE policies on `storage.objects` MUST also confirm a matching SELECT policy exists. Supabase Storage runs `INSERT … RETURNING` (or INSERT followed by SELECT) on every upload, and a missing SELECT policy returns the same generic "new row violates row-level security policy" 403 that misleadingly points at the INSERT — the actual denial is on the readback. `scripts/12-buckets.sql` declares SELECT policies for `user_avatars` / `channel_avatars` / `media` (each scoped by `bucket_id` plus the same path/owner predicate as its write policies); the migration tree must keep parity. Public-URL reads (`/storage/v1/object/public/...`) take a different code path that doesn't go through PostgREST RLS, so the avatar display can work while uploads silently 403 — that's exactly how this gap survived three rounds of "fix the RLS" migrations.
- **`storage.objects` EXISTS subqueries:** inside `exists (select 1 from public.channels c where …)`, unqualified `name` binds to **`c.name`** (channel slug), not the storage row — correlate media paths with **`objects.name`** (e.g. `(storage.foldername(objects.name))[2]` for `{userId}/{channelId}/…`). Bare `foldername(name)` in public-channel chat media SELECT policies broke anon and non-member signed-URL reads; channel members still worked via the member policy.
- **Avatar source-of-truth is a two-field hybrid.** `users.avatar_url` holds the OAuth provider URL (set by `handle_new_user` from Google's `picture` claim on signup); `users.avatar_updated_at` is the "user has uploaded a custom avatar" indicator. `<Avatar>` reads `avatar_updated_at` first — if set, derives the bucket URL `${BUCKET}/${id}/avatar.png?${avatar_updated_at}` (the timestamp doubles as cache-buster); if null, falls back to `src` (= `avatar_url` = OAuth URL). `useAvatarUpload.handleUpload` overwrites `avatar_url` with the bucket URL (so after a custom upload `avatar_url` is the bucket URL, not the OAuth one); `handleRemove` nulls BOTH `avatar_url` and `avatar_updated_at` — DB-first, before deleting the storage object, so a render never points at a deleted file. Removing a custom avatar therefore drops to the default avatar; it does not restore the OAuth picture.
- **Channel/workspace IDs are `varchar(36)`, not `uuid`.** `channels.id`, `channels.workspace_id`, and `workspaces.id` are declared `varchar(36) default uuid_generate_v4()` (`scripts/04-channels.sql:5-6`) — they hold UUID-shaped text in a `varchar` column, and `messages.channel_id` follows the same typing via its FK. SQL that compares them against a real `uuid` (e.g. `auth.uid()`, a `uuid`-typed column, or a `::uuid` literal) must cast both sides to the same type or Postgres throws `operator does not exist: character varying = uuid`. This bit the chat-media storage RLS / `validate_message_medias` path, where the `media` object path segment (text) is compared to `channel_id` — keep those comparisons text-vs-text (or cast explicitly), never `varchar = uuid`.
- **`notifications` has no authenticated INSERT policy — mention/system trigger functions must stay `SECURITY DEFINER`** (`scripts/13-RLS.sql` §2i); recreating trigger bodies without re-applying `SECURITY DEFINER` breaks @mention sends with Postgres `42501` on the `notifications` INSERT (distinct from the `channel_members` rule above — different trigger family, same failure class).
- **Any SQL that `DELETE`s from `storage.objects` (the soft-delete GC `internal.delete_chat_media_paths` + `internal.cleanup_orphan_chat_media`) must first `perform set_config('storage.allow_delete_query', 'true', true)`** — Supabase's `storage.protect_delete` trigger otherwise raises `Direct deletion from storage tables is not allowed` (errcode 42501), which bubbles up and fails the whole message soft-delete UPDATE. The flag is the same one the Storage API sets; `is_local = true` scopes it to the GC transaction.
- **Chat-media quota:** 10 GB/workspace is enforced by `internal.enforce_media_workspace_quota` (a `BEFORE INSERT` trigger on `storage.objects` for `bucket_id = 'media'`); quota bytes come from `internal.media_workspace_quota_bytes()` only — stats RPCs, the trigger, and admin UI read that helper (no TS quota constant). Path aggregation is centralized in `internal.media_workspace_usage_rows()` (`split_part(path, '/', 2) = channel_id`; upload paths in `uploadChatMedia.ts`).
- **`get_workspace_media_storage_stats` / `get_all_workspace_media_storage_stats` / `get_workspace_media_storage_summary`** (`10-4-func-chat-media-features.sql`) use `workspace_id varchar(36)` with text equality — never cast channel/workspace IDs to `uuid` (see the varchar(36) rule above). Per-workspace and fleet RPC rows share the same shape (`slug`, `name`, `quota_bytes`, `usage_percent`).
- Orphaned pre-send uploads are reclaimed daily by the `cleanup-orphan-chat-media` pg_cron job (`scripts/16-cron-jobs.sql`; the migration schedules it inside a `pg_extension` guard).

## Learned User Preferences

Inbox only. New cross-cutting working-style preferences go into §Workflow And Review Expectations (or the topical section that owns the subject); append here only when no section fits, one rule per bullet, and file entries into their owning section on the next tidy.

## Learned Workspace Facts

Inbox only. New workspace facts go into the topical section that owns the subject; append here only when no section fits, one rule per bullet, and file entries into their owning section on the next tidy.
