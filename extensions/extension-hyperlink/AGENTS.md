# AGENTS.md — `@docs.plus/extension-hyperlink`

Persistent memory for AI agents working inside this package. Covers schema, commands, safety, click handling, metadata/preview, the `specialUrls` catalog, the public API surface, the floating toolbar, and the clean-room Cypress harness. Repo-wide rules (package manager, scripts naming, release flow) live in the root `AGENTS.md`. Webapp-side popover integration lives there too, under §Webapp-Owned Hyperlink Popovers.

## Schema And Commands

- Markdown import/export lives **in this package** on the `Hyperlink` mark itself: `markdownTokenName: 'link'` + `parseMarkdown`/`renderMarkdown` (in `hyperlink.ts`). The hooks are inert unless the host also loads a Markdown extension; the webapp uses the base `Hyperlink` directly (no `*WithMarkdown` wrapper). Parsing applies mark name `hyperlink` (the `HYPERLINK_MARK_NAME` constant).
- The `hyperlink` mark name is locked by markdown wiring and stored production Yjs docs. Never rename it to `link`.
- This package is **not** a drop-in schema replacement for `@tiptap/extension-link`; migration docs describe moving into `@docs.plus/extension-hyperlink`.
- Same-document hyperlink targets update URL/hash/route for in-app navigation. Do not treat them as external opens.
- `setHyperlink({ href, target?, title?, image? })` is pure and chainable — it only writes the mark and returns boolean. `setHyperlink()` with no args returns false; never call it to open UI.
- UI opens through `openCreateHyperlinkPopover()`, bound to `Mod-k`. Webapp call sites: `HyperlinkButton.tsx`, `EditorToolbar.tsx`, `ToolbarMobile.tsx`.
- `previewHyperlink.ts` no longer passes dead `view` / `linkCoords` args to `editHyperlinkPopover`; keep the canonical signature.
- Link-compatible command aliases: `setLink`, `unsetLink`, `toggleLink` — command names only, no schema rename.
- Canon options: `defaultProtocol`, `isAllowedUri(href, ctx)`, `shouldAutoLink(url)`, `enableClickSelection`, `exitable`.
- `editHyperlinkCommand` must return a composable Tiptap command that reads positions/marks from `tr.doc`. Do not dispatch a nested chain that can cause mismatched transactions.

## Click Handling

- ProseMirror has two click paths: DOM `click` through `handleDOMEvents.click`, and `mouseup`-based `handleSingleClick` that tracks `mousedown` position before DOM `click`.
- To prevent editable-mode navigation:
  - Capture-phase `mousedown`: `preventDefault + stopPropagation` to block ProseMirror mousedown tracking.
  - Capture-phase `click`: `preventDefault` only, so the event still bubbles to `handleDOMEvents.click` for popover display.
- Call `options.popover(...)` **before** `editor.chain().focus(clickPos).setTextSelection(pos).run()`.
- If the popover returns `null`, skip the focus call entirely. `null` is the host opt-out signal, especially for mobile sheets. Desktop popovers still set focus/selection after content exists so edit/remove actions target the right mark.
- `iosCaretFixPlugin` must early-return on link targets in both `touchstart` and `click`, and clear `lastTouchCoords` on `touchstart`. Link taps are owned by this extension; stray caret-fix selection dispatch can re-trigger iOS auto-scroll.
- `target` and `image` mark attrs are `rendered: false` so stored `_blank` and preview-metadata payloads do not render to DOM. Preview metadata stays mark-only and refetches on demand.

## Safety And Normalization

- `isSafeHref` + `composeGate` are the single XSS gate. `parseHTML` uses `getAttrs` + `isSafeHref(href)`; `clickHandler.ts` and the preview popover `window.open` fallback also call `isSafeHref`.
- `composeGate(options)` composes `isSafeHref` with user `isAllowedUri(href, { defaultValidate, protocols, defaultProtocol })`.
- All write boundaries use the composed gate: `setHyperlink`, `toggleHyperlink`, `editHyperlink`, input rule, paste rule, paste handler, autolink, popover submit. `parseHTML`/`parseMarkdown` apply only the `isSafeHref` floor so a tightened `isAllowedUri` cannot strip marks from existing documents on import.
- `DANGEROUS_SCHEME_RE` is defined only in `validateURL.ts` and is deliberately public (exported via `utils/index.ts` and `url-decisions/index.ts`, reachable from the package root, documented in README → Security). In-package call sites import `isSafeHref`, never the regex.
- Every path that stores a hyperlink mark routes through `normalizeHref(raw)` or `normalizeLinkifyHref(match)`:
  - Bare domains become `https://...`; explicit schemes are preserved.
  - Bare email becomes `mailto:<email>` via strict full-string linkify match.
  - Bare E.164 phone becomes `tel:+<digits>` — `+` prefix required, 8-15 digits per RFC 3966; spaces, dashes, dots, parentheses accepted on input and stripped in canonical href; gated by `utils/phone.ts::isBarePhone`.
- Phone support is wired in `normalizeHref`, `autolink.ts` (emits `type: 'phone'` with canonical `tel:` href), and `validateURL` (so editing a phone number can remove the mark when it stops matching).
- Read-side click/preview prefers stored `attrs.href` over DOM `link.href` so relative hrefs do not resolve against `document.baseURI`.
- `validateURL` rejects web-scheme URLs with no plausible host (e.g. `https://googlecom`). Standard web schemes `http`, `https`, `ftp`, `ftps` require a TLD-dot, `localhost`, IPv4, or IPv6 host (IPv6 is detected by colon in `URL.host`). Non-standard schemes are validated through `utils/specialUrls.ts`.
- `isSafeHyperlinkHref` is a **render** safety gate, not input validation. It accepts scheme-less hrefs because no XSS vector can lack a scheme. Do not tighten it to require a scheme; relative hrefs may legitimately reach the renderer through migrations or external authoring.

## Metadata And Preview

- Async metadata mark-attr writes must not move selection. Never use:

```ts
editor
  .chain()
  .setTextSelection(nodePos)
  .extendMarkRange('hyperlink')
  .updateAttributes('hyperlink', attrs)
  .run()
```

Moving selection across the link makes the floating toolbar think the user navigated away and destroys the popover.

- Instead, compute the mark range with `getMarkRange(resolvedPos, hyperlinkType)` and dispatch a plain transaction: `tr.removeMark`, then `tr.addMark` with new attrs over the same range, optionally `setMeta('preventUpdate', true)`. No `tr.selection` changes.
- Failed metadata fetches degrade silently: render `createMetadataContent(null, href)` so the title falls back to raw `href`. Do not render unavailable/warning UI for preview metadata failures.
- Desktop preview popover is title-only: one row, ellipsis truncation, 200px max width.
- Mobile `LinkPreviewSheet` shows title + description + href with wrapping and no truncation. Do not reintroduce `line-clamp-2` on the description. Render the href line only when `data?.title && data.title !== href`.

## Special URLs

- `utils/specialUrls.ts` covers 50+ app schemes plus `DOMAIN_MAPPINGS`. Catalog source: <https://github.com/bhagyas/app-urls>.
- Domain matching strips `www.` and supports subdomain suffixes (e.g. `api.github.com` → `github.com`).
- `getSpecialUrlInfo` returns `{ type: SpecialUrlType, title, category }`.
- `SpecialUrlType` is a string-literal union for compile-time exhaustiveness without runtime bytes. The extension ships no icon catalog; consumers own `type → icon` mapping.
- `SpecialUrlType` naming convention:
  - lowercase single-word brands: `whatsapp`, `figma`;
  - kebab-case multi-word brands: `facetime-audio`, `apple-tv`, `app-store`;
  - brand spelling over scheme abbreviation: `tg:` → `telegram`, `fb:` → `facebook`.

## Public Surface

- `utils/index.ts` is the auditable public utility surface. Use explicit named re-exports only; no `export *`. Adding a public barrel export is a minor semver bump.
- Module-internal helpers (`getURLScheme`, `isBarePhone`, `normalizeLinkifyHref`, `Link`, `Title`) are reachable from siblings but not through the package barrel.
- Internal constants live in `src/constants.ts` (`HYPERLINK_MARK_NAME`, `PREVENT_AUTOLINK_META`). Do not export them publicly.
- `src/utils/findLinks.ts` contains pure linkify-result filtering with Bun tests in `utils/__tests__/findLinks.test.ts`.
- v2.0.0 symbol renames (do not reintroduce the old names): `getUrlScheme → getURLScheme`, `isValidSpecialScheme → isRecognizedSpecialScheme`, `showPopover → openHyperlinkToolbar` (since renamed `openPreviewPopoverFromClick` — it opens the preview popover; "toolbar" named the content, not the surface), `TRAILING_PUNCT_RE → TRAILING_PUNCTUATION_RE`, `stripTrailingPunct → stripTrailingPunctuation`, `hrefTitle → hrefAnchor`, `buildHrefGate → composeGate`, local `preventAutolink → shouldSkipAutolink`. `EditHyperlinkModalOptions` / `EditHyperlinkPopoverOptions` (both v1 names) were consolidated into `EditHyperlinkOptions` in v2.0.0 — no deprecated alias shipped; do not reintroduce either old name.

## Floating Popover

- The engine is `@docs.plus/floating-popover`, a private workspace package bundled into `dist` (never externalized; see root AGENTS.md §Shared Library Config). `src/floating-popover/index.ts` is a shim re-export that keeps internal `../floating-popover` import paths stable. Each consuming extension bundles its own controller instance — no cross-package singleton.
- Layered public API: Layer 1 — named openers `openPreviewHyperlink` / `openEditHyperlink` / `openCreateHyperlink` (slot resolution, prebuilt fallback, `null` opt-out). Layer 2 — `getDefaultController()` with `adopt` / `close` / `reposition` / `getState` / `subscribe`; `subscribe` does NOT fire with the current state on attach. Primitive — `createPopover` (self-adopts as `'unknown'`; openers re-adopt under `'preview' | 'edit' | 'create'`). Adopt destroys the previous owner — one popover at a time.
- Popovers are `position: fixed` with inline `z-index` (override via `createPopover({ zIndex })`; `styles.css` carries no positioning). Virtual references must recompute live viewport coords on every call; never snapshot at popover open. Edit popover anchors to the live `<a>` via `findLiveEquivalentAnchor`; create popover passes a recomputing closure over captured ProseMirror `from`/`to`.
- Shell ARIA roles are per-surface (the engine shell is role-neutral; openers pass `role`): preview mounts as `role="toolbar"`; create/edit mount as `role="dialog"` with `aria-label` `"Add link"` / `"Edit link"`. BYO factories replace content only, so the shell role and name stand for them too. Pinned by the preview-edit spec's a11y test.
- Ownership: openers call `setActivePopoverOwner(editor, popover)` after adopt; the mark's `onDestroy` calls `closeOwnedPopover(editor)`, which closes only when the controller's mounted element is the owned instance's element, and ownership clears as soon as the controller stops holding that popover. Destroying an editor must never close a sibling's or a manually adopted popover.
- Icon-only buttons in the prebuilt popovers get hover/focus tooltips from `@docs.plus/floating-tooltip` (bundled like the engine, never externalized; no native `title` — that would double the label). The `.floating-tooltip` skin in `styles.css` stays in lockstep with hypermultimedia's `media-toolbar.css` copy, and every opener composes `hideTooltip` into `createPopover`'s `onHide` so dismissal cannot strand the shared bubble.
- Regression coverage: `cypress/e2e/scroll-stickiness.cy.ts` (live anchoring), `custom-popover.cy.ts` (controller contract), `destroy-lifecycle.cy.ts` (ownership).

## Clean-Room Harness

- Release-gate harness: `test/playground/main.ts` (editor fixture) + shared `@docs.plus/playground` (`docs-playground` serves the page shell; `setupPlayground` wires title/tokens/theme). Vanilla Tiptap + StarterKit; no Vite.
- Playground loads built `dist/` + `styles.css` via the published exports map, **not** monorepo source.
- Cypress specs cover create, preview-edit, autolink, xss-guards, styling, custom-popover, scroll-stickiness, and special-schemes. `_debug.cy.ts` is scratch and excluded from release counts.
- Run with `bun run test`. `pretest` builds, `start-server-and-test` boots `docs-playground` on `127.0.0.1:5173`, Cypress runs, then teardown. Manual dev: `bun run playground` (`bun --hot docs-playground`). Append `?popover=custom` for custom popover factories in custom-popover tests.
- Support file is single-file `cypress/support/e2e.ts`. Do not split it; Cypress 15 JIT skipped split imports.
- `cypress/tsconfig.json` extends `@docs.plus/playground/cypress/tsconfig.json` with `include: ["./**/*.ts"]` so tsc does not inherit the package `rootDir: src`.
- Every `cypress/e2e/*.cy.ts` file must end with `export {}` to avoid top-level constant collisions under project-level type-checking.
- Tests use `window._editor` + `window._hyperlink`. Use structural checks instead of `instanceof RegExp` because Cypress iframe realm breaks cross-realm `instanceof`.
- Unit tests use Bun native runner: `bun test src`.
- Repo-wide test orchestration runs the hyperlink clean-room Cypress suite after `extension-indent` Jest and before webapp Jest, via `scripts/run-tests.sh`.
