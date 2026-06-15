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
- Long-form policy docs that an `.mdc` rule points at live in `.cursor/docs/`. Today: `.cursor/docs/scripts-naming-convention.md` (timeless rule, source of truth). One-shot migration docs may live alongside as siblings (e.g. a `scripts-naming-cutover.md`) and are deleted with the cutover PR that completes them.
- Package-internal rules that don't generalize to the repo live in **package-local `AGENTS.md`** files next to the package. Today: `extensions/extension-hyperlink/AGENTS.md` for that extension's schema, commands, safety, click/preview, and clean-room harness. Cross-package rules (release flow, scripts naming, monorepo toolchain) stay in this root file; the package file is read in addition to the root file when working inside its package.
- When guidance overlaps, keep the project-specific policy in `AGENTS.md` or `.cursor/docs/`, and the detailed authoring/reference material in the relevant `.mdc` file.

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
- Run `bun run build` after major refactors before claiming completion.
- Validate full-document paste (`⌘A` -> `⌘V`) on editor changes that can affect paste or document transforms.
- Authoring conventions and naming live under §Tests (Monorepo Toolchain).

### Skills And Prose

- Cleanup/review skills are autonomous by default. Do not gate every step; stop only when a decision is genuinely ambiguous.
- `--review` is opt-in. Default cleanup applies edits and prints one terse line per file.
- Reports are terse next-step outlines, not detailed plans.
- Real senior-level refactors are in scope under the gated-approval mechanism: exported symbol renames, typo fixes, file moves, file splits, and dependency bumps.
- True safety rules remain absolute: do not change runtime behavior for handled inputs, edit generated files, or commit directly.
- All prose work routes through `.cursor/skills/tech-writer`: README, CHANGELOG, reports, post-mortems, design docs, PR descriptions, and JSDoc/docstrings.
- Skills never create branches or worktrees. They operate in the current directory and branch.

### Documentation And Comments

- Comments and JSDoc explain non-obvious _why_, never narrate _what_. Names, types, and structure are the contract.
- Hard cap: **≤ 4 lines** per JSDoc or block comment. If you need more, the code or the name is wrong — fix that instead. No section banners, no "Why X, not Y" preambles, no restating signatures or union members in prose.
- Cleanup includes deleting comments that violate this. "I didn't write it" is not a reason to keep them.

### UI And Theme

- Theme/UI color consistency is first-class. Every surface, including third-party pickers, must follow design tokens.
- On DaisyUI-backed surfaces, prefer DaisyUI + Tailwind over bespoke nested hover/active stacks that fight parent controls.
- Use `.cursor/rules/daisyui.mdc` for daisyUI/Tailwind reference details and `.cursor/rules/react-floating-ui.mdc` for generic React/Floating UI pitfalls.

## Monorepo Toolchain

### Workspace

- **docs.plus** is a Bun monorepo. Root `package.json` workspaces are `"apps/*"`, `"extensions/*"`, `"packages/*"`: deployables (`webapp`, `hocuspocus.server`, `admin-dashboard`) under `apps/`; the five publishable `@docs.plus/extension-*` under `extensions/`; shared internals and tooling (`floating-popover`, `eslint-config`, `release-tooling`, `playground`, `supabase`, `email-templates`) under `packages/`. `apps/*` and `extensions/*` sit at the same depth as the old `packages/*`, so every extension's `../../tsup.base` / `../../tsconfig.base.json` and `apps/webapp/next.config.js` tracing root resolve unchanged; the per-package eslint shims import `../../packages/eslint-config/*`. `@docs.plus/playground` is a dev/test-only clean-room harness the extension Cypress suites consume as a `workspace:*` devDependency: a `docs-playground` bin (generates the page shell + serves it, symlinking the consumer's `main.ts` into a temp dir so Bun's HTML bundler resolves it) plus a browser `setupPlayground` helper (personalizes title/heading/tokens, wires the theme toggle, returns `#editor`). Each extension's `test/playground/` holds only `main.ts` (the editor fixture) and a 1-line `tsconfig.json` that extends `@docs.plus/playground/tsconfig.json`; `cypress/tsconfig.json` extends `@docs.plus/playground/cypress/tsconfig.json` with a local `include`. The package ships raw source (no build), is never published, and is never imported by any `src/`, so it stays out of every `dist`; its manifest is COPY'd into each Dockerfile so `--frozen-lockfile` resolves the devDep.
- Main app: `@docs.plus/webapp` (Next.js Pages Router).
- Backend: `@docs.plus/hocuspocus` / `@docs.plus/hocuspocus.server`.
- Admin UI: `@docs.plus/admin-dashboard`.
- Editor code lives under `apps/webapp/src/components/TipTap/`.
- Shared webapp utilities live in `apps/webapp/src/utils/`; `src/lib/` was removed. Keep feature-local helpers colocated. **Layer placement rules** (utils vs `ui/` vs layout shells vs feature folders) live under §Webapp UI Systems → Webapp Module Layers — follow them before adding or promoting helpers.

### Dependencies

- Root `package.json` owns shared devtool versions: ESLint, TypeScript, Prettier, Stylelint, Jest, `babel-jest`, `jest-environment-jsdom`, `@types/jest`, `@babel/preset-typescript`, and related tooling.
- Root `catalog:` centralizes pins where used. Workspaces reference matching deps as `"package": "catalog:"`.
- Do not duplicate Jest/Babel dev dependencies in package workspaces unless there is an exceptional documented reason.
- `@tanstack/react-query` is root-cataloged at v5 for webapp and admin-dashboard. Use object syntax; mutation pending state is `isPending`, while query `isLoading` remains valid.
- Stay on ESLint 9.x and TypeScript 5.x until a dedicated migration. ESLint 10 and TS 6 have breaking changes.
- Dependency update flow:
  - Bump version ranges: `bun run update` (patch + minor only; root catalog + every `packages/*`). Majors: `bun run update --upgrade`. Preview: `bun run update --dry-run`.
  - After `update`, run `bun install` at the repo root. Do not run parallel `bun update` / installs inside individual packages; shared `bun.lock` can race with `EEXIST`.
- Removed tools/scripts stay removed: per-package `update:packages`, `scripts/reinstall-packages.sh`, `reinstall:all-packages`, `update:all-packages`.

### Tests

- Unit + E2E stack: Jest and Cypress. Script names and `CYPRESS_PARALLEL` semantics are defined in the naming convention doc; this section captures docs.plus-specific orchestration, Jest wiring, and authoring conventions. Policy (when to write a test, what shapes to avoid) is in §Testing And Verification.
- Run order in `run-tests.sh` (the unit block; each extension runs its own `bun run test`):
  1. `@docs.plus/extension-indent` — Jest (local `jest.config.cjs`) then clean-room Cypress against built `dist/`.
  2. `@docs.plus/extension-hyperlink` — clean-room Cypress against built `dist/` (preceded by `bun test src` units).
  3. `@docs.plus/extension-hypermultimedia` — clean-room Cypress against built `dist/`.
  4. `@docs.plus/extension-inline-code` — clean-room Cypress against built `dist/`.
  5. `@docs.plus/extension-placeholder` — clean-room Cypress against built `dist/`.
  6. `@docs.plus/webapp` Jest (`jest --passWithNoTests`, so an empty or temporarily absent suite does not fail CI/local runs).
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
- `eslint-plugin-prettier` is removed. Only `eslint-config-prettier` is used.

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
- `extension-hypermultimedia` intentionally preserves `console.error` from its `Logger` wrapper (`src/utils/logger.ts`, error-only — `warn`/`debug` were dead weight, removed pre-2.0) under the shared tsup factory. Note logger changes in its CHANGELOG.
- **`@docs.plus/floating-popover` and `@docs.plus/floating-tooltip` are bundled into each consuming extension's `dist`, never externalized.** Both are `private` workspace packages (never published), wired as `devDependencies` `workspace:*` in `extension-hyperlink` and `extension-hypermultimedia`. Their `tsup.config.ts` `external` must stay `['@tiptap/core', '@tiptap/pm']` — do **not** add a `'@docs.plus/floating-*'` entry, or tsup emits a bare import into the published bundle that throws `MODULE_NOT_FOUND` for external npm consumers. `@floating-ui/dom` stays external (real published dep). Verify after any tsup change: built `dist/index.{js,cjs}` must contain no `@docs.plus/floating-*` import/require. Neither package ships CSS. Consumers carry lockstep skins with one split rule: `.floating-popover*` shell blocks use each package's own tokens, but the `.floating-tooltip` block is identical `light-dark()` **literals** by contract — both bundles style that one global class, and per-package tokens would let cascade order pick one bundle's look for every bubble (`scripts/extension-preflight.sh` enforces the byte parity).
- Root `LICENSE` is the single committed license.
  - Each publishable package adds `/LICENSE` to package `.gitignore`.
  - `prepack` copies the root `LICENSE` before `bun publish` or `bun pm pack`.
  - Symlinks fail because Bun pack drops them. Hard links fail because git stores independent copies.
- **Shared release scaffolding lives in `@docs.plus/release-tooling`** — an internal workspace package exposing `release-prepack` and `release-preflight` as `bin` commands. The scripts are data-driven: they derive the consumer's package name and dist-artifact list from its own `package.json` (`name` + `exports` map), so there is no per-consumer parameterization. Same DRY principle as `@docs.plus/eslint-config`, `tsconfig.base.json`, and `tsup.base.ts` — cross-package scaffolding is hoisted, never copied. Publishable libraries wire `prepack` / `prepublishOnly` to these bins per the Type 4 contract in the naming convention doc.
- Do not centralize package-specific files: `README.md`, `CHANGELOG.md`, package source, 3-line `eslint.config.js` shims, or `package.json` fields.

### Docker

- Use one Docker base tag everywhere: `oven/bun:1-slim`.
- Do not mix `1-alpine`, `1-slim`, or hardcoded patch tags.
- Do not copy `node_modules` between Docker stages. Bun uses symlinks into a virtual store; copied installs can break module resolution.
- Any stage that runs `next build`, extension builds, or config that requires deps must run `bun install --frozen-lockfile`.
- Copy only `package.json`, `bun.lock`, and the workspace tree between stages.
- Any Dockerfile stage that runs `bun run build` for `@docs.plus/extension-*` must also `COPY` the root-level shared configs `tsconfig.base.json` and `tsup.base.ts` into the build context. Each extension's `tsconfig.json` extends `../../tsconfig.base.json` and each `tsup.config.ts` imports `from '../../tsup.base'`; missing either file fails the extension build with `Could not resolve "../../tsup.base"`. Affected Dockerfiles today: `apps/hocuspocus.server/docker/Dockerfile.bun` and `apps/webapp/docker/Dockerfile.bun` (`build-extensions` stage must copy them via `--from=deps`).
- **A stage that rebuilds the workspace from a prior stage must copy all three roots, not just `packages/`.** The `apps/* + extensions/* + packages/*` layout splits the workspace, so any `COPY --from=<stage> /app/packages ./packages` must be followed by `COPY --from=<stage> /app/apps ./apps` and `COPY --from=<stage> /app/extensions ./extensions` before `bun install --frozen-lockfile`. Without the `apps/*` and `extensions/*` members the frozen install fails with `lockfile had changes, but lockfile is frozen`. Stages that wire this today: webapp `build-extensions` + `builder`, admin-dashboard `builder`, hocuspocus.server `production`. A `builder` that imports the extensions needs the **built** `extensions/` (with `dist/`) from the build stage; manifests alone are not enough.
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
- **Public-facing docs follow the family install policy and stay cohesive.** Every `extensions/extension-*/README.md` and `CHANGELOG.md` uses Bun commands (`bun add` / `bun remove`), never `npm`/`yarn`/`pnpm` — even though external consumers could use npm. Install blocks lead with `bun add <pkg>@next` during the Phase-1 alpha soak and show plain `bun add <pkg>` only as the `# stable, after promotion:` line, mirroring `extensions/README.md`. Never lead a README Install block with `npm install <pkg>` — it resolves `@latest`, empty/wrong during soak. Keep the five READMEs at structural parity: shared Install/Contributing/Family boilerplate, framework-neutral `new Editor` (from `@tiptap/core`) Quickstart — not React `useEditor` — no per-package marketing taglines, and no `chrome` in shipped prose (use "UI"/"shell"/"toolbar", same as the §Code Quality rule).
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
awk '/^## \[/{ if (found) exit; if (/^## \[<ver>\]/) found=1 } found' packages/<pkg>/CHANGELOG.md
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
  8. no-op detection via `git diff <prevTag>..HEAD -- packages/<pkg>/src/`.
- CHANGELOG style guide:
  - Themed sections per major: Highlights, Breaking, Added, Changed, Fixed, Security, Removed, Documentation, Internal.
  - Include code-diff migration guides and one-shot rename scripts for mechanical changes.
  - Disclose mispublishes/unpublishes honestly.
  - Add a brief pre-X.0 development history when public versions diverge from internal milestones.
  - Never auto-generate entries from commit subjects. Lerna/Changesets/Release-Please are not adopted.

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

- `extensions/heading-scale/heading-scale.ts` is a mandatory spec.
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

### Editor State And References

- **Store discipline.** `useStore` (the main app store in `stores/useStore.ts`) combines six slices: `workspaceStore`, `usersPresence`, `history`, `notification`, `virtualKeyboardStore`, `dialogStore`. Standalone stores (`authStore`, `focusedHeadingStore`, `sheetStore`, `themeStore`, the chat-domain `useChatStore`) live alongside but are not folded in. All `useStore` calls must use leaf selectors; never select `(state) => state` or `(state) => state.settings`.
- **Canonical editor handle:**

```ts
useStore((state) => state.settings.editor.instance)
```

- Registered by `useEditorAndProvider.ts` via `setWorkspaceEditorSetting('instance', editor)`.
- Consumers: `EditorContent.tsx`, `useTocActions.tsx`, the toolbar, collaboration-document features.
- `window._editor` is set only by `pages/editor.tsx` (standalone playground); undefined on real document/collab routes. Do not add new `window._editor` readers to document-route features.
- React mobile sheets that need an editor reference use typed `SheetDataMap` payloads (e.g. `linkPreview`, `linkEditor`), not globals.
- **ProseMirror state pitfalls:**
  - `doc.nodeAt(pos)` can throw `RangeError` for out-of-range positions. Guards must not assume null-only.
  - `transaction.before` is the pre-step document `Node`, not `EditorState`. Never call `PluginKey.getState(transaction.before)`.
  - For fold-driven UI such as TOC, snapshot heading-fold plugin state from `editor.state` and diff across transactions.

## Webapp UI Systems

### Webapp Module Layers

Webapp code is split by **responsibility**, not by “whatever folder the first consumer lived in.” Pick the layer before adding a file; do not colocate a pure helper under `@components/ui/` just because a UI component imports it.

- **`apps/webapp/src/utils/`** — app-wide **pure** code: formatters (`formatCappedCount`, `formatTime`), layout/spacing **tokens** (`sheetBodyPadding`: `sheetBodyPadClassName`, `horizontalPadBleedClass`, `sheetBodyBleedClassName`), parsers, metrics, URL helpers with no feature owner. No React, no JSX, no DOM. Re-export new shared utils from `utils/index.ts` when other packages might import them.
- **`apps/webapp/src/components/ui/`** — reusable **presentational** React components only: buttons, badges, inputs, `PanelTabBar`, `RollingNumber`, `ScrollArea`, etc. A file here must export a component (or a type props-only module tightly coupled to one). **Never** put standalone `.ts` formatters, string builders, or bleed/pad maps in `ui/`.
- **`apps/webapp/src/components/` (root, not `ui/`)** — cross-feature **layout shells and composites**: `SheetLayout`, `SheetHeader`, `SheetFooter`, `PanelSurfaceShell`, `TabbedPanelBody`, `BottomSheet`. These orchestrate children and variant forks; they are not generic atoms.
- **Feature folders** (e.g. `TipTap/hyperlinkPopovers/utils/`, `chatroom/utils/`) — logic owned by one feature (`urlFieldInput`, `postgresErrors`, `collectHeadings`). Promote to `@utils/` only when **two or more unrelated features** need it with no feature-specific contract.
- **Shared types** — cross-surface variants in `apps/webapp/src/types/` (e.g. `PanelSurfaceVariant` in `types/ui.ts`). Feature-owned types stay in that feature's `types.ts`.

**DRY for formatters and caps:** one canonical implementation (today: `formatCappedCount` for display caps like `99+`). Do not inline `count > 99 ? '99+' : String(count)` in new code; wire existing call sites when touching them.

**Tailwind token maps:** pad/bleed class strings that must stay JIT-literal live in a utils module (`sheetBodyPadding.ts`), not on a React shell (`SheetLayout`). Shell components import tokens from `@utils/sheetBodyPadding`.

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

### Mobile Bottom Sheets

- The canonical mobile sheet system is `apps/webapp/src/components/BottomSheet.tsx`, wrapping `react-modal-sheet`.
- Sheets register through `useSheetStore` with `SheetType` + `SheetDataMap`.
- New mobile UI surfaces add a `SheetType` variant, a typed `SheetDataMap` entry, and a React subscriber.
- Tiptap extension imperative-DOM popovers connect to React sheets through extension `popovers` config, gated by `settings.deviceDetect.isMobile` in `TipTap.tsx`.
- Do not build parallel imperative-DOM bottom sheets next to the React + Zustand sheet system.
- Keyboard dismissal is a per-sheet entry-point decision. Do not globalize it in `useSheetStore` or `BottomSheet`.
- Keep the keyboard up for chatroom composer and `linkEditor`. The composer emoji panel mounts inline (not as a sheet variant); `emojiPicker` is no longer a `SheetType` / `SheetDataMap` entry / `useBottomSheet.openEmojiPicker` flow. `CHATROOM_OVERLAY_SHEETS` is gone with it. Do not reintroduce an `emojiPicker` sheet variant for the composer surface.
- Dismiss the keyboard for `linkPreview` and chatroom open paths: `CHAT_OPEN` / `CHAT_COMMENT` in `services/eventsHub.ts`.
- A single synchronous `editor.view.dom.blur()` is not reliable; it can lose the race against queued ProseMirror focus.
- Proven dismiss patterns:
  - `useClipboard.ts` style: collapse selection, then `setTimeout(50)` and `editor.view.dom.blur()`.
  - `exitDocEditModeForSheet` in `eventsHub.ts`: `editor.setEditable(false)` plus `editor.view.dom.blur()`.
- `editor.setEditable(false)` synchronously flips `contenteditable` through `view.updateState` in Tiptap 3.20; a separate DOM attribute write is not load-bearing for that timing.
- Always early-return when `isKeyboardOpen` is false.
- **Unified sheet shell.** `SheetLayout` (`@components/SheetLayout`) is the canonical mobile sheet body: a `SheetHeader` title that states the sheet's purpose, a scrollable `flex-1 min-h-0 overflow-y-auto` body, and an optional sticky footer (`fillHeight` toggles `h-full min-h-0` vs `max-h-[min(85dvh,100%)]`). Form sheets pin actions with `SheetActionFooter` (built on `SheetFooter`): an optional square ghost Back (`btn-square min-h-12 w-12`) on the left plus a primary `flex-1` Apply that is deliberately heavier (`btn-primary min-h-12 text-base font-semibold`) — add flows show Apply full-width, edit flows show Back + Apply. The hyperlink add/edit and link-preview sheets, plus the bookmark, document-settings, filter, and notification sheets, all adopt this shell; desktop popovers keep their inline layout. `SheetLayout` / `SheetHeader` / `SheetFooter` / `SheetActionFooter` live at `components/` root, not `ui/`.

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

### Motion System (motion v1)

- **Tokens live in two lockstep homes.** CSS: `:root` in `apps/webapp/src/styles/_entry.scss` (`--motion-overlay-in: 120ms`, `--motion-overlay-out: 80ms`, `--motion-panel: 200ms`, `--motion-region: 220ms`, `--motion-ease-enter: ease-out`, `--motion-ease-exit: ease-in`). JS mirror: `apps/webapp/src/utils/motion.ts` (`MOTION_*_MS`, `MOTION_DIALOG_IN_MS` 180 / `OUT` 150, `PANEL_TWEEN`, `prefersReducedMotion()`). Update both together; do not invent new duration/easing values per surface.
- **Tiers.** Overlays (popovers, menus, selects): 120ms ease-out enter, opacity + scale 0.96 from the anchored side; exit 80ms ease-in opacity-only (context menus and tooltips dismiss instantly). Tooltips: 100ms opacity-only, never scale. Dialogs: backdrop 150ms fade, card 180ms scale-0.96 from center, exits 150ms. In-page panels / status chrome: 200ms. Content/region reveals: 180–240ms via the shared keyframes `doc-region-in` (opacity + 4px rise), `doc-content-in` (opacity only), `pill-in`, applied as `motion-safe:animate-[…]` Tailwind utilities.
- **Shared primitives, not bespoke wiring.** Every React Floating UI surface animates through `apps/webapp/src/components/ui/floatingTransition.ts` (`useOverlayTransition`); hosts that animate scale MUST pass `transform: false` to `useFloating` (left/top positioning) or the scale clobbers translate positioning. Conditional mounts that need an exit fade use `apps/webapp/src/hooks/useEntryExitTransition.ts` (double-rAF enter so the from-frame paints; transitionend + fallback-timer exit — transitionend never fires under `display:none` or reduced motion).
- **Hard rules.** Opacity-only on/above ProseMirror hosts and sticky/visualViewport shells — no transforms (containing-block + caret hazards). Never `transition-all`; always an explicit property list. One-shot reveals must not replay on re-render (gate with an `onAnimationEnd` flag or a deliberate keyed remount; display-toggles restart CSS animations). `.animate-badge-entry` keeps `animation-fill-mode: backwards` — `forwards` sticks the end transform and clobbers co-existing translate utilities.
- **Reduced motion is layered, not one switch.** CSS entries: `motion-safe:`. JS-driven motion (Floating UI transition styles, framer-motion): `prefersReducedMotion()` / `<MotionConfig reducedMotion="user">` in `_app.tsx` (covers `motion/react` consumers including react-modal-sheet — `motion` is its peer dep), because inline styles beat CSS PRM rules. Functional delays keep their timing under PRM and drop only the motion (the skeleton pill's 1.5s anti-flash hold has a PRM keyframe override in `_entry.scss`). daisyUI vendor motion overrides (countdown roll, drawer) live in one auditable block in `_daisyui.scss`. Decorative infinite loops are PRM-gated; `.loading` spinners stay (status, not decoration).
- **floating-popover engine contract (published).** `hide()` plays the skin's exit: removes `.visible`, defers `root.remove()` until transitionend with a 150ms fallback, and `show()` during an in-flight exit cancels the pending removal; `destroy()` removes immediately. `updatePosition()` sets `transform-origin` from the resolved placement. The skins in `extension-hyperlink/src/styles.css` and `extension-hypermultimedia/src/styles/media-toolbar.css` restate 120/80/0.96 + a PRM block as literals (publish boundary — webapp tokens never cross into extension CSS); the webapp re-skin in `styles.scss` stays lockstep. Any engine/skin change rebuilds both extensions and gets a CHANGELOG entry each. The hypermultimedia toolbar appends before flagging `hm-has-toolbar` (rAF) and defers removal 100ms, or its fades never play.

### Slug Page Entry And Skeletons

- **The page gate is provider presence only.** `DocumentPage` renders the layout when `settings.hocuspocusProvider` is set (synchronously at provider creation; nulled on destroy). Channel fetches, `join_workspace`, profile arrival, and sync state must never re-gate the tree — once mounted, the editor is never unmounted for the same document. `joinedWorkspace` means the join RPC _succeeded_, not started.
- **Pre-sync mounts.** The layout exists before first `onSynced`. Any hook under `useEditorAndProvider` that reads the Ydoc/ymetadata once (not event-driven) must early-return while `settings.editor.providerSyncing` is true — wired today in `useInitializeNewDocument`, `useHandleDraftOnFocus`, `useCheckUrlAndOpenHeadingChat`.
- **Provider lifecycle on doc switch.** Recreate the provider AND the Y.Doc (`useYdocAndProvider` nulls `providerRef` in cleanup and tags the ydoc by documentId) — a reused Y.Doc merges the old document's content and its `needsInitialization=false` into the new room. A 15s first-sync watchdog (per documentId, skipped while status is `offline`) sets `providerStatus: 'error'`; `SyncErrorCard` in `EditorContent` renders on `providerSyncing && status ∈ {error, offline}` and self-heals on a later `onSynced`.
- **Skeleton doctrine.** `SlugPageLoader` is server-rendered as a page sibling keyed on `!hasProvider`, prop-pure (`isMobile`, `isAuthed` from GSSP — never store reads, which land post-paint). Its geometry mirrors the real layout pixel-exact: headers are `h-14` (56px, matching `$pad-header-height` content), `ToolbarSkeleton` bones match the real control sizes (select 160×32 `rounded-field`, buttons `size-8`), the document bones carry the `_blocks.scss` sheet styling (`max-w-4xl mx-auto bg-base-100 border rounded-md`), the wrapper reserves the scrollbar gutter (`overflow-y-auto [scrollbar-gutter:stable] scrollbar-custom scrollbar-thin`), and `TableOfContentsLoader` mirrors the TocHeader row. `EditorContentSkeleton` is the single bones component shared by the page skeleton and `EditorContent`, so the S0→S1 swap doesn't move a pixel. Verify skeleton↔real geometry in the browser at ≥1280px and as both anon and authed — narrow viewports and the anon header mask real drift.
- **Skeleton visual language.** Text-line bones: bare `.skeleton` (base 0.25rem radius). Control-shaped bones: `rounded-field`. Circles: `rounded-full`. Media/card bones: `rounded-box`. Square bones use `size-*`, not `h-* w-*`. The `_daisyui.scss` base-radius override MUST stay scoped `:not([class*='rounded-'])` — it is unlayered CSS and otherwise silently squares every `rounded-*` bone (layers lose to unlayered regardless of order). `EditorContentSkeleton`'s root is a layout shell, NOT a `.skeleton` — a root slab swallows its own bones on surfaces without a bg override (mobile has no `.pad .editor` sheet SCSS). The status pill is CSS-delayed (`pill-in … 1500ms both`) — never JS timers, which cannot run in the pre-hydration window the pill exists to cover.
- **emoji-mart never loads at page module scope.** `utils/ensureEmojiData.ts` owns init (idle-scheduled; `ensureEmojiData(true)` from CHAT_OPEN / CHAT_COMMENT) and must be the first init emoji-mart sees, or its components self-fetch data from a CDN.

## Backend And Infrastructure

### HTTP Modules

- New backend HTTP features go to `@docs.plus/hocuspocus.server` (Hono), not webapp `pages/api/`.
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
- Stages are cache -> handlers -> oembed -> htmlScrape -> fallback.
- `STAGE_TIMEOUT_MS` and the base User-Agent constant live in `domain/types.ts`.
- Host handlers live under `domain/stages/handlers/`.
- `htmlScrape` appends `facebookexternalhit/1.1`; Reddit uses plain `DocsPlusBot/1.0`. Keep them intentionally different.
- Test files mirror source filenames one-to-one, e.g. `htmlScrape.ts` -> `htmlScrape.test.ts`.

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

### Supabase

- **Never edit `packages/supabase/seed.sql`.** Agents and routine changes must not modify it; use `packages/supabase/migrations/` and `packages/supabase/scripts/` only.
- **Never edit `apps/webapp/src/types/supabase.ts`.** It is generated by the Supabase CLI via `packages/supabase` script `types` (`bunx supabase gen types typescript --local` → that path).
- **Webapp types convention.** `apps/webapp/src/types/supabase.ts` is the generated source of truth; the rest of `apps/webapp/src/types/*.ts` (`api.ts`, `domain.ts`, `history.ts`, `message.ts`, `stores.ts`, `tiptap.ts`, `toc.ts`) is where derived/expanded types are authored and re-exported. Build new shared types there and import them — do not redeclare row/payload aliases inline in hooks, components, or stores. SDK types (`@supabase/supabase-js` — `PostgrestError`, `PostgrestResponse`, `AuthError`) come from the SDK directly and bypass this folder.
- **After any SQL change, regenerating types is required, not optional.** Any work that touches `packages/supabase/migrations/**` or `packages/supabase/scripts/**` must end with the **developer** running `bun run --filter @docs.plus/supabase_back types` from the repo root (local Supabase + root `.env.local`) and committing the regenerated `apps/webapp/src/types/supabase.ts` in the same PR. Agents do not hand-edit and do not run this command — they must remind the developer to run it before the SQL work is considered complete.
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
- **Migrations and `scripts/*` are paired.** Every change applied via a migration must be mirrored in the corresponding source-of-truth `scripts/*.sql` file so `db reset` (which rebuilds from `scripts/`) reproduces the production state. Do not land migration-only or scripts-only changes for the same invariant.
- **Remote `db push` vs local reset.** `[db.migrations] enabled` in `packages/supabase/config.toml` stays `false` for day-to-day local dev (`db reset` loads `scripts/` + `seed.sql`). Toggle `true` only while pushing to remote. Never delete a migration file that remote has already applied — use `supabase migration repair --status reverted <version>` if consolidating history. Bulk function catch-up for prod gaps: edit `scripts/`, run `bun run --filter @docs.plus/supabase_back generate:functions-parity-migration` (writes a timestamped migration from an allowlisted script subset; adds `DROP TRIGGER IF EXISTS` before bare `CREATE TRIGGER`). One-shot data backfills stay hand-written migrations, not in `scripts/`.
- **Migrations must ship dependencies they call.** If a migration `create or replace`s a function that calls `internal.*` helpers, those helpers must appear in the same migration or an earlier one — not only in `scripts/` (prod never runs `db reset`). Trigger functions that write other users' `channel_members` rows must end with `SECURITY DEFINER` in both `scripts/` and the migration path, or RLS column grants block inserts after `13-RLS.sql`.
- **`supabaseClient.rpc(...)` is lazy.** It returns a `PostgrestBuilder`; the request only leaves the browser when `.then(...)` / `await` / `.single()` / `.maybeSingle()` is attached. Fire-and-forget calls that drop the result (e.g. a debounced cursor advance) MUST attach `.then((res) => { if (res.error) console.warn(...) })`, or the network call silently never dispatches. Any `supabaseClient.rpc(` without a continuation is a bug.
- **Storage RLS is path-based, not column-based.** Bucket policies for `user_avatars` / `channel_avatars` check `(storage.foldername(name))[1] = (select auth.uid()::text)`, NOT `owner` (uuid) or `owner_id` (text). Storage-api v1.54.1 doesn't reliably auto-populate either column on insert; predicates against them evaluate `NULL = …` → false → 403 "new row violates RLS policy". The FE writes paths as `{userId}/{filename}` (`useAvatarUpload` uses `${user.id}/avatar.png`; `Config.app.profile.getAvatarURL` emits the matching read URL). Encoding ownership in the path is Supabase's canonical pattern and matches Slack/Discord/Linear conventions.
- **Storage bucket policies are CRUD-complete, not write-only.** Migrations that re-declare INSERT / UPDATE / DELETE policies on `storage.objects` MUST also confirm a matching SELECT policy exists. Supabase Storage runs `INSERT … RETURNING` (or INSERT followed by SELECT) on every upload, and a missing SELECT policy returns the same generic "new row violates row-level security policy" 403 that misleadingly points at the INSERT — the actual denial is on the readback. `scripts/12-buckets.sql` declares SELECT policies for `user_avatars` / `channel_avatars` / `media` (all `bucket_id = '<name>'`); the migration tree must keep parity. Public-URL reads (`/storage/v1/object/public/...`) take a different code path that doesn't go through PostgREST RLS, so the avatar display can work while uploads silently 403 — that's exactly how this gap survived three rounds of "fix the RLS" migrations.
- **Avatar source-of-truth is a two-field hybrid.** `users.avatar_url` holds the OAuth provider URL (set by `handle_new_user` from Google's `picture` claim on signup); `users.avatar_updated_at` is the "user has uploaded a custom avatar" indicator. `<Avatar>` reads `avatar_updated_at` first — if set, derives the bucket URL `${BUCKET}/${id}/avatar.png?${avatar_updated_at}` (the timestamp doubles as cache-buster); if null, falls back to `src` (= `avatar_url` = OAuth URL). `useAvatarUpload.handleRemove` clears `avatar_updated_at` to null so the OAuth picture reappears without re-fetching from the provider. Don't refactor to a single-column shape — the hybrid gives free "remove falls back to OAuth" semantics that single-column variants need extra logic to implement.

## Extension Workflow

### Standalone Extension Development

- Standalone packages: `extension-hyperlink`, `extension-hypermultimedia`, `extension-indent`, `extension-inline-code`, `extension-placeholder`.
- Shared structure: TypeScript + tsup build + `@tiptap/core` peer dep.
- GFM markdown uses `@tiptap/markdown`; paste lives at `extensions/markdown-paste/`; import/export lives in `utils/markdown.ts` and `toolbar/desktop/DocumentSettingsPanel`.
- `sanitizeJsonContent` runs on paste and import paths.
- After modifying any `extensions/extension-*` source:
  1. Run `bunx tsup` in that package.
  2. Clear `.next/cache` or remove `.next`.
  3. Restart the dev server and hard-refresh the browser.
- Next.js HMR does not reliably detect changes in Bun workspace-symlinked packages.
- If an extension playground is running via `bun run playground` (`bun --hot docs-playground`), restart it after `bun run build`; tsup `clean: true` can wipe `dist/` and leave the hot server serving 500 for `dist/styles.css`.

### Hyperlink Extension

Extension-internal rules (schema, commands, click handling, safety/normalization, metadata/preview, the `specialUrls` catalog, public API surface, floating toolbar, clean-room Cypress harness) live in [`extensions/extension-hyperlink/AGENTS.md`](./extensions/extension-hyperlink/AGENTS.md). Read that file before touching anything under `extensions/extension-hyperlink/src/`. The webapp-side popover integration is below.

### Webapp-Owned Hyperlink Popovers

- The extension stays host-agnostic. `popovers.createHyperlink` / `popovers.editHyperlink` are callbacks returning `HTMLElement | null`.
- Desktop create/edit entries create an empty host and set only `host.dataset.testid`. Never set `host.className`.
- Register `{ kind, host, props }` in `useHyperlinkPopoverStore`.
- Return the host so the extension's floating controller positions it.
- A single React `<HyperlinkPopoverPortal>` in `TipTap.tsx` reads `active` and portals `<HyperlinkEditor>` with `<HyperlinkSuggestions>` into the host.
- Tests select by `data-testid` only. Do not restore legacy class selectors.
- `useHyperlinkPopoverStore` subscribes once at module load to `getDefaultController().subscribe((state) => state.kind === 'idle')`.
- The idle discriminator is `idle`, not `closed`.
- The subscription is guarded by `globalThis.__hyperlinkControllerSubscribed` so HMR/Jest module-cache replays do not stack listeners.
- `__resetHyperlinkPopoverStoreForTests()` reattaches after `resetDefaultController()`.
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
  - `previewShared.ts::TYPE_TO_ICON` maps `SpecialUrlType` to `IconType` from `@components/icons/registry` as `Partial<Record<SpecialUrlType, IconRenderer>>`.
  - It is intentionally partial so domain-catalog types such as `meet` or web `github` can be absent; favicon wins for `https://` URLs.
  - Use Lucide React components only.
  - `createSvgIcon(Icon)` renders with `renderToStaticMarkup(createElement(Icon, { size: 20, 'aria-hidden': true }))`.
  - Do not reintroduce per-platform `Fa*` / `Si*` icons or hard-coded SVG strings.

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
- Cypress: webapp suite under `apps/webapp/cypress/e2e/editor/indent/` plus the package clean-room suite (port 5175, against built `dist/`); Jest lives under `extensions/extension-indent`.

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
- URL helpers live in `pages/history/historyShareUrl.ts`: `parseHistoryHash`, `buildHistoryShareUrl`, `replaceHistoryHashVersion`.
- Without `#history?version=`, the sidebar treats the latest version as active.
- Every entry to history page, including editor <-> history navigation, must resync sidebar selection from current hash + store.

### TOC And Heading Chrome

- TOC code lives under `components/toc/`.
- Keep `tocClasses.ts` in sync with `styles/components/_tableOfContents.scss`.
- `--color-docsy` equals `var(--color-primary)` in both `@theme` and `:root`; it tracks DaisyUI light/dark/high-contrast themes.
- Heading widgets live in `TipTap/extensions/HeadingActions/plugins/`.
- Heading-action styling lives in `styles/components/_heading-actions.scss`.
- `$ha-hit-size` is shared with plugins.
- `$ha-group-has-unread` owns the DRY `:has()` selector for unread tray visibility.
- `_unread-badge.scss` only styles `[data-unread-count]` on `.ha-chat-btn` and notification bell. Do not add `.toc__chat-trigger` or `.ha-group` rules there.
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
- **TOC trailing rail.** `TocHeader` and `TocItemDesktop` reserve a fixed-width trailing rail at the right of each row: chat/unread pill is pinned `absolute left-0`, AvatarStack is pinned `absolute right-0`. Rail width comes from `tocTrailingRailPx(userCount, unreadCount)` in `components/toc/utils.ts` (wider for 10+ users / 100+ unread). The row uses `overflow-hidden` and the title is `flex-1 min-w-0` so a growing avatar stack never compresses heading text. The legacy `data-present-users-count` attribute and matching `_tableOfContents.scss` width loop are gone — they only existed for the old outside (`absolute -right-9` / `-right-6`) placement; do not reintroduce them.
- **TOC chat trigger is `<button type="button">`** (was `<span onClick>` inside `<a>`) for keyboard + a11y semantics; same pattern as mobile. The chat hover SCSS selector is `&:hover > a .toc__chat-icon`, NOT the deeper `&:hover > a > span > .toc__chat-icon` — the rail DOM broke the original deeper selector. `usePresentUsers` MUST filter `profile?.id` and `useMemo` (matches `PresentUsers.tsx`); without it the row gets an extra avatar and the rail width inflates.

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

## Chatroom And Messaging

### Optimistic Message Lifecycle

- Client generates a UUID v4 via `crypto.randomUUID()` in `utils/clientMessageId.ts` and carries it from optimistic insert through Postgres INSERT to realtime echo. The same ID is reconciled in place; there is no remove + re-add.
- Do not reintroduce the literal `'fake_id'` placeholder. Two rapid sends collide in the store map and corrupt the optimistic UI.
- `MessageStatus = 'pending' | 'sent' | 'failed'` lives in `types/message.ts`. Server-fetched rows omit the field and are treated as `sent` (`status === 'sent' || !status`). No runtime `MESSAGE_STATUS` const; the literal type alone gives compile-time safety.
- `useReadCursor.advance` skips rows where `status !== 'sent'`; pending/failed optimistic rows must not advance the read cursor. The hook is monotonic (greatest()-on-server) and 1s-debounced, so callers can fire on every scroll tick.
- **Read-cursor advance is viewport-driven, not at-bottom-only.** `ChatList.onScroll` calls `advance(seq)` for the last fully-visible message on every scroll tick; `useChannelMessages.onInitialVisible` fires one rAF-polled seed after `data.replace` settles. Reducing this to an at-bottom-only signal regresses the Telegram-style UX (messages read while scrolling up never clear).
- **`advance_read_cursor` recomputes `unread_message_count`** in the same UPDATE that bumps `last_read_seq` (plus stamps `last_read_update_at`); without the recompute the TOC badge desyncs forever. The TOC `<UnreadBadge>` and `<JumpToPresentButton>` both read `useUnreadCount(channelId)` (not raw `channels.*.unread_message_count` alone). `useUnreadCount` prefers `optimisticUnreadStore` while the user is reading in-view; `ChatroomContext` decrements on viewport cursor advance and `useCatchUserPresences` reconciles via `setOptimisticUnread` on `channel_members` postgres_changes — clear the map entry when the server count lands. `JumpToPresentButton` renders `max(unreadCount, newCount)` so persisted unread and session-local arrivals stack onto one chip.
- **`lastOptimisticSeqRef` MUST seed from `channel_members.last_read_seq`** once `isChannelDataLoaded` flips true. The ref tracks "highest seq the user has visually crossed in this session"; if it starts at `0`, the first `onLastVisibleIndexChange` walk-backward counts every loaded message as newly crossed and decrements `optimisticUnread` by the entire window — opening a chatroom with many unread instantly zeros the badge. Seed from the persisted server cursor (`useChatStore.channelMembers.get(channelId).get(userId).last_read_seq`) so the walk only counts messages past the cursor (actual unread). Guard the seed with `if (lastOptimisticSeqRef.current > 0) return` so a later effect re-run doesn't undo session progress. Also: the store is named `optimisticUnreadStore` — never reintroduce `optical*` spellings.
- Send path: composer routes through `ChatroomContext.send` → `useSendMessage.send`, which appends a `pending` row to Virtuoso's `data` and INSERTs directly via `supabaseClient.from('messages').insert(...)` (no `sendMessage` API helper). On error, flips to `failed`; the postgres_changes INSERT echo flips it to `sent` via `useChannelRealtime`'s in-place merge.
- **Own-send always scrolls to tail.** `data.append([optimistic], () => 'smooth')` is unconditional — the user follows their own message down even when scrolled up to re-read history. The `atBottom`-gated "don't yank" rule applies ONLY to others' arrivals in `useChannelRealtime`. Reverting to `({ atBottom }) => atBottom ? 'smooth' : false` here regresses Discord/Slack/Telegram parity for own sends.
- Duplicate-key classification is centralized in `components/chatroom/utils/postgresErrors.ts::isDuplicateKeyError`. Both `useSendMessage` and `retryMessage` must import it; do not inline PgError code/message checks.
- Retry path: failed-row tap → `ChatroomContext.retry(clientId)` → `useSendMessage.retry` → `utils/retryMessage` helper (the only remaining caller of the `sendMessage` API). Re-issues with the original client UUID; 23505 duplicate-key is treated as success (the row was already persisted on a prior attempt). Returns `RetryMessageResult`; the caller (`useSendMessage.retry`) owns the pending/sent/failed UI flip against Virtuoso's data.

### Message Grouping Projection

- `TGroupedMsgRow = TMsgRow & { isGroupStart, isGroupEnd, isNewGroupById, isOwner }`. Grouping flags are computed render-time in `ChatList/ItemContent.tsx::samePrev` against Virtuoso's `prevData`; never persisted, never written into `api/messages/*` types.
- Do not reintroduce a projection utility (`utils/projectMessageGroups.ts` and `utils/groupMessages.ts` are both gone) or an in-store mutation that writes grouping flags back onto rows. Out-of-order realtime arrivals and pagination merges corrupt flags whenever they're materialised.
- **Notification rows break grouping.** `ItemContent.tsx::samePrev` excludes `prevData.row.type === 'notification'` — without that exclusion, a notification chip between two same-author messages renders the post-notification message in `compact` mode (no avatar/header). The chip itself is `ChatList/SystemNotifyChip.tsx`, dispatched on `data.row.type === 'notification'`; `metadata.type` branches `user_join_workspace` / `channel_created` / `user_join_channel` (last one returns null — the workspace-join chip already records first appearance).
- Virtuoso's `data` store is the single source of truth for in-view message rows; there is no parallel Zustand `channelMessagesStore`. Derive the newest seq from `useChannelMessages.newestSeqRef`; do not re-walk the list to compute it on hot paths.
- `MessageCardContext` must memoize its context value object (`useMemo`). A fresh object identity on every parent render cascades re-renders through every `MessageCard`.
- `MessageFooter` self-hides on `status === 'failed'`. Consumers (`DesktopEditor`, `ChatContainerMobile`) render `MessageCard.FailedRow` for owner rows and must not re-gate on `status`.

### Chatroom List (Virtuoso)

- **`ItemLocation` is index-based.** `VirtuosoMessageList`'s `data.replace` and `scrollToItem` accept `{ index: number | 'LAST', align, behavior }`; the string `'lastItem'` and id-based `{ id, … }` shapes silently no-op behind the EmptyPlaceholder. Resolve a numeric index from the items array via `findIndex`; never wallpaper the call with `as any`.
- **Layout contract.** `.message-feed` is `flex min-h-0 flex-1 flex-col overflow-hidden`; Virtuoso owns the scroll, not the wrapper. `<VirtuosoMessageList style={{ height: '100%' }}>` so the scroller fills the parent. Reverting `.message-feed` to a plain block + `overflow-y-auto` re-introduces an ~9000 px scroller stretch with items rendered far below the visible panel.
- **Panel resize bypasses React during drag.** `useResizeContainer.doDrag` writes `containerRef.current.style.height` directly and dispatches `CustomEvent('chat-panel-resize-tick', { detail: height })`; `useAdjustEditorSizeForChatRoom` listens and mirrors to the editor wrapper's `marginBottom`. Single `setOrUpdateChatPanelHeight(lastHeight)` commit on `stopDrag` drives localStorage + the post-drag Virtuoso re-measure. Per-mousemove Zustand writes cascade through every `state.chatRoom` subscriber → Virtuoso ResizeObserver → `bottom-smooth` thrash at 60Hz; direct-DOM avoids that.
- **Sticky day chip uses `getBoundingClientRect`, not `offsetTop`.** `StickyDayHeader` reads the topmost visible `[data-msg-date]` element via rAF-throttled `querySelectorAll` against the scroller. Virtuoso positions each item `absolute` inside a per-item wrapper, so `node.offsetTop` is 0 relative to that wrapper and the topmost-detection loop would always return the first item regardless of scroll. Visibility is scroll-driven with a `HIDE_AFTER_MS = 1500` idle fade — `data-msg-date` is stamped on the message card outer div + inline `DateChip` + `SystemNotifyChip` wrappers.
- **Hover-menu integration (Floating UI + Virtuoso).** The four pieces are coupled and easy to misdiagnose individually — keep all of them in mind when any one breaks:
  1. **Visibility tracking → `IntersectionObserver`, not `getBoundingClientRect` polling.** Virtuoso items mount with transient/zero rects; a one-shot mount-time rect check sticks at `false`, which gates `useHover.enabled`, which silently disables the menu until the user scrolls. Bookmarked rows that mutate after mount (BookmarkIndicator + reactions render late) have the same failure mode without the scroll workaround. IntersectionObserver fires on initial paint _and_ on layout-driven intersection changes; both bugs collapse into one fix. Use `threshold: [0, 0.5, 1]` (not just `0.5`) so the first callback fires regardless of starting ratio.
  2. **`boundary` on `flip`/`shift` → `.message-feed`, not `.group/chat`.** The boundary defines the rectangle the floating menu cannot physically extend past. The panel-wide rect includes the toolbar and composer; a menu sitting _over_ the toolbar still fits inside the panel and won't trigger flip. `.message-feed` excludes both — top-of-feed messages flip to `bottom-end`. `position: fixed` can't be constrained by z-index or `overflow: hidden`; this is the only thing that actually keeps the menu inside the visual feed.
  3. **Portal target → `<div id="chat-hover-portal">` inside DesktopLayout.** Default `FloatingPortal` mounts at body root, which puts the menu in the root stacking context where nothing inside the panel can compete. Portaling inside the panel lets `JumpToPresentButton` (`z-40`) sit above the menu (`menuClassName="z-30"`) when both occupy the bottom-right region.
  4. **`safePolygon({ buffer: 8 })` + `delay.open: 100ms`.** `buffer: 1` required pixel-precise mouse paths from message → menu and felt broken; the user-visible complaint is "I have to exact-focus the message." 8px is the Floating UI example range. 100ms open beats 200ms perceptually without admitting accidental hovers.
- **`Header` / `Footer` slots require stable, module-scope component refs; changing values flow through the `context` prop, NOT through closures.** Toggling the component reference itself (`Header={loadingOlder ? Loader : undefined}`) silently fails — Virtuoso re-mounts the slot but the closure captured before the remount never updates, so the inner spinner never reaches the DOM even though the `loading` state cycles correctly for the full RTT. `ChatList.tsx` defines `Header` / `Footer` at module scope, adds `loadingOlder` / `loadingNewer` to `ChatListContext`, and reads them via `{ context }` in the slot props to drive `PaginationLoader` (top for older, bottom for newer). `MessageFeed.tsx` threads both flags through. Do not revert to inline-`useMemo` Header/Footer factories.

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

### MessageComposer Pitfalls

- After submit, refocus the editor only if it was the active element. Otherwise `editor.chain().clearContent(true).focus('start').run()` force-opens the iOS keyboard right after a `SendButton` tap and produces a visible bounce. Enter-key submits keep focus naturally.
- `useEditor(...)` in `components/chatroom/components/MessageComposer/hooks/useTiptapEditor.ts` captures `workspaceId` / `channelId` / `isToolbarOpen` in the `onUpdate` closure. Today this is masked because `Chatroom.ChannelComposer` remounts on channel key change and drafts never cross. If the composer mount is ever made persistent (a tempting perf win), drafts will silently corrupt across channels — fix with a refs pattern or lift `setComposerStateDebounced` into a `useEffect` keyed on the ids.
- `prepareContent` must return a stable `chunks` shape (`{ htmlChunks: string[], textChunks: string[] }`) on both the happy and empty paths so callers never need an `as` cast.
- **Draft vs mode memory.** Text/HTML drafts live only in IndexedDB (`messageComposerDB` via `syncComposerDraft` / `discardComposerDraft`); Zustand `*MessageMemory` holds reply/edit/comment UI modes only — do not reintroduce `messageDraftMemory`.
- **Post-send draft clear.** Successful send must call `discardComposerDraft` (cancels trailing debounced IDB writes, then deletes the row). A trailing debounced write after clear resurrects sent text when the user reopens the chatroom.
- **Formatting toolbar session scope.** Toolbar defaults closed; expanded state is `sessionStorage` via `composerToolbarSession.ts` (per workspace+channel, current tab session only) — not IndexedDB.
- **Anon Enter opens sign-in.** `useComposerSubmit` calls `openComposerSignIn(channelId)` when `!user` — same entry as `SignInToJoinChannel`; do not let Enter silently no-op for visitors.
- **No per-keystroke state in `MessageComposerContext`.** `text` / `html` / `isSubmittable` / function-form `canPressSend` writes per the 150ms editor debounce churn the context value identity through every consumer (toolbar buttons, layout shells, action buttons) every 150ms while typing. The contract today: context exposes a derived boolean `canSend = text.trim().length > 0` (transition-only — empty ↔ non-empty), plus `editor` (stable handle), `submitMessage`, `isEmojiOnly` (transition-only), and the reply/edit/comment memory + setters. `SendButton` reads `disabled={!canSend}`; `useComposerSubmit.isSubmittable` stays internal and reads `editor.getText()` directly at click-time so the moment-of-submit check is fully live. Never re-add `text` or `html` to the context type.
- **`EmojiPanel` is host-agnostic.** The shared `chatroom/components/EmojiPanel/` accepts `{ variant: 'desktop' | 'mobile', onSelect: (native: string) => void }`. The old `usage` discriminator (`composer-inline | reaction | desktop`) and its central exhaustiveness `switch` are deleted; `Selector.tsx` reads only `{ variant, onSelect }` from `EmojiPanelContext` and never imports `useComposerEmojiPanelStore` or `emojiReaction`. Each call site owns its own dispatch: `DesktopLayout` (desktop picker, two-mode `emojiPicker.eventType` reactToMessage vs caret insert with click-time `getState()` for stable callback identity), `ChatContainerMobile` (reaction overlay → `emojiReaction(selectedMessage, native)` + `closeEmojiPicker`), and `ComposerEmojiPanel` (composer-inline → `editor.chain().insertContent(native).run()` + auto-collapse to peek). Adding a new emoji surface = a new `<EmojiPanel variant=… onSelect={…}>` mount; do not re-add a central usage discriminator.
- **`ComposerEmojiPanel` is composer-owned, not a sheet.** Lives at `MessageComposer/components/ComposerEmojiPanel/` with its own `composerEmojiPanelStore` (`peek` ↔ `expanded` mode, idempotent `open()` that snapshots `useStore.keyboardHeight` once into `peekHeightPx` so the panel renders at the right height after `blur()` resets keyboard-height to 0, plus `history.pushState({ composerEmojiPanel: true })` for back-button dismiss). The store deliberately lives in the composer subtree, not in `EmojiPanel/` — moving it back re-couples the host-agnostic panel to composer dispatch.
- **Animated panel + emoji-mart grid: animate outer height, fixed inner shell.** `ComposerEmojiPanel` animates `motion.div` `height: 0 → targetHeight` (`PANEL_TWEEN` from `@utils/motion`, 200ms ease-out) so the parent flex column absorbs the change cleanly via `flex-1` on the chatroom feed; the inner content is wrapped in a `style={{ height: expandedHeight }}` div so emoji-mart's grid measures its container once and never reflows during the tween. Animating height directly on the picker subtree thrashes layout/paint on the emoji-mart grid every frame. Apply the same outer-tween + fixed-inner-shell pattern to any future animated surface that hosts a measurement-sensitive virtualized grid.
- **Mobile formatting-toolbar taps.** The composer editor runs `shouldRerenderOnTransaction: false`, so `FormattingToolbar` must call `useReRenderOnEditorTransaction(editor)` or mark buttons (Bold / Code block / etc.) keep a stale `isActive` highlight after a toggle. The composer toolbar `ui/Button` (`ToolbarButton`) wires `onTouchEnd` (gated on `editor && type && onPress`) alongside `onClick`, because on iOS a tap on a toolbar button while the editor is focused often never fires the synthesized `click`; `handleClick` dedupes via a `touchPressRef` so touch + click never double-run, and `SendButton` (`type="submit"`, no `editor`) intentionally skips the touch path. `ToggleToolbarButton` (the format-bar toggle) stays plain `onPress={toggleToolbar}` — never `preventDefault` on `pointerdown`, which suppresses the synthesized click on iOS WebKit and leaves the bar stuck open.

### Mention Picker

- **4-layer split (mirror hyperlink, do not import across features).** `MessageComposer/helpers/suggestion.ts` owns the popup host + `autoUpdate` + `ReactRenderer` create/destroy + TipTap key routing; `MentionList.tsx` owns debounced RPC + selection + keyboard API; `MentionSuggestions.tsx` + `MentionSuggestionRow.tsx` own the Discord-style listbox + a11y; `mentionTypes.ts` owns shared types, `EVERYONE_ENTRY` (`id: 'everyone'`), and helpers `showEveryoneForQuery` / `isMentionSuggestionPopupVisible` / `mentionOptionId` / `MENTION_LISTBOX_ID`. Do not add a Zustand store, SQL function, or shared suggestion package for it.
- **Popup anchors to `[data-chat-composer-surface]`** (set on the desktop inner composer card and mobile composer wrapper), `placement: 'top-start'`, width 98% of the surface with 1% inset each side; `autoUpdate` tracks the surface, NOT the `@` caret. Discord/Telegram-style wide picker above the editor. When the surface marker is missing, log a warning so `@` doesn't fail silently. Do not bring back caret-following `bottom-start` / `shift` or `min-w-[280px]`.
- **`@tiptap/suggestion` Escape contract.** The plugin runs `onExit` / `dispatchExit` ONLY when `onKeyDown` returns `false`. Returning `true` for Escape leaves the plugin alive (`state.active === true`) even after manual DOM removal — the picker silently won't reopen. Always return `false` for Escape and route ALL teardown through `onExit` → single `destroyPopup()` path; never manually remove the DOM on Escape.
- **Window-level Escape and Enter contention.** `useHandleEscKey` (composer reply/edit/comment) bails when `isMentionSuggestionPopupVisible()` is true so first Escape closes the picker, second clears reply/edit. The same helper gates Enter-send blocking. Do NOT `stopPropagation` Enter in `useTiptapEditor` — Mention's own `onKeyDown` needs the key; only `preventDefault` the send while the popup is `isConnected` and visible.
- **RPC contract.** Direct `searchWorkspaceUsers({ workspaceId, username: query })` with 150ms debounce + a `cancelled` flag for stale-response guard — NOT `useApi`. Anon / non-member visitors skip the RPC entirely (Notify-only row when query matches `everyone`). Members list filters `u.id !== currentUserId` so the user never sees themselves; `@everyone` Notify is unaffected. Type the response as `PostgrestResponse<FetchMentionedUsersRow>` from the generated `Database` types — NOT the `[][]` generic (Supabase RPC typing pitfall). On RPC error, set `fetchError` and surface "Couldn't load members" in the Members section instead of empty list. Insert payload stays `command({ id, label: item.username })` — `label` MUST be username (or `'everyone'`), never display name; notification SQL matches plain text.

### Anonymous Chat Read Path

- **Anon visitors get read-only PUBLIC chat.** Anon can call every read path — `fetch_message_window`, `fetch_messages_since`, `get_channel_aggregate_data`, channel/user/message SELECTs — and hydrate the local Zustand store; the anon RLS policies and SQL functions handle `auth.uid() IS NULL` explicitly so the read path renders cleanly without any FE early-return.
- **Writes must gate on `auth.uid()` at the entry point.** `useChannelMetadata` skips `upsertChannel` + `joinChannel`, `useSendMessage` short-circuits via `onAuthRequired`, and `useReadCursor.advance` no-ops when uid is null. Do not gate inside the RPC bodies; do not let RLS 403s reach the FE as toasts. Authenticated writes assume the channel/member rows exist.
- **Anon-only UI is hidden, not disabled.** The Bookmarks popover in `EditorToolbar.tsx` is gated `{user && <Popover>…</Popover>}`; `ChatroomToolbar/components/NotificationToggle.tsx` early-returns `null` when `useAuthStore.profile?.id` is falsy. Hide at the component (or wrapping popover) so the trigger never invokes an RPC that would 401 — don't render a disabled button that toasts on click.
- **Async-handshake success paths resolve their own loading state.** `useOnAuthStateChange.signInAnonymously` calls `useAuthStore.setSession(data.user, true)` on success (which flips `loading: false` in the store) — it does NOT wait for the post-signin `SIGNED_IN` event. The `onAuthStateChange` handler intentionally omits `SIGNED_IN` from its branches to avoid profile-refetch thrash on tab focus / token refresh in older Supabase versions; relying on it would leave anon visitors stuck on "Loading workspace" forever. General rule: when a sign-in / handshake call returns the resulting session data, terminate the loading state at the call site, not via a secondary event listener.
- **Anon viewers subscribe to the same `workspace:${workspaceId}` realtime channel** as authenticated users (handled in `useCatchUserPresences.ts`) so presence join/leave + broadcast events flow into `useStore.usersPresence` and every `AvatarStack` surface — TOC header, TOC items, pad header `PresentUsers`, chatroom `ParticipantsList`, message `UserReadStatus` — renders the same set of online users an authed viewer would see. Anon must NOT call `track()`: they observe only, never broadcast themselves into presence state. Do not split anon onto a separate `anonymous:*` channel — presence is per-channel-name and a parallel channel would silently miss every broadcast.
- **`AvatarStack` consumers filter the current user out, never gate on `usersPresence.size`.** Authed `track(profile)` puts self in the map; anon never tracks so the map is already just other viewers. Size-based guards (`size <= 1`) hide the stack from anon when one auth peer is present. The right shape is `Array.from(usersPresence.values()).filter(u => u.id !== profile?.id)` then render when the remainder is non-empty — works for both auth (drops self) and anon (no-op).
- **Clear `usersPresence` on every (re)subscribe.** `useCatchUserPresences` calls `clearUsersPresence()` at the top of its subscribe effect before opening either the anon or authed channel. This drops stale `ONLINE` entries from the previous channel (anon→authed sign-in, workspace switch, `online`-event reconnect) so the next subscription's `presence` `sync` snapshot is the authoritative state.
- **Anon's TOC badge re-purposes `unread_message_count` as a channel-activity hint** because anon has no per-user read cursor. Both `useMapDocumentAndWorkspace.fetchChannels` (initial) and `channelMessageCountsUpsert` (realtime) write `channel_message_counts.message_count` (channel TOTAL) into the store's `unread_message_count` field. This is intentional — don't "fix" it. Both write paths must auth-gate (`if (profile?.id) return`) so authenticated users keep the real per-user value from the `channel_members` subscription.
- **`fetch_message_window` returns `anchor_seq=null` for `first_unread` when no real unread exists** — anon viewers (no `channel_members` row) and authed users caught up to tail. SQL still windows around tail (so the view loads correctly); the FE only inserts the "Unread messages" sentinel when `win.anchor_seq != null`. Reverting this so anon/caught-up users see a sentinel before their tail message is a regression — the divider is meaningless without a read cursor.

## Learned User Preferences

- When Task/subagent output is already visible in the UI, avoid repeating or summarizing it unless the user asks or multi-task synthesis requires it; an optional brief third-person completion line is fine—vary wording instead of identical confirmations every time.
- When the user asks for a review-first workflow (e.g. “wire a plan”, approve-before-execute), draft the plan and pause for explicit approval before implementing.
- After substantive chatroom/webapp, Supabase, or extension-package work (playground harness, npm publish readiness, hypermultimedia), expect a cohesive DRY/KISS pass (dead-file import-graph sweep, redundant store fields, code-simplifier, thermo-nuclear review when invoked) before treating the work as production-ready—not optional follow-up polish. Extension publish audits expect all five packages at parity: package-local `CONTRIBUTING.md`, `bunx` release lifecycle hooks, README gallery assets via `docs:screenshots` (hero + `<details>`/`<picture>` scenes—no JS carousels; GitHub/npm READMEs are static HTML only), CI extension tests, and harness docs centralized in `extensions/README.md` with cutover/e2e READMEs linking—not duplicating ports/scripts. Preview collapsible README galleries on GitHub or `bunx grip <readme>`—VS Code default Markdown preview often won't render `<details>`/`<picture>`. When trimming harness redundancy, limit to dead CLI, derived manifest fields, and small shell extractions (`extension-preflight.sh`)—no shared Cypress factories or root screenshot wrappers.
- Do not call URL, router-adjacent, or floating-menu UI work production-ready or “ship” until the real interaction path is checked in the browser (light + dark); `history.pushState` can leave `h`/`id` in the bar where stripping only bookmark-style params no-ops — context menus need pointer cursor, hover contrast, and full-width dividers verified the same way.
- Monorepo dependency bumps go through `npm-check-updates` (`bun run update` = patch+minor; `bun run update --upgrade` for majors)—not `npm-check`, not a verbose `bun update --recursive` wrapper; keep `scripts/update-packages.sh` minimal. When adding a workspace package, keep `bun.lock` diffs scoped to that package's graph—avoid unrelated root devDependency churn from a blind full `bun install`; surgically merge lockfile entries if needed.
- Keep `AGENTS.md` in full human-readable prose; do not caveman-compress it or commit token-budget rewrites unless the user explicitly asks—restore from backup if an agent compresses without approval.
- UI shell and layout components must use clear role names (`*Layout`, `*Bar`) — never `*Chrome` in exported component or file names; rename on sight during cleanup.
- Do not extract Tailwind className constants into sidecar `*Classes.ts` / `*Styles.ts` / `*ClassNames.ts` modules (or local module-scope `const FOO_BTN = '...'` for single-file use); inline the literal at the call site, even when several sibling components repeat it. Tailwind atoms are already the design token, and a second naming layer reads as over-engineering. Lift only into a shared **component** (e.g. `<IconButton variant="composer-icon">`) when the composite is genuinely non-trivial and reused.
- **Webapp module layers:** pure formatters/tokens → `@utils/`; presentational components → `@components/ui/`; layout shells/composites → `@components/` root; feature-owned helpers → that feature's `utils/`. Never file a standalone helper under `ui/` because the nearest importer is a component — see §Webapp Module Layers.
- For large HoE-style reviews (chatroom, TOC, sheets, composer, toolbar panels), build cohesive context from related modules first, then wait for the explicit task before implementing; avoid overengineering and overthinking in review output and refactor plans.
- When changing `extension-hypermultimedia` embed behavior (paste rules, oEmbed/iframe params, node attrs), update the per-node README and package README for end users in the same change; on multi-item embed work ("work on all of them"), honor explicit scope exclusions the user states (e.g. skip toolbar/player-param UI for YouTube when they say "do not work on the toolbar").
- **`extension-hypermultimedia` Cypress resize/loading specs must assert rendered DOM size** (inline `style` width/height or `getBoundingClientRect` on `img` / iframe / `.hm-media-host`), not ProseMirror node attrs alone — attrs can commit while the node view still paints the old pixel box.

## Learned Workspace Facts

- Chat mention and @everyone notifications are driven by plain-text `messages.content` (composer `getText()` / sanitized text), not TipTap mention HTML attrs — SQL in `10-func-notifications.sql` regex-matches `@username` and `@everyone` there. Mention inserts must use `label: username` (or `'everyone'`), not display name. `sanitizeMessageContent` / `sanitizeChunk` allow only `href`, `target`, and `rel` on spans — not `data-id`, `data-type`, or `class` — so stored message HTML may not retain mention attrs; feed tap-to-profile via `useMentionClick` needs an explicit DOMPurify allowlist extension, not picker UI alone.
- Chat message-list virtualization is Virtuoso (`@virtuoso.dev/message-list`); `@tanstack/react-virtual` was removed from webapp after the Virtuoso migration—do not re-add it as the list virtualizer.
- Message forwarding was removed end-to-end (no `origin_message_id` / `prepare_forwarded_message`, no `forwardMessage` API or Forward menu)—do not reintroduce the feature in Supabase or webapp.
- MessageComposer shell: `ComposerLayout` → `ComposerDesktopLayout` / `ComposerMobileLayout` wrap `ComposerBar`; TipTap body is `MessageComposer.EditorContent`. Format toggle sits left; emoji, mention, and send are ungrouped ghost controls on the right with inline Lucide `@icons` literals in each action-button file—not mixed icon sets. Old `*Chrome` / `MessageComposer.Editor` layout names are retired.
- Composer emoji, mention, and link-dialog overlays are mutually exclusive — only one open at a time via `dismissComposerOverlays.ts` helpers. Toolbar mention: active toggle closes on re-click (no stacked `@`); mid-word caret gets a leading space before `@` so TipTap suggestion opens. Active state tracks `getMentionPickerActive()` synced from Floating UI visibility, not the module flag alone. Escape order: link dialog → emoji panel/picker → mention → reply/edit.
- TOC + chatroom right-click menus share `@components/ui/ContextMenu` primitives (`contextMenuPanelClassName`, `ContextMenuRow`, `ContextMenuDivider`, `MenuItem`); mobile long-press uses the same row/divider shell via `ContextActionsMenu`. Panel is Tailwind `flex flex-col list-none`, not daisyUI `menu` — `.menu` only styles direct `button`/`a` children, so `<span>` rows need `group`/`cursor-pointer`/`group-hover:bg-base-300` on the row. Dividers are empty `<li role="separator">` with `bg-base-300 h-px my-[4px]` on the li — never inner divs, daisyUI `divider`, or `border-t` under `.menu`.
- Chat + pad hyperlink UI (`TipTap/hyperlinkPopovers/`): pad desktop → `createHyperlinkDesktop` + one page-level `HyperlinkPopoverPortal` (never mount inside `MessageComposer` when `DesktopEditor` already mounts it); pad mobile → `createHyperlinkMobile` → `linkEditor` / `linkPreview` sheets via `useSheetStore`. Mobile **chat composer** is a separate surface: `getHyperlinkPopoverConfig(isMobile, surface)` with `HyperlinkSurface = 'pad' | 'composer'` routes `composerMobilePopoverEntries` (return `null`, open `composerLinkDialogStore`) and portaled `ComposerLinkDialog` in `MobileLayout` — not pad `linkEditor`. Composer `useTiptapEditor` uses `getHyperlinkPopoverConfigAtInvoke(() => isComposerMobileRef.current, () => 'composer')` so frozen `useEditor([], …)` reads layout at invoke time (`variant === 'mobile'` via ref, not `settings.editor.isMobile`). Snapshot selection in `composerLinkSelectionRef` before modal focus steal (toolbar create + iOS save). All composer link dialog paths (preview tap on `<a>`, edit/add open, Cancel, dismiss) must preserve keyboard state — open stays open, closed stays closed; never call pad `previewHyperlink.dismissSoftKeyboard`; snapshot `keyboardWasOpenAtOpen` at open and refocus on close only when the keyboard was open (Cancel must not collapse an open keyboard). `ComposerLinkModalShell` centers in the visual viewport on iOS and Android via `--visual-viewport-height` / `--visual-viewport-offset-top`, not `fixed inset-0` or top-clamped placement. URL field is a `<textarea>` (not `<input>`) with Tailwind v4 `field-sizing-content` + `max-h-24` so long URLs auto-grow within the row instead of overflowing horizontally; pad `HyperlinkEditor` and composer `ComposerLinkEditorDialog` share the shape, daisyUI `.input` wrapper around the textarea owns the border/focus ring (it has no built-in textarea styling), and the popover shell is responsive (`min-w-[26rem]` floor, `max-w-[min(34rem,calc(100vw-2rem))]`), not a fixed `w-[24rem]`.
- Mobile pad has two overlay systems: **`ModalDrawer`** (checkbox + label; left TOC via `TocModal`) and **`BottomSheet`** (`react-modal-sheet` + `useSheetStore`; chatroom, notifications, filters, bookmarks, documentSettings, pad link sheets). `BottomSheet` mounts outside `mobileLayoutRoot` in `MobileLayout`. Opening a sheet from inside `TocModal` must `closeModal()` before `openSheet()` — the drawer is `z-30` and stacks above the sheet (same pattern as filters). Extend new mobile action panels via `SheetType` + `SHEET_CONTENT`/`SHEET_PROPS` registries — not parallel sheet systems. Chatroom sheet: on composer `focusin`, `isKeyboardOpen`, or `useComposerEmojiPanelStore.isOpen`, snap full height (`CHATROOM_TOP_SNAP_INDEX`) + `avoidKeyboard`; emoji panel must OR into the same trigger.
- Desktop pad toolbar exposes **`BookmarkPanel`**, **`FilterPanel`**, and **`DocumentSettingsPanel`** as Floating UI popovers (`w-[28rem]`, `bottom-end`). Mobile parity: filters, bookmarks, and document settings via `TocModal` sticky footer → `filters` / `bookmarks` / `documentSettings` bottom sheets (`FilterModal` + panel reuse with `variant="sheet"`); active slug filters still surface as `FilterBar` chips on the pad. **`SettingsPanel`** (user account) and **`DocumentSettingsPanel`** (per-doc metadata/markdown I/O) stay separate scopes. `TocMobile` append-heading button scrolls with the list; footer is filter + settings + bookmarks (bookmarks when authed). `BookmarkItem` "View in chat" dispatches `CHAT_OPEN` only — do not add `closeSheet()` or `activeSheet` checks (`NotificationItem` parity). Panels that have both surfaces accept `variant?: PanelSurfaceVariant` (`'popover' | 'sheet'`, canonical type lives in `apps/webapp/src/types/ui.ts`); sheet variant hides the in-header close button (drag/backdrop dismiss only, matches notifications) and swaps the inner scroll region to `flex-1 min-h-0` instead of `max-h-96`. Segmented Active/Archived tab chrome is the shared `@components/ui/PanelTabBar` (`PanelTabOption<T>`, generic `T extends string`) — used by `NotificationPanel`, `BookmarkPanel`, and the mobile sheet variants alike; do not re-roll per-panel daisyUI `tabs` markup. **`TabbedPanelBody`** (`@components/TabbedPanelBody`) owns tab bar + infinite-scroll list; **`PanelSurfaceShell`** owns popover vs sheet header fork — both at `components/` root, not `ui/`. Sheet body horizontal pad + bleed tokens live in `@utils/sheetBodyPadding` (`sheetBodyPadClassName`, `horizontalPadBleedClass`); display count caps use `@utils/formatCappedCount` — not under `ui/` or duplicated inline.
- **`extension-hypermultimedia` embed configuration.** `@docs.plus/floating-popover` (extracted from hyperlink; local popover impl deleted there) positions media toolbars. **X** uses oEmbed width presets (Compact 280 / Standard 400 / Wide 550); `theme` is a per-node attr (`light`/`dark`, toolbar-switchable) passed to oEmbed — exclude `x` from gripper/`acceptedNodes`. `hide_media`, `hide_thread`, `lang` (+ kit `dnt`) are kit defaults and per-node attrs for integrators, not toolbar controls. **YouTube** maps official iframe query params in `nodes/youtube/embedOptions.ts` (kit defaults + per-node attrs); paste extracts `start` from `t=?`/`start=`; `loop=1` auto-sets `playlist` to the video id; no toolbar UI for player params unless explicitly requested. **Iframe embed nodes** (YouTube, Vimeo, SoundCloud, Loom) share `createIframeEmbedNodeView` / `createIframeEmbedRenderHTML` via `src/utils/iframeEmbedNode.ts`; per-host URL/attr logic stays in each `embedOptions.ts`. **Loom** kit default `scrolling: 'no'`; oEmbed is 4:3 — README gallery height uses `README_GALLERY_LOOM_HEIGHT` (360), not 16:9, or the iframe scrolls. Shared kit in `src/utils/embedKit.ts`: `resolveEmbedOption`, `embedAttrsEqual`, `resolveEmbedLayoutDimensions` (insert-time column clamp for default 640×480 embeds). **Loading shell:** `loadingShell` kit option (default `true`; factory override); `src/loading/` + `media-loading-shell.css` (`data-hm-loading`, `--hm-loading-*`); clipboard file upload progress stays webapp (`mediaUploadPlaceholder`); X uses fluid `hm-media-host--fluid` after widgets.js settles (~6s in README gallery captures via `X_WIDGET_SETTLE_MS`).
- **`extension-hypermultimedia` media-resize chrome is hover-driven on desktop (Notion-style).** `MediaResizeControls` (`src/extensions/mediaResizeControls.ts`) wires `mouseover` / `mouseout` / `click` through `handleDOMEvents`; per-editor state lives in `WeakMap<Editor, MediaControlsState>` at `src/utils/media-resize-controls.ts` (not module globals). Desktop is gated by `hasFinePointer()`; `ResizeGripper` uses `acceptedNodes` (resizable only), `MediaResizeControls` uses `trackedNodes` (all media incl. X for delete teardown). Interactive embeds (`isInteractiveEmbed` — everything except `image`/`audio`) stay clickable: gripper shell is `pointer-events: none`, only `.media-resize-clamp` handles capture; images/audio use click-to-lock. **Toolbar gap:** `wireToolbarHoverBridge` + deferred hide keep the floating toolbar open while the pointer crosses the popover gap (gripper + popover `pointerenter`/`pointerleave`). **Column max-width:** gripper drag and inserts cap via `getEditorContentWidth` / `resolveEmbedLayoutDimensions`. **Pixel sync:** gripper commits attrs but node views must mirror width/height onto iframe/img/video/`.hm-media-host` via `sync*NodeLayout` in `src/loading/syncLayout.ts` (`syncElementPixelSize` on shell + surface). **Delete:** the document-CAPTURE-phase Delete/Backspace handler (`handleMediaDeleteKey`, registered with capture `true`) deletes the hovered media node (`deleteActiveMediaNode`), so it MUST bail when focus is inside editable chrome the node view owns — `INPUT`/`TEXTAREA`/`SELECT` inside `.media-toolbar` and `document.activeElement.closest('.hm-caption')`; capture fires before a nested element's bubble-phase `stopPropagation`, so the guard lives in the handler itself, not the caption/input listener. Node delete/cut must hide gripper + toolbar via `targetNodeCountChanged`, `appendTransaction`, and `purgeOrphanedResizeChrome()`. **Resize drag:** never inject overlay into node-view `contentDOM` — toggle `hypermultimedia__resize-gripper--dragging` on the gripper widget via `setGripperDragging` (`gripperDrag.ts`); use `setPointerCapture` + window pointer listeners so drag survives iframe overlays. **Drag end:** `restoreControlsAfterResize` clears `mediaResizing`, re-shows chrome only when `:hover`, calls `editor.commands.focus()` (never `blur()`). Gripper CSS: `src/styles/resize-gripper.css` (webapp `globals.scss` import; `--hm-resize-border` / `--hm-resize-handle-bg`). **Toolbar:** the media toolbar is a declarative action registry (`BASE_ACTIONS` / `NODE_ACTIONS`, resolved by `resolveMediaActions`) mounted in the node's top-right corner (Notion-style) with an inline vs `…`-overflow split; overflow/submenu popovers use `@docs.plus/floating-popover`; CSS lives in `media-toolbar.css` (renamed from `media-toolbar-popover.css`, webapp `globals.scss` import updated); host integration is via the `mediaActions` / `mediaToolbar` / `isUploadedMedia` hooks. **Captions:** every media node has an editable `<figcaption>` whose `caption` attribute (shared logic in `src/caption.ts`: `captionAttribute`, `createCaptionElement`, `readCaption`, `wrapRenderWithCaption`, `mediaElementFrom`) is the source of truth and persists via collab/JSON/same-editor copy-paste; standalone-HTML `<figure>`/`<figcaption>` round-trip is image-only by design (embeds/video/audio keep the editable figcaption but never serialize `<figure>`). A node view with an editable figcaption MUST add `stopEvent` returning true when the event target is inside the caption element plus `ignoreMutation` for its subtree, or ProseMirror treats typing as editor transactions and deletes the node; caption commit/focus/keydown and `setMediaCaption` must guard on `editor.isEditable`, and the node-view `sync`/update re-sets the caption `contenteditable` to mirror it. **Node-type table:** classification is one table in `src/utils/media-target.ts` — `mediaKind(nodeType): 'asset' | 'embed'` (asset = image/audio/video, downloadable), with `isDownloadableMedia` and `isInteractiveEmbed` (= embed OR `video`) derived from it; keep the explicit `if (!nodeType) return false` null guard because `mediaKind(null)` returns `'embed'`. `toolbar/handlers.ts` `isDownloadable` / `isEmbedNode` derive from the same table, and video/audio node-view `update()` remount guards use the keyed `embedAttrsEqual(attrs, snapshot, KEYS)` helper from `embedKit.ts`, same as x/iframe.
- **Extension clean-room Cypress harnesses** (all five `@docs.plus/extension-*`): specs under `cypress/e2e/**` and `cypress/docs/**` (kebab-case dirs); `bun run test` uses `start-server-and-test` against `docs-playground` (ports 5173–5177; `pretest` builds `dist/`). Each extension's `cypress/tsconfig.json` extends `@docs.plus/playground/cypress/tsconfig.json` with `include: ["./**/*.ts"]` — without it, tsc inherits the package `rootDir: src` and fails once `test/playground/tsconfig.json` pulls playground outside `src/`. Publishable extensions declare `engines.node` only (aligned with root floor) — not `engines.bun`; they ship prebuilt browser bundles and peers are `@tiptap/*`, while Bun stays the root maintainer publish/install toolchain. README galleries: hero + optional `<details>`/`<summary>` scenes with light/dark `<picture>` pairs; `docs:screenshots` runs `cypress/docs/*`; `flattenReadmeScreenshots.ts` + shared `readmeGallery.ts` flatten into tracked `assets/*.png` (hypermultimedia: 18 PNGs, one per node type). HM asset nodes use committed CC0 media in `assets/readme-media/` served by playground `--readme-media-dir` at `/readme-media/*` (not npm tarball). Gallery captures wait for media ready, then `hoverMediaControls`/`activateImageGripper` so toolbar + gripper appear in frame (X: toolbar only, ~6s `widgets.js` settle). Family harness index: `extensions/README.md`; CI/local dist build: `scripts/build-extensions.sh` (`.github/actions/build-extensions`); `run-tests.sh --extensions` with `EXTENSION_DIST_READY=1` skips per-package `pretest` rebuilds; all-five publish gate: `scripts/extension-preflight.sh`. Publishable dir list + gate metadata: `scripts/publishable-extensions.ts` (`hasUnit` drives Jest vs Cypress-only notes; imported by `release-family.ts`). Extension `.gitignore` must anchor package-root docs ignore as `/docs/`, not `docs/`, or `cypress/docs/*.cy.ts` is accidentally ignored. Publish lifecycle hooks must use `bunx release-prepack` / `bunx release-preflight` — bare bin names fail under `bun publish` (workspace `.bin` not on PATH). Phase 1 laptop publish: `bun publish --tag next --otp …` only — never `npm publish` (packed `peerDependencies` stay `catalog:` and break external installs). Internal workspace deps use `workspace:*`, not `file:` paths. `extension-hypermultimedia` playground imports built `@docs.plus/extension-hyperlink`; HM `pretest`/`docs:screenshots` builds hyperlink first. Hypermultimedia helpers `activateImageGripper` / `hoverMediaControls` / `dragResizeClamp` / `expectMediaLoadingPending|Ready` live in `cypress/support/e2e.ts`; resize specs assert rendered inline size on `img`/iframe/video/`.hm-media-host`, not attrs alone; caption specs use caret-based backspaces — not `{selectall}` or `{moveToStart}`. Clear stale playground ports with `lsof -ti:5173,5174,5175,5176,5177 | xargs kill -9`.
