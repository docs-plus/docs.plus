# AGENTS.md — `@docs.plus/extension-hyperlink`

Persistent memory for AI agents working inside this package. Covers schema, commands, safety, click handling, metadata/preview, the `specialUrls` catalog, the public API surface, the floating toolbar, and the clean-room Cypress harness. Repo-wide rules (package manager, scripts naming, release flow) live in the root `AGENTS.md`. Webapp-side popover integration lives there too, under §Webapp-Owned Hyperlink Popovers.

## Schema And Commands

- The webapp couples to this extension through `packages/webapp/src/components/TipTap/extensions/markdown-extensions.ts` as `HyperlinkWithMarkdown = Hyperlink.extend({ markdownTokenName: 'link', parseMarkdown, renderMarkdown })`. Parsing applies mark name `hyperlink`.
- The `hyperlink` mark name is locked by markdown wiring and stored production Yjs docs. Never rename it to `link`.
- This package is **not** a drop-in schema replacement for `@tiptap/extension-link`; migration docs describe moving into `@docs.plus/extension-hyperlink`.
- Same-document hyperlink targets update URL/hash/route for in-app navigation. Do not treat them as external opens.
- `setHyperlink({ href, target?, title?, image? })` is pure and chainable — it only writes the mark and returns boolean. `setHyperlink()` with no args returns false; never call it to open UI.
- UI opens through `openCreateHyperlinkPopover()`, bound to `Mod-k`. Webapp call sites: `MobileBubbleMenu.tsx`, `HyperlinkButton.tsx`, `EditorToolbar.tsx`, `ToolbarMobile.tsx`.
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

- `isSafeHref` + `buildHrefGate` are the single XSS gate. `parseHTML` uses `getAttrs` + `isSafeHref(href)`; `clickHandler.ts` and the preview popover `window.open` fallback also call `isSafeHref`.
- `buildHrefGate(options)` composes `isSafeHref` with user `isAllowedUri(href, { defaultValidate, defaultProtocol })`.
- All write boundaries use the composed gate: `setHyperlink`, `toggleHyperlink`, `editHyperlink`, input rule, paste rule, paste handler, autolink, popover submit, `parseHTML`.
- `DANGEROUS_SCHEME_RE` stays internal to `validateURL.ts`. Call sites import `isSafeHref`, not the regex.
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
- Failed metadata fetches degrade silently: render `createMetadataContent(null, href)` so the title falls back to raw `href`. Do not render unavailable/warning chrome for preview metadata failures.
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
- v2.0.0 symbol renames (do not reintroduce the old names): `getUrlScheme → getURLScheme`, `isValidSpecialScheme → isRecognizedSpecialScheme`, `showPopover → openHyperlinkToolbar`, `TRAILING_PUNCT_RE → TRAILING_PUNCTUATION_RE`, `stripTrailingPunct → stripTrailingPunctuation`, `hrefTitle → hrefAnchor`, local `preventAutolink → shouldSkipAutolink`. `EditHyperlinkModalOptions` is a deprecated alias for `EditHyperlinkPopoverOptions`, dropped in 3.x.

## Floating Toolbar

- Toolbar is `position: fixed`. Virtual references must recompute live viewport coords on every call; never snapshot at popover open. Frozen rects make `computePosition` keep writing the same `top`/`left` while the anchor scrolls away.
- DOM-anchored popovers pass `referenceElement: <a>` directly. Selection-anchored popovers pass a closure that calls `view.coordsAtPos(from)` on every invocation.
- Edit popover anchors to the live `<a>`, not a `linkCoords` snapshot. Create popover passes a recomputing closure over captured ProseMirror `from`/`to`.
- `floatingToolbar.ts` has a module-level singleton `currentToolbar`; creating a toolbar destroys the previous one.
- Public exports are only `hideCurrentToolbar`, `updateCurrentToolbarPosition`, `FloatingToolbarInstance`, `FloatingToolbarOptions`. Keep `createFloatingToolbar` and `DEFAULT_OFFSET` module-private.
- Regression coverage: `cypress/e2e/scroll-stickiness.cy.ts`. The singleton contract is pinned by `cypress/e2e/custom-popover.cy.ts`.

## Clean-Room Harness

- Release-gate harness lives at `test/playground/`. Uses `Bun.serve` with HTML import, vanilla Tiptap, and StarterKit; no Vite. Bun 1.2+ bundles the HTML's `<script>` and `<link>` tags on demand.
- Playground loads built `dist/` + `styles.css` via the published exports map, **not** monorepo source.
- Cypress specs cover create, preview-edit, autolink, xss-guards, styling, custom-popover, scroll-stickiness, and special-schemes. `_debug.cy.ts` is scratch and excluded from release counts.
- Run with `bun run test`. `pretest` builds, `start-server-and-test` boots the Bun playground on `127.0.0.1:5173`, Cypress runs, then teardown. Append `?popover=custom` to use custom popover factories in custom-popover tests.
- Support file is single-file `cypress/support/e2e.ts`. Do not split it; Cypress 15 JIT skipped split imports.
- Every `cypress/e2e/*.cy.ts` file must end with `export {}` to avoid top-level constant collisions under project-level type-checking.
- Tests use `window._editor` + `window._hyperlink`. Use structural checks instead of `instanceof RegExp` because Cypress iframe realm breaks cross-realm `instanceof`.
- Unit tests use Bun native runner: `bun test src`.
- Repo-wide test orchestration runs the hyperlink clean-room Cypress suite after `extension-indent` Jest and before webapp Jest, via `scripts/run-tests.sh`.
