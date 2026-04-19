<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/extension-hyperlink` are documented here.
This project follows [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://conventionalcommits.org). Section headings (`Added` / `Changed` / `Fixed` / `Security`) intentionally repeat per version, per the [Keep a Changelog](https://keepachangelog.com/) convention.

## [4.3.0] — 2026-04-16

### Added

- **`normalizeHref(raw)` helper** (re-exported from the package root) for canonicalizing user-typed hrefs: prepends `https://` to bare domains (`google.com` → `https://google.com`), preserves explicit schemes, passes protocol-relative URLs (`//example.com`) through untouched.
- **`normalizeLinkifyHref(match)` helper** — same canonical form for `linkifyjs` matches. Routes URL matches through `normalizeHref(match.value)` to upgrade linkifyjs's `http://` default to `https://`; trusts linkifyjs's `href` for non-URL matches (emails → `mailto:`, custom schemes).
- **`LinkifyMatchLike` type** exported for consumers building BYO popovers that interact with linkifyjs matches directly.
- **Plausible-host validation** in `validateURL`: web-scheme URLs must have a host with a TLD dot, `localhost`, or an IPv4/IPv6 literal. Rejects typos like `https://googlecom` that linkifyjs would otherwise accept.
- **`autolink.cy.ts`** E2E spec (5 tests) pinning the unified-href contract across autolink-on-space, paste-over-selection, and email-preservation paths.

### Changed

- **Unified write-boundary href canonicalization**: every path that stores a hyperlink mark now produces the same canonical `href` for the same input — create popover, edit popover, `setHyperlink` command, markdown input rule, autolink plugin, paste handler, and paste rule all route through `normalizeHref` or `normalizeLinkifyHref`. Previously, autolink stored bare domains, paste stored `http://`, and only the create popover upgraded to `https://`.
- **Read-side origin-leak defence**: click handler and preview popover now prefer the stored mark attribute (`attrs.href`) over the DOM `link.href` property, which resolves relative URLs against `document.baseURI`. Prevents a `<a href="google.com">` injected via `setContent` from rendering/opening as `http://<host-origin>/google.com`.

### Fixed

- **Autolink email href clobber**: `findLinks`'s trailing-punctuation cleanup was overwriting linkifyjs's canonical `href` (including the `mailto:` prefix) with the punctuation-stripped `value`. Emails now correctly store `mailto:user@example.com` on whitespace autolink.

## [4.2.0] — 2026-04-15

### Added

- **Shipped default stylesheet** (`@docs.plus/extension-hyperlink/styles.css`) for the prebuilt create / preview / edit popovers. Small, framework-agnostic, and opt-in — the extension's JavaScript never imports it, so fully-custom UIs pay zero CSS cost. Previously consumers had to write popover styles from scratch or copy them out of the monorepo.
- **Theming via CSS custom properties**: every visual token (colors, radii, shadow, font, transitions, z-index) exposed as `--hl-*` variables. Colors use CSS `light-dark()` so the popover tracks the nearest ancestor's `color-scheme` (and falls back to `prefers-color-scheme` when no `color-scheme` is set), instead of being locked to the OS preference.
- **README quick-start** for the prebuilt popovers, plus two runnable vanilla-JS DOM examples (under `<details>`) showing how to build a custom `previewHyperlink` / `createHyperlink` from scratch — restored from the v3 docs and wired to the current `PreviewHyperlinkOptions` / `CreateHyperlinkOptions` shapes.
- **Clean-room E2E test harness** (Cypress specs across `create`, `preview-edit`, `xss-guards`, `styling`, `custom-popover`) that runs against the **built `dist/` loaded via the published `exports` map** — i.e. exercises exactly what an npm consumer installs, not the monorepo source. Replaces the manual "scratch Tiptap install + click around" ritual done before every release. Run with `bun run test` (~20s headless).
- **Bun-native playground** (`test/playground/server.ts`, ~15 lines): `Bun.serve({ routes: { '/': index } })` with an HTML import bundles the playground's TypeScript + CSS on demand. Replaces the previous Vite dev server; no bundler config, no dedupe knobs, one less dev dep.

### Security

- **`parseHTML` now rejects every dangerous URL scheme**, not only `javascript:`. Previously used a CSS selector (`a[href]:not([href^="javascript:"])`) that silently let `data:` and `vbscript:` through on document load / paste of third-party HTML; replaced with a `getAttrs` callback that runs the full `DANGEROUS_SCHEME_RE` check. Aligns `parseHTML` with the input rule, click handler, and preview popover so all four entry points enforce the same XSS invariant.

### Fixed

- **`editHyperlink` "mismatched transaction" error** when editing text + href together via the edit popover. The command helper used to dispatch its own nested `editor.chain()...run()`, which collided with the outer `.extendMarkRange(...).editHyperlink(...).run()` in the popover. Refactored into a composable Tiptap command (`editHyperlinkCommand`) that reads positions + marks off `tr.doc` inside the caller's single transaction. Discovered by the new `preview-edit.cy.ts` spec.

### Changed

- **`sideEffects`** in `package.json` is now `["**/*.css"]` (was `false`) so bundlers preserve `import '@docs.plus/extension-hyperlink/styles.css'` while still tree-shaking JS.
- **Package `exports`** now advertises `./styles.css` and `./package.json` as public subpaths.
- **`DANGEROUS_SCHEME_RE`** is now part of the public API (re-exported from the package root) so custom popovers can apply the same XSS check as the prebuilt ones.

---

## [4.1.0] — 2026-04-15

### Security

- **Blocked dangerous URL schemes** (`javascript:`, `data:`, `vbscript:`) in the markdown input rule, click handler `window.open`, and preview popover link open. Previously, `parseHTML` blocked `javascript:` on import but the input rule allowed it on creation — a stored XSS vector in collaborative editors. Shared `DANGEROUS_SCHEME_RE` regex exported from `utils/validateURL`.

### Fixed

- **Click handler attrs mismatch**: `showPopover` now reads mark attributes from the **clicked link's document position** (`view.posAtDOM`) instead of from the current selection (`getAttributes`). Previously, clicking a link when the cursor was on a different link returned wrong `attrs` (href, title, image) to the popover.
- **Global `linkifyjs.reset()` removed**: `onDestroy` no longer calls `reset()`, which cleared the global linkify protocol registry and broke other editors on the same page. Registered protocols are now additive for the page lifetime.
- **Edit popover back button**: replaced fragile `setTimeout(() => link.click(), 1)` with an explicit `onBack` callback that re-creates the preview toolbar without simulating DOM clicks.
- **Floating toolbar async race**: `updatePosition` now checks `visible` after `await computePosition()` to avoid writing to a detached toolbar element if `hide()` ran mid-computation.
- **Silent error swallowing**: `editHyperlink` helper now logs a `console.warn` on `catch` instead of silently returning `false`.

### Changed

- **Hardcoded mark name eliminated**: `editHyperlink` helper and edit popover now accept `markName` parameter (default `'hyperlink'`) instead of hardcoding `state.schema.marks.hyperlink` and `.extendMarkRange('hyperlink')`. All callers pass `this.name`.
- **Production build preserves `console.warn`/`console.error`**: tsup config changed from `drop: ['console']` to `pure: ['console.log', 'console.debug']` — library errors are now visible in production.
- **Deduplicated toolbar offset**: `TOOLBAR_OFFSET` in `clickHandler.ts` replaced with shared `DEFAULT_OFFSET` exported from `floatingToolbar.ts`.
- **`EditHyperlinkModalOptions` exported**: consumers can now type-check edit popover configuration.

---

## [4.0.0] — 2026-04-15

### Breaking Changes

- **Renamed options** to align with Tiptap conventions:
  - `autoHyperlink` → `autolink`
  - `hyperlinkOnPaste` → `linkOnPaste`
- **Renamed commands** to fix mixed casing:
  - `editHyperLinkText` → `editHyperlinkText`
  - `editHyperLinkHref` → `editHyperlinkHref`
- **Renamed CSS classes** from camelCase to kebab-case:
  - `.hyperlinkCreatePopover` → `.hyperlink-create-popover`
  - `.hyperlinkPreviewPopover` → `.hyperlink-preview-popover`
  - `.hyperlinkEditPopover` → `.hyperlink-edit-popover`
  - `.buttonsWrapper` → `.buttons-wrapper`
  - `.inputsWrapper` → `.inputs-wrapper`
  - `.textWrapper` → `.text-wrapper`
  - `.hrefWrapper` → `.href-wrapper`
  - `.backButton` → `.back-button`
  - `.btn_applyModal` → `.apply-button`
- **Unified popover contract**: `createHyperlink` callback now returns `HTMLElement | null` (was `void`). The extension handles positioning — consumers only build content.
- **Renamed meta key**: `preventAutoHyperlink` → `preventAutolink`.
- **Fixed type augmentation**: commands are now augmented under the correct `hyperlink:` key (was `link:`).

### Added

- **Exported popover types**: `PreviewHyperlinkOptions` and `CreateHyperlinkOptions` — consumers no longer need to hand-roll option types.
- **`updateReference()`** on `FloatingToolbarInstance` — allows consumers to reposition the toolbar after async updates (e.g., metadata fetch).
- **`hide` middleware** from `@floating-ui/dom` — toolbar auto-hides when the reference element scrolls out of view.

### Fixed

- **Floating-ui strategy**: changed from `position: absolute` to `strategy: 'fixed'` for body-appended elements, eliminating scroll-lag.
- **Stateful `/g` regex**: split `SPECIAL_SCHEME_REGEX` into global and non-global variants to prevent intermittent `test()` failures.
- **`editHyperlink` helper**: rewritten to use ProseMirror model (`getMarkRange`) instead of fragile DOM traversal (`domAtPos` → `closest('a')`).
- **Missing `.run()`**: edit popover now correctly executes the `editHyperlink` command chain.
- **Stale `view` capture**: click handler passes `view` directly from `handleDOMEvents` instead of capturing at plugin creation time.
- **Memory leaks**: proper cleanup of `autoUpdate` subscriptions and event listeners on `hide()` and `destroy()`.

### Changed

- **`floating-toolbar.ts` rewritten**: replaced over-engineered singleton class (`FloatingToolbarManager`, ~800 LOC) with a lean functional module (~270 LOC).
- **`createHyperlinkPopover` simplified**: no longer manages its own floating toolbar — just returns DOM content.
- **Reference type**: `any` → `ReferenceElement | VirtualElement` for the floating toolbar reference element.
- Plugin factory functions renamed to camelCase: `autolinkPlugin`, `clickHandlerPlugin`, `pasteHandlerPlugin`.
- Plugin key strings standardized to camelCase: `hyperlinkAutolink`, `hyperlinkClickHandler`, `hyperlinkPasteHandler`.
- File renames: `copy2Clipboard.ts` → `copyToClipboard.ts`, `floating-toolbar.ts` → `floatingToolbar.ts`, `autoHyperlink.ts` → `autolink.ts`.

### Removed

- Internal `Logger`, `HTMLSanitizer`, `CleanupTracker` classes (replaced by direct, simpler implementations).
- Redundant default export from `specialUrls.ts`.
- Empty `types.ts` file.

### Migration Guide

```diff
 Hyperlink.configure({
-  autoHyperlink: true,
-  hyperlinkOnPaste: true,
+  autolink: true,
+  linkOnPaste: true,
   popovers: {
     previewHyperlink: myPreviewFn,
-    createHyperlink: myCreateFn,   // was (options) => void
+    createHyperlink: myCreateFn,   // now (options) => HTMLElement | null
   }
 })

 // Commands
-editor.commands.editHyperLinkText('New Text')
-editor.commands.editHyperLinkHref('https://example.com')
+editor.commands.editHyperlinkText('New Text')
+editor.commands.editHyperlinkHref('https://example.com')

 // CSS selectors
-.hyperlinkCreatePopover { ... }
-.buttonsWrapper { ... }
+.hyperlink-create-popover { ... }
+.buttons-wrapper { ... }

 // Meta key in transactions
-tr.setMeta('preventAutoHyperlink', true)
+tr.setMeta('preventAutolink', true)

 // Popover types (no more hand-rolled types)
+import type { PreviewHyperlinkOptions, CreateHyperlinkOptions } from '@docs.plus/extension-hyperlink'
```

---

## [3.0.0] — 2024

Internal release. Migrated build to `tsup` (ESM + CJS + DTS). Added special URL scheme support (50+ protocols), markdown link input rules (`[text](url)`), and image syntax protection for auto-linking.

## [2.0.0] — 2024

Internal release. Moved from standalone repository to `docs.plus` monorepo under `packages/extension-hyperlink`. Updated peer dependencies to use monorepo `catalog:` pins.

---

## [1.3.7] — 2023-07-26

Version bump only.

## [1.3.6] — 2023-07-26

Version bump only.

## [1.3.5] — 2023-07-26

Version bump only.

## [1.3.4] — 2023-07-25

### Bug Fixes

- Hide popover on outside click.
- Prevent popover from displaying in the wrong position.
- Fix typo.

## [1.3.3] — 2023-07-23

Version bump only.

## [1.3.2] — 2023-07-21

### Bug Fixes

- Fix interfaces and types.
- Fix replacing hyperlink with new text.
- Fix selecting closest anchor element.
- Fix wrong selection of the anchor node.

## [1.3.1] — 2023-07-20

### Bug Fixes

- Fix interfaces and types.
- Fix replacing hyperlink with new text.
- Fix selecting closest anchor element.
- Fix wrong selection of the anchor node.

## [1.3.0] — 2023-07-20

### Bug Fixes

- Fix interfaces and types.
- Fix replacing hyperlink with new text.
- Fix selecting closest anchor element.

## [1.2.1] — 2023-07-19

### Bug Fixes

- Fix interfaces and types.

## [1.2.0] — 2023-07-19

Version bump only.

## [1.1.0] — 2023-07-18

Version bump only.

## [1.0.4] — 2023-07-17

Version bump only.
