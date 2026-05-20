# AGENTS.md

Persistent memory AI agents working **docs.plus**. Preserve rules unless maintainer changes.

## Agent Operating Rules

### Memory And Rule Boundaries

- `AGENTS.md` stores durable docs.plus invariants, maintainer prefs, regression guardrails.
- Keep vendor/mechanical refs in focused Cursor rules, not copied:
  - `.cursor/rules/daisyui.mdc`: daisyUI/Tailwind ref.
  - `.cursor/rules/react-floating-ui.mdc`: React 19 ref + Floating UI patterns.
  - `.cursor/rules/supabase.mdc`: SQL style + focused Supabase warnings.
  - `.cursor/rules/tiptap.mdc`: upstream Tiptap/ProseMirror ref workflow.
  - `.cursor/rules/scripts-naming.mdc`: scripts/Make-target naming; auto-attaches editing `package.json`, `Makefile`, workflows, `scripts/`.
- Long-form policy docs `.mdc` rule points at live `.cursor/docs/`. Today: `.cursor/docs/scripts-naming-convention.md` (timeless rule, source of truth). One-shot migration docs may live alongside as siblings (e.g. `scripts-naming-cutover.md`), deleted with cutover PR completing them.
- Package-internal rules not generalizing live **package-local `AGENTS.md`** next to package. Today: `packages/extension-hyperlink/AGENTS.md` for that extension's schema, commands, safety, click/preview, clean-room harness. Cross-package rules (release flow, scripts naming, monorepo toolchain) stay root file; package file read in addition to root file when working inside package.
- Guidance overlap: project-specific policy in `AGENTS.md` or `.cursor/docs/`, detailed authoring/reference in relevant `.mdc`.

### Package Manager

- Use Bun: `bun install`, `bun add`, `bun add -d`, `bun run`, `bunx`, `bun publish`, `bun pm pack`.
- Never npm, yarn, pnpm, `npx`, `npm publish`, package-lock/yarn-lock.
- Keep `bun.lock` only lockfile. No `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`.
- User sometimes prefers local command instructions over agent-run installs; ask or provide command when dep changes not clearly part of task.
- Use root workspace commands:
  - `bun run --filter @docs.plus/webapp dev`
  - `bun run --filter '*' build`
- Required engines: Node >= 24.11.0, Bun >= 1.3.7.

### Git And Commits

- No commit unless user explicitly asks.
- When **authoring** implementation/execution plans (e.g. superpowers `writing-plans`, `docs/superpowers/plans/`), do **not** include commit messages, `git commit`, `git add`, generic "commit changes" steps. End with review/verification only; dev inspects diff and commits manually.
- Executing multi-task plans from `docs/superpowers/plans/`, every task ends "Review checkpoint": surface touched files + short summary, stop. No `git add`, `git commit`, `git push`, `git stash`, amend. Quality gates (`bun run … typecheck|test|build`) still run between tasks.
- Execute plans only **current** workspace (this git worktree). No switching to another worktree, path, parallel checkout; all edits/commands/tests run against open repo root.
- **Work on `main` only. Never create new branch or worktree for any task, step, plan, subagent.** No `git checkout -b`, `git switch -c`, `git worktree add`, no passing `isolation: "worktree"` to Agent tool. No "feature branch", "isolated worktree per task", "branch off main for fix". All edits on checked-out `main`. User manages branching outside agent session.
- **Rule applies every agent/subagent without exception.** Dispatching any subagent (`Agent` tool, `general-purpose`, `Explore`, `Plan`, specialized like `code-reviewer`, `frontend-developer`, `tdd-orchestrator`), dispatching prompt must explicitly state "work on current `main` working tree; do not create branches or worktrees." Never set `isolation: "worktree"`. Skills (`superpowers:using-git-worktrees`, `superpowers:executing-plans`, `superpowers:subagent-driven-development`) suggesting isolating per-task are overridden — stay on `main`. Supervisor, orchestrator, parallel-agent flows all share same `main` working tree.

### Code Quality

- Keep production code DRY, KISS, YAGNI, SOLID, industry-standard. No overengineering.
- Export names match file names. Fix identifier typos during refactors.
- Feature folders use one central type module: `types.ts` or `types/index.ts`. No scattered feature-owned `type`/`interface` across `hooks/`, `commands/`, `utils/`, `stores/`, `components/`.
- Keep feature layers separate, navigable: `index.ts` -> `types.ts` -> `hooks/`/`commands/`/`utils/`/`stores/`/`components/`.
- Treat perf/memory leaks as production-readiness, not follow-up. Audit Tiptap/ProseMirror changes for re-render storms, unsubscribed listeners, detached views.
- Any `editor.on(...)` or `getDefaultController().subscribe(...)` must return + call unsubscribe on unmount unless intentionally module-scoped and guarded.
- Keep debug/info loggers on editor core paths. No stripping during cleanup.

### Testing And Verification

- **Default: no new tests.** Add test only when (a) user explicitly asks, (b) change pins regression actually shipped/reported, (c) failure mode is real branching/ordering/race/parsing/projection bug hard to verify by hand. Cannot name specific failure mode in one sentence, no test. "Seemed good idea to add coverage" not a reason.
- **Prefer integration over unit.** Test warranted, default Cypress E2E or real-stack integration exercising actual user behavior end-to-end. Unit only when unit has branching logic dense enough E2E couldn't isolate regression — parsers, projections, schema validators, pure utilities, message-grouping projections, scroll-mode state machines.
- **Never write these test shapes** (delete on sight, no generating): type assertions re-proving what `tsc` proves; framework-behavior tests ("React renders", "Tiptap commands return truthy", "Supabase client exists", "useEffect runs"); mock-only flows every dep faked + assertion is "mock called with X"; snapshots of unstable output (full DOM trees, formatted JSON dumps, ProseMirror node JSON); "renders without crashing" smoke; trivial props-passthrough/getter/setter; coverage-chasing with no named behavior.
- **TDD opt-in, not default.** Follow strict TDD only when user explicitly asks ("write test first", "let's TDD this", "/tdd"). Overrides any subagent skill defaulting TDD on every fix/feature. Otherwise: design change, ship, verify with `bun run build`/`bun run check` + relevant Cypress suite, stop.
- **Observe tests pass before declaring done.** Test added in change must run locally and observed green — "should pass" not evidence. Pre-existing failing tests fixed same change or explicitly `.skip`'d with one-line reason + issue link; never silently disabled.
- **Unsure, ask.** Mid-test and cannot articulate in one sentence which user-visible failure prevented, stop and ask whether test wanted. Cost of low-value test (review burden, maintenance, false confidence) > cost of missing one we add later when real bug appears.
- Run `bun run build` after major refactors before claiming completion.
- Validate full-document paste (`⌘A` -> `⌘V`) on editor changes affecting paste/document transforms.
- Authoring conventions/naming under §Tests (Monorepo Toolchain).

### Skills And Prose

- Cleanup/review skills autonomous by default. No gating every step; stop only when decision genuinely ambiguous.
- `--review` opt-in. Default cleanup applies edits + prints one terse line per file.
- Reports terse next-step outlines, not detailed plans.
- Real senior-level refactors in scope under gated-approval: exported symbol renames, typo fixes, file moves, file splits, dep bumps.
- Safety rules absolute: no changing runtime behavior for handled inputs, editing generated files, committing directly.
- All prose work routes through `.cursor/skills/tech-writer`: README, CHANGELOG, reports, post-mortems, design docs, PR descriptions, JSDoc/docstrings.
- Skills never create branches/worktrees. Operate in current directory/branch.

### Documentation And Comments

- Comments/JSDoc explain non-obvious _why_, never narrate _what_. Names, types, structure are contract.
- Hard cap: **≤ 4 lines** per JSDoc or block comment. Need more, code or name wrong — fix that. No section banners, "Why X, not Y" preambles, restating signatures or union members in prose.
- Cleanup includes deleting comments violating this. "I didn't write it" not reason to keep.

### UI And Theme

- Theme/UI color consistency first-class. Every surface, including third-party pickers, follows design tokens.
- DaisyUI-backed surfaces, prefer DaisyUI + Tailwind over bespoke nested hover/active stacks fighting parent controls.
- Use `.cursor/rules/daisyui.mdc` for daisyUI/Tailwind ref, `.cursor/rules/react-floating-ui.mdc` for React/Floating UI pitfalls.

## Monorepo Toolchain

### Workspace

- **docs.plus** is Bun monorepo, workspaces in root `package.json` as `"packages/*"`.
- Main app: `@docs.plus/webapp` (Next.js Pages Router).
- Backend: `@docs.plus/hocuspocus` / `@docs.plus/hocuspocus.server`.
- Admin UI: `@docs.plus/admin-dashboard`.
- Editor code under `packages/webapp/src/components/TipTap/`.
- Shared webapp utilities `packages/webapp/src/utils/`; `src/lib/` removed. Keep feature-local helpers colocated.

### Dependencies

- Root `package.json` owns shared devtool versions: ESLint, TypeScript, Prettier, Stylelint, Jest, `babel-jest`, `jest-environment-jsdom`, `@types/jest`, `@babel/preset-typescript`, related tooling.
- Root `catalog:` centralizes pins. Workspaces reference matching deps as `"package": "catalog:"`.
- No duplicating Jest/Babel dev deps in package workspaces unless exceptional documented reason.
- `@tanstack/react-query` root-cataloged v5 for webapp + admin-dashboard. Object syntax; mutation pending state `isPending`, query `isLoading` remains valid.
- Stay ESLint 9.x + TypeScript 5.x until dedicated migration. ESLint 10 + TS 6 have breaking changes.
- Dep update flow:
  - Bump version ranges: `bun run update` (patch + minor only; root catalog + every `packages/*`). Majors: `bun run update --upgrade`. Preview: `bun run update --dry-run`.
  - After `update`, run `bun install` at repo root. No parallel `bun update`/installs in individual packages; shared `bun.lock` can race with `EEXIST`.
- Removed tools/scripts stay removed: per-package `update:packages`, `scripts/reinstall-packages.sh`, `reinstall:all-packages`, `update:all-packages`.

### Tests

- Unit + E2E stack: Jest + Cypress. Script names + `CYPRESS_PARALLEL` semantics in naming convention doc; this section captures docs.plus-specific orchestration, Jest wiring, authoring conventions. Policy (when to write test, what shapes to avoid) in §Testing And Verification.
- Run order `run-tests.sh`:
  1. `@docs.plus/extension-indent` Jest via local `jest.config.cjs`.
  2. `@docs.plus/extension-hyperlink` clean-room Cypress against built `dist/`.
  3. `@docs.plus/webapp` Jest (`jest --passWithNoTests`, so empty/temporarily absent suite no fail CI/local).
- Jest wiring:
  - `@docs.plus/webapp` keeps `next/jest` in `jest.config.js`.
  - Library packages needing Jest use local `jest.config.cjs`. Configure `roots`, `testMatch`, `transform`, `testEnvironment` there.
  - Prefer inline `babel-jest` options in `jest.config.cjs`; no per-package `babel.config.cjs` unless package-specific Babel behavior required.
  - Add library package test script as `"test": "jest --config jest.config.cjs"`.
  - No package-local Jest stacks in `package.json`; use root dev deps.
  - Jest 30 uses plural flag `--testPathPatterns`, not singular `--testPathPattern` from older docs/snippets. Correct on sight.
  - `bun test` is Bun's native runner — not substitute for Jest where Next/Jest or local Jest configs used.
  - Slice unit tests must call `enableMapSet()` from `immer` at module scope. Slice files don't enable themselves (only `useChatStore.ts` does at production load), so isolated slice instantiations fail with "MapSet plugin not loaded".
- Cypress conventions:
  - Split tests by concern, include README for scope.
  - Use `it()`, not `test()`. Consolidate overlapping tests.
  - ProseMirror `handleDOMEvents.click` not triggered by Cypress `realClick()`/`.click()`. Dispatch native `MouseEvent('click', { bubbles: true, clientX, clientY })` using `getBoundingClientRect()` coords. Same pattern for floating-toolbar `keydown` Escape dismissal.
- Naming:
  - Cypress E2E dirs/files use kebab-case (`copy-paste/`, `keyboard-shortcuts/`, `clipboard-validation.cy.js`); no `e2e-` or numeric ordering prefixes unless reason documented.
  - Unit test files use camelCase matching source module: `<moduleName>.test.ts`; perf tests use `<moduleName>.performance.test.ts`.
  - Cypress support modules camelCase; fixture files kebab-case; fixture dirs may use camelCase mirroring command name.
  - Avoid sprint, phase, audit, ticket names. Test descriptions describe behavior, not ticket IDs — within file, use either `should ...` phrasing or bare verbs consistently.

### ESLint Config

- `packages/eslint-config` is ESM with `"type": "module"`.
- Three-layer config:
  - `index.js`: base TypeScript + Prettier + `simple-import-sort`; no React.
  - `next.js`: base + React + hooks; used by webapp/admin-dashboard.
  - `library.js`: base + `explicit-module-boundary-types` + `no-console: warn`; used by `extension-*`.
- Consumers use 2-line ESM imports. No `createRequire` bridges.
- React plugins load only in `next.js`, never in library/backend configs.
- `eslint-plugin-prettier` removed. Only `eslint-config-prettier` used.

### Shared Library Config

- Keep root-level shared config as single source of truth.
- `tsconfig.base.json` applies to all `extension-*` packages. Package `tsconfig.json` only declare local `outDir`, `rootDir`, `include`, `exclude`.
- Package `exclude` must list colocated test paths: `src/**/__tests__/**`, `src/**/*.test.ts`. Otherwise tsc can expand computed source root above `src` and trip `TS6059`.
- `tsup.base.ts` exports `defineTiptapExtensionConfig(overrides?)`.
  - Factory intentionally Tiptap-specific. Hardcodes `@tiptap/core` + `@tiptap/pm` externals.
  - Build shape: ESM + CJS, dts, production sourcemaps/minify, `esbuildOptions.pure = ['console.log', 'console.debug']` in production.
  - No `drop: ['console']`; strips `console.warn` + `console.error`.
  - Package's `tsup.config.ts` should call `defineTiptapExtensionConfig()` through `defineConfig(...)`; pass overrides only for package-specific behavior.
  - Overrides shallow. Function-valued options like `esbuildOptions`, `external`, `dts` replace base value. Caller overrides `esbuildOptions`, must preserve base pure policy manually.
- `extension-hypermultimedia` intentionally preserves `console.warn`/`console.error` from `Logger` wrapper under shared tsup factory. Note in next CHANGELOG entry.
- Root `LICENSE` single committed license.
  - Each publishable package adds `/LICENSE` to package `.gitignore`.
  - `prepack` copies root `LICENSE` before `bun publish` or `bun pm pack`.
  - Symlinks fail because Bun pack drops them. Hard links fail because git stores independent copies.
- **Shared release scaffolding lives in `@docs.plus/release-tooling`** — internal workspace package exposing `release-prepack` + `release-preflight` as `bin` commands. Scripts data-driven: derive consumer's package name + dist-artifact list from own `package.json` (`name` + `exports` map), no per-consumer parameterization. Same DRY as `@docs.plus/eslint-config`, `tsconfig.base.json`, `tsup.base.ts` — cross-package scaffolding hoisted, never copied. Publishable libraries wire `prepack`/`prepublishOnly` to these bins per Type 4 contract in naming convention doc.
- No centralizing package-specific files: `README.md`, `CHANGELOG.md`, package source, 3-line `eslint.config.js` shims, `package.json` fields.

### Docker

- Use one Docker base tag everywhere: `oven/bun:1-slim`.
- No mixing `1-alpine`, `1-slim`, hardcoded patch tags.
- No copying `node_modules` between Docker stages. Bun uses symlinks into virtual store; copied installs can break module resolution.
- Any stage running `next build`, extension builds, or config requiring deps must run `bun install --frozen-lockfile`.
- Copy only `package.json`, `bun.lock`, workspace tree between stages.
- Any Dockerfile stage running `bun run build` for `@docs.plus/extension-*` must also `COPY` root-level shared configs `tsconfig.base.json` + `tsup.base.ts` into build context. Each extension's `tsconfig.json` extends `../../tsconfig.base.json` + each `tsup.config.ts` imports `from '../../tsup.base'`; missing either fails extension build with `Could not resolve "../../tsup.base"`. Affected Dockerfiles today: `packages/hocuspocus.server/docker/Dockerfile.bun` + `packages/webapp/docker/Dockerfile.bun` (`build-extensions` stage must copy via `--from=deps`).

### Standalone Bun Scripts

- Root `tsconfig.json` doesn't include `scripts/`. IDE lint errors like missing `node:fs` or `import.meta.dir` in `scripts/*.ts` usually noise.
- Smoke-check standalone Bun scripts with:

```bash
bun build scripts/<file>.ts --target=bun --outfile=/tmp/out.js
```

- Avoid ad-hoc `bunx tsc --noEmit <file>` unless passing `--ignoreConfig`; otherwise `TS5112` fires when `tsconfig.json` exists.

## Publishing And Releases

### Extension Package Contract

- Publish workspace extensions under org-owned `@docs.plus` scope.
- `exports.require.types` must point to `./dist/index.d.cts`, not `.d.ts`.
- `sideEffects` must include CSS, e.g. `['**/*.css']`; no bare `false`.
- Every scoped package needs `publishConfig.access: "public"` or `bun publish` defaults private + can 402.
- Package metadata should include `homepage`, `bugs`, discovery-oriented `keywords`.
- Adding any root re-export through `src/index.ts` or `src/utils/index.ts` is minor release, not patch.
- Resolve `[Unreleased]` to real version before `bun run build`, `bun pm pack`, `bun publish`.
- `prepublishOnly` runs `release-preflight`; asserts:
  - publisher user-agent is `bun/*`;
  - every `dist/...` path in consumer's `exports` map exists on disk;
  - no literal `catalog:` leaks into built bundles.

### Release And Publish

- `RELEASE_POLICY.md` authoritative for versioning doctrine, cutover phase, lockstep activation, `release:family`, CHANGELOG style, soak/promotion, CI guards, readiness checklists. Bullets below are operational subset agents need at keyboard.
- Phase 1 cutover: each extension can ship first `2.0.0` to `@next` independently. Lockstep activates only through explicit switch-flip commit in `AGENTS.md`/`RELEASE_POLICY.md`, not automatically when versions align.
- Lockstep release entry:

```bash
bun run release:family
```

Only root release/publish script is `"release:family": "bun scripts/release-family.ts"`. No reintroducing removed `release`, `release:major`, `release:minor`, `release:patch`, `version*`, parallel `publish` scripts.

- Publishing on maintainer laptop because npm 2FA-on-write requires OTP. No `NPM_TOKEN` in CI for publishing:

```bash
bun publish --tag <next|latest> --otp <6-digit>
```

- Major bumps go to `@next` for soak; stable patches/minors go to `@latest`. Promote later with `npm dist-tag add <pkg>@<ver> latest` when appropriate.
- Release tags are `<package-name>@<semver>` (e.g. `@docs.plus/extension-hyperlink@2.0.0`). `v<semver>` reserved only as fallback for future repo-wide releases.
- Release notes use state-machine `awk` slice; range form fails because both ends can match same heading:

```bash
awk '/^## \[/{ if (found) exit; if (/^## \[<ver>\]/) found=1 } found' packages/<pkg>/CHANGELOG.md
```

- Announcement happens after npm publish:
  - GitHub Releases are announcement gate.
  - Discord push activity: `secrets.DISCORD_WEBHOOK` via `.github/workflows/discord-activity.yml`.
  - Discord releases: `secrets.DISCORD_RELEASE_WEBHOOK` via `.github/workflows/discord-release.yml`. Reserve unqualified `DISCORD_WEBHOOK` for original push channel.
  - Release embeds color-code stability: green `#22c55e` stable, orange `#f97316` pre-release.
  - Install hints switch on `is_pre` — stable uses `bun add <pkg>@<version>`, pre-release uses `bun add <pkg>@next`. No hard-coded per-package paths in workflow.

### Extension Version Doctrine

- All five publishable `@docs.plus/extension-*` packages share same major, tracking docs.plus product line.
- `1.x` = 2023 product line.
- `2.x` = docs.plus alpha v2.
- Extensions are leaf packages; lockstep is policy, not graph-forced.
- Rotating per-package cutover state in [`.cursor/docs/extension-version-cutover.md`](./.cursor/docs/extension-version-cutover.md), deleted with lockstep switch-flip PR.
- Family-release script invariants in `scripts/release-family.ts`:
  - Use `spawnSync` helper calls, no shell strings, so OTP never lands in `ps aux` or shell history.
  - GitHub release creation idempotent across resumes: iterate `[...published, ...skipped]` + guard each with `gh release view <tag>`.
  - Push explicit tag list only. Never run `git push --tags`.
- CLI flags: `--dry-run`, `--tag <next|latest>`, `--allow-noop`, `--generate-noop-changelogs`, `--help`.
- Preflight aggregates errors before OTP prompt:
  1. lockstep;
  2. CHANGELOG entries;
  3. `dist/` freshness against `src/`;
  4. per-package `prepublishOnly`;
  5. clean working tree + `HEAD` matches `origin/main`;
  6. `npm whoami` + `git user.email`;
  7. local + remote tag collisions;
  8. no-op detection via `git diff <prevTag>..HEAD -- packages/<pkg>/src/`.
- CHANGELOG style guide:
  - Themed sections per major: Highlights, Breaking, Added, Changed, Fixed, Security, Removed, Documentation, Internal.
  - Include code-diff migration guides + one-shot rename scripts for mechanical changes.
  - Disclose mispublishes/unpublishes honestly.
  - Add brief pre-X.0 development history when public versions diverge from internal milestones.
  - Never auto-generate entries from commit subjects. Lerna/Changesets/Release-Please not adopted.

## Editor Architecture

### Document Model And Migrations

- Server-side `TiptapTransformer.toYdoc`/nested-to-flat migrations must use extension set covering every node/mark in stored docs.
- Include `TaskList`/`TaskItem` from `@tiptap/extension-list` aligned with webapp. StarterKit alone not enough.
- Missing node/mark types fail encode; not flattening issues.
- Batch migrations fail closed. Never overwrite stored Yjs bytes when transform/encode fails; keep prior bytes + surface doc id.
- Run migration CLI from `packages/hocuspocus.server` after root `bun install`:

```bash
bun run migrate:nested-to-flat
```

- Invoking script path from arbitrary cwd can break Bun resolution of `yjs` for `@hocuspocus/transformer`.

### Heading Schema

- Editor uses flat heading schema: `heading block*`.
- Sections decoration-based.
- `attrs['toc-id']` renders as `data-toc-id`.
- Shared heading utilities in `TipTap/extensions/shared/`: `computeSection`, `moveSection`, `canMapDecorations`, `transactionAffectsNodeType`, `matchSections`.
- Section reorder TOC-only via `useTocDrag`/`moveHeading` + `moveSection`. No in-editor heading drag handle extension.

### HeadingScale

- `extensions/heading-scale/heading-scale.ts` mandatory spec.
- Heading font size dynamic by rank within section, not fixed per HTML level + not Google-style ladder.
- Each H1 starts new section.
- Within section, distinct heading levels sorted + sizes interpolate evenly between 20pt max + 12pt min.
- Same heading level repeated in one section gets same visual size.
- Section with one distinct heading level uses 20pt.
- Title, first top-level H1, part of section 1.
- Use decorations only: `--hd-size`, `--hd-rank`, `--hd-total`. Never write sizes into document.
- Plugin state is `{ fingerprint, decorations }`.
- Fingerprint is top-level heading levels in order, e.g. `1,2,4,1,3`.
- Rebuild fully when fingerprint changes or `y-sync$` meta present; otherwise map decoration set.
- No replacing with fixed per-level point maps.

### Editor Performance

- Editor jank usually React/Zustand re-renders, not ProseMirror.
- Never put UI flags in `useEditor` deps.
- Use `shouldRerenderOnTransaction: false` on collaboration editors.
- Decoration plugins avoid full rebuilds every keystroke. Use `transactionAffectsNodeType(tr, 'heading')` or cheaper structural check.
- HeadingScale uses heading-level fingerprint, not only `transactionAffectsNodeType`.
- Placeholder uses `@docs.plus/extension-placeholder` with O(1) state `init/apply`. No replacing with Tiptap built-in placeholder, which scans with `doc.descendants`.

### Editor State And References

- **Store discipline.** `useStore` (main app store in `stores/useStore.ts`) combines six slices: `workspaceStore`, `usersPresence`, `history`, `notification`, `virtualKeyboardStore`, `dialogStore`. Standalone stores (`authStore`, `focusedHeadingStore`, `sheetStore`, `themeStore`, chat-domain `useChatStore`) live alongside but not folded in. All `useStore` calls must use leaf selectors; never select `(state) => state` or `(state) => state.settings`.
- **Canonical editor handle:**

```ts
useStore((state) => state.settings.editor.instance)
```

- Registered by `useEditorAndProvider.ts` via `setWorkspaceEditorSetting('instance', editor)`.
- Consumers: `EditorContent.tsx`, `useTocActions.tsx`, toolbar, collaboration-document features.
- `window._editor` set only by `pages/editor.tsx` (standalone playground); undefined on real document/collab routes. No new `window._editor` readers in document-route features.
- React mobile sheets needing editor reference use typed `SheetDataMap` payloads (e.g. `linkPreview`, `linkEditor`), not globals.
- **ProseMirror state pitfalls:**
  - `doc.nodeAt(pos)` can throw `RangeError` for out-of-range positions. Guards must not assume null-only.
  - `transaction.before` is pre-step document `Node`, not `EditorState`. Never call `PluginKey.getState(transaction.before)`.
  - For fold-driven UI like TOC, snapshot heading-fold plugin state from `editor.state` + diff across transactions.

## Webapp UI Systems

### TipTap Styling

- TipTap pad-only SCSS under `packages/webapp/src/styles/editor/`.
- Load path: `styles.scss` -> `components/_index.scss` -> `@use '../editor'`.
- No parallel `.scss` files next to TipTap extensions.
- Pad chrome:
  - `PadTitle` has `border-b` for header-to-toolbar.
  - `.tiptap__toolbar` uses `border-b` only; no `border-t` against `PadTitle`.
  - Pad sheet top border comes from `_blocks.scss` for toolbar-to-editor.
  - Mobile `.m_mobile .tiptap__toolbar` lives in `_blocks.scss`.
- Scrollbars:
  - Shared `:root` tokens in `globals.scss`.
  - Use `scrollbar-custom scrollbar-thin` on `.editorWrapper` + TOC `ScrollArea`.
  - Avoid ad-hoc scrollbar styling on pad column.

### Mobile Bottom Sheets

- Canonical mobile sheet system is `packages/webapp/src/components/BottomSheet.tsx`, wrapping `react-modal-sheet`.
- Sheets register through `useSheetStore` with `SheetType` + `SheetDataMap`.
- New mobile UI surfaces add `SheetType` variant, typed `SheetDataMap` entry, React subscriber.
- Tiptap extension imperative-DOM popovers connect to React sheets through extension `popovers` config, gated by `settings.deviceDetect.isMobile` in `TipTap.tsx`.
- No parallel imperative-DOM bottom sheets next to React + Zustand sheet system.
- Keyboard dismissal per-sheet entry-point decision. No globalizing in `useSheetStore` or `BottomSheet`.
- Keep keyboard up for chatroom composer, `linkEditor`, message-composer `emojiPicker`.
- Dismiss keyboard for `linkPreview` + chatroom open paths: `CHAT_OPEN`/`CHAT_COMMENT` in `services/eventsHub.ts`.
- Single synchronous `editor.view.dom.blur()` not reliable; can lose race against queued ProseMirror focus.
- Proven dismiss patterns:
  - `useClipboard.ts` style: collapse selection, then `setTimeout(50)` + `editor.view.dom.blur()`.
  - `exitDocEditModeForSheet` in `eventsHub.ts`: `editor.setEditable(false)` + `editor.view.dom.blur()`.
- `editor.setEditable(false)` synchronously flips `contenteditable` through `view.updateState` in Tiptap 3.20; separate DOM attribute write not load-bearing for that timing.
- Always early-return when `isKeyboardOpen` false.

### Mobile Document Pad

- iOS Safari rules under `packages/webapp`, mainly `html.m_mobile` in `styles/_mobile.scss`.
- `html` + `body` are `position: fixed`.
- `.mobileLayoutRoot` tracks `window.visualViewport` through `syncVisualViewportToCssVars` + `AppProviders` visualViewport `resize` + `scroll`, coalesced with rAF.
- No skipping CSS sync when height deltas small. WebKit can emit sub-threshold steps after large keyboard resize.
- `useVisualViewportCssSyncOnFocus` listens for captured `focusin` on `.mobileLayoutRoot .tiptap__editor.docy_editor` + reruns viewport CSS sync when final resize missing.
- No `transform: translateZ(0)` on `.editor.editorWrapper`.
- No `contain` or `will-change: height` on `.mobileLayoutRoot`; WebKit can mis-paint contenteditable caret.
- Use `scrollElementInMobilePadEditor` for headings, TOC, deep links. Avoid raw `Element.scrollIntoView` on doc nodes.
- `innerHeight - visualViewport.height` can stay 0 while keyboard up. Use `applyVirtualKeyboardToStore` in `utils/virtualKeyboardMetrics.ts`.
- `useVirtualKeyboard` + `nudgeVirtualKeyboardOpenFromVisualViewport` both call that metrics path. Listen to visualViewport `scroll` + `resize`.
- In `useEditableDocControl`, never set `isEditable = isKeyboardOpen` on every effect. Keyboard opens before resize; only clear `isEditable` on keyboard close.
- 500ms DOM sync must not set `contenteditable=false` while `settings.editor.isEditable` still true.
- Read-mode `contenteditable` leak fix:
  - Keyboard-close store updates alone not enough.
  - Add/keep reconcile effect mirroring `isEditable -> false` to both `editor.setEditable(false)` + `view.dom.contenteditable`.
  - Guard false-direction only + only when `editor.isEditable` currently true.
  - No removing legacy entry-edit-mode behavior or 500ms grace.
- Removing JS `.focus()` call from `extension-hyperlink/clickHandler.ts` not enough; user tap itself can focus lingering `contenteditable=true` host.
- In `AppProviders`, if `.mobileLayoutRoot`, `visualViewport.offsetTop > 0`, + `window.scrollY > 0`, call `window.scrollTo(0, 0)`.
- Edit entry:
  - `EditFAB` + double-tap share `enableAndFocus()` from `hooks/useCaretPosition.ts`.
  - FAB uses `onTouchEnd` + suppresses synthetic `click`.
  - `enableAndFocus()` uses `editor.commands.focus()` only. No chaining Tiptap `scrollIntoView()` with `ensureCaretVisible`/`scrollCaretIntoView`.
  - Mobile caret scroll uses `behavior: 'auto'`.
  - `ensureCaretVisible` uses 2x rAF + one ~300ms retry.

## Backend And Infrastructure

### HTTP Modules

- New backend HTTP features go to `@docs.plus/hocuspocus.server` (Hono), not webapp `pages/api/`.
- New endpoints under `packages/hocuspocus.server/src/modules/<feature>/`:
  - `domain/`: pure logic + pipeline stages.
  - `http/`: controller, router, zod schema.
  - `infra/`: Redis cache + external SDK adapters.
  - `__tests__/`: unit + integration tests.
- `module.ts` exports `init({ deps }): { router }`.
- `src/index.ts` mounts with `app.route('/api/<path>', module.init({ ... }).router)`.
- Modules no top-level side effects.
- Link-metadata feature migrated out of `webapp/src/pages/api/metadata.ts`; no reintroducing server endpoints there.
- Link-metadata vocabulary `stage`, never `tier`.
- Stages are cache -> handlers -> oembed -> htmlScrape -> fallback.
- `STAGE_TIMEOUT_MS` + base User-Agent constant live in `domain/types.ts`.
- Host handlers under `domain/stages/handlers/`.
- `htmlScrape` appends `facebookexternalhit/1.1`; Reddit uses plain `DocsPlusBot/1.0`. Keep intentionally different.
- Test files mirror source filenames one-to-one, e.g. `htmlScrape.ts` -> `htmlScrape.test.ts`.

### Production And Docker Compose

- Production uses `docker-compose.prod.yml` with Traefik.
- Dev compose backend services need `context: .` at repo root to match `Dockerfile.bun`.
- Hocuspocus image:
  - `migration-extensions.ts` imports `@docs.plus/extension-hypermultimedia` + `@docs.plus/extension-inline-code` at runtime.
  - Root `.dockerignore` excludes `**/dist`.
  - Those packages must be built inside image; copying only package.json stubs not enough.
  - Other `@docs.plus/extension-*` packages may stay stubs for lockfile/workspace only.
- For prod WebSocket issues, check `hocuspocus` container health + `docker logs` before chasing Traefik.
- Traefik's no-router response is `HTTP/2 404`, `text/plain`, `content-length: 19`, body `404 page not found`; distinguish from backend 404s.
- Traefik access-log filters combined with AND. Keep `statusCodes: 400-599` alone; adding retry/min-duration filters hides fast 5xxs.
- SSR URL split:
  - `SERVER_RESTAPI_URL`: internal Docker-network base, e.g. `http://rest-api:4000/api`.
  - `NEXT_PUBLIC_RESTAPI_URL`: public browser base, e.g. `https://prodback.docs.plus/api`.
- Verify container env with:

```bash
docker compose -p docsplus -f docker-compose.prod.yml --env-file .env.production exec webapp env | grep -E 'SERVER_RESTAPI_URL|NEXT_PUBLIC_RESTAPI'
```

- `DocumentFetchError "Network error while fetching document"` only fires when `fetch()` throws: DNS, connection refused/reset, abort, 10s timeout. No fire for HTTP 4xx/5xx.
- Common cause is SSR startup race before `rest-api` accepts traffic.
- Probe SSR connectivity from inside `webapp`:

```bash
docker compose -p docsplus -f docker-compose.prod.yml --env-file .env.production exec webapp bun -e "fetch('http://rest-api:4000/health').then(r=>r.text().then(t=>console.log(r.status,t)))"
```

- Log env vars:
  - `LOG_LEVEL`/`HTTP_LOG_LEVEL`: all services.
  - `REST_LOG_LEVEL`: most important for REST route logging; set to `debug`.
  - `WS_LOG_LEVEL`: hocuspocus server.
  - `WORKER_LOG_LEVEL`: hocuspocus worker.
  - `HOCUSPOCUS_LOGGER=true`: only for collab noise debugging.
- Prisma `P3009` failed migration in REST logs independent of WebSocket/fetch failures. Resolve through Prisma's failed-migration flow, but doesn't block traffic because entrypoint continues starting service.

### Supabase

- **Never edit `packages/supabase/seed.sql`.** Agents + routine changes must not modify; use `packages/supabase/migrations/` + `packages/supabase/scripts/` only.
- **Never edit `packages/webapp/src/types/supabase.ts`.** Generated by Supabase CLI via `packages/supabase` script `types` (`bunx supabase gen types typescript --local` → that path).
- **Webapp types convention.** `packages/webapp/src/types/supabase.ts` is generated source of truth; rest of `packages/webapp/src/types/*.ts` (`api.ts`, `domain.ts`, `history.ts`, `message.ts`, `stores.ts`, `tiptap.ts`, `toc.ts`) is where derived/expanded types authored + re-exported. Build new shared types there + import — no redeclaring row/payload aliases inline in hooks, components, stores. SDK types (`@supabase/supabase-js` — `PostgrestError`, `PostgrestResponse`, `AuthError`) come from SDK directly + bypass this folder.
- **After any SQL change, regenerating types required, not optional.** Any work touching `packages/supabase/migrations/**` or `packages/supabase/scripts/**` must end with **developer** running `bun run --filter @docs.plus/supabase_back types` from repo root (local Supabase + root `.env.local`) + committing regenerated `packages/webapp/src/types/supabase.ts` in same PR. Agents no hand-edit + no run command — must remind developer to run before SQL work considered complete.
- SQL authoring style in `.cursor/rules/supabase.mdc`; keep this section focused on project architecture + safety policy.
- Pages Router Supabase architecture:
  - Browser singleton: `utils/supabase/index.ts`.
  - Factory: `component.ts`.
  - GSSP: `server-props.ts`.
  - API route client: `api.ts`.
  - URL resolver: `url.ts`.
  - DB types file: `types/supabase.ts` (generated only; see above).
- Browser code imports `supabaseClient` singleton.
- Apply single migration locally without resetting (preserves shared local state across worktrees) with `docker exec -i supabase_db_docsplus_supabase psql -U postgres -d postgres < packages/supabase/migrations/<file>.sql`. `bunx supabase db reset` wipes everyone else's state; `supabase db query -f` doesn't handle multi-statement files (`SQLSTATE 42601: cannot insert multiple commands into a prepared statement`).
- **Editing uncommitted migration file requires re-apply.** Iterating on unmerged migration (or behaviour-only changes to its paired `scripts/*.sql`), file on disk diverges silently from what's running in `supabase_db_docsplus_supabase` until you re-apply. Symptoms of forgetting: FE realtime channels subscribing with `{ config: { private: true } }` thrash retries because server lacks matching `realtime.messages` policy; FE features calling new RPCs/new return columns silently see old behaviour. Re-apply via `docker exec -i ... psql ... < migrations/...sql` form above (idempotent `drop policy if exists`/`create or replace function` make re-runs safe). If only script changed, prefer `docker exec ... < scripts/<file>.sql` so later `db reset` reproduces same state.
- **Migrations + `scripts/*` paired.** Every change applied via migration must mirror in corresponding source-of-truth `scripts/*.sql` so `db reset` (which rebuilds from `scripts/`) reproduces production state. No landing migration-only or scripts-only changes for same invariant.
- **Remote `db push` vs local reset.** `[db.migrations] enabled` in `packages/supabase/config.toml` stays `false` for day-to-day local dev (`db reset` loads `scripts/` + `seed.sql`). Toggle `true` only while pushing to remote. Never delete migration file that remote has already applied — use `supabase migration repair --status reverted <version>` if consolidating history. Bulk function catch-up for prod gaps: edit `scripts/`, run `bun run --filter @docs.plus/supabase_back generate:functions-parity-migration` (writes timestamped migration from allowlisted script subset; adds `DROP TRIGGER IF EXISTS` before bare `CREATE TRIGGER`). One-shot data backfills stay hand-written migrations, not in `scripts/`.
- **Migrations must ship dependencies they call.** Migration `create or replace`s function that calls `internal.*` helpers, those helpers must appear in same migration or earlier — not only in `scripts/` (prod never runs `db reset`). Trigger functions writing other users' `channel_members` rows must end with `SECURITY DEFINER` in both `scripts/` + migration path, or RLS column grants block inserts after `13-RLS.sql`.
- **`supabaseClient.rpc(...)` is lazy.** Returns `PostgrestBuilder`; request only leaves browser when `.then(...)`/`await`/`.single()`/`.maybeSingle()` attached. Fire-and-forget calls dropping result (e.g. debounced cursor advance) MUST attach `.then((res) => { if (res.error) console.warn(...) })`, or network call silently never dispatches. Any `supabaseClient.rpc(` without continuation is bug.
- **Storage RLS path-based, not column-based.** Bucket policies for `user_avatars`/`channel_avatars` check `(storage.foldername(name))[1] = (select auth.uid()::text)`, NOT `owner` (uuid) or `owner_id` (text). Storage-api v1.54.1 doesn't reliably auto-populate either column on insert; predicates against them evaluate `NULL = …` → false → 403 "new row violates RLS policy". FE writes paths as `{userId}/{filename}` (`useAvatarUpload` uses `${user.id}/avatar.png`; `Config.app.profile.getAvatarURL` emits matching read URL). Encoding ownership in path is Supabase's canonical pattern + matches Slack/Discord/Linear conventions.
- **Storage bucket policies CRUD-complete, not write-only.** Migrations re-declaring INSERT/UPDATE/DELETE policies on `storage.objects` MUST also confirm matching SELECT policy exists. Supabase Storage runs `INSERT … RETURNING` (or INSERT followed by SELECT) on every upload, missing SELECT policy returns same generic "new row violates row-level security policy" 403 misleadingly pointing at INSERT — actual denial on readback. `scripts/12-buckets.sql` declares SELECT policies for `user_avatars`/`channel_avatars`/`media` (all `bucket_id = '<name>'`); migration tree must keep parity. Public-URL reads (`/storage/v1/object/public/...`) take different code path that doesn't go through PostgREST RLS, so avatar display can work while uploads silently 403 — exactly how gap survived three rounds of "fix RLS" migrations.
- **Avatar source-of-truth is two-field hybrid.** `users.avatar_url` holds OAuth provider URL (set by `handle_new_user` from Google's `picture` claim on signup); `users.avatar_updated_at` is "user has uploaded custom avatar" indicator. `<Avatar>` reads `avatar_updated_at` first — if set, derives bucket URL `${BUCKET}/${id}/avatar.png?${avatar_updated_at}` (timestamp doubles as cache-buster); if null, falls back to `src` (= `avatar_url` = OAuth URL). `useAvatarUpload.handleRemove` clears `avatar_updated_at` to null so OAuth picture reappears without re-fetching from provider. No refactoring to single-column shape — hybrid gives free "remove falls back to OAuth" semantics single-column variants need extra logic to implement.

## Extension Workflow

### Standalone Extension Development

- Standalone packages: `extension-hyperlink`, `extension-hypermultimedia`, `extension-indent`, `extension-inline-code`, `extension-placeholder`.
- Shared structure: TypeScript + tsup build + `@tiptap/core` peer dep.
- GFM markdown uses `@tiptap/markdown`; paste lives at `extensions/markdown-paste/`; import/export in `utils/markdown.ts` + `toolbar/desktop/DocumentSettingsPanel`.
- `sanitizeJsonContent` runs on paste + import paths.
- After modifying any `packages/extension-*` source:
  1. Run `bunx tsup` in that package.
  2. Clear `.next/cache` or remove `.next`.
  3. Restart dev server + hard-refresh browser.
- Next.js HMR doesn't reliably detect changes in Bun workspace-symlinked packages.
- If extension playground running via `bun --hot ./test/playground/server.ts`, restart after `bun run build`; tsup `clean: true` can wipe `dist/` + leave hot server serving 500 for `dist/styles.css`.

### Hyperlink Extension

Extension-internal rules (schema, commands, click handling, safety/normalization, metadata/preview, `specialUrls` catalog, public API surface, floating toolbar, clean-room Cypress harness) live in [`packages/extension-hyperlink/AGENTS.md`](./packages/extension-hyperlink/AGENTS.md). Read before touching anything under `packages/extension-hyperlink/src/`. Webapp-side popover integration below.

### Webapp-Owned Hyperlink Popovers

- Extension stays host-agnostic. `popovers.createHyperlink`/`popovers.editHyperlink` are callbacks returning `HTMLElement | null`.
- Desktop create/edit entries create empty host + set only `host.dataset.testid`. Never set `host.className`.
- Register `{ kind, host, props }` in `useHyperlinkPopoverStore`.
- Return host so extension's floating controller positions it.
- Single React `<HyperlinkPopoverPortal>` in `TipTap.tsx` reads `active` + portals `<HyperlinkEditor>` with `<HyperlinkSuggestions>` into host.
- Tests select by `data-testid` only. No restoring legacy class selectors.
- `useHyperlinkPopoverStore` subscribes once at module load to `getDefaultController().subscribe((state) => state.kind === 'idle')`.
- Idle discriminator is `idle`, not `closed`.
- Subscription guarded by `globalThis.__hyperlinkControllerSubscribed` so HMR/Jest module-cache replays don't stack listeners.
- `__resetHyperlinkPopoverStoreForTests()` reattaches after `resetDefaultController()`.
- Legacy `.hyperlink-create-popover` + `.hyperlink-edit-popover` SCSS blocks removed from `styles/styles.scss`.
- Only `.hyperlink-preview-popover` keeps SCSS because preview still rendered by imperative DOM.
- Create popover UX minimal: one inline `[URL input] [Add]` row + suggestions; no header + no Cancel.
- Edit popover keeps back arrow, URL/Text labels, Update.
- Mobile `LinkEditorSheet` dismisses through drag/backdrop + also no Cancel.
- Controls use DaisyUI: `input input-sm`, `input-error`, `btn btn-primary btn-sm`, `btn btn-ghost btn-sm btn-square`.
- Suggestions data:
  - headings from top-level `doc.content` children, same source as `useTocActions.copyLink`;
  - current-workspace bookmarks, both active + archived via parallel `getUserBookmarks` calls;
  - active bookmarks sort before archived.
- Suggestion URLs absolute + reuse `useTocActions.copyLink` + `BookmarkItem.handleCopyUrl` shapes:
  - headings: `?h=...&id=<headingId>`;
  - bookmarks: `?msg_id=...&chatroom=...`.
- Picker command contract: choosing heading/bookmark during create applies only `href` when text selected; choosing suggestion during edit updates only URL unless user explicitly edited Text field.
- Suggestion states collapsed -> browsing -> searching.
- Desktop default state `collapsed`; mobile default state `browsing`.
- Webapp icon catalog:
  - `hyperlinkPopovers/iconList.ts` deleted.
  - `previewShared.ts::TYPE_TO_ICON` maps `SpecialUrlType` to `IconType` from `@components/icons/registry` as `Partial<Record<SpecialUrlType, IconRenderer>>`.
  - Intentionally partial so domain-catalog types like `meet` or web `github` can be absent; favicon wins for `https://` URLs.
  - Use Lucide React components only.
  - `createSvgIcon(Icon)` renders with `renderToStaticMarkup(createElement(Icon, { size: 20, 'aria-hidden': true }))`.
  - No reintroducing per-platform `Fa*`/`Si*` icons or hard-coded SVG strings.

### Indent Extension

- Keep pad `TipTap.tsx` + chat composer `useTiptapEditor` on same `Indent.configure({ indentChars: '\t' })`, or widen both together.
- Literal indent/outdent gated by `allowedIndentContexts`, allowlist of `{ textblock, parent }` TipTap type-name pairs.
- Default literal indent contexts: paragraphs under `doc` + `blockquote`.
- `[]` disables literal indent.
- Tab/Shift-Tab order:
  1. sink/lift list (`listItem`/`taskItem` when schema supports);
  2. table cell navigation when table extension exists;
  3. literal indent/outdent.
- Extension priority is 25 + delegation.
- Other textblocks need explicit `allowedIndentContexts` rules.
- Cypress under `packages/webapp/cypress/e2e/editor/indent/`; Jest under `packages/extension-indent`.

## Document Features

### Document Version History

- Hocuspocus history uses stateless `history.list`/`history.watch`.
- Server unicasts `{ msg: 'history.response', type, response }` to requesting connection. No `broadcastStateless`.
- Prisma always uses collab room document id (`document.name`).
- If client sends different `documentId`, respond `history_failed`.
- Current `history.list` returns `{ versions, latestSnapshot }` in one RTT. Client still accepts legacy plain `HistoryItem[]`.
- `applyHistoryItemToEditor` single TipTap hydration path.
- `loadingHistory` clears only after successful apply, not merely after network response.
- `useHistoryEditorApplyWhenReady` applies when editor mounts after data arrives.
- While `pendingWatchVersion` set, no re-applying stale `activeHistory`.
- Late `history.list` must not reset pending watch state or hydrate from `latestSnapshot` over that watch.
- On `history_failed`, clear `pendingWatchVersion` so next watch not dropped.
- Shareable revision URLs use same pathname/query plus `#history?version=<n>`, where `<n>` is `HistoryItem.version`.
- URL helpers in `pages/history/historyShareUrl.ts`: `parseHistoryHash`, `buildHistoryShareUrl`, `replaceHistoryHashVersion`.
- Without `#history?version=`, sidebar treats latest version as active.
- Every entry to history page, including editor <-> history navigation, must resync sidebar selection from current hash + store.

### TOC And Heading Chrome

- TOC code under `components/toc/`.
- Keep `tocClasses.ts` in sync with `styles/components/_tableOfContents.scss`.
- `--color-docsy` equals `var(--color-primary)` in both `@theme` + `:root`; tracks DaisyUI light/dark/high-contrast themes.
- Heading widgets in `TipTap/extensions/HeadingActions/plugins/`.
- Heading-action styling in `styles/components/_heading-actions.scss`.
- `$ha-hit-size` shared with plugins.
- `$ha-group-has-unread` owns DRY `:has()` selector for unread tray visibility.
- `_unread-badge.scss` only styles `[data-unread-count]` on `.ha-chat-btn` + notification bell. No adding `.toc__chat-trigger` or `.ha-group` rules there.
- TOC uses React `UnreadBadge` only.
- `UNREAD_SYNC` clears `data-unread-count` on `.toc__chat-trigger`.
- Active chat icon uses `toc__chat-icon--active` with `fill: none`; Lucide icons are stroke-based.
- When nested `ul.toc__children` lives under parent `li`, folded subtrees hide with `&.closed > .toc__children { display: none }`.
- Fold state still comes from editor state, not CSS alone.
- TOC data path:
  - `components/toc/hooks/useToc.ts` throttles heading-driven rebuilds with `lodash/throttle`;
  - flat heading list converts to recursive `NestedTocNode` through `buildNestedToc`;
  - `TocDesktop`/`TocMobile` own roots;
  - `useHeadingScrollSpy.ts` debounces scroll/active-heading work with `lodash/debounce`.
- **TOC trailing rail.** `TocHeader` + `TocItemDesktop` reserve fixed-width trailing rail at right of each row: chat/unread pill pinned `absolute left-0`, AvatarStack pinned `absolute right-0`. Rail width comes from `tocTrailingRailPx(userCount, unreadCount)` in `components/toc/utils.ts` (wider for 10+ users/100+ unread). Row uses `overflow-hidden` + title is `flex-1 min-w-0` so growing avatar stack never compresses heading text. Legacy `data-present-users-count` attribute + matching `_tableOfContents.scss` width loop gone — only existed for old outside (`absolute -right-9`/`-right-6`) placement; no reintroducing.
- **TOC chat trigger is `<button type="button">`** (was `<span onClick>` inside `<a>`) for keyboard + a11y semantics; same pattern as mobile. Chat hover SCSS selector is `&:hover > a .toc__chat-icon`, NOT deeper `&:hover > a > span > .toc__chat-icon` — rail DOM broke original deeper selector. `usePresentUsers` MUST filter `profile?.id` + `useMemo` (matches `PresentUsers.tsx`); without it row gets extra avatar + rail width inflates.

### Heading Fold Crinkle

- Crinkle uses widget decorations with `data-fold-phase` for CSS animation.
- Unique `Decoration.widget` keys per phase force ProseMirror remount so animation fires:
  - `fold-${id}-folding`;
  - `fold-${id}-unfolding`;
  - `fold-${id}`.
- Width spans full sheet with `margin-left/right: calc(-1 * var(--tiptap-inline-pad-end))`.
- Timing uses SCSS variables `$crinkle-fold-duration` + `$crinkle-easing`, not CSS custom properties.
- `Decoration.node` on heading-section removed; animations live on widget.
- Strip count uses `MIN_FOLD_STRIPS`, `MAX_FOLD_STRIPS`, `CONTENT_HEIGHT_PER_STRIP` in `heading-fold-plugin.ts`.
- If `MIN_FOLD_STRIPS === MAX_FOLD_STRIPS`, strip count fixed regardless of content height.

## Chatroom And Messaging

### Optimistic Message Lifecycle

- Client generates UUID v4 via `crypto.randomUUID()` in `utils/clientMessageId.ts` + carries from optimistic insert through Postgres INSERT to realtime echo. Same ID reconciled in place; no remove + re-add.
- No reintroducing literal `'fake_id'` placeholder. Two rapid sends collide in store map + corrupt optimistic UI.
- `MessageStatus = 'pending' | 'sent' | 'failed'` lives in `types/message.ts`. Server-fetched rows omit field + treated as `sent` (`status === 'sent' || !status`). No runtime `MESSAGE_STATUS` const; literal type alone gives compile-time safety.
- `useReadCursor.advance` skips rows where `status !== 'sent'`; pending/failed optimistic rows must not advance read cursor. Hook monotonic (greatest()-on-server) + 1s-debounced, so callers can fire on every scroll tick.
- **Read-cursor advance viewport-driven, not at-bottom-only.** `ChatList.onScroll` calls `advance(seq)` for last fully-visible message on every scroll tick; `useChannelMessages.onInitialVisible` fires one rAF-polled seed after `data.replace` settles. Reducing to at-bottom-only signal regresses Telegram-style UX (messages read while scrolling up never clear).
- **`advance_read_cursor` recomputes `unread_message_count`** in same UPDATE bumping `last_read_seq` (plus stamps `last_read_update_at`); without recompute TOC badge desyncs forever. TOC `<UnreadBadge>` + `<JumpToPresentButton>` both read `useUnreadCount(channelId)` (not raw `channels.*.unread_message_count` alone). `useUnreadCount` prefers `optimisticUnreadStore` while user reading in-view; `ChatroomContext` decrements on viewport cursor advance + `useCatchUserPresences` reconciles via `setOptimisticUnread` on `channel_members` postgres_changes — clear map entry when server count lands. `JumpToPresentButton` renders `max(unreadCount, newCount)` so persisted unread + session-local arrivals stack onto one chip.
- **`lastOptimisticSeqRef` MUST seed from `channel_members.last_read_seq`** once `isChannelDataLoaded` flips true. Ref tracks "highest seq user has visually crossed in this session"; if starts at `0`, first `onLastVisibleIndexChange` walk-backward counts every loaded message as newly crossed + decrements `optimisticUnread` by entire window — opening chatroom with many unread instantly zeros badge. Seed from persisted server cursor (`useChatStore.channelMembers.get(channelId).get(userId).last_read_seq`) so walk only counts messages past cursor (actual unread). Guard seed with `if (lastOptimisticSeqRef.current > 0) return` so later effect re-run doesn't undo session progress. Also: store named `optimisticUnreadStore` — never reintroduce `optical*` spellings.
- Send path: composer routes through `ChatroomContext.send` → `useSendMessage.send`, appends `pending` row to Virtuoso's `data` + INSERTs directly via `supabaseClient.from('messages').insert(...)` (no `sendMessage` API helper). On error, flips to `failed`; postgres_changes INSERT echo flips to `sent` via `useChannelRealtime`'s in-place merge.
- **Own-send always scrolls to tail.** `data.append([optimistic], () => 'smooth')` unconditional — user follows own message down even when scrolled up to re-read history. `atBottom`-gated "don't yank" rule applies ONLY to others' arrivals in `useChannelRealtime`. Reverting to `({ atBottom }) => atBottom ? 'smooth' : false` here regresses Discord/Slack/Telegram parity for own sends.
- Duplicate-key classification centralized in `components/chatroom/utils/postgresErrors.ts::isDuplicateKeyError`. Both `useSendMessage` + `retryMessage` must import; no inlining PgError code/message checks.
- Retry path: failed-row tap → `ChatroomContext.retry(clientId)` → `useSendMessage.retry` → `utils/retryMessage` helper (only remaining caller of `sendMessage` API). Re-issues with original client UUID; 23505 duplicate-key treated as success (row was already persisted on prior attempt). Returns `RetryMessageResult`; caller (`useSendMessage.retry`) owns pending/sent/failed UI flip against Virtuoso's data.

### Message Grouping Projection

- `TGroupedMsgRow = TMsgRow & { isGroupStart, isGroupEnd, isNewGroupById, isOwner }`. Grouping flags computed render-time in `ChatList/ItemContent.tsx::samePrev` against Virtuoso's `prevData`; never persisted, never written into `api/messages/*` types.
- No reintroducing projection utility (`utils/projectMessageGroups.ts` + `utils/groupMessages.ts` both gone) or in-store mutation writing grouping flags back onto rows. Out-of-order realtime arrivals + pagination merges corrupt flags whenever materialised.
- **Notification rows break grouping.** `ItemContent.tsx::samePrev` excludes `prevData.row.type === 'notification'` — without exclusion, notification chip between two same-author messages renders post-notification message in `compact` mode (no avatar/header). Chip itself is `ChatList/SystemNotifyChip.tsx`, dispatched on `data.row.type === 'notification'`; `metadata.type` branches `user_join_workspace`/`channel_created`/`user_join_channel` (last returns null — workspace-join chip already records first appearance).
- Virtuoso's `data` store is single source of truth for in-view message rows; no parallel Zustand `channelMessagesStore`. Derive newest seq from `useChannelMessages.newestSeqRef`; no re-walking list to compute on hot paths.
- `MessageCardContext` must memoize context value object (`useMemo`). Fresh object identity on every parent render cascades re-renders through every `MessageCard`.
- `MessageFooter` self-hides on `status === 'failed'`. Consumers (`DesktopEditor`, `ChatContainerMobile`) render `MessageCard.FailedRow` for owner rows + must not re-gate on `status`.

### Chatroom List (Virtuoso)

- **`ItemLocation` is index-based.** `VirtuosoMessageList`'s `data.replace` + `scrollToItem` accept `{ index: number | 'LAST', align, behavior }`; string `'lastItem'` + id-based `{ id, … }` shapes silently no-op behind EmptyPlaceholder. Resolve numeric index from items array via `findIndex`; never wallpaper call with `as any`.
- **Layout contract.** `.message-feed` is `flex min-h-0 flex-1 flex-col overflow-hidden`; Virtuoso owns scroll, not wrapper. `<VirtuosoMessageList style={{ height: '100%' }}>` so scroller fills parent. Reverting `.message-feed` to plain block + `overflow-y-auto` re-introduces ~9000 px scroller stretch with items rendered far below visible panel.
- **Panel resize bypasses React during drag.** `useResizeContainer.doDrag` writes `containerRef.current.style.height` directly + dispatches `CustomEvent('chat-panel-resize-tick', { detail: height })`; `useAdjustEditorSizeForChatRoom` listens + mirrors to editor wrapper's `marginBottom`. Single `setOrUpdateChatPanelHeight(lastHeight)` commit on `stopDrag` drives localStorage + post-drag Virtuoso re-measure. Per-mousemove Zustand writes cascade through every `state.chatRoom` subscriber → Virtuoso ResizeObserver → `bottom-smooth` thrash at 60Hz; direct-DOM avoids that.
- **Sticky day chip uses `getBoundingClientRect`, not `offsetTop`.** `StickyDayHeader` reads topmost visible `[data-msg-date]` element via rAF-throttled `querySelectorAll` against scroller. Virtuoso positions each item `absolute` inside per-item wrapper, so `node.offsetTop` is 0 relative to that wrapper + topmost-detection loop always returns first item regardless of scroll. Visibility scroll-driven with `HIDE_AFTER_MS = 1500` idle fade — `data-msg-date` stamped on message card outer div + inline `DateChip` + `SystemNotifyChip` wrappers.
- **Hover-menu integration (Floating UI + Virtuoso).** Four pieces coupled + easy to misdiagnose individually — keep all in mind when any breaks:
  1. **Visibility tracking → `IntersectionObserver`, not `getBoundingClientRect` polling.** Virtuoso items mount with transient/zero rects; one-shot mount-time rect check sticks at `false`, gating `useHover.enabled`, silently disabling menu until user scrolls. Bookmarked rows mutating after mount (BookmarkIndicator + reactions render late) have same failure mode without scroll workaround. IntersectionObserver fires on initial paint _and_ layout-driven intersection changes; both bugs collapse into one fix. Use `threshold: [0, 0.5, 1]` (not just `0.5`) so first callback fires regardless of starting ratio.
  2. **`boundary` on `flip`/`shift` → `.message-feed`, not `.group/chat`.** Boundary defines rectangle floating menu cannot physically extend past. Panel-wide rect includes toolbar + composer; menu sitting _over_ toolbar still fits inside panel + won't trigger flip. `.message-feed` excludes both — top-of-feed messages flip to `bottom-end`. `position: fixed` can't be constrained by z-index or `overflow: hidden`; only thing actually keeping menu inside visual feed.
  3. **Portal target → `<div id="chat-hover-portal">` inside DesktopLayout.** Default `FloatingPortal` mounts at body root, putting menu in root stacking context where nothing inside panel can compete. Portaling inside panel lets `JumpToPresentButton` (`z-40`) sit above menu (`menuClassName="z-30"`) when both occupy bottom-right region.
  4. **`safePolygon({ buffer: 8 })` + `delay.open: 100ms`.** `buffer: 1` required pixel-precise mouse paths from message → menu + felt broken; user-visible complaint is "I have to exact-focus the message." 8px is Floating UI example range. 100ms open beats 200ms perceptually without admitting accidental hovers.
- **`Header`/`Footer` slots require stable, module-scope component refs; changing values flow through `context` prop, NOT through closures.** Toggling component reference itself (`Header={loadingOlder ? Loader : undefined}`) silently fails — Virtuoso re-mounts slot but closure captured before remount never updates, so inner spinner never reaches DOM even though `loading` state cycles correctly for full RTT. `ChatList.tsx` defines `Header`/`Footer` at module scope, adds `loadingOlder`/`loadingNewer` to `ChatListContext`, + reads via `{ context }` in slot props to drive `PaginationLoader` (top for older, bottom for newer). `MessageFeed.tsx` threads both flags through. No reverting to inline-`useMemo` Header/Footer factories.

### Chatroom Realtime

- **Per-channel topic.** `useChannelRealtime` subscribes to `chatroom:${channelId}` for postgres_changes (INSERT/UPDATE on `messages`) + broadcast events. Anon viewers receive same events as authed — source-table RLS (`messages_visible_select`/`messages_public_anon_select`) gates per-row, anon's anon-JWT carries `role = 'anon'` so `TO anon` policy matches. If realtime appears broken globally on `chatroom:*` topics, suspect `realtime.messages` RLS (`07-3-notification-broadcast.sql:109`) — missing topic policy can block subscription authorization at WS layer.
- **Row-merge preserves RPC-computed columns.** `useChannelRealtime`'s drain uses `incomingRow.user_details != null` as discriminator: present → RPC-hydrated row (`fetch_message_window`/`fetch_messages_since`), authoritative; absent → raw `postgres_changes` payload, graft `user_details` + `is_bookmarked` + `bookmark_id` from existing in-memory row. Those columns JOIN-computed in RPCs, never on `messages` table, so postgres_changes UPDATEs (reactions, edits, soft-deletes) can't carry them — without graft, reactions blank avatar AND wipe bookmark indicator. Both merge sites (UPDATE drain + optimistic→echo arrival merge) must stay in lockstep.
- **Catchup paginated.** On `SUBSCRIBED`/`online`/`focus`, `useChannelRealtime.catchUp` loops `fetch_messages_since(p_since_seq = newestSeqRef)` until page returns fewer than `CATCHUP_PAGE = 100` rows or `MAX_PAGES = 20` (2000-row cap) fires. Single-shot 100-row call silently drops gaps on busy channels after multi-hour disconnects. On cap-overflow loop warn-logs + bails; next user-initiated `snapToPresent()` resyncs from tail.
- **Soft-delete broadcast contract.** `handle_message_soft_delete` trigger emits `realtime.send({id, channel_id}, 'message:deleted', 'chatroom:' || channel_id, FALSE)` on `NULL → NOT NULL` transition only. `private=FALSE` because anon viewers can't observe postgres_changes UPDATE — anon SELECT policy filters `deleted_at IS NULL`, so realtime layer drops event whose NEW row state fails policy. Authed members receive both signals; `deleteBufferRef` is `Set` so duplicate idempotent. PRIVATE-channel info-leak (id-only payload to anyone who knows channel UUID) accepted; revisit if private-channel activity timing ever becomes sensitive. Topic + event name must not change without bumping FE listener in `useChannelRealtime`.
- **Deep-link bridge.** `Chatroom.tsx` resolves Virtuoso anchor as `deepLinkMessageId ?? store.chatRoom.fetchMsgsFromId ?? URL.msg_id`. All four in-app entry points (`BookmarkItem`, `hrefEventHandler`, `NotificationItem`, `usePushNotifications`) feed `fetchMsgsFromId` through `setChatRoom`; shared links land via `?msg_id=`. Without any source, anchor falls back to `first_unread`. `useChannelMetadata` independently passes same `startMsgId` to `fetchChannelInitialData` for anchor-existence validation — duplication intentional, surfaces invalid deep-links as user-visible error rather than silently falling back to tail.
- **Peer read cursor for sender check-marks.** Seed `peerReadSeq` from `get_channel_aggregate_data.peer_max_read_seq` at bootstrap; advance on private realtime topic `chatroom-read:{channelId}` event `read:advanced` (emitted by `advance_read_cursor`). `MessageSeen` uses `message.seq <= peerReadSeq` — no driving check-marks from per-message `readed_at`. Reconnect catch-up re-seeds `peer_max_read_seq` via same aggregate RPC (`useChannelRealtime.refetchPeerSeq` on `online` window event).
- **`chatroom-read:{channelId}` topic split is load-bearing.** Two channels per chatroom: public `chatroom:{id}` carries postgres_changes + `message:deleted` broadcast (so anon PUBLIC readers receive); private `chatroom-read:{id}` carries `read:advanced` broadcast only. `realtime.send(..., 'chatroom-read:...', true)` requires `chatroom_read_topic_access` RLS policy on `realtime.messages` (members-only via `substr(topic, 15)` → `channel_members.channel_id`). Folding `read:advanced` back onto public topic leaks per-user read positions to anyone holding channel UUID; merging postgres_changes onto private topic breaks anon PUBLIC-channel realtime. FE `useChannelRealtime` subscribes both channels independently; readChannel gated on `currentUserId` (anon doesn't subscribe).
- **`peer_max_read_seq` members-only.** `get_channel_aggregate_data` gates `MAX(last_read_seq)` query inside `IF is_member_result THEN ... END IF;` so anon viewers + authed non-members on PUBLIC channels receive `NULL` — not leak of who's actively reading. Corresponding FE seed in `bootstrapStore` ignores non-numeric values.
- **`advance_read_cursor` uses `FOR UPDATE`.** Without row lock, two concurrent calls (open tab + mobile, double-click) can interleave SELECT/UPDATE + write stale `unread_message_count`. `greatest(last_read_seq, p_up_to_seq)` keeps `last_read_seq` itself monotonic, but recomputed unread can flap. Pair lock with existing 1s FE debounce in `useReadCursor` — both layers required.

### MessageComposer Pitfalls

- After submit, refocus editor only if it was active element. Otherwise `editor.chain().clearContent(true).focus('start').run()` force-opens iOS keyboard right after `SendButton` tap + produces visible bounce. Enter-key submits keep focus naturally.
- `useEditor(...)` in `components/chatroom/components/MessageComposer/hooks/useTiptapEditor.ts` captures `workspaceId`/`channelId`/`isToolbarOpen` in `onUpdate` closure. Today masked because `Chatroom.ChannelComposer` remounts on channel key change + drafts never cross. If composer mount ever made persistent (tempting perf win), drafts will silently corrupt across channels — fix with refs pattern or lift `setComposerStateDebounced` into `useEffect` keyed on ids.
- `prepareContent` must return stable `chunks` shape (`{ htmlChunks: string[], textChunks: string[] }`) on both happy + empty paths so callers never need `as` cast.
- **Draft vs mode memory.** Text/HTML drafts live only in IndexedDB (`messageComposerDB` via `syncComposerDraft`/`discardComposerDraft`); Zustand `*MessageMemory` holds reply/edit/comment UI modes only — no reintroducing `messageDraftMemory`.
- **Post-send draft clear.** Successful send must call `discardComposerDraft` (cancels trailing debounced IDB writes, then deletes row). Trailing debounced write after clear resurrects sent text when user reopens chatroom.
- **Formatting toolbar session scope.** Toolbar defaults closed; expanded state is `sessionStorage` via `composerToolbarSession.ts` (per workspace+channel, current tab session only) — not IndexedDB.
- **Anon Enter opens sign-in.** `useComposerSubmit` calls `openComposerSignIn(channelId)` when `!user` — same entry as `SignInToJoinChannel`; no letting Enter silently no-op for visitors.
- **No per-keystroke state in `MessageComposerContext`.** `text`/`html`/`isSubmittable`/function-form `canPressSend` writes per 150ms editor debounce churn context value identity through every consumer (toolbar buttons, layout shells, action buttons) every 150ms while typing. Contract today: context exposes derived boolean `canSend = text.trim().length > 0` (transition-only — empty ↔ non-empty), plus `editor` (stable handle), `submitMessage`, `isEmojiOnly` (transition-only), + reply/edit/comment memory + setters. `SendButton` reads `disabled={!canSend}`; `useComposerSubmit.isSubmittable` stays internal + reads `editor.getText()` directly at click-time so moment-of-submit check fully live. Never re-add `text` or `html` to context type.

### Mention Picker

- **4-layer split (mirror hyperlink, no importing across features).** `MessageComposer/helpers/suggestion.ts` owns popup host + `autoUpdate` + `ReactRenderer` create/destroy + TipTap key routing; `MentionList.tsx` owns debounced RPC + selection + keyboard API; `MentionSuggestions.tsx` + `MentionSuggestionRow.tsx` own Discord-style listbox + a11y; `mentionTypes.ts` owns shared types, `EVERYONE_ENTRY` (`id: 'everyone'`), + helpers `showEveryoneForQuery`/`isMentionSuggestionPopupVisible`/`mentionOptionId`/`MENTION_LISTBOX_ID`. No adding Zustand store, SQL function, or shared suggestion package for it.
- **Popup anchors to `[data-chat-composer-surface]`** (set on desktop inner composer card + mobile composer wrapper), `placement: 'top-start'`, width 98% of surface with 1% inset each side; `autoUpdate` tracks surface, NOT `@` caret. Discord/Telegram-style wide picker above editor. When surface marker missing, log warning so `@` doesn't fail silently. No bringing back caret-following `bottom-start`/`shift` or `min-w-[280px]`.
- **`@tiptap/suggestion` Escape contract.** Plugin runs `onExit`/`dispatchExit` ONLY when `onKeyDown` returns `false`. Returning `true` for Escape leaves plugin alive (`state.active === true`) even after manual DOM removal — picker silently won't reopen. Always return `false` for Escape + route ALL teardown through `onExit` → single `destroyPopup()` path; never manually remove DOM on Escape.
- **Window-level Escape + Enter contention.** `useHandleEscKey` (composer reply/edit/comment) bails when `isMentionSuggestionPopupVisible()` true so first Escape closes picker, second clears reply/edit. Same helper gates Enter-send blocking. No `stopPropagation` Enter in `useTiptapEditor` — Mention's own `onKeyDown` needs key; only `preventDefault` send while popup `isConnected` + visible.
- **RPC contract.** Direct `searchWorkspaceUsers({ workspaceId, username: query })` with 150ms debounce + `cancelled` flag for stale-response guard — NOT `useApi`. Anon/non-member visitors skip RPC entirely (Notify-only row when query matches `everyone`). Members list filters `u.id !== currentUserId` so user never sees themselves; `@everyone` Notify unaffected. Type response as `PostgrestResponse<FetchMentionedUsersRow>` from generated `Database` types — NOT `[][]` generic (Supabase RPC typing pitfall). On RPC error, set `fetchError` + surface "Couldn't load members" in Members section instead of empty list. Insert payload stays `command({ id, label: item.username })` — `label` MUST be username (or `'everyone'`), never display name; notification SQL matches plain text.

### Anonymous Chat Read Path

- **Anon visitors get read-only PUBLIC chat.** Anon can call every read path — `fetch_message_window`, `fetch_messages_since`, `get_channel_aggregate_data`, channel/user/message SELECTs — + hydrate local Zustand store; anon RLS policies + SQL functions handle `auth.uid() IS NULL` explicitly so read path renders cleanly without any FE early-return.
- **Writes must gate on `auth.uid()` at entry point.** `useChannelMetadata` skips `upsertChannel` + `joinChannel`, `useSendMessage` short-circuits via `onAuthRequired`, + `useReadCursor.advance` no-ops when uid null. No gating inside RPC bodies; no letting RLS 403s reach FE as toasts. Authenticated writes assume channel/member rows exist.
- **Anon-only UI hidden, not disabled.** Bookmarks popover in `EditorToolbar.tsx` gated `{user && <Popover>…</Popover>}`; `ChatroomToolbar/components/NotificationToggle.tsx` early-returns `null` when `useAuthStore.profile?.id` falsy. Hide at component (or wrapping popover) so trigger never invokes RPC that would 401 — no rendering disabled button that toasts on click.
- **Async-handshake success paths resolve their own loading state.** `useOnAuthStateChange.signInAnonymously` calls `useAuthStore.setSession(data.user, true)` on success (flips `loading: false` in store) — does NOT wait for post-signin `SIGNED_IN` event. `onAuthStateChange` handler intentionally omits `SIGNED_IN` from branches to avoid profile-refetch thrash on tab focus/token refresh in older Supabase versions; relying on it would leave anon visitors stuck on "Loading workspace" forever. General rule: when sign-in/handshake call returns resulting session data, terminate loading state at call site, not via secondary event listener.
- **Anon viewers subscribe to same `workspace:${workspaceId}` realtime channel** as authenticated users (handled in `useCatchUserPresences.ts`) so presence join/leave + broadcast events flow into `useStore.usersPresence` + every `AvatarStack` surface — TOC header, TOC items, pad header `PresentUsers`, chatroom `ParticipantsList`, message `UserReadStatus` — renders same set of online users authed viewer would see. Anon must NOT call `track()`: observe only, never broadcast themselves into presence state. No splitting anon onto separate `anonymous:*` channel — presence per-channel-name + parallel channel would silently miss every broadcast.
- **`AvatarStack` consumers filter current user out, never gate on `usersPresence.size`.** Authed `track(profile)` puts self in map; anon never tracks so map is already just other viewers. Size-based guards (`size <= 1`) hide stack from anon when one auth peer present. Right shape is `Array.from(usersPresence.values()).filter(u => u.id !== profile?.id)` then render when remainder non-empty — works for both auth (drops self) + anon (no-op).
- **Clear `usersPresence` on every (re)subscribe.** `useCatchUserPresences` calls `clearUsersPresence()` at top of subscribe effect before opening either anon or authed channel. Drops stale `ONLINE` entries from previous channel (anon→authed sign-in, workspace switch, `online`-event reconnect) so next subscription's `presence` `sync` snapshot is authoritative state.
- **Anon's TOC badge re-purposes `unread_message_count` as channel-activity hint** because anon has no per-user read cursor. Both `useMapDocumentAndWorkspace.fetchChannels` (initial) + `channelMessageCountsUpsert` (realtime) write `channel_message_counts.message_count` (channel TOTAL) into store's `unread_message_count` field. Intentional — no "fixing" it. Both write paths must auth-gate (`if (profile?.id) return`) so authenticated users keep real per-user value from `channel_members` subscription.
- **`fetch_message_window` returns `anchor_seq=null` for `first_unread` when no real unread exists** — anon viewers (no `channel_members` row) + authed users caught up to tail. SQL still windows around tail (so view loads correctly); FE only inserts "Unread messages" sentinel when `win.anchor_seq != null`. Reverting so anon/caught-up users see sentinel before tail message is regression — divider meaningless without read cursor.

## Learned User Preferences

- When Task/subagent output already visible in UI, avoid repeating/summarizing unless user asks or multi-task synthesis requires; optional brief third-person completion line fine—vary wording instead of identical confirmations every time.
- When user asks for review-first workflow (e.g. "wire a plan", approve-before-execute), draft plan + pause for explicit approval before implementing.
- After substantive chatroom/webapp or Supabase cleanup, expect cohesive DRY/KISS pass (dead-file import-graph sweep, redundant store fields, code-reviewer/code-simplifier) before treating work as production-ready—not optional follow-up polish.
- No calling URL or router-adjacent work production-ready or "ship" until real close/open path checked in browser; `history.pushState` can leave `h`/`id` in bar where stripping only bookmark-style params no-ops.
- Monorepo dep bumps go through `npm-check-updates` (`bun run update` = patch+minor; `bun run update --upgrade` for majors)—not `npm-check`, not verbose `bun update --recursive` wrapper; keep `scripts/update-packages.sh` minimal.

## Learned Workspace Facts

- Continual-learning transcript indexing for this workspace stores mtimes in `.cursor/hooks/state/continual-learning-index.json`; routine scans prefer parent session JSONL (`agent-transcripts/<uuid>/<uuid>.jsonl`) over `subagents/` unless subagent logs explicitly needed.
- Chat mention + @everyone notifications driven by plain-text `messages.content` (composer `getText()`/sanitized text), not TipTap mention HTML attrs — SQL in `10-func-notifications.sql` regex-matches `@username` + `@everyone` there. Mention inserts must use `label: username` (or `'everyone'`), not display name.
- `sanitizeMessageContent`/`sanitizeChunk` allow only `href`, `target`, `rel` on spans — not `data-id`, `data-type`, `class` — so stored message HTML may not retain mention attrs; feed tap-to-profile via `useMentionClick` needs explicit DOMPurify allowlist extension, not picker UI alone.
- Chat message-list virtualization is Virtuoso (`@virtuoso.dev/message-list`); `@tanstack/react-virtual` removed from webapp after Virtuoso migration—no re-adding as list virtualizer.
- Message forwarding removed end-to-end (no `origin_message_id`/`prepare_forwarded_message`, no `forwardMessage` API or Forward menu)—no reintroducing feature in Supabase or webapp.
- Exact semver pins without `^` in workspace `package.json` (e.g. webapp `next: "15.5.9"`) often skipped by `bun run update`/`--target compatible`; bump with `bun update <pkg> --latest --filter <workspace>` or edit pin, then rely on root `catalog` + `bun.lock` for catalog deps.
