# AGENTS.md

## Learned User Preferences

- Use Bun exclusively — never npm/yarn/pnpm (`bun install`, `bun add`, `bun run`, `bunx`)
- Do not commit unless explicitly asked; short descriptive messages, no AI/Cursor branding or internal doc references
- Production code quality: DRY, KISS, SOLID, industry-standard; avoid overengineering and overthinking
- TDD for fixes/features; schema-first test design; fix behavior when the spec is wrong — don't weaken tests to match broken behavior
- Always run `bun run build` after major refactors to verify type-safety before claiming completion
- Before large migrations, audit all config/doc/rule paths (.cursor/rules, Notes/, AGENTS.md) for stale references to removed concepts
- Notes/ folder is local-only (.gitignore); never commit local notes or plans
- Keep debug/info loggers on editor core paths; don't strip them for "cleanup"
- Cypress tests: split by concern with README for scope; kebab-case dirs, `it()` not `test()`; consolidate overlapping tests
- Theme/UI color consistency is first-class — all surfaces (including third-party pickers) must follow design tokens
- Full-doc paste (⌘A→⌘V) is a critical scenario to validate
- User sometimes prefers commands/instructions to run locally rather than the agent auto-installing

## Monorepo toolchain

- **Bun-only** for install/run (`bun install`, `bun run`, `bunx`); see [docs/engineering/toolchain.md](docs/engineering/toolchain.md) for phases, CI parity, and version policy.
- **Quality gates:** `bun run check` = lint + Prettier check + typecheck; `bun run check:full` adds Stylelint (used at end of `pre-push`); `bun run check:static` = lint + Prettier + Stylelint (no `tsc`, used in CI lint job).
- **Shared devtool versions** (ESLint, TypeScript, Prettier, Stylelint, etc.) are owned at the **repo root** — avoid drifting copies in leaf packages.

## Learned Workspace Facts

- docs.plus / docsy — Bun monorepo (packages/\*); main app @docs.plus/webapp (Next.js), backend @docs.plus/hocuspocus; editor code under packages/webapp/src/components/TipTap/ (extensions, nodes, plugins)
- Editor uses flat heading schema (`heading block*`) with decoration-based sections; `attrs['toc-id']` renders as `data-toc-id`; shared heading utilities (computeSection, moveSection, canMapDecorations, transactionAffectsNodeType, matchSections) in TipTap/extensions/shared/
- Editor perf: jank is React/Zustand re-renders, not ProseMirror; never put UI flags in `useEditor` deps; `shouldRerenderOnTransaction: false` on collab; all decoration plugins must gate full rebuilds behind `transactionAffectsNodeType(tr, 'heading')`; placeholder uses `@docs.plus/extension-placeholder` (O(1) via state.init/apply) — do NOT replace with TipTap's built-in (O(N) doc.descendants)
- Zustand: monolithic 7-slice store; all `useStore` calls must use leaf selectors — never `(state) => state` or `(state) => state.settings`
- ProseMirror caveat: `doc.nodeAt(pos)` can throw RangeError for out-of-range — guards must not assume null-only
- Test orchestration: root test:all → scripts/run-tests.sh; Jest (unit) + Cypress (E2E); parallel via CYPRESS_PARALLEL env
- TipTap pad-only SCSS lives under `packages/webapp/src/styles/editor/` and loads via `styles.scss` → `components/_index.scss` → `@use '../editor'`; do not add parallel `.scss` next to TipTap extensions (single source of truth)
- Production: docker-compose.prod.yml with Traefik; dev compose backend services need `context: .` (repo root) to match Dockerfile.bun
- Separate TinyDocy repo (docs-plus/editor): Next.js + Hocuspocus via PM2; ports 3847/3848; Traefik routes at tiny.docs.plus; used as reference for aligning editor patterns
- Stay on ESLint 9.x / TypeScript 5.x until dedicated migration — ESLint 10 and TS 6 have breaking changes
- Standalone extension packages (`extension-hyperlink`, `-hypermultimedia`, `-indent`, `-inline-code`, `-placeholder`) share identical structure: TypeScript + tsup build + `@tiptap/core` peer dep
- Markdown support via `@tiptap/markdown` (GFM); paste plugin at `extensions/markdown-paste/`, import/export in `utils/markdown.ts` + GearModal UI; `sanitizeJsonContent` must be applied to both paste and import paths
