# AGENTS.md — `@docs.plus/extension-hyperlink`

Persistent memory for AI agents working inside this package. Covers schema, commands, safety, click handling, metadata/preview, the `specialUrls` catalog and the public API surface. It also covers the popover engine, the hovercard, link icons, and the clean-room Cypress harness. Repo-wide rules (package manager, scripts naming) live in the root `AGENTS.md`; release flow is in the `release-extensions` skill. Webapp-side popover integration is in `extensions/CLAUDE.md`, under §Webapp-Owned Hyperlink Popovers.

## Schema And Commands

- Markdown import/export lives **in this package** on the `Hyperlink` mark itself: `markdownTokenName: 'link'` + `parseMarkdown`/`renderMarkdown` (in `hyperlink.ts`). The hooks are inert unless the host also loads a Markdown extension; the webapp uses the base `Hyperlink` directly (no `*WithMarkdown` wrapper). Parsing applies mark name `hyperlink` (the `HYPERLINK_MARK_NAME` constant).
- The `hyperlink` mark name is locked by markdown wiring and stored production Yjs docs. Never rename it to `link`.
- This package is **not** a drop-in schema replacement for `@tiptap/extension-link`; migration docs describe moving into `@docs.plus/extension-hyperlink`.
- Same-document hyperlink targets update URL/hash/route for in-app navigation. Do not treat them as external opens.
- `setHyperlink({ href, target?, title?, image? })` is pure and chainable — it only writes the mark and returns boolean. `setHyperlink()` with no args returns false; never call it to open UI.
- UI opens through `openCreateHyperlinkPopover()`, bound to `Mod-k`. `Mod-k` first calls `openPreviewAtSelection`. With a collapsed caret strictly inside a link (`linkAtSelection`), it opens that link's preview and returns `true`. So the create form never opens over a link. With no preview slot, or a factory that returns `null`, it does nothing. Webapp call sites: `HyperlinkButton.tsx`, `EditorToolbar.tsx`, `ToolbarMobile.tsx`, `slash/slashItems.ts`.
- `Mod-k` works on a collapsed caret outside a link and must keep working. A caret at either edge of a link, or between two touching links, counts as outside: the webapp's `applyCreate` inserts a picked heading/bookmark title there. With an empty selection the prebuilt create popover inserts the typed URL as its own link text, in one chain. It does that because `setMark` alone would only reach `storedMarks` and change no text. Gate the href with `editor.can().setHyperlink(...)` before the chain. `chain().run()` dispatches its `tr` even when a command returns false, so a rejected URL would otherwise land as plain text.
- `previewHyperlink.ts` no longer passes dead `view` / `linkCoords` args to `editHyperlinkPopover`; keep the canonical signature.
- Link-compatible command aliases: `setLink`, `unsetLink`, `toggleLink` — command names only, no schema rename.
- Canon options: `defaultProtocol`, `isAllowedUri(href, ctx)`, `shouldAutoLink(url)`, `enableClickSelection`, `exitable`.
- The `hyperlink` mark is never inclusive: the mark spec sets `inclusive: false`. Text typed at either edge of a link stays plain, as in Google Docs (maintainer ruling on #374, 2026-10-05). Do not tie it back to `autolink` for Tiptap parity. `exitable` stays in the API.
- `editHyperlinkCommand` must return a composable Tiptap command that reads positions/marks from `tr.doc`. Do not dispatch a nested chain that can cause mismatched transactions.

## Click Handling

- ProseMirror has two click paths: DOM `click` through `handleDOMEvents.click`, and `mouseup`-based `handleSingleClick` that tracks `mousedown` position before DOM `click`.
- To prevent editable-mode navigation:
  - Capture-phase `mousedown`: `preventDefault + stopPropagation` to block ProseMirror mousedown tracking.
  - Capture-phase `click`: `preventDefault` only, so the event still bubbles to `handleDOMEvents.click` for popover display.
- Call `options.popover(...)` **before** `editor.chain().focus(clickPos).setTextSelection(pos).run()`.
- If the popover returns `null`, skip the focus call entirely. `null` is the host opt-out signal, especially for mobile sheets. Desktop popovers still set focus/selection after content exists so edit/remove actions target the right mark.
- **Mod-click** (Cmd on macOS, Ctrl elsewhere, `hasMod` in `interactions/modKey.ts`) opens the link in a new tab through `openLink`, with no preview. It runs in `handleDOMEvents.click`, before the preview path. Shift or Alt with Mod still counts. A refused href swallows the click on purpose. Read-only mode makes exactly one open.
- **C1: links keep the browser I-beam at rest.** Never add a resting `cursor: pointer` on links. While Mod is held, `attachModCursor` sets `data-hyperlink-mod` on `<html>`. The click plugin adds the `hyperlink-click-scope` class to the editor through `props.attributes`. `styles.css` shows the hand only for `:root[data-hyperlink-mod] .hyperlink-click-scope a[href]`. The webapp keeps a lockstep copy of that rule in `document-styles.scss`, because it does not import `styles.css`.
- The flag clears on a keyup with Mod up, on any non-modifier key (so `Mod-k` drops the hand), on window blur and on a hidden tab. Releasing Shift while Mod is held keeps the hand. A `pointerover` on a link re-syncs it from the event. Editors share one flag per document through a ref count, so destroying one editor leaves the others alone.
- **Read-only Enter on a focused link** reaches `handleDOMEvents.click` as a click with `detail` 0. In read-only mode that opens the preview with focus inside, and Escape returns focus to the link. Edit mode keeps the mouse path, because a scripted click there also has `detail` 0 and must still move the caret.
- **`Alt-Enter`** with a collapsed caret strictly inside a link opens it through `openLink` with `newTab: false`. It returns `true` even when the gate refuses the link, so Enter never splits the link (ruling, 2026-10-27).
- `iosCaretFixPlugin` must early-return on link targets in both `touchstart` and `click`, and clear `lastTouchCoords` on `touchstart`. Link taps are owned by this extension; stray caret-fix selection dispatch can re-trigger iOS auto-scroll.
- `target` and `image` mark attrs are `rendered: false` so stored `_blank` and preview-metadata payloads do not render to DOM. Preview metadata stays mark-only and refetches on demand.
- `class` is `rendered: false` with `parseHTML: () => null`, so content can never set it (#399). Only the developer's `HTMLAttributes.class` reaches the `<a>`, through `mergeAttributes`.
- `openLink(linkCtx, href, { newTab })` is the one place the package opens a link (#242). It runs the read gate, then the host `navigate`, or `window.open(href, '_blank', SAFE_WINDOW_FEATURES)` when `navigate` is unset. `newTab` is `true` only when the gesture asked for a new tab: Mod held, or the middle button. A plain open passes `false`, and the host chooses. The callers:
  - `true`: Mod-click and the middle click on a link in the text, and the middle click on the preview's Open and the hovercard title;
  - `false`: `Alt-Enter` and the read-only click with no preview slot;
  - `hasMod(event)`: a click on the preview's Open and the hovercard title.
- The prebuilt preview reaches the context through `getLinkContext(editor)`. Its Open anchor's `href` is blank unless the composed gate allows it, so a native open skips nothing. Route any new open, middle click included, through `openLink`.

## Safety And Normalization

- `isSafeHref` + `composeGate` are the single XSS gate. `parseHTML` uses `getAttrs` + `isSafeHref(href)`. Every link open goes through `openLink` (`interactions/openLink.ts`), which runs `urls.forRead`: `isSafeHref` plus the composed gate.
- `composeGate(options)` composes `isSafeHref` with user `isAllowedUri(href, { defaultValidate, protocols, defaultProtocol })`.
- All write boundaries use the composed gate: `setHyperlink`, `toggleHyperlink`, `editHyperlink`, input rule, paste rule, paste handler, autolink, popover submit. `parseHTML`/`parseMarkdown` apply only the `isSafeHref` floor so a tightened `isAllowedUri` cannot strip marks from existing documents on import.
- `DANGEROUS_SCHEME_RE` is defined only in `validateURL.ts` and is deliberately public (exported via `utils/index.ts`, the single root-reachable path, documented in `docs/security.md`). In-package call sites import `isSafeHref`, never the regex.
- Every path that stores a hyperlink mark routes through `normalizeHref(raw)` or `normalizeLinkifyHref(match)`:
  - Bare domains become `https://...`; explicit schemes are preserved.
  - Bare email becomes `mailto:<email>` via strict full-string linkify match.
  - Bare E.164 phone becomes `tel:+<digits>` — `+` prefix required, 8-15 digits per RFC 3966. Spaces, dashes, dots, and parentheses are accepted on input and stripped in the canonical href. `utils/phone.ts::isBarePhone` gates it.
- Phone support is wired in `normalizeHref`, `autolink.ts`, and `validateURL`. `autolink.ts` emits `type: 'phone'` with a canonical `tel:` href. `validateURL` is wired so editing a phone number can remove the mark when it stops matching.
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
- Failed metadata fetches degrade silently. The webapp's `renderMetadataInto` builds the title with the raw `href` as its text before the fetch, and a failed fetch keeps it. Do not render unavailable/warning UI for preview metadata failures.
- Desktop preview popover is title-only: one row, ellipsis truncation, 200px max width.
- Mobile `LinkPreviewSheet` shows title + description + href with wrapping and no truncation. Do not reintroduce `line-clamp-2` on the description. Render the href line only when `data?.title && data.title !== href`.

## Special URLs

- `utils/specialUrls.ts` covers 50+ app schemes plus `DOMAIN_MAPPINGS`. Catalog source: <https://github.com/bhagyas/app-urls>.
- Domain matching strips `www.` and supports subdomain suffixes (e.g. `api.github.com` → `github.com`).
- `getSpecialUrlInfo` returns `{ type: SpecialUrlType, title, category }`.
- `SpecialUrlType` is a string-literal union for compile-time exhaustiveness without runtime bytes. The extension ships no icon catalog; consumers own `type → icon` mapping. `linkIconMap` holds only the host's own table.
- `SpecialUrlType` naming convention:
  - lowercase single-word brands: `whatsapp`, `figma`;
  - kebab-case multi-word brands: `facetime-audio`, `apple-tv`, `app-store`;
  - brand spelling over scheme abbreviation: `tg:` → `telegram`, `fb:` → `facebook`.

## Public Surface

- `utils/index.ts` is the auditable public utility surface. Use explicit named re-exports only; no `export *`. Adding a public barrel export is a minor semver bump.
- Module-internal helpers (`getURLScheme`, `isBarePhone`, `normalizeLinkifyHref`, `Link`, `Title`) are reachable from siblings but not through the package barrel.
- The hovercard types `HovercardOptions`, `HovercardData`, `HovercardRenderContext` and `HovercardView` are root type exports. Nothing docs.plus-specific belongs in them. The plugin, `content.ts` and the `Check` icon stay internal.
- `hasMod(event, isMac?)` is a root export (a minor bump). It lives in `interactions/modKey.ts` with `MODIFIER_KEYS` and `modKeyName`. The mod cursor uses all three. The hovercard key rule uses `hasMod` and `MODIFIER_KEYS`.
- `keepsHovercardOpen(event, isMac?)` is a root export (a minor bump). It lives in `hovercard/rules.ts`. A host that runs its own hover card outside the engine can use it to close on the same keys. Cards drawn through `render` need nothing, because the engine applies the rule.
- `linkAtSelection(state, markType)` is a root export (a minor bump). `Mod-k`, `Alt-Enter` and the webapp composer's Enter handler use it. It reads the mark type it is given, never `HYPERLINK_MARK_NAME`.
- Internal constants live in `src/constants.ts` (`HYPERLINK_MARK_NAME`, `PREVENT_AUTOLINK_META`). Do not export them publicly.
- `src/utils/findLinks.ts` contains pure linkify-result filtering with Bun tests in `utils/__tests__/findLinks.test.ts`.
- v2.0.0 symbol renames (do not reintroduce the old names): `getUrlScheme → getURLScheme`, `isValidSpecialScheme → isRecognizedSpecialScheme`, `showPopover → openHyperlinkToolbar`, `TRAILING_PUNCT_RE → TRAILING_PUNCTUATION_RE`, `stripTrailingPunct → stripTrailingPunctuation`, `hrefTitle → hrefAnchor`, `buildHrefGate → composeGate`, local `preventAutolink → shouldSkipAutolink`. `openHyperlinkToolbar` has since been renamed `openPreviewPopoverFromClick`, because it opens the preview popover and "toolbar" named the content, not the surface. `EditHyperlinkModalOptions` / `EditHyperlinkPopoverOptions` (both v1 names) were consolidated into `EditHyperlinkOptions` in v2.0.0 — no deprecated alias shipped; do not reintroduce either old name.

## Floating Popover

- The engine is `@docs.plus/floating-popover`, a private workspace package bundled into `dist` (never externalized; see root AGENTS.md §Shared Library Config). `src/floating-popover/index.ts` is a shim re-export that keeps internal `../floating-popover` import paths stable. Each consuming extension bundles its own controller instance — no cross-package singleton.
- Layered public API: Layer 1 — named openers `openPreviewHyperlink` / `openEditHyperlink` / `openCreateHyperlink` (slot resolution, prebuilt fallback, `null` opt-out). Layer 2 — `getDefaultController()` with `adopt` / `close` / `reposition` / `getState` / `subscribe`; `subscribe` does NOT fire with the current state on attach. Primitive — `createPopover` (self-adopts as `'unknown'`; openers re-adopt under `'preview' | 'edit' | 'create'`, and the hovercard under `'hovercard'`). All four are literals in the `PopoverKind` union. Adopt destroys the previous owner — one popover at a time. The returned `Popover` is a one-shot once opened: `hide()` releases ownership and nothing re-adopts, so `show()` no-ops afterwards. Never cache a popover to reopen — build a new one, which is what every opener already does.
- `createPopover({ onRemove })` runs once, after the root leaves the DOM: at the end of the exit fade, or at once on `destroy()`. `onHide` runs as the hide starts. The hovercard destroys host views in `onRemove`, so a React card never empties while it fades.
- Popovers are `position: fixed` with inline `z-index` (override via `createPopover({ zIndex })`; `styles.css` carries no positioning). Virtual references must recompute live viewport coords on every call; never snapshot at popover open. Edit popover anchors to the live `<a>` via `findLiveEquivalentAnchor`; create popover passes a recomputing closure over captured ProseMirror `from`/`to`.
- The prebuilt edit popover fills Text through the internal `getHyperlinkDisplayText`. It keeps the same body as the webapp copy in `linkMarkUtils.ts`; change both together.
- Shell ARIA roles are per-surface (the engine shell is role-neutral; openers pass `role`): preview mounts as `role="dialog"` with `aria-label` `"Link preview"` (spec C8, 2026-10-27); create/edit mount as `role="dialog"` with `aria-label` `"Add link"` / `"Edit link"`. The hovercard passes no role. BYO factories replace content only, so the shell role and name stand for them too. Pinned by the preview-edit spec's a11y test.
- Ownership: openers call `setActivePopoverOwner(editor, popover)` after adopt. The mark's `onDestroy` calls `closeOwnedPopover(editor)`, which closes only when the controller's mounted element is the owned instance's element. Ownership clears as soon as the controller stops holding that popover. Destroying an editor must never close a sibling's or a manually adopted popover.
- Icon-only buttons in the prebuilt popovers get hover/focus tooltips from `@docs.plus/floating-tooltip` (bundled like the engine, never externalized; no native `title` — that would double the label). The `.floating-tooltip` skin in `styles.css` stays in lockstep with hypermultimedia's `media-toolbar.css` copy. Every opener composes `hideTooltip` into `createPopover`'s `onHide`, so dismissal cannot strand the shared bubble.
- The engine reads the Tab cycle on each Tab, from one `keydown` listener on the root that `show()` binds. A control that renders after open joins the cycle. `FOCUSABLE_SELECTOR` drops `tabindex="-1"`. `canTakeFocus` skips a control that is `:disabled`, inside `[inert]`, or has no client rects. `preview-edit.cy.ts` pins this with a late-appended button.
- **Keyboard-opened preview (spec C3, C9).** `focusPreviewFromKeyboard` (`openers/focusPreviewFromKeyboard.ts`) moves focus to `[data-popover-autofocus]` inside the preview, else the first control of the engine's `focusables(root)`, else the root. A host preview marks its title with that attribute; the prebuilt preview does not. First focus thus follows the Tab rule and skips hidden and inert controls. When the preview closes, focus goes back once, and only when focus is on `body` or still inside the closed preview. It waits one microtask, so an Edit or Back opener can adopt first. It never takes back focus the user moved.
- Regression coverage: `cypress/e2e/scroll-stickiness.cy.ts` (live anchoring), `custom-popover.cy.ts` (controller contract), `destroy-lifecycle.cy.ts` (ownership), `preview-edit.cy.ts` (roles and the Tab cycle).

## Hovercard

- `hovercard: HovercardOptions` adds one ProseMirror plugin (`src/hovercard/hovercardPlugin.ts`). Unset means no plugin. The pure rules live in `hovercard/rules.ts`, and the built-in card DOM lives in `hovercard/content.ts`. The start page for users is `docs/hovercard.md`.
- **Rulings of 2026-11-04 (maintainer).** The extension is the engine. It ships one simple built-in card for demos, and the docs teach hosts to draw their own card through `render`. The docs.plus pad cards and the docs.plus rich web card both draw through `render`. This overturns the 2026-11-03 ruling "a docs.plus link gets a webapp card, never the extension's". The extension still holds nothing docs.plus-specific.
- **Removed before the first publish (never on npm).** The list: `HovercardData.kind`, `HovercardData.facts`, `HovercardFact`, `HovercardFactIcon`, `imageLayout` / `HovercardImageLayout`, `chooseImageShape`, the thumb and tile CSS, the stroke-icon file `hovercard/icons.ts`, and Open in new tab in the built-in card. Do not bring them back; a host draws them through `render`.
- Built-in card (ruled 2026-11-04), top to bottom: the picture in a 1.91:1 cover well, the title (two lines) and the description (two lines). The link line follows: site icon, host and path, and one Copy link button. No `title` shows "No preview for this page." The icons are the package's Material strings from `src/utils/icons.ts` (`Copy`, `Check`). Do not add a third-party icon set to the extension.
- The built-in card sets `innerHTML` only from those static icon strings. No host data and no mark attr ever reaches `innerHTML`; every text goes in through `textContent`.
- **`render` contract.** `render(ctx)` returns an `HTMLElement`, a `HovercardView` (`{ element, destroy? }`) or `null`. `null` keeps the built-in card for that state. The engine owns the frame `.hyperlink-hovercard` (width, border, radius, shadow, `--hl-*` tokens); drawn content fills it. `ctx.open` hides the card only when the open card's href is its own, then calls `openLink`. So a stale view never closes a newer card. `ctx.copy` is `copyToClipboard(href)`. The built-in card (`createBuiltInCard(ctx, picture, siteIcon)`) is drawn from the same public `HovercardRenderContext`.
- `render` runs only for an accepted answer. For `data` it runs when the answer is accepted, before the open, so a React portal can paint first. Only a host view is kept on the pending token. The built-in card is built in `openPending`, so `siteIcon` never runs for a dropped open. For `loading` it runs at the open, and for `empty` (or `data` after a `loading` open) at the swap.
- `destroy` runs on a swap, on a close, and when a pending open that holds a view is dropped (leave, key, press, or `openPending` finding the link gone or another popover open). The close path is the popover `onRemove`, after the root has left the DOM at the end of the exit fade. It also covers an `adopt()` eviction and `editor.destroy()`, which remove at once. `onHide` only clears `card` and the give-up timer. Each path owns its view once, so no guard set is needed. A swap skips `destroy` when `render` returned the same view again. A throwing `destroy` is caught and logged.
- A `render` that throws logs once per editor and the built-in card draws that state. Data with no `title` still reaches `render` as `data`; only the built-in card turns it into the no-preview line.
- Swap: built-in to built-in calls `setBody`, so the link line and its copy state stay. Any host view on either side replaces all frame children, and the frame gets `data-swapped` for the 120 ms fade.
- `render` is declared with method syntax on purpose. Under `strictFunctionTypes`, the property form would stop a `HovercardOptions<D>` with a required host field from assigning to `HyperlinkOptions['hovercard']`.
- The picture wait applies only when the engine preloaded a picture (`data.title` and `data.image`), for the built-in card and a custom one alike.
- Loading (ruled 2026-11-03): with no data at 500 ms the card opens with static bars and a live link line. Data fills the same popover with a 120 ms fade, and `autoUpdate` places the grown card again. At 4000 ms (`GIVE_UP_MS`) with no data, or a `null` answer after open, the body becomes the no-preview line, and a later answer is ignored.
- The title and the Copy link button carry `tabIndex = -1`, and the button calls `preventDefault` on `mousedown`. Tab keeps its editor meaning; the keyboard path is the `Mod-k` preview. No tooltips on the button: a bubble outside the card would start the 300 ms close. `docs/hovercard.md` asks custom cards to follow the same rules.
- Every listener and timer lives in the plugin `view()`, and its `destroy()` removes them. So `editor.destroy()` and an unmount leave other editors alone. The listeners sit on the document, so `linkAt` accepts only a link inside this view.
- Timing (spec A7): the request starts after a 150 ms dwell. When data comes before 500 ms, the card opens at `max(enteredAt + 500, min(dataAt + 300, pictureSettledAt))`. Leaving the link drops the pending open but never cancels the request, so the host cache keeps the answer. Close delay is 300 ms. Do not add an `AbortController` on leave (ruling, 2026-10-27).
- Keys (spec A8): `keepsHovercardOpen` keeps the card open for a bare Shift, Control, Alt, Meta, AltGraph or CapsLock. It also keeps it open for the arrow and page keys, F1–F12, and Mod-C. Mod-Shift-C and Mod-Alt-C close it. `compositionstart` and a `pointerdown` outside the card close it too.
- Never adopt over another kind. `createPopover` adopts at once and destroys the current owner, so the plugin checks `isOtherPopoverOpen()` right before it builds a card. It closes only its own card.
- The card loads only the URLs the host returns. The picture is exactly `data.image.url`, and no mark attr reaches the card. Pictures load with `referrerPolicy: 'no-referrer'` set before `src`.
- The plugin calls `fetchMetadata({ href, editor })` once per dwell, with no cache of its own. Hosts dedupe `fetchMetadata` by URL, so a hover and the click that follows share one request.
- Gates before any request: a mouse `pointerType`, `(hover: hover) and (pointer: fine)`, no button down, a stored `hyperlink` mark href, `urls.forRead`, then the host `shouldShow`. A throwing `shouldShow` shows no card and logs once per editor.
- A picture that fails after open folds its well away. A picture that fails before open shows no well.
- Known limits, both ruled. A resting pointer gets no card until it re-enters. The open-popover check sees only this bundle's controller.
- `hovercard.css` ships beside `styles.css` through the `./hovercard.css` export, and tsup copies it to `dist/`. Every colour reads a `--hl-*` token with a fallback.

## Paste title

- `pasteTitle: PasteTitleOptions` adds one plugin (`src/paste-title/pasteTitle.ts`). Unset means no plugin, and `onTransaction` returns at its idle check. The title cleaner is the pure `paste-title/cleanTitle.ts`, with a Bun table test. The start page for users is `docs/paste-title.md`.
- **Rulings of 2026-11-04 (maintainer).** The swap is automatic, with no prompt. A reader keeps the URL four ways: the host leaves the option unset, one `Mod-z`, `Mod-Shift-v`, or a host setting read in `shouldFetch`. Spec: `Notes/local-docs/2026-11-04-paste-title/spec.md`.
- **State.** `storage.pasteTitle` holds `armed: { text, href, plain } | null` and `runs: Set<Run>`. A run carries its own `text` and `href`.
- **Observe, never take over.** `handleDOMEvents.paste` reads `clipboardData` `text/plain`, and every hook returns `false`. With an empty selection and one linkify `url` (not an email), it decides the href once. It calls `urls.forWrite({ kind: 'match', match })`, the same call as the paste rule. No decision means nothing is armed. So an HTML clipboard whose `<a>` skipped `validate` or `shouldAutoLink` through `parseHTML` never reaches `fetchTitle`.
- `transformPastedText(text, plain)` marks the armed paste raw when `plain` is true. ProseMirror passes `inCode || plainText`; Shift sets `plainText`. It never calls that hook for an html+plain clipboard without Shift.
- The first transaction after the DOM event consumes `armed`. It becomes a run only on `uiEvent: 'paste'`. The paste must also have made a `hyperlink` mark with the armed href, whose whole text is the pasted URL. Then `shouldFetch` runs.
- **Idle check.** The mark's `onTransaction` returns on `!armed && runs.size === 0`, and does nothing else while idle.
- **Anchor.** One inner character (`from + 1`), made with `editor.utils.createMappablePosition` in `onTransaction`, never in plugin `apply`. It maps through the transaction and every appended one with `getUpdatedPosition`. It stops after a result with `mapResult === null`: collaboration returns that for a remote transaction, already resolved against the final state. The range is rebuilt with `getMarkRange(…, { href })` and must still read the pasted URL. Never trust `mapResult.deleted`. Collaboration swaps these utils for Yjs relative positions, so the package imports no `yjs` and no `@tiptap/y-tiptap`.
- **Lifetime.** Runs live in per-editor `storage`, because plugin views rebuild on `registerPlugin`. Each run owns one `AbortController` and one 4,000 ms deadline. `endRun` is the only exit: it clears the timer, aborts, then deletes the run. The abort also removes a waiting `compositionend` listener, which is bound with that `signal`. `onDestroy` ends them all. `swapWhenReady` holds the one liveness check, for a late answer or an IME retry. Five runs at most; a sixth ends the oldest.
- **Swap.** End the run first, so the swap's own `onTransaction` never checks it. Skip when the editor is read-only or destroyed, or when a selection end sits strictly inside the link. A caret at either edge is fine. During IME composition, wait for `compositionend`, plus one microtask for ProseMirror's own read. One `replaceWith` takes the marks of the link's first text node only. The swap goes through `closeHistory(tr)` from `@tiptap/pm/history` and carries the meta `preventAutolink`, `inputRule` and `pasteTitle: true`. Then dispatch an empty transaction through `closeHistory(tr)` with `inputRule`.
- **Never `addToHistory: false`** on the swap. Under Yjs it makes the paste impossible to undo (measured 2026-11-04). Tiptap's own input rules use the same `closeHistory` plus `inputRule` route; the collaboration extension calls `stopCapturing()` on `inputRule`.
- **Errors.** A `fetchTitle` throw or rejection ends the run and logs nothing, so an abort is never an error. A non-string, non-null answer logs once per editor. A throwing `shouldFetch` counts as `false` and logs once per editor.
- **Cleaner order.** Collapse white space first, then strip C0, C1 and bidi controls (U+061C included), then collapse and trim again. Stripping first would delete `\n` and `\t` instead of turning them into a space. A title with no letter, number, punctuation or symbol keeps the URL; U+200D stays, for emoji. A title that is one linkify URL on another host is a spoof and keeps the URL.
- `signal` aborts whenever a run ends, after a good answer too. Hosts must not pass it to a request that other callers share.
- The clean room runs `prosemirror-history` only. The y-undo route (`inputRule`) is pinned by the webapp test on a real pad.
- `PasteTitleOptions` and `PasteTitleContext` are root type exports. `fetchTitle` and `shouldFetch` use method syntax, for the same reason as `hovercard.render`. Nothing docs.plus-specific belongs in them.

## Link icons

- `linkIconMarkView.ts` builds the `<a>` only through the mark's `toDOM`, with the same arguments prosemirror-view uses. `renderHTML` blanks an unsafe href there. Never build the `<a>` from Tiptap's `HTMLAttributes` prop, which skips `renderHTML`.
- Call `isSafeHref` before `linkIcon`. An unsafe href never reaches it.
- The parse rule `{ tag: '.hyperlink-icon', ignore: true, priority: 1000 }` comes first. Without it, a host `img[src]` rule turns an icon into an Image node on paste or a native split.
- Keep `ignoreMutation`. It ignores changes inside the icon, such as an image load. Without it, unhiding every icon rebuilds every link view.
- The sweep moves stray text from the `<a>` into the text `<span>`. It must restore the DOM caret afterwards, or typed characters come out reversed. It never runs while composing; `linkIconCompositionSweep` runs it after `compositionend`.
- The icon click rule tests the point against the icon box, because the icon has `pointer-events: none`. `posAtDOM(link, 0)` then gives the link start.
- With `linkIcon` unset, `addMarkView` returns the plain view and neither `linkIconCompositionSweep` nor `linkIconEnter` loads.
- `linkIconEnter` handles Enter just before a link on Chrome for Android (#513). prosemirror-view skips that Enter keydown and reads the DOM back after Chrome splits the block. Before the `contenteditable=false` icon, Chrome adds a `<br>`, which reads back as a `hardBreak`. On `beforeinput` `insertParagraph`, with a collapsed caret right before a link and no composition, the plugin runs the editor's Enter and cancels the native split. Keep the Chrome Android gate: prosemirror-view warns that cancelling Enter on iOS confuses the keyboard. iOS was not checked (simulator caret placement failed, 2026-11-03).
- The mark view sets `aria-hidden="true"` on the icon, unless the icon carries a non-empty `aria-label`. Then it sets `role="img"` instead, so the host's kind name is spoken (#174). It does not remove an `aria-hidden` the host set itself.
- `linkIconMap` and `linkIconFetcher` live in `src/link-icons/` with the internal `imgIcon.ts`. The barrel exports the two helpers only, not their option types or `imgIcon.ts`.
- Each helper keeps a failed-URL set: an image URL that errored once gets no `src` again. A transient failure therefore hides that icon until reload. Do not add an in-flight request cache; the browser shares one load per URL.
- The helpers add no `window` or `document` listener, only `onload` and `onerror` on their own `<img>`. They never clear `src`. A pair follows `color-scheme` through `light-dark()`, with no JS listener.
- A map lookup with no hit returns `null`. Never fall back to another entry: an unlisted host would then wear a listed site's icon.
- DOM unit tests import `link-icons/__tests__/setupDom.ts` first and need `test:unit` to keep `--isolate`.

## Clean-Room Harness

- Release-gate harness: `test/playground/main.ts` (editor fixture) + shared `@docs.plus/playground` (`docs-playground` serves the page shell; `setupPlayground` wires title/tokens/theme). Vanilla Tiptap + StarterKit; no Vite.
- Playground loads built `dist/` + `styles.css` via the published exports map, **not** monorepo source.
- Cypress specs cover create, preview-edit, autolink, xss-guards, nav-guards, styling, custom-popover, scroll-stickiness, special-schemes, link-icons, link-edges, hovercard, paste-title, and destroy-lifecycle. `link-edges.cy.ts` runs every case with no query, with `?icons=element` and with `?icons=map`. `_debug.cy.ts` is scratch and excluded from release counts.
- `navigate=spy` records each host `navigate` call on `window._navigateCalls` and opens nothing. `gate=strict` adds a host `isAllowedUri` that refuses `blocked.example`.
- `hovercard=on` turns the built-in card on, and `hovercard=custom` adds `render` (the `renderCard` example that `docs/hovercard.md` points at). Under `custom`, `builtin.example` returns `null` and `throw.example` throws. Each drawn view is recorded with its destroy count on `window._hovercard.views`. The stub counts calls on `window._hovercard` and answers after `delayMs` on the page clock, so `cy.tick` drives the dwell and the open. Each spec serves the pictures with `cy.intercept`. Cypress fakes rAF by default, and the engine shows a popover in a rAF, so `hovercard.cy.ts` fakes only timers and `Date`.
- `pasteTitle=on|slow|throw|null` turns the option on with a stub. `on` answers "Example Domain" after 100 ms on the page clock; `slow` answers after 6 s, past the deadline; `throw` throws at once; `null` answers `null`. `shouldAutoLink=block` adds a host veto that refuses every autolink. Every mode refuses `nofetch.example` through `shouldFetch`. Each call and its signal sit on `window._pasteTitle`. `paste-title.cy.ts` fakes `setTimeout`, `clearTimeout` and `Date`, so history groups break only at `closeHistory`.
- Icon params: `icons=element|throw|map|fetcher|both` and `tile=on`. The `playground` script passes `--readme-media-dir ./test/playground/icons`, so the test PNGs load from `/readme-media/<file>`. Each page load adds a `?run=` token to every icon URL, so the HTTP cache never hides a request across tests.
- Run with `bun run test`. `pretest` builds, `start-server-and-test` boots `docs-playground` on `127.0.0.1:5173`, Cypress runs, then teardown. Manual dev: `bun run playground` (`bun --hot docs-playground`). Append `?popover=custom` for custom popover factories in custom-popover tests.
- Support file is single-file `cypress/support/e2e.ts`. Do not split it; Cypress 15 JIT skipped split imports.
- `cypress/tsconfig.json` extends `@docs.plus/playground/cypress/tsconfig.json` with `include: ["./**/*.ts"]` so tsc does not inherit the package `rootDir: src`.
- Every `cypress/e2e/*.cy.ts` file must end with `export {}` to avoid top-level constant collisions under project-level type-checking.
- Tests use `window._editor` + `window._hyperlink`. Use structural checks instead of `instanceof RegExp` because Cypress iframe realm breaks cross-realm `instanceof`.
- Unit tests use Bun native runner: `bun test --isolate src`. `--isolate` gives each file fresh globals, so the jsdom globals of a DOM test file do not leak into the others.
- Repo-wide test orchestration runs the hyperlink clean-room Cypress suite after `extension-indent` Jest and before webapp Jest, via `scripts/run-tests.sh`.
