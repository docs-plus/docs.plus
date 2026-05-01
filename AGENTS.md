# AGENTS.md

Persistent memory for AI agents working in `docsy`. Preserve these rules unless a maintainer explicitly changes them.

## Agent Operating Rules

### Package Manager

- Use Bun only: `bun install`, `bun add`, `bun add -d`, `bun run`, `bunx`, `bun publish`, `bun pm pack`.
- Never use npm, yarn, pnpm, `npx`, `npm publish`, or package-lock/yarn-lock flows.
- The user sometimes prefers local command instructions over agent-run installs; ask or provide the command when dependency changes are not clearly part of the requested task.
- Use root workspace commands:
  - `bun run --filter @docs.plus/webapp dev`
  - `bun run --filter '*' build`

### Git And Commits

- Do not commit unless the user explicitly asks.
- When executing multi-task plans from `docs/superpowers/plans/`, every task ends in a "Review checkpoint" step: surface the touched files and a suggested `git add` / commit message for the user's reference only, then stop. Do not run `git add`, `git commit`, `git push`, `git stash`, or amend. Quality gates (`bun run … typecheck|test|build`) still run between tasks.
- Commit-review context flow: find the earliest modified or created file timestamp, inspect parent Cursor sessions from that time onward, group files by intent, then write simple Conventional Commit messages.
- Use short descriptive commit messages. Do not add AI/Cursor branding or internal doc references.
- A Cursor commit hook currently injects a `Made-with: Cursor` trailer on every commit. This conflicts with `commit-review`'s trailer-stripping rule; do not chase it manually mid-session.
- Do not propose cosmetic whitespace-only YAML commits. `lint-staged` runs `prettier --write` on staged YAML, and Prettier removes trailing alignment, often leaving an empty commit.
- `scripts/hooks/commit-msg.sh` does not accept the Conventional Commits `!` marker. Use:
  - Subject: `feat(scope): message`
  - Body footer: `BREAKING CHANGE: description`
  - Deploy trigger: `(build): front`, `(build): back`, or `(build): front back`
- If the team wants `feat!:` later, widen the hook regex to `(\(.+\))?!?:`.

### Code Quality

- Keep production code DRY, KISS, YAGNI, SOLID, and industry-standard. Avoid overengineering.
- Export names must match file names. Fix typos in identifiers during refactors.
- Feature folders use one central type module: `types.ts` or `types/index.ts`. Do not scatter feature-owned `type` / `interface` declarations across `hooks/`, `commands/`, `utils/`, `stores/`, or `components/`.
- Keep feature layers separate and navigable: `index.ts` -> `types.ts` -> `hooks/` / `commands/` / `utils/` / `stores/` / `components/`.
- Treat performance and memory leaks as part of production readiness, not follow-up work. Audit Tiptap/ProseMirror changes for re-render storms, unsubscribed listeners, and detached views.
- Any `editor.on(...)` or `getDefaultController().subscribe(...)` call must return and call its unsubscribe on unmount unless it is intentionally module-scoped and guarded.
- Keep debug/info loggers on editor core paths. Do not strip them during cleanup.

### Testing And Verification

- Use TDD for fixes and features.
- Design tests from the schema/spec first. If the spec is wrong, fix behavior; do not weaken tests to match broken behavior.
- Run `bun run build` after major refactors before claiming completion.
- Validate full-document paste (`⌘A` -> `⌘V`) on editor changes that can affect paste or document transforms.
- Cypress conventions:
  - Split tests by concern and include a README for scope.
  - Use kebab-case directories.
  - Use `it()`, not `test()`.
  - Consolidate overlapping tests.
  - ProseMirror `handleDOMEvents.click` is not triggered by Cypress `realClick()` / `.click()`. Dispatch a native `MouseEvent('click', { bubbles: true, clientX, clientY })` using `getBoundingClientRect()` coordinates.
  - Use the same native-event pattern for floating-toolbar `keydown` Escape dismissal.

### Local-Only Files

- `Notes/` is local-only. Never commit local notes or plans.
- Root `/docs/` is also gitignored. Agent-authored design specs, implementation plans, brainstorm RFCs, and code-janitor reports live there during a session but must not be committed. Current subdirs include `brainstorms/`, `engineering/`, `plans/`, `skills-output/`, and `superpowers/`.
- `.cursor/hooks/state/continual-learning.json` and `continual-learning-index.json` are local hook churn. Keep them out of commits; restore them if staged.
- Store durable regression context in `AGENTS.md`, not only in continual-learning plugin JSON.
- Before large migrations, audit config/doc/rule paths for stale references: `.cursor/rules`, `Notes/`, `docs/`, and `AGENTS.md`.

### Skills And Prose

- Cleanup/review skills are autonomous by default. Do not gate every step; stop only when a decision is genuinely ambiguous.
- `--review` is opt-in. Default cleanup applies edits and prints one terse line per file.
- Reports are terse next-step outlines, not detailed plans.
- Real senior-level refactors are in scope under the gated-approval mechanism: exported symbol renames, typo fixes, file moves, file splits, and dependency bumps.
- True safety rules remain absolute: do not change runtime behavior for handled inputs, edit generated files, or commit directly.
- All prose work routes through `.cursor/skills/tech-writer`: README, CHANGELOG, reports, post-mortems, design docs, PR descriptions, and JSDoc/docstrings.
- Skills never create branches or worktrees. They operate in the current directory and branch.

### Documentation And Comments

- Keep JSDoc terse. Public extension JSDoc ships into `.d.ts` bundles.
- For `packages/extension-*/src/` exports:
  - File headers: 1-2 lines.
  - Symbol docs: 1-3 lines.
  - Link to `README.md` for option semantics.
  - Preserve only why: collab races, intentional anti-patterns, security boundaries.
- The same minimum-JSDoc rule applies to `packages/webapp/src/**`.
- Do not write multi-paragraph preambles, restated parameter lists, or obvious comments such as `// Increment counter`.
- Benchmark: trimming `extension-hyperlink` v2.0.0 JSDoc cut DTS from 14.81 KB to 13.24 KB (-10.6%) without source-byte changes.

### UI And Theme

- Theme/UI color consistency is first-class. Every surface, including third-party pickers, must follow design tokens.
- On DaisyUI-backed surfaces, prefer DaisyUI + Tailwind over bespoke nested hover/active stacks that fight parent controls.

## Monorepo Toolchain

### Workspace

- `docs.plus` / `docsy` is a Bun monorepo with workspaces under `packages/*`.
- Main app: `@docs.plus/webapp` (Next.js Pages Router).
- Backend: `@docs.plus/hocuspocus` / `@docs.plus/hocuspocus.server`.
- Editor code lives under `packages/webapp/src/components/TipTap/`.
- Shared webapp utilities live in `packages/webapp/src/utils/`; `src/lib/` was removed. Keep feature-local helpers colocated.

### Quality Gates

- One naming rule: bare script names report, `:fix` suffix mutates.
- Aggregates:
  - `bun run check` = lint + format + styles + typecheck. This is the report gate used by `pre-push` and the PR template.
  - `bun run check:fix` = `lint:fix` + `styles:fix` + `format:fix`.
- Primitives:
  - `lint` / `lint:fix` = ESLint.
  - `format` / `format:fix` = Prettier. `format` reports only.
  - `styles` / `styles:fix` = Stylelint.
  - `typecheck` = report-only.
- CI splits lint and tsc into parallel jobs. The lint job inlines `bun run lint && bun run format && bun run styles`; the typecheck job runs `bun run typecheck`.
- Deleted names stay deleted: `check:lint`, `check:format`, `check:types`, `check:full`, `check:static`, `lint:packages`, `fix`, `format:check`, `lint:styles`.
- Do not reintroduce alias chains, asymmetric verb directions, or tool-confused namespaces.

### Dependencies

- Root `package.json` owns shared devtool versions: ESLint, TypeScript, Prettier, Stylelint, Jest, Babel-Jest, and related tooling.
- Root `catalog:` centralizes pins where used. Workspaces reference matching deps as `"package": "catalog:"`.
- Toolchain policy details live in `docs/engineering/toolchain.md`; use it for phases, CI parity, and version policy.
- Do not duplicate Jest/Babel dev dependencies in package workspaces unless there is an exceptional documented reason.
- `@tanstack/react-query` is root-cataloged at v5 for webapp and admin-dashboard. Use object syntax; mutation pending state is `isPending`, while query `isLoading` remains valid.
- Stay on ESLint 9.x and TypeScript 5.x until a dedicated migration. ESLint 10 and TS 6 have breaking changes.
- Dependency update flow:
  - Use `bun update` at the repo root, or `bun run update:all-packages`.
  - Run `bun install` at root if the lockfile or install tree needs healing.
  - Do not run parallel `bun update` in multiple package directories; shared `bun.lock` and hoisted installs can race with `EEXIST`.
- Removed tools/scripts stay removed: `npm-check-updates`, per-package `update:packages`, `scripts/reinstall-packages.sh`, and `reinstall:all-packages`.

### Tests

- Root `test:all` runs `scripts/run-tests.sh`.
- Unit + E2E stack: Jest and Cypress. `CYPRESS_PARALLEL` enables Cypress parallelism.
- Unit order in `run-tests.sh`:
  1. `@docs.plus/extension-indent` Jest via its local `jest.config.cjs`.
  2. `@docs.plus/webapp` Jest.
- Webapp `test` uses `jest --passWithNoTests` so an empty or temporarily absent app suite does not fail CI/local runs.
- `@docs.plus/webapp` keeps `next/jest` in `jest.config.js`.
- Library packages that need Jest use a local `jest.config.cjs`. Do not add package-local Jest stacks to `package.json`.

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
  - Overrides are shallow. If a caller overrides `esbuildOptions`, it must preserve the base pure policy manually.
- `extension-hypermultimedia` intentionally preserves `console.warn` / `console.error` from its `Logger` wrapper under the shared tsup factory. Note this in its next CHANGELOG entry.
- Root `LICENSE` is the single committed license.
  - Each publishable package adds `/LICENSE` to package `.gitignore`.
  - Each publishable package wires `scripts/prepack.ts` through `"prepack": "bun run scripts/prepack.ts"`.
  - `prepack` copies the root `LICENSE` before `bun publish` or `bun pm pack`.
  - Symlinks fail because Bun pack drops them. Hard links fail because git stores independent copies.
- Do not centralize package-specific files: `README.md`, `CHANGELOG.md`, package source, 3-line `eslint.config.js` shims, or `package.json` fields.

### Docker

- Use one Docker base tag everywhere: `oven/bun:1-slim`.
- Do not mix `1-alpine`, `1-slim`, or hardcoded patch tags.
- Do not copy `node_modules` between Docker stages. Bun uses symlinks into a virtual store; copied installs can break module resolution.
- Any stage that runs `next build`, extension builds, or config that requires deps must run `bun install --frozen-lockfile`.
- Copy only `package.json`, `bun.lock`, and the workspace tree between stages.
- Any Dockerfile stage that runs `bun run build` for `@docs.plus/extension-*` must also `COPY` the root-level shared configs `tsconfig.base.json` and `tsup.base.ts` into the build context. Each extension's `tsconfig.json` extends `../../tsconfig.base.json` and each `tsup.config.ts` imports `from '../../tsup.base'`; missing either file fails the extension build with `Could not resolve "../../tsup.base"`. Affected Dockerfiles today: `packages/hocuspocus.server/docker/Dockerfile.bun` and `packages/webapp/docker/Dockerfile.bun` (`build-extensions` stage must copy them via `--from=deps`).

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
- Adding any root re-export through `src/index.ts` or `src/utils/index.ts` is a minor release, not a patch.
- Resolve `[Unreleased]` to a real version before `bun run build`, `bun pm pack`, and `bun publish`.
- `prepublishOnly` runs `scripts/preflight.ts`; it asserts:
  - publisher user-agent is `bun/*`;
  - dist artifacts exist;
  - no literal `catalog:` leaks into built bundles.

### Release Policy

- `RELEASE_POLICY.md` is authoritative for versioning doctrine, cutover phase, lockstep activation, `release:family`, CHANGELOG style, soak/promotion, CI guards, and readiness checklists.
- During Phase 1 cutover, each extension can ship its first `2.0.0` to `@next` independently.
- Lockstep activates only through an explicit switch-flip commit in `AGENTS.md` / `RELEASE_POLICY.md`, not automatically when versions align.
- Once lockstep is active, coordinated extension-family releases use:

```bash
bun run release:family
```

- The only root release/publish script is `"release:family": "bun scripts/release-family.ts"`.
- Do not reintroduce the removed `release`, `release:major`, `release:minor`, `release:patch`, `version*`, or parallel `publish` scripts.

### Publish Flow

- Publishing happens on the maintainer laptop because npm 2FA-on-write requires OTP. Do not put `NPM_TOKEN` in CI for publishing.
- Use:

```bash
bun publish --tag <next|latest> --otp <6-digit>
```

- Major bumps go to `@next` for soak. Stable patches/minors go to `@latest`.
- Promote later with `npm dist-tag add <pkg>@<ver> latest` when appropriate.
- GitHub Releases are the announcement gate and happen after npm publish.
- Release tags must be `<package-name>@<semver>`, e.g. `@docs.plus/extension-hyperlink@2.0.0`. `v<semver>` is reserved only as a fallback for future repo-wide releases.
- Use the state-machine `awk` slice for release notes. Do not use the range form because both ends can match the same heading:

```bash
awk '/^## \[/{ if (found) exit; if (/^## \[<ver>\]/) found=1 } found' packages/<pkg>/CHANGELOG.md
```

- Discord webhooks:
  - Push activity: `secrets.DISCORD_WEBHOOK` via `.github/workflows/discord-activity.yml`.
  - Releases: `secrets.DISCORD_RELEASE_WEBHOOK` via `.github/workflows/discord-release.yml`.
  - Reserve unqualified `DISCORD_WEBHOOK` for the original push channel.
- Release embeds color-code stability: green `#22c55e` for stable, orange `#f97316` for pre-release.
- Install hints switch from one `is_pre` branch: stable uses `bun add <pkg>@<version>`, pre-release uses `bun add <pkg>@next`. Do not hard-code per-package paths in the workflow.

### Extension Version Doctrine

- All five publishable `@docs.plus/extension-*` packages share the same major, tracking the docs.plus product line.
- `1.x` = 2023 product line.
- `2.x` = docs.plus alpha v2.
- Extensions are leaf packages; lockstep is policy, not graph-forced.
- Current cutover state:
  - `extension-hyperlink` ships `2.0.0` first.
  - `extension-hyperlink@4.3.0` was a brief mispublish and is being rolled back/unpublished when npm allows it.
  - `extension-hypermultimedia 1.4.0`, `extension-indent 0.2.0`, `extension-inline-code 0.1.1`, and `extension-placeholder 0.1.0` converge to `2.0.0` over later release windows.
  - Laggard packages need the same `LICENSE` / `prepack.ts` / `scripts/preflight.ts` scaffolding currently wired on `extension-hyperlink`.
- Family-release script invariants in `scripts/release-family.ts`:
  - Use `spawnSync` helper calls, no shell strings, so OTP never lands in `ps aux` or shell history.
  - GitHub release creation is idempotent across resumes: iterate `[...published, ...skipped]` and guard each with `gh release view <tag>`.
  - Push an explicit tag list only. Never run `git push --tags`.
- CLI flags: `--dry-run`, `--tag <next|latest>`, `--allow-noop`, `--generate-noop-changelogs`, `--help`.
- Preflight aggregates errors before any OTP prompt:
  1. lockstep;
  2. CHANGELOG entries;
  3. `dist/` freshness against `src/`;
  4. per-package `scripts/preflight.ts`;
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
- Run the migration CLI from `packages/hocuspocus.server` after root `bun install`:

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

### Zustand And ProseMirror

- The app has a monolithic 7-slice Zustand store. All `useStore` calls must use leaf selectors.
- Never select `(state) => state` or `(state) => state.settings`.
- `doc.nodeAt(pos)` can throw `RangeError` for out-of-range positions. Guards must not assume null-only.
- `transaction.before` is the pre-step document `Node`, not `EditorState`. Never call `PluginKey.getState(transaction.before)`.
- For fold-driven UI such as TOC, snapshot heading-fold plugin state from `editor.state` and diff across transactions.

### Editor References

- The canonical editor handle is:

```ts
useStore((state) => state.settings.editor.instance)
```

- `useEditorAndProvider.ts` registers it through `setWorkspaceEditorSetting('instance', editor)`.
- Consumers include `EditorContent.tsx`, `useTocActions.tsx`, the toolbar, and collaboration-document features.
- `window._editor` is set only by `pages/editor.tsx`, the standalone editor playground. It is undefined on real document/collab routes.
- Do not add new `window._editor` readers to document-route features.
- React mobile sheets that need an editor reference should use typed `SheetDataMap` payloads, e.g. `linkPreview` and `linkEditor`.

## Webapp UI Systems

### TipTap Styling

- TipTap pad-only SCSS lives under `packages/webapp/src/styles/editor/`.
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

- The canonical mobile sheet system is `packages/webapp/src/components/BottomSheet.tsx`, wrapping `react-modal-sheet`.
- Sheets register through `useSheetStore` with `SheetType` + `SheetDataMap`.
- New mobile UI surfaces add a `SheetType` variant, a typed `SheetDataMap` entry, and a React subscriber.
- Tiptap extension imperative-DOM popovers connect to React sheets through extension `popovers` config, gated by `settings.deviceDetect.isMobile` in `TipTap.tsx`.
- Do not build parallel imperative-DOM bottom sheets next to the React + Zustand sheet system.
- Keyboard dismissal is a per-sheet entry-point decision. Do not globalize it in `useSheetStore` or `BottomSheet`.
- Keep the keyboard up for chatroom composer, `linkEditor`, and message-composer `emojiPicker`.
- Dismiss the keyboard for `linkPreview` and chatroom open paths: `CHAT_OPEN` / `CHAT_COMMENT` in `services/eventsHub.ts`.
- A single synchronous `editor.view.dom.blur()` is not reliable; it can lose the race against queued ProseMirror focus.
- Proven dismiss patterns:
  - `useClipboard.ts` style: collapse selection, then `setTimeout(50)` and `editor.view.dom.blur()`.
  - `dismissDocumentKeyboardForSheet` in `eventsHub.ts`: `editor.setEditable(false)` plus `editor.view.dom.blur()`.
- `editor.setEditable(false)` synchronously flips `contenteditable` through `view.updateState` in Tiptap 3.20; a separate DOM attribute write is not load-bearing for that timing.
- Always early-return when `isKeyboardOpen` is false.

### Mobile Document Pad

- iOS Safari rules live under `packages/webapp`, mainly `html.m_mobile` in `styles/_mobile.scss`.
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

## Backend And Infrastructure

### HTTP Modules

- New backend HTTP features go to `@docs.plus/hocuspocus.server` (Hono), not webapp `pages/api/`.
- New endpoints live under `packages/hocuspocus.server/src/modules/<feature>/`:
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

- Pages Router Supabase architecture:
  - Browser singleton: `utils/supabase/index.ts`.
  - Factory: `component.ts`.
  - GSSP: `server-props.ts`.
  - API route client: `api.ts`.
  - URL resolver: `url.ts`.
  - Generated DB types: `types/supabase.ts`.
- Browser code imports the `supabaseClient` singleton.

## Extension Workflow

### Standalone Extension Development

- Standalone packages: `extension-hyperlink`, `extension-hypermultimedia`, `extension-indent`, `extension-inline-code`, `extension-placeholder`.
- Shared structure: TypeScript + tsup build + `@tiptap/core` peer dep.
- GFM markdown uses `@tiptap/markdown`; paste lives at `extensions/markdown-paste/`; import/export lives in `utils/markdown.ts` and `toolbar/desktop/DocumentSettingsPanel`.
- `sanitizeJsonContent` runs on paste and import paths.
- After modifying any `packages/extension-*` source:
  1. Run `bunx tsup` in that package.
  2. Clear `.next/cache` or remove `.next`.
  3. Restart the dev server and hard-refresh the browser.
- Next.js HMR does not reliably detect changes in Bun workspace-symlinked packages.
- If an extension playground is running via `bun --hot ./test/playground/server.ts`, restart it after `bun run build`; tsup `clean: true` can wipe `dist/` and leave the hot server serving 500 for `dist/styles.css`.

### Hyperlink Extension: Schema And Commands

- Webapp couples to `extension-hyperlink` through `packages/webapp/src/components/TipTap/extensions/markdown-extensions.ts`.
- `HyperlinkWithMarkdown = Hyperlink.extend({ markdownTokenName: 'link', parseMarkdown, renderMarkdown })`; parsing applies mark name `hyperlink`.
- The `hyperlink` mark name is locked by markdown wiring and stored production Yjs docs. Never rename it to `link`.
- The package is not a drop-in schema replacement for `@tiptap/extension-link`; migration docs describe moving into `@docs.plus/extension-hyperlink`.
- Same-document hyperlink targets update URL/hash/route for in-app navigation. Do not treat them as external opens.
- `setHyperlink({ href, target?, title?, image? })` is pure and chainable; it only writes the mark and returns boolean.
- `setHyperlink()` with no args returns false. Never call it to open UI.
- UI opens through `openCreateHyperlinkPopover()`, and `Mod-k` is bound to it.
- Migrated webapp call sites use `editor.chain().focus().openCreateHyperlinkPopover().run()`: `MobileBubbleMenu.tsx`, `HyperlinkButton.tsx`, `EditorToolbar.tsx`, and `ToolbarMobile.tsx`.
- `previewHyperlink.ts` no longer passes dead `view` / `linkCoords` args to `editHyperlinkPopover`; keep the canonical signature.
- Link-compatible command aliases exist: `setLink`, `unsetLink`, `toggleLink`; command names only, no schema rename.
- Canon options include `defaultProtocol`, `isAllowedUri(href, ctx)`, `shouldAutoLink(url)`, `enableClickSelection`, and `exitable`.
- `editHyperlinkCommand` must return a composable Tiptap command that reads positions/marks from `tr.doc`. Do not dispatch a nested chain that can cause mismatched transactions.

### Hyperlink Extension: Click Handling

- ProseMirror has two click paths:
  - DOM `click` event through `handleDOMEvents.click`.
  - `mouseup`-based `handleSingleClick`, tracking `mousedown` position before DOM `click`.
- To prevent editable-mode navigation:
  - Capture-phase `mousedown`: `preventDefault + stopPropagation` to block ProseMirror mousedown tracking.
  - Capture-phase `click`: `preventDefault` only, so the event still bubbles to `handleDOMEvents.click` for popover display.
- Call `options.popover(...)` before `editor.chain().focus(clickPos).setTextSelection(pos).run()`.
- If the popover returns `null`, skip the focus call entirely. `null` is the host opt-out signal, especially for mobile sheets.
- Desktop popovers still set focus/selection after content exists so edit/remove actions target the right mark.
- `iosCaretFixPlugin` must early-return on link targets in both `touchstart` and `click`, and clear `lastTouchCoords` on `touchstart`.
- Link taps are owned by the hyperlink extension; stray caret-fix selection dispatch can re-trigger iOS auto-scroll.
- `target` mark attr is `rendered: false` so stored `_blank` does not render to DOM.
- `image` mark attr is also `rendered: false`; preview metadata stays mark-only and refetches on demand.

### Hyperlink Extension: Safety And Normalization

- `isSafeHref` + `buildHrefGate` are the single XSS gate.
- `parseHTML` uses `getAttrs` + `isSafeHref(href)`.
- `clickHandler.ts` and preview popover `window.open` fallback also call `isSafeHref`.
- `buildHrefGate(options)` composes `isSafeHref` with user `isAllowedUri(href, { defaultValidate, defaultProtocol })`.
- All write boundaries use the composed gate: `setHyperlink`, `toggleHyperlink`, `editHyperlink`, input rule, paste rule, paste handler, autolink, popover submit, and `parseHTML`.
- `DANGEROUS_SCHEME_RE` stays internal to `validateURL.ts`. Call sites import `isSafeHref`, not the regex.
- Every path that stores a hyperlink mark routes through `normalizeHref(raw)` or `normalizeLinkifyHref(match)`.
- Bare domains become `https://...`; explicit schemes are preserved.
- Bare email becomes `mailto:<email>` via strict full-string linkify match.
- Bare E.164 phone numbers become `tel:+<digits>`:
  - `+` prefix required.
  - 8-15 digits per RFC 3966.
  - spaces, dashes, dots, and parentheses accepted on input and stripped in canonical href.
  - gated by `utils/phone.ts::isBarePhone`.
- Phone support is wired in:
  - `normalizeHref`;
  - `autolink.ts`, emitting `type: 'phone'` with canonical `tel:` href;
  - `validateURL`, so editing a phone number can remove the mark when it stops matching.
- Read-side click/preview prefers stored `attrs.href` over DOM `link.href` so relative hrefs do not resolve against `document.baseURI`.
- `validateURL` rejects web-scheme URLs with no plausible host, e.g. `https://googlecom`.
- Standard web schemes `http`, `https`, `ftp`, and `ftps` require a TLD-dot, `localhost`, IPv4, or IPv6 host. IPv6 is detected by colon in `URL.host`.
- Non-standard schemes are validated through `utils/specialUrls.ts`.
- `isSafeHyperlinkHref` is a render safety gate, not input validation. It accepts scheme-less hrefs because no XSS vector can lack a scheme.
- Do not tighten `isSafeHyperlinkHref` to require a scheme; relative hrefs may legitimately reach the renderer through migrations/external authoring.

### Hyperlink Extension: Metadata And Preview

- Async metadata mark-attr writes must not move selection.
- Never use:

```ts
editor
  .chain()
  .setTextSelection(nodePos)
  .extendMarkRange('hyperlink')
  .updateAttributes('hyperlink', attrs)
  .run()
```

- Instead, compute the mark range with `getMarkRange(resolvedPos, hyperlinkType)` and dispatch a plain transaction:
  - `tr.removeMark`;
  - `tr.addMark` with new attrs over the same range;
  - `setMeta('preventUpdate', true)` when needed;
  - no `tr.selection` changes.
- Moving selection across the link makes the floating toolbar think the user navigated away and destroys the popover.
- Failed metadata fetches degrade silently: render `createMetadataContent(null, href)` so the title falls back to raw `href`.
- Do not render unavailable/warning chrome for preview metadata failures.
- Desktop preview popover is title-only: one row, ellipsis truncation, 200px max width.
- Mobile `LinkPreviewSheet` shows title + description + href with wrapping and no truncation.
- Do not reintroduce `line-clamp-2` on the mobile description.
- Render the mobile href line only when `data?.title && data.title !== href`.

### Hyperlink Extension: Special URLs And Public Surface

- `utils/specialUrls.ts` covers 50+ app schemes plus `DOMAIN_MAPPINGS`.
- Domain matching strips `www.` and supports subdomain suffixes, e.g. `api.github.com` -> `github.com`.
- Catalog source: `https://github.com/bhagyas/app-urls`.
- `getSpecialUrlInfo` returns `{ type: SpecialUrlType, title, category }`.
- The extension ships no icon catalog. Consumers own `type -> icon` mapping.
- `SpecialUrlType` is a string-literal union for compile-time exhaustiveness without runtime bytes.
- Naming convention:
  - lowercase single-word brands: `whatsapp`, `figma`;
  - kebab-case multi-word brands: `facetime-audio`, `apple-tv`, `app-store`;
  - brand spelling over scheme abbreviation: `tg:` -> `telegram`, `fb:` -> `facebook`.
- `utils/index.ts` is the auditable public utility surface. Use explicit named re-exports only; no `export *`.
- Module-internal helpers such as `getURLScheme`, `isBarePhone`, `normalizeLinkifyHref`, `Link`, and `Title` are reachable from siblings but not through the package barrel.
- Adding a public barrel export is a minor semver bump.
- Internal constants live in `src/constants.ts`: `HYPERLINK_MARK_NAME`, `PREVENT_AUTOLINK_META`. Do not export them publicly.
- `src/utils/findLinks.ts` contains pure linkify-result filtering with Bun tests in `utils/__tests__/findLinks.test.ts`.
- v2.0.0 renames:
  - `getUrlScheme` -> `getURLScheme`;
  - `isValidSpecialScheme` -> `isRecognizedSpecialScheme`;
  - `showPopover` -> `openHyperlinkToolbar`;
  - `TRAILING_PUNCT_RE` -> `TRAILING_PUNCTUATION_RE`;
  - `stripTrailingPunct` -> `stripTrailingPunctuation`;
  - `hrefTitle` -> `hrefAnchor`;
  - local `preventAutolink` -> `shouldSkipAutolink`.
- `EditHyperlinkModalOptions` remains as a deprecated alias for `EditHyperlinkPopoverOptions` for one major. Drop it in 3.x.

### Hyperlink Extension: Floating Toolbar

- Toolbar is `position: fixed`.
- Virtual references must recompute live viewport coords on every call; never snapshot at popover open.
- Frozen rects make `computePosition` keep writing the same `top`/`left` while the anchor scrolls away.
- DOM-anchored popovers should pass `referenceElement: <a>` directly.
- Selection-anchored popovers pass a closure that calls `view.coordsAtPos(from)` on every invocation.
- Edit popover anchors to the live `<a>`, not a `linkCoords` snapshot.
- Create popover passes a recomputing closure over captured ProseMirror `from`/`to`.
- Regression coverage: `cypress/e2e/scroll-stickiness.cy.ts`.
- `floatingToolbar.ts` has a module-level singleton `currentToolbar`; creating a toolbar destroys the previous one.
- Public exports are only `hideCurrentToolbar`, `updateCurrentToolbarPosition`, `FloatingToolbarInstance`, and `FloatingToolbarOptions`.
- Keep `createFloatingToolbar` and `DEFAULT_OFFSET` module-private.
- `cypress/e2e/custom-popover.cy.ts` pins the singleton contract.

### Hyperlink Extension: Clean-Room Harness

- Release-gate harness: `packages/extension-hyperlink/test/playground/`.
- Uses `Bun.serve` with HTML import, vanilla Tiptap, and StarterKit; no Vite.
- Bun 1.2+ bundles the HTML's `<script>` and `<link>` tags on demand.
- Playground loads built `dist/` + `styles.css` via the published exports map, not monorepo source.
- Cypress specs cover create, preview-edit, autolink, xss-guards, styling, custom-popover, scroll-stickiness, and special-schemes.
- `_debug.cy.ts` is scratch/debug and excluded from release counts.
- Run via `bun run test` in the package. `pretest` builds, `start-server-and-test` boots the Bun playground on `127.0.0.1:5173`, Cypress runs, then teardown.
- Append `?popover=custom` to use custom popover factories in custom-popover tests.
- Support file is single-file `cypress/support/e2e.ts`. Do not split it; Cypress 15 JIT skipped split imports.
- Every `cypress/e2e/*.cy.ts` file must end with `export {}` to avoid top-level constant collisions under project-level type-checking.
- Tests use `window._editor` + `window._hyperlink`. Use structural checks instead of `instanceof RegExp` because Cypress iframe realm breaks cross-realm `instanceof`.
- Hyperlink extension unit tests use Bun native runner: `bun test src`.
- `scripts/run-tests.sh` runs hyperlink extension unit tests after `extension-indent` and before webapp Jest.

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
- Cypress lives under `packages/webapp/cypress/e2e/editor/indent/`; Jest lives under `packages/extension-indent`.

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
  - `useToc.ts` throttles heading-driven rebuilds with `lodash/throttle`;
  - flat heading list converts to recursive `NestedTocNode` through `buildNestedToc`;
  - `TocDesktop` / `TocMobile` own roots;
  - `useHeadingScrollSpy.ts` debounces scroll/active-heading work with `lodash/debounce`.

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
- `useCheckReadMessage` skips rows where `status !== 'sent'`; this replaces the old `id === 'fake_id'` skip.
- Send path: composer builds a `pending` row with the client UUID, calls `sendMessage({ id, … })` (object-arg signature, single caller is `MessageComposer.tsx`), flips to `failed` with `statusError` on rejection. Realtime echo upsert flips to `sent`.
- Duplicate-key classification is centralized in `components/chatroom/utils/postgresErrors.ts::isDuplicateKeyError`. Both the composer and `retryMessage` must import it; do not inline PgError code/message checks.
- Retry is a standalone helper `components/chatroom/utils/retryMessage.ts` with no React coupling. It routes thread vs regular by `row.thread_id` and is idempotent on stale rows.
- Server RPC `create_thread_message` accepts `p_id UUID DEFAULT NULL` and uses `coalesce(p_id, uuid_generate_v4())`. Mirror any change in both `packages/supabase/scripts/10-4-func-threads.sql` and `packages/supabase/seed.sql`, plus add a versioned migration under `packages/supabase/migrations/`.

### Message Grouping Projection

- Grouping lives in the view layer, not the store. `utils/projectMessageGroups.ts` is a pure projection `(rows, currentUserId) → TGroupedMsgRow[]` run inside `MessageLoop`'s `useMemo`; it sorts by `(created_at ASC, id ASC)` and emits parallel flags.
- `TGroupedMsgRow = TMsgRow & { isGroupStart, isGroupEnd, isNewGroupById, isOwner }`. The store keeps raw `TMsgRow`; grouping flags are never persisted and do not leak into `api/messages/*` types.
- Do not reintroduce `utils/groupMessages.ts` or an in-store mutation that writes grouping flags back onto rows. Out-of-order realtime arrivals and pagination merges corrupt flags whenever they are stored.
- `channelMessagesStore` is tightened from `any` to `TMsgRow` and no longer maintains a `lastMessages` side-store. Derive the most-recent row from `messagesByChannel` directly.
- `MessageListContext` and `MessageCardContext` must memoize their context value objects (`useMemo`). A fresh object identity on every parent render cascades re-renders through every `MessageCard`.
- `MessageFooter` self-hides on `status === 'failed'`. Consumers (`DesktopEditor`, `ChatContainerMobile`) render `MessageCard.FailedRow` for owner rows and must not re-gate on `status`.

### MessageComposer Pitfalls

- After submit, refocus the editor only if it was the active element. Otherwise `editor.chain().clearContent(true).focus('start').run()` force-opens the iOS keyboard right after a `SendButton` tap and produces a visible bounce. Enter-key submits keep focus naturally.
- `useEditor(...)` in `components/chatroom/components/MessageComposer/hooks/useTiptapEditor.ts` captures `workspaceId` / `channelId` / `isToolbarOpen` in the `onUpdate` closure. Today this is masked because `Chatroom.ChannelComposer` remounts on channel key change and drafts never cross. If the composer mount is ever made persistent (a tempting perf win), drafts will silently corrupt across channels — fix with a refs pattern or lift `setComposerStateDebounced` into a `useEffect` keyed on the ids.
- `prepareContent` must return a stable `chunks` shape (`{ htmlChunks: string[], textChunks: string[] }`) on both the happy and empty paths so callers never need an `as` cast.
