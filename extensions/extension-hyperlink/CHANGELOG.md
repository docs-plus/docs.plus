<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/extension-hyperlink` are documented here.

The extension's major version tracks the docs.plus product line. `1.x` corresponds to the 2023 product; `2.x` corresponds to docs.plus **alpha v2**, the first major release after approximately three years of iteration in the monorepo. Versioning follows [Semantic Versioning](https://semver.org/) and commits follow [Conventional Commits](https://conventionalcommits.org/). Section headings (`Added` / `Changed` / `Fixed` / `Security` / `Removed`) repeat per version, per the [Keep a Changelog](https://keepachangelog.com/) convention.

---

## [Unreleased]

## [2.0.0] — 2026-08-09

**First major release since `1.5.2`.** This entry rolls up every user-facing change made while docs.plus was iterating toward alpha v2. Treat the upgrade as effectively a rewrite of the public surface. The option names, popover contract, CSS selectors, validation rules, URL canonicalization, and type exports are all new. The bones (Tiptap extension that marks hyperlinks, autolinks on whitespace, opens a popover on click) are the same.

A complete migration guide from `1.5.2` is at the end of this entry. It includes a one-shot rename script for the mechanical changes and code diffs for the semantic ones.

### Highlights

- **Unified Popover vocabulary across the package.** Every layer — factory slot names, opener functions, primitive (`createPopover`), controller (`PopoverController`), CSS classes (`.floating-popover*`), state union (`ControllerState`) — speaks the same noun. The v1 split between "popover" and "floating-toolbar" is gone.
- **Two-layer integration surface.** Three named openers (`openCreateHyperlink`, `openEditHyperlink`, `openPreviewHyperlink`) cover the 90% case; a generic `PopoverController` covers the remaining lifecycle / observation cases. The `createPopover` primitive remains for fully custom popovers (the &lt;1% case).
- **New popover architecture** built on `@floating-ui/dom`. Preview / create / edit popovers ship as small DOM-returning factory functions. The extension owns positioning, and the popover stays stuck to its anchor on scroll (no more drift).
- **Unified write-boundary URL canonicalization** — one `normalizeHref` used by the create popover, edit popover, `setHyperlink` command, markdown input rule, autolink plugin, paste handler, and paste rule. Bare phones become `tel:+CCNSN`, bare emails become `mailto:…`, bare domains become `https://…`, and user-typed schemes pass through untouched. The same input produces the same stored `href` no matter how it entered the editor.
- **50+ special URL scheme catalog** (`whatsapp://`, `tg://`, `vscode://`, `slack://`, `zoom://`, `figma://`, `spotify:`, and friends) exposed as a brand-neutral `SpecialUrlType` union plus a `getSpecialUrlInfo(href)` classifier. Consumers map types to their own icon set — the extension ships zero icon catalog.
- **Defense-in-depth XSS + navigation guards** — `javascript:`, `data:`, `vbscript:`, `file:`, and `blob:` are rejected at every entry point. The entry points are `parseHTML`, input rule, paste handler, paste rule, click handler, middle-click (`auxclick`), and popover open. `renderHTML` re-validates on serialization and blanks tampered hrefs. Every `window.open` call re-checks the gate and passes `'noopener,noreferrer'`, eliminating tabnabbing end-to-end. The regex `DANGEROUS_SCHEME_RE` and the predicate `isSafeHref` are exported so BYO popovers apply the same check.
- **Default stylesheet ships separately** (`import '@docs.plus/extension-hyperlink/styles.css'`) and is fully themeable via `--hl-*` CSS custom properties with `light-dark()` support. Fully-custom UIs pay zero CSS cost.
- **Bun-native unit suite + clean-room Cypress E2E** — 299 unit tests (`bun test src`) plus E2E coverage across 16 specs. The specs exercise the **built `dist/` loaded via the published `exports` map** — exactly what an npm consumer installs.
- **`@tiptap/extension-link` canon parity** — `setHyperlink` is a pure command (writes the mark only); the side-effecting popover lives behind a dedicated `openCreateHyperlinkPopover` command so chains stay transactional. New `toggleHyperlink` plus migration aliases `setLink` / `unsetLink` / `toggleLink`. Options `defaultProtocol`, `isAllowedUri`, `shouldAutoLink`, `enableClickSelection`, `exitable` mirror the upstream Link-extension surface so existing policies port over without rewrites. `shouldAutoLink` is honored by the autolink plugin, paste handler, AND paste rule — full policy parity across every autolink entry point.

### Breaking

All relative to `1.5.2`, grouped by migration friction. The mechanical renames have a [one-shot script](#one-shot-rename-script) below; the semantic changes require code review.

**Popover API redesign — requires code review.**

- **CSS classes** `.floating-toolbar*` → `.floating-popover*`. Hosts with custom rules targeting the old names need to rename. The container, arrow, content wrapper, and arrow-side modifiers all changed in lockstep:
  - `.floating-toolbar` → `.floating-popover`
  - `.floating-toolbar-arrow` → `.floating-popover-arrow` (`-top` / `-bottom` / `-left` / `-right` modifiers follow)
  - `.floating-toolbar-content` → `.floating-popover-content`
- **Removed exports** — `createFloatingToolbar`, `hideCurrentToolbar`, `updateCurrentToolbarPosition`, `FloatingToolbarOptions`, `FloatingToolbarInstance`, `HyperlinkUIController`, `SurfaceKind`, `EditHyperlinkPopoverOptions`, `EditHyperlinkModalOptions`. See the v2 migration table below.
- **`PreviewHyperlinkOptions.attrs` is required** (was optional). The defensive `link.getAttribute('href')` fallback inside the prebuilt preview popover is gone — callers must pass the parsed mark attributes. Hardens the read-side origin-leak defense (relative hrefs in `attrs` are validated at write; the DOM property would re-resolve against `document.baseURI`).
- **Factory return types tightened** — `editHyperlinkPopover` returns `HTMLElement` (was `void`); `createHyperlinkPopover` returns `HTMLElement` (was `HTMLElement | null`). All three prebuilt factories now share the `(opts) => HTMLElement` shape; the extension owns mounting via the controller. Slot factories may still return `HTMLElement | null` (returning `null` opts out — typical for mobile bottom sheets).
- **`PopoverOptions` is a discriminated anchor union.** Exactly one of `referenceElement` or `coordinates` is required, enforced at compile time. The v1 runtime throw on missing-anchor is gone — TypeScript catches it at the call site.
- **`surface` field removed** from the floating-popover primitive options. The kind tag is set when the controller adopts the popover (via `adopt(popover, kind, metadata)`), not on construction. Most consumers never set `surface` directly.

**Migration map (v2).**

| Old (v1)                                  | New (v2)                                                              |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `createFloatingToolbar(opts)`             | `createPopover(opts)` — same shape minus `surface`                    |
| `hideCurrentToolbar()`                    | `getDefaultController().close()`                                      |
| `updateCurrentToolbarPosition(ref?)`      | `getDefaultController().reposition(ref?)`                             |
| `FloatingToolbarOptions` / `…Instance`    | `PopoverOptions` / `Popover`                                          |
| `HyperlinkUIController`                   | `PopoverController`                                                   |
| `SurfaceKind`                             | `PopoverKind`                                                         |
| `EditHyperlinkPopoverOptions` / `…Modal…` | `EditHyperlinkOptions`                                                |
| `editHyperlinkPopover({ … onBack })`      | `openEditHyperlink({ editor, … })` — Back re-opens preview by default |
| `state.surface`                           | `state.popoverKind` (+ new `element`, `referenceElement` fields)      |

The only known external consumer (`apps/webapp`) is migrated in this same release; no separate `[2.0.1]` follow-up is needed.

**Renames — mechanical.**

- **Options** aligned with Tiptap's naming convention:
  - `autoHyperlink` → `autolink`
  - `hyperlinkOnPaste` → `linkOnPaste`
- **Commands** fixed for consistent casing:
  - `editHyperLinkText` → `editHyperlinkText`
  - `editHyperLinkHref` → `editHyperlinkHref`
- **Transaction meta key** renamed:
  - `tr.setMeta('preventAutoHyperlink', …)` → `tr.setMeta('preventAutolink', …)`
- **Type augmentation** — commands are now augmented under the `hyperlink:` key (was `link:`). Fixes `editor.commands.editHyperlink…` autocomplete.
- **CSS classes** switched from camelCase to kebab-case:
  - `.hyperlinkCreatePopover` → `.hyperlink-create-popover`
  - `.hyperlinkPreviewPopover` → `.hyperlink-preview-popover`
  - `.hyperlinkEditPopover` → `.hyperlink-edit-popover`
  - `.buttonsWrapper` → `.buttons-wrapper`
  - `.inputsWrapper` → `.inputs-wrapper`
  - `.textWrapper` → `.text-wrapper`
  - `.hrefWrapper` → `.href-wrapper`
  - `.backButton` → `.back-button`
  - `.btn_applyModal` → `.apply-button`

**Popover contract — requires code review.**

- `previewHyperlink` / `createHyperlink` / `editHyperlink` slot factories return **`HTMLElement | null`** instead of `void`. The extension owns positioning via its floating-popover module; the consumer owns content only. Returning `null` opts out (typical for mobile bottom sheets that mount themselves).
- Default stylesheet no longer auto-injects. Add `import '@docs.plus/extension-hyperlink/styles.css'` at app bootstrap if you use the prebuilt popovers and want the default look.

**URL validation — stricter by design.**

- **Dangerous schemes are blocked at every entry point.** `javascript:`, `data:`, and `vbscript:` URLs that round-tripped through `setContent`, paste, input rule, click handler, or popover open are now rejected. If you intentionally stored such URLs (rare — this was almost always a stored XSS vector), they will now be dropped on the floor.
- **Plausible-host check** in `validateURL`: web-scheme URLs must have a host with a TLD dot, `localhost`, or an IP literal. Typos like `https://googlecom` no longer autolink.
- **Real-scheme detection** in `normalizeHref` requires either `://`, or a single-token candidate that doesn't look like a hostname (no dot, not `localhost`, not an IP literal). Inputs like `localhost:3000` and `mydomain.com:8080` are now treated as host:port and canonicalized to `https://localhost:3000`, not left as the scheme `localhost:`.

**Public surface tightened — audit your imports.**

- **Public barrel audited** — `src/utils/index.ts` now uses explicit named re-exports (no `export *`). `src/index.ts` re-exports only controlled barrels (`./hyperlink`, `./utils`), so module-internal helpers no longer leak through the public surface:
  - `Link` / `Title` icons (still importable from `./utils/icons` if you forked the prebuilt popovers).
  - `normalizeLinkifyHref` (used inside autolink + paste plugins only).
  - `getUrlScheme` (used inside `validateURL` only).
  - `isBarePhone` (used inside `autolink` / `normalizeHref` / `validateURL` only).
- **`SpecialUrlIcon` typed union removed**, along with the optional `icon?: SpecialUrlIcon` field on `SpecialUrlInfo`. The extension ships no icon catalog — consumers map `SpecialUrlInfo.type` to their own renderer. See the [icon mapping migration](#consumer-icon-mapping) below for the recommended pattern.
- **Two `SpecialUrlInfo.type` values renamed** for a consistent kebab-case + brand-spelling convention:
  - `'tv'` → `'apple-tv'` (returned for `videos://` URLs).
  - `'appstore'` → `'app-store'` (matches the brand "App Store" and existing kebab-case `'facetime-audio'`).
- **`isSpecialSchemeUrl(url)` removed.** It was a thin wrapper over `getUrlScheme` + an inline allow-list. Replace with `getSpecialUrlInfo(url) != null` for the same boolean, or inline the check if you need the exact previous semantics.
- **Three floating-popover helpers never reached the public surface** — `getCurrentToolbar`, `isToolbarVisible`, `destroyCurrentToolbar`. Inspect controller state via `getDefaultController().getState()` (returns a discriminated `ControllerState` union) and dismiss via `getDefaultController().close()`. Disposal is handled implicitly when the next opener call lands.
- **Neither `PreviewHyperlinkOptions` nor `EditHyperlinkOptions` carry `linkCoords` or `view`.** The prebuilt preview / edit popovers derive their reference from the live `<a>` DOM node passed as `link`. The snapshotted rect was never read (the floating-popover primitive recomputes a live rect on every reposition, which is what makes scroll-stickiness work). The `view` field is reachable via `editor.view` for the rare BYO factory that needs it. BYO factory authors that need viewport coords for a custom anchor should pass them via `popover.options.coordinates` to `createPopover`.

### Added

- **Tooltips on the prebuilt popovers' icon buttons.** The preview popover's Copy / Edit / Remove buttons show a floating tooltip on hover and keyboard focus. The tooltip is a shared bubble from the bundled `@docs.plus/floating-tooltip`. It replaces the native `title` attribute, so the label never doubles up. The skin is the `.floating-tooltip` block in `styles.css` (fixed `light-dark()` literals kept lockstep with extension-hypermultimedia, since both packages style the one global class). Every opener hides the bubble when its popover closes, so an outside-click dismissal cannot strand a visible tooltip. `attachTooltip` / `hideTooltip` are re-exported from the package barrel for BYO popovers that want the same labels.
- **Per-surface ARIA roles on popover shells.** The preview popover mounts as `role="toolbar"` (a row of link actions); the create and edit popovers mount as `role="dialog"` with accessible names (`aria-label="Add link"` / `aria-label="Edit link"`). The roles ride the floating-popover engine's optional `role` option and live on the shell, so BYO factories inherit the same semantics.
- **Micro-motion.** Popover entrances decelerate and exits play their fade before the node is removed. `hide()` defers DOM removal until the transition ends (with a timed fallback). The scale blooms from the anchored side via a placement-derived `transform-origin`. Motion follows the docs.plus language: 120ms `ease-out` enter, 80ms `ease-in` exit. Tooltips rise 2px toward rest, and a `prefers-reduced-motion: reduce` guard zeroes all of it.

**Openers (Layer 1 — the 90% case).**

- `openCreateHyperlink(editor, attributes?)` — opens the create popover anchored to the current selection; the pre-fill `attributes` are optional and default to `{}`. Reads `popovers.createHyperlink`, falls back to the prebuilt factory.
- `openEditHyperlink(opts)` — opens the edit popover anchored to a hyperlink (`opts.editor` carries the editor). The prebuilt edit popover's Back button re-opens the preview from its own options — no consumer wiring needed.
- `openPreviewHyperlink(opts)` — opens the preview popover anchored to a hyperlink. Used internally by the click handler; also callable from outer toolbars.
- `buildPreviewOptionsFromAnchor({ editor, link, validate?, markName? })` — returns a fully-formed `PreviewHyperlinkOptions` derived from a live `<a>` DOM node. Centralizes the `posAtDOM → mark.attrs` lookup, with a defensible fallback when the mark cannot be located. BYO `editHyperlink` factories and the prebuilt edit popover's Back button then share the same code path.

**Controller + primitive (Layer 2 — the 10% case).**

- `PopoverController` (formerly `HyperlinkUIController`) — generic, kind-agnostic owner of the floating-popover lifecycle. Adds `adopt(popover, kind, metadata)` as the canonical mount call.
- `AdoptMetadata` — the `{ element, referenceElement }` pair every `adopt` call surfaces to subscribers.
- Richer `ControllerState` — the `mounted` variant now exposes `popoverKind: PopoverKind`, `element: HTMLElement` (popover root), and `referenceElement: HTMLElement | null` (anchor; `null` for virtual-coords popovers). Outer toolbars can place focus rings, freeze scroll, or observe the DOM without spelunking.
- `PopoverKind` — `'preview' | 'edit' | 'create' | (string & {})`. The branded union accepts custom kinds for BYO popovers without losing autocomplete on the built-in ones.
- `createPopover(options)` (formerly `createFloatingToolbar`) — primitive every opener calls under the hood. Adopts itself into the controller automatically.
- `PopoverOptions` — discriminated anchor union; exactly one of `referenceElement` or `coordinates` is required, enforced at compile time.

**Configuration slots.**

- `popovers.editHyperlink` — third popover slot in `Hyperlink.configure({ popovers })`. Symmetric with `previewHyperlink` and `createHyperlink`; defaults to `null` and falls back to the prebuilt `editHyperlinkPopover` when unset.

**Public types + constants.**

- `PreviewHyperlinkOptions`, `CreateHyperlinkOptions`, `EditHyperlinkOptions` — no more hand-rolled popover option types. `PreviewHyperlinkOptions.attrs` is required (see Changed below).
- `Popover`, `PopoverOptions` — explicit type exports for the floating-popover primitive.
- `SpecialUrlType` — string-literal union of every recognized special-URL type. Type-only, zero runtime cost. Declare your icon table as `Partial<Record<SpecialUrlType, IconRenderer>>` and TypeScript catches typos and catalog renames at compile time.
- `LinkifyMatchLike` — for consumers building BYO popovers that interact with `linkifyjs` matches directly.
- `DEFAULT_OFFSET` — promoted to the public surface so BYO popovers can read the canonical 8px gap.
- `SAFE_WINDOW_FEATURES` — the `'noopener,noreferrer'` features string the extension passes to every `window.open` call. Re-export so BYO navigation handlers stay aligned with the prebuilt ones.

**Popover module.**

- Popover engine extracted to `@docs.plus/floating-popover` — a private workspace package **bundled into `dist`** (never externalized; npm consumers resolve no workspace dependency). `src/floating-popover/index.ts` re-exports it so internal import paths stay stable, and each consuming extension bundles its own controller instance — no cross-package singleton. Replaces the v1 `helpers/floatingToolbar.ts` + `ui-controller/` split: functional, no class hierarchy.
- `updateReference()` on every popover — reposition after async updates (e.g. metadata fetch) without tearing the popover down. Re-subscribes `autoUpdate` to the new reference's overflow ancestors so scroll listeners stay live across reference swaps.
- `hide` middleware from `@floating-ui/dom` — popover auto-hides when the reference scrolls out of view.
- Virtual references support a live `getBoundingClientRect` callback (recomputed on every mount/scroll/resize) plus an optional `contextElement` that anchors `autoUpdate`'s overflow-ancestor walk. The create popover uses this to position from captured ProseMirror `from`/`to` positions without snapshotting viewport coords at open time.

**URL canonicalization + classification.**

- `normalizeHref(raw)` — canonicalizes user-typed hrefs. It prepends `https://` to bare domains, preserves explicit schemes, and passes protocol-relative URLs (`//example.com`) through untouched. It canonicalizes bare phones to `tel:+CCNSN`, and bare emails to `mailto:…`.
- `normalizeLinkifyHref(match)` — same canonical form for `linkifyjs` matches. Routes URL matches through `normalizeHref` to upgrade linkifyjs's `http://` default to `https://`; trusts linkifyjs's `href` for non-URL matches (emails → `mailto:`, custom schemes).
- `getSpecialUrlInfo(href)` — classifies a URL against a 50+ scheme catalog and returns `{ type, title, category } | null`. Type is a `SpecialUrlType` string-literal.
- `isBarePhone(trimmed)` _(module-internal, pinned by 30 unit tests)_ — one-shot E.164 detection + canonicalization. Returns `{ ok: true, href: 'tel:+CCNSN' } | { ok: false }`. Strict: only `+`-prefixed 8–15 digit numbers are recognized, so years (`2024`), ZIPs (`90210`), and bare numerics (`5551234567`) never get turned into broken `tel:` links.
- `DANGEROUS_SCHEME_RE` — shared regex for the XSS check; exported so BYO popovers apply the same invariant as the prebuilt ones.
- `isSafeHref(href)` — single-call boolean predicate (with type narrowing) wrapping `DANGEROUS_SCHEME_RE`. Used at every WRITE boundary in the extension (`setHyperlink`, paste handler, paste rule, input rule, `parseHTML`, `editHyperlink`). It is exported so BYO popovers reuse the exact same gate.

**Tiptap canon options.**

- `defaultProtocol: string` (default `'https'`) — scheme used by `normalizeHref` when promoting bare domains.
- `isAllowedUri?: (uri, ctx) => boolean` — composes WITH the built-in safety floor. Receives `{ defaultValidate, protocols, defaultProtocol }` so policies can reuse `isSafeHref` instead of re-implementing it. Mirrors the `@tiptap/extension-link` shape; `IsAllowedUriContext` is exported.
- `shouldAutoLink?: (uri) => boolean` — per-URI veto consulted by the autolink plugin, the paste handler (smart-paste over a non-empty selection), AND the linkify paste rule. This is full parity across every autolink surface. Lets hosts block app-wide categories (e.g. internal mention syntax) without losing paste-as-link UX for everything else.
- `enableClickSelection: boolean` (default `false`) — when `true`, clicking inside a link in editable mode selects the entire mark range.
- `exitable: boolean` (default `false`) — when `true`, ArrowRight at the end of a hyperlink mark exits the mark so the next typed character is plain text.

**Tiptap canon commands.**

- `openCreateHyperlinkPopover(attributes?)` — dedicated UI command that opens the create popover anchored to the current selection. The historic side-effect on `setHyperlink()` (no-args) lives here now; `Mod-k` rebinds to it. Falls back to the prebuilt create popover when no `popovers.createHyperlink` factory is wired up; no-op only when a configured factory returns `null`.
- `toggleHyperlink({ href, … })` — toggles the mark on/off across the current selection. Same XSS + `isAllowedUri` gates as `setHyperlink`.
- `setLink` / `unsetLink` / `toggleLink` — drop-in delegating aliases that ease migration from `@tiptap/extension-link`. They forward to the canonical `setHyperlink` / `unsetHyperlink` / `toggleHyperlink`, so future policy changes flow through automatically.

**Default stylesheet.**

- `@docs.plus/extension-hyperlink/styles.css` — small, framework-agnostic, opt-in. The extension's JavaScript never imports it; fully-custom UIs pay zero CSS cost.
- Every visual token (colors, radii, shadow, font, transitions) exposed as `--hl-*` custom properties. Colors use `light-dark()` so the popover tracks the nearest ancestor's `color-scheme`, falling back to `prefers-color-scheme` when none is set. Positioning never lives in the stylesheet — popovers are `position: fixed` with an inline `z-index` (`9999` by default; override via `createPopover({ zIndex })`).
- `package.json`'s `sideEffects` is `["**/*.css"]` so bundlers preserve the stylesheet import while still tree-shaking JS. `./styles.css` and `./package.json` are advertised as public subpaths in the `exports` map.

**Prebuilt popover accessibility.**

- Preview-popover icon buttons ship `type="button"` and an `aria-label`; every popover button gets a `:focus-visible` ring.

**Write-boundary behaviors.**

- **Bare-phone canonicalization** at create / edit / markdown input rule / `setHyperlink`. Typing `+1 (555) 123-4567` stores `tel:+15551234567` — formatting stripped, digits-only after the `+`. Matches what autolink produces on whitespace; all paths now agree.
- **Bare-email canonicalization** at the same boundary. `hi@example.com` stores `mailto:hi@example.com` instead of `https://hi@example.com` (which browsers resolve as HTTP basic-auth credentials).
- **Deep-link autolink** — whitespace-triggered autolink now handles `whatsapp://`, `tg://`, `vscode://`, `slack://`, `spotify:`, `zoom://`, and 40+ others in addition to `http(s)://`. Custom protocols registered via `registerCustomProtocol('mychat')` pass through untouched.
- **Read-side origin-leak defense** — the click handler and preview popover prefer the stored mark attribute (`attrs.href`) over the DOM `link.href` property. That property resolves relative URLs against `document.baseURI`. Prevents `<a href="google.com">` injected via `setContent` from rendering as `http://<host-origin>/google.com`.
- **Create with nothing selected now writes a link.** `Mod-k` on a collapsed caret used to store the mark and change no text, so Apply closed the popover and left the document untouched. The prebuilt create popover inserts the typed URL as its own link text instead, in one undo step. A URL the gate rejects still inserts nothing.

**Test harness.**

- Bun-native unit suite across `src/**/__tests__/` (12 files) — 299 tests covering `normalizeHref`, `phone`, `specialUrls`, `validateURL`, `findLinks`, `isSafeHref`, `DANGEROUS_SCHEME_RE`, and the command/interaction/opener/url-decisions layers. Runs via `bun test src`. New scripts: `bun run test:unit`, `bun run test:unit:watch`.
- Clean-room Cypress specs in `cypress/e2e/` (16 specs) exercise the built `dist/` loaded via the published `exports` map — the install-time surface. Coverage spans create, preview-edit, autolink, full-document paste, undo/redo, node contexts, destroy lifecycle, and special schemes. It also spans XSS guards, navigation guards, canon options, styling, custom popovers, scroll-stickiness, touch tap, and markdown round-trip. The spec-by-spec matrix lives in `cypress/e2e/README.md`. Run with `bun run test:e2e`.
- Clean-room playground served by the shared `@docs.plus/playground` workspace harness (the `docs-playground` page-shell server plus a browser `setupPlayground` helper); this package commits only `test/playground/main.ts`. No bundler config, no Vite.
- Root `test` script composes all three: build (via `pretest`) → unit → e2e.

### Changed

- **Floating-popover internals rewritten.** 800-LOC singleton class (`FloatingToolbarManager`) replaced with the lean functional engine now in the bundled `@docs.plus/floating-popover`. Strategy switched from `position: absolute` to `strategy: 'fixed'` for body-appended elements, eliminating scroll lag under transformed ancestors.
- **`createHyperlinkPopover` simplified** — no longer manages its own positioning. Returns DOM content only; positioning lives in the floating-popover module via `createPopover`.
- **Popover scroll-stickiness** — the edit popover uses the live `<a>` DOM node as `referenceElement` (the browser recomputes its rect on every call). The create popover passes a closure that recomputes coords from captured ProseMirror `from`/`to` positions on every reposition. It replaces the v1-era snapshot-at-open approach, which caused the popover to drift while the page scrolled.
- **`editHyperlink` command** is a composable Tiptap command (`editHyperlinkCommand`) that reads positions + marks off `tr.doc` inside the caller's single transaction. The previous helper dispatched its own nested `editor.chain()…run()` and collided with the outer `.extendMarkRange(...).editHyperlink(...).run()` in the popover ("mismatched transaction" error).
- **Mark name is no longer hardcoded.** The `editHyperlink` helper and the edit popover accept a `markName` parameter (default `'hyperlink'`) instead of hardcoding `state.schema.marks.hyperlink` and `.extendMarkRange('hyperlink')`. All callers pass `this.name`.
- **Production build preserves `console.warn` / `console.error`** — `tsup` now uses `pure: ['console.log', 'console.debug']` instead of `drop: ['console']`. Library errors are visible in production.
- **Reference type**: `any` → `ReferenceElement | VirtualElement` for floating-popover references.
- **`TOOLBAR_OFFSET`** in `clickHandler.ts` deduplicated; callers use the shared `DEFAULT_OFFSET` from `floating-popover/createPopover.ts`.
- **Plugin factories and keys** renamed camelCase: `autolinkPlugin`, `clickHandlerPlugin`, `pasteHandlerPlugin`; plugin-key strings `hyperlinkAutolink`, `hyperlinkClickHandler`, `hyperlinkPasteHandler`.
- **File renames** to match casing: `copy2Clipboard.ts` → `copyToClipboard.ts`, `helpers/floating-toolbar.ts` → `floating-popover/createPopover.ts`, `autoHyperlink.ts` → `autolink.ts`.
- **`setHyperlink` is now a pure command.** The historic no-args overload that opened the create popover is split out into `openCreateHyperlinkPopover()` per Tiptap canon (commands stay pure; UI is its own command). The Mod-k shortcut rebinds automatically; programmatic callers that relied on `editor.commands.setHyperlink()` opening the popover must migrate to `editor.commands.openCreateHyperlinkPopover()`. With an `href` (`setHyperlink({ href })`), behavior is unchanged.
- **`setHyperlink` / `unsetHyperlink` / `toggleHyperlink` / `editHyperlinkCommand` are strictly composable.** The shared body operates on the parent transaction via `commands.setMark` (which shares `tr` across the chain) instead of dispatching a nested `chain().run()`. `editor.chain().extendMarkRange('hyperlink').setHyperlink({ href }).run()` now lands as a single transaction — no more "Applying a mismatched transaction" errors when chaining mark-range ops with a hyperlink command. No behavior change for the common single-command call site.
- **`Hyperlink` mark `image` attribute is no longer rendered to the DOM** (`rendered: false`). `<a>` has no standard `image` attribute, so the previous behavior produced invalid HTML and polluted downstream sanitizers. The mark still carries the value for the preview popover (favicon / OG image); only the DOM serialization changed.
- **Popover-internal write paths now route through `setHyperlink`.** The prebuilt `createHyperlink` popover used to call `editor.chain().setMark(...).setMeta(...).run()` directly; it now delegates to `editor.chain().setHyperlink({ href }).run()` so the composed XSS + `isAllowedUri` gate runs unconditionally. The popover surfaces a "Please enter a valid URL" error if the gate rejects.
- **Symbol renames for naming consistency.** `getUrlScheme` → `getURLScheme` matches the SCREAMING-acronym policy used by `validateURL` / `DANGEROUS_SCHEME_RE`. Internal `isValidSpecialScheme` → `isRecognizedSpecialScheme`. `EditHyperlinkModalOptions` / `EditHyperlinkPopoverOptions` → `EditHyperlinkOptions`, with no deprecated alias kept. This is a single major bump that consolidates both v1 names into the v2 vocabulary. Internal `showPopover` → `openPreviewPopoverFromClick`. Autolink internals `TRAILING_PUNCT_RE` / `stripTrailingPunct` → `TRAILING_PUNCTUATION_RE` / `stripTrailingPunctuation`.
- **All cross-module string literals replaced by `src/constants.ts`** — `HYPERLINK_MARK_NAME` (`'hyperlink'`) and `PREVENT_AUTOLINK_META` (`'preventAutolink'`) are imported by every site that previously had the magic string inline. Internal-only — neither is re-exported from the public barrel.
- **`autolinkPlugin` `findLinks` core extracted to `utils/findLinks.ts`** for unit testing without spinning up a ProseMirror editor. The plugin's `appendTransaction` body shrinks; matcher behavior is now pinned by an additional 12 unit tests covering URLs, emails, special schemes, phones, and trailing-punctuation stripping.
- **Autolink boundary detection is Unicode-aware.** Word splitting uses `/\s+/`, not just `' '`. Links followed by a tab, NBSP, em-space, ideographic space, or any other Unicode whitespace are recognized as link boundaries. Fixes silent autolink misses in CJK / European-typography content.
- **Autolink skips `code` marks.** A URL typed inside an inline `code` mark is content, not a navigation target — it must round-trip verbatim. The autolink plugin consults `state.schema.marks.code` and refuses to apply a hyperlink mark inside any range that already carries the `code` mark. Mirrors `@tiptap/extension-link` v3 canon.
- The default popover skin adopts the docs.plus floating-surface elevation:
  `--hl-radius` moves 6px → 10px, `--hl-radius-sm` 4px → 8px, and `--hl-shadow`
  becomes a deeper two-layer shadow. Consumers who retheme via the `--hl-*`
  custom properties are unaffected; the lockstep `.floating-tooltip` block is
  unchanged.

### Fixed

**Popovers.**

- `.floating-popover-arrow-left` / `-right` bordered the wrong faces of the rotated arrow square, so horizontal placements rendered a half-outlined arrow. Each side now borders its two exposed faces. The `prefers-reduced-motion` guard also gained the `.floating-popover.visible` selector — the entrance transition previously out-specified it, so reduced-motion users still saw the scale-bloom.
- The prebuilt edit popover closes when the hyperlink mark disappeared under it (e.g. a collab peer removed the link). It no longer misreports the URL as invalid. It also honors `document.execCommand('copy')` failures in the legacy clipboard fallback instead of closing as if the copy succeeded.

**URL handling.**

- `localhost:3000` stored as the scheme `localhost:`. The old `SCHEME_RE` matched any `[a-z][a-z0-9+.-]*:` prefix, so `localhost:3000` and `mydomain.com:8080` were treated as already-absolute and returned unchanged from `normalizeHref`. The browser then resolved `localhost:` / `mydomain.com:` as scheme names and the link broke. Fixed by the `hasRealScheme` gate; pinned by two `create.cy.ts` regression tests.
- Bare email stored as `https://user@example.com` (the `user@` part is HTTP basic-auth in a URL context). Now stores `mailto:user@example.com` from every entry point.
- Bare phone was never autolinked — `linkifyjs` has no phone matcher (upstream issue open since 2016). The autolink plugin now emits a synthetic `type: 'phone'` entry with the canonical `tel:+CCNSN` href when the whitespace-delimited token matches `isBarePhone`. Typing `+4733378901<space>` now autolinks.
- Autolink email href clobber — `findLinks`'s trailing-punctuation cleanup was overwriting `linkifyjs`'s canonical `href` (including the `mailto:` prefix) with the punctuation-stripped `value`. Emails now correctly store `mailto:user@example.com` on whitespace autolink.
- Stateful `/g` regex — `SPECIAL_SCHEME_REGEX` split into global and non-global variants to prevent intermittent `test()` failures caused by a preserved `lastIndex`.
- Relative hrefs mangled by `normalizeHref`. A fragment, query, absolute path, or dot-relative ref (`#intro`, `?q=1`, `/docs/intro`, `./guide.md`, `../a`) was treated as a bare domain and promoted to `https://#intro`. The browser rejects that outright. The rendered anchor was inert. These five shapes now pass through unchanged. Protocol-relative `//cdn.example.com` keeps its existing path.

**Popover positioning + lifecycle.**

- Popover stayed glued to the viewport while its anchor scrolled away. Both popovers used frozen `getBoundingClientRect` snapshots feeding `floating-ui` a static rect; `position: fixed` + a frozen rect means the toolbar stays nailed to its open-time viewport position. Fixed by using live rect sources (DOM node for edit; live `coordsAtPos` closure for create). Pinned by `scroll-stickiness.cy.ts`.
- Unhandled rejection from `view.coordsAtPos()` on doc mutation. A remote collab op (Yjs / Hocuspocus) shrinking the doc while the create popover was open made the captured `from`/`to` positions out-of-range. The next `autoUpdate`-triggered reposition then threw inside `computePosition` as an uncaught promise rejection. Now caught; the popover dismisses itself on the next microtask. The anchor is gone — there's nothing for the form to attach to. Hiding via `referenceHidden` was the first instinct, but it leaves a phantom popover with `autoUpdate` still firing and focus trapped inside the invisible form. Full dismissal is the honest behavior.
- Stale `autoUpdate` subscription after `updateReference()`. The subscription stayed bound to the _previous_ reference's overflow ancestors, so a new reference in a different scroll container stopped following scroll. Now torn down and re-bound on every reference swap.
- `updatePosition` async race — checks `visible` after `await computePosition()` to avoid writing to a detached toolbar element if `hide()` ran mid-computation.
- Destroying an editor closes only the popover that editor opened. Ownership tracks the popover instance, registered on open and cleared on normal close. Tearing down one editor therefore never closes a sibling editor's popover or a manually adopted one. Pinned by `destroy-lifecycle.cy.ts`.
- The create popover's selection anchor no longer computes a negative-width rect on wrapped multi-line selections.
- `createPopover` is a one-shot once opened: `hide()` and `destroy()` are terminal after the first `show()`, which no longer reopens a closed popover. Hiding releases the controller's ownership and nothing re-adopted, so a re-shown popover stayed on screen while the controller believed it was idle. `getDefaultController().close()` could not reach it, and the next `adopt()` did not evict it (two popovers at once). It also survived `editor.destroy()` with `autoUpdate` observers still bound. Only BYO popovers built directly on the exported `createPopover` could reach this; every built-in opener already creates a fresh popover per open. Build a new popover to reopen.

**Popover + command correctness.**

- `editHyperlink` "mismatched transaction" error when editing text + href together (see Changed above).
- `editHyperlink` helper rewritten to use the ProseMirror model (`getMarkRange`) instead of fragile DOM traversal (`domAtPos` → `closest('a')`).
- Missing `.run()` — the edit popover now correctly executes the `editHyperlink` command chain.
- Click handler `attrs` mismatch — `showPopover` now reads mark attributes from the **clicked link's document position** (`view.posAtDOM`) instead of from the current selection (`getAttributes`). Previously, clicking a link when the cursor was on a different link returned the wrong `attrs` to the popover.
- Edit-popover back button — replaced the fragile `setTimeout(() => link.click(), 1)` with direct back navigation. The prebuilt edit popover's Back button re-opens the preview from the options it already holds (`onBack` overrides it). No more simulated DOM clicks, and consumer factories no longer need to wire an `onBack` prop themselves.
- Silent error swallowing — the `editHyperlink` helper logs a `console.warn` on `catch` instead of returning `false` without signal.
- `editHyperlink` preserves co-located marks (bold / italic / code): URL-only edits swap the hyperlink mark in place; text edits carry the surrounding marks onto the rebuilt range.
- Escape in the edit popover restores editor focus, matching the create popover.
- Clicking a link while an unrelated selection was active restored that selection verbatim. The preview popover's Remove then ran over the stale range, and Edit closed silently. The click now keeps a non-empty selection only when it overlaps the clicked link's mark range; otherwise the caret moves to the click position.
- The create popover's Apply left focus on `<body>` after closing. It now returns focus to the editor, matching the Escape handler and the edit popover's submit.
- The create popover ignored its documented pre-fill. `openCreateHyperlinkPopover({ href })` built the options and handed them to the factory, but the prebuilt surface rendered an empty field and a disabled Apply. The URL input now starts at `attributes.href` and Apply starts enabled when that value is non-empty.
- `editor.can().editHyperlinkHref(uri)` reported `true` while `editor.commands.editHyperlinkHref(uri)` returned `false` for a URI rejected by `isAllowedUri` — the gate sat below the dry-run exit. It now runs above it, so a toolbar button driven by `can()` no longer enables an action that cannot succeed.
- The `[text](url)` input rule stripped co-located marks. Typing the literal inside a bold or italic run produced plain-weight link text; the replacement now carries the run's non-hyperlink marks, matching the edit command.

**Markdown round-trip.**

- `renderMarkdown` exported the stored `href` ungated, so a hostile mark that reached the document through Yjs replay or a raw `addMark` serialized as `[click](javascript:alert(1))`. It now applies the same `isSafeHref` floor as `renderHTML`, `parseHTML`, and `parseMarkdown`.
- An href containing whitespace truncated on re-import: marked.js's href grammar excludes space and tab. The trailing `)` therefore never matched, and the whole link fell back to plain text. Whitespace is percent-encoded on export, alongside the existing `)` handling.

**Platform + environment.**

- `linkifyjs` global `reset()` call removed from `onDestroy`. The previous behavior cleared the global linkify protocol registry and broke other editors on the same page. Registered protocols are now additive for the page lifetime.
- Mounting more than one editor that uses the extension on the same page no longer logs `linkifyjs: already initialized - will not register custom scheme`. Custom `protocols` register in each editor's `onCreate`, but linkifyjs keeps one process-global scheme registry that locks on first use. A second editor registered after that lock only logged the warning. Each scheme now registers once; later editors reuse it silently. Autolinking of configured schemes (e.g. `ftp`, `mailto`) is unchanged.
- Stale `view` capture — the click handler passes `view` directly from `handleDOMEvents` instead of capturing it at plugin creation time.
- `autoUpdate` subscription + listener leaks — proper cleanup on `hide()` and `destroy()`.
- `openCreateHyperlinkPopover` honors the dry-run guard. `editor.can().openCreateHyperlinkPopover()` — the idiomatic way to enable a toolbar button — used to mount the create dialog and evict whatever popover was open. It now reports availability without side effects.

### Security

- **Mispublish disclosure.** `extension-hyperlink@4.3.0` was mistakenly published to npm under the wrong semver line on 2026-04-19. npm allows an unpublish only within 72 hours, so that window closed on 2026-04-22 and `4.3.0` cannot be removed from the registry. It is deprecated instead, and because it is the highest version number on the package it stays at the top of the npm version list. Do not install `4.3.0` — install `2.0.0` (`bun add @docs.plus/extension-hyperlink`). This entry is the authoritative disclosure; the archived pre-2.0 history footnote below is not a substitute.
- **Dangerous-scheme blocklist at every entry point.** `javascript:`, `data:`, `vbscript:`, `file:`, and `blob:` are uniformly refused. The refusal covers `parseHTML` (callback-based `getAttrs` runs `DANGEROUS_SCHEME_RE`), input rule, paste handler, paste rule, click handler, middle-click `auxclick` handler, preview popover, and autolink. The previous check was inconsistent. `parseHTML` allowed only `javascript:` via a CSS selector, and every other surface allowed everything. Collaborative editing plus `setContent` on untrusted HTML made it a stored XSS vector. `file:` exfiltrates local-disk paths; `blob:` persists scriptable HTML across the document's lifetime; both join the blocklist. `DANGEROUS_SCHEME_RE` and `isSafeHref` are exported so BYO popovers inherit the same floor.
- **Defensive `isSafeHref` gate inside `validateURL`.** Even if a downstream consumer skips the regex, the WHATWG `URL`-based validator refuses dangerous schemes before parsing. Closes the "validator-as-public-API" hole where consumers used `validateURL` directly to vet user input.
- **`renderHTML` re-validates on serialization.** The mark serializer passes the stored `href` through `isSafeHref` and blanks the attribute on failure. Even if a tampered document smuggles `<a href="javascript:…">` past parse, it is never written back into the editor DOM as a live anchor. The routes past parse are a collaborative edit, a misbehaving extension, and a downstream HTML serializer.
- **Middle-click (`auxclick`) navigation safety.** Without it, middle-click bypasses the capture-phase primary-click guard. The browser then opens `javascript:` / `data:` / `file:` / `blob:` anchors in a new tab, fully circumventing the posture above. The new handler runs `isSafeHref` + `isAllowedUri`, then opens with `'noopener,noreferrer'`. Right-click (`button === 2`) is left untouched so the native context menu still works.
- **`window.open` safety harness on every read-side path.** Preview popover "Open" button, `clickHandler` read-only fallback, and the new `auxclick` handler all re-check `isSafeHref(href)`. Each then runs the composed `isAllowedUri` policy (mirroring the write side) and passes `SAFE_WINDOW_FEATURES` (`'noopener,noreferrer'`). The new tab therefore cannot reach back into `window.opener` or leak a Referer header. Tabnabbing surface eliminated end-to-end.
- **`isAllowedUri` threaded through the preview popover.** `PreviewHyperlinkOptions` carries an optional `isAllowedUri` field, defaulted from the click-handler plugin to the composed gate; the prebuilt preview popover's "Open" button consults it before `window.open`. Closes the last asymmetry where a tightened policy was honored on click + middle-click but not on the popover's anchor button. BYO popovers should call the same gate for parity.
- **Control characters can't smuggle a scheme past the gate.** Browsers strip embedded ASCII tab / LF / CR and C0 controls when resolving a URL, so `java\tscript:alert(1)` navigates as `javascript:`. `isSafeHref` tests a control-stripped copy of the href, closing the bypass at every boundary that uses the gate.
- **Markdown-imported hrefs are gated.** `parseMarkdown` routes incoming link hrefs through the same `normalizeHref` + `isSafeHref` pipeline as every other write boundary; an unsafe scheme lands as an empty `href`.

### Removed

**Popover API (v2 redesign).**

- `createFloatingToolbar` — use `createPopover` (or, for the 90% case, an opener: `openCreateHyperlink` / `openEditHyperlink` / `openPreviewHyperlink`).
- `hideCurrentToolbar()` — use `getDefaultController().close()`.
- `updateCurrentToolbarPosition(ref?)` — use `getDefaultController().reposition(ref?)`.
- `FloatingToolbarOptions`, `FloatingToolbarInstance` — use `PopoverOptions`, `Popover`.
- `HyperlinkUIController` — use `PopoverController`.
- `SurfaceKind` — use `PopoverKind`.
- `EditHyperlinkPopoverOptions`, `EditHyperlinkModalOptions` — use `EditHyperlinkOptions`.
- `surface` field on the floating-popover primitive options — kind tagging moved to `controller.adopt(popover, kind, metadata)`.
- `helpers/floatingToolbar.ts` and `ui-controller/` — both modules deleted; logic lives in the bundled `@docs.plus/floating-popover` engine.

**Other.**

- `SpecialUrlIcon` typed union and the `SpecialUrlInfo.icon?: SpecialUrlIcon` optional field. See Breaking Changes and [icon-mapping migration](#consumer-icon-mapping).
- `isSpecialSchemeUrl(url)` from the public utility surface. Use `getSpecialUrlInfo(url) != null`.
- Internal helpers `getCurrentToolbar`, `isToolbarVisible`, `destroyCurrentToolbar` (never made the public surface).
- Per-platform brand icons (`FaWhatsapp`, `SiZoom`, etc.) — never in the published bundle; the brand-neutral `getSpecialUrlInfo` contract makes this explicit.
- Internal `Logger`, `HTMLSanitizer`, and `CleanupTracker` classes — replaced by simpler direct implementations.
- Redundant default export from `specialUrls.ts`; empty `types.ts`.

### Documentation

- README quick-start for the prebuilt popovers, plus three runnable vanilla-JS DOM examples (under `<details>`) showing how to build a custom `previewHyperlink` / `createHyperlink` / `editHyperlink` from scratch. The examples are wired to the current `PreviewHyperlinkOptions` / `CreateHyperlinkOptions` / `EditHyperlinkOptions` shapes.
- README badge row reorganized: docs.plus product badge (auto-switching dark / light variant), npm version, monthly downloads, MIT license, and a Discord community badge.
- Badge SVGs moved to their canonical home at `apps/webapp/public/badges/` (also served from `https://docs.plus/badges/...`); the README's `<picture>` source URLs updated to match.
- README accuracy pass — `HTMLAttributes` no longer documents `target` / `image` (those keys are stripped on render). The BYO `setHyperlink` example uses `editor.chain().setHyperlink({ href }).run()` instead of `setMark`. The URL-handling section names `normalizeHref` (the actual export) instead of `normalizeLinkifyHref` (internal). The Security section reflects the widened blocklist, the `renderHTML` re-validation, and the `'noopener,noreferrer'` features arg.
- README rewritten for the v2 popover API. The "Popovers" intro now describes the two-layer surface (factory slots, openers, primitive). A new "Openers" section documents `openCreateHyperlink` / `openEditHyperlink` / `openPreviewHyperlink`. The "Floating-popover primitive" and "UI controller" sections document `createPopover`, `PopoverOptions`, `Popover`, `getDefaultController`, `PopoverController`, and the richer `ControllerState` (with `popoverKind`, `element`, `referenceElement`). The "Class names" table renames every `.floating-toolbar*` row to `.floating-popover*`. The "TypeScript" section lists the v2 exports and drops the v1 ones.
- README restructured for junior-developer onboarding. The Popovers intro is now task-framed (use prebuilt / open from outside / replace) instead of percentage-tiered. The Openers section moved up next to the option shapes, so consumers see the canonical entry points before BYO. A new `## Advanced` umbrella heading walls off the BYO factories, the `createPopover` primitive, and the `PopoverController`. You only read those sections when replacing a prebuilt or building a non-link-anchored popover. The standalone "Wiring the edit popover's Back button" section was deleted; its contract lives in the BYO `editHyperlink` example as a brief comment. The `validate` description in the Options table was corrected (it gates every write boundary, not just autolinks). A new `validate` vs `isAllowedUri` subsection explains the signature-only difference. The `1.x → 2.0` migration callout demoted from an `[!IMPORTANT]` block at the top to a one-line link inside Install.
- `CONTRIBUTING.md` added at the package root. The test docs (run commands, playground query-string flags, the 16-spec Cypress matrix) moved out of the README and into the contributor doc. The README links to it from a single-paragraph `## Contributing` section.
- Documented the controller `subscribe` contract (no initial fire), plus `nodePos` and the forwarded `isAllowedUri` gate on the popover option shapes. Also documented the DOM-helper exports (`copyToClipboard`, `createHTMLElement`, the icon factories), and the mark's built-in markdown hooks. The BYO preview example gates `attrs.href` through `isSafeHref` before rendering a navigable anchor.
- New README `## Caveats` section on the StarterKit collision. StarterKit v3 bundles `@tiptap/extension-link` by default. Both marks sit at priority 1000, both declare `setLink` / `unsetLink` / `toggleLink` into Tiptap's single flat command map, and both claim the `a[href]` parse rule. One therefore silently overrides the other in extension-array order, and one mark takes every anchor. `StarterKit.configure({ link: false })` is required, not stylistic. The Install sample and the alias row in the command table both point at it.
- BYO `editHyperlink` sample corrected. It read `link.href`, which resolves relative hrefs against `document.baseURI`, so an untouched Apply rewrote a stored relative href with the host origin. It now reads the raw `href` attribute, as the prebuilt popover already did. The sample also destructures and forwards `isAllowedUri`. Its Back button then re-opens the preview with the same navigation policy the option table two sections above promises.
- `buildPreviewOptionsFromAnchor`'s documented signature now lists all six fields. `nodePos` (the only way to reach duplicate-anchor disambiguation) and `isAllowedUri` (what keeps the composed gate alive across edit → Back) were missing.
- The tooltip entry notes that the bubble is per bundle. Pair `attachTooltip` and `hideTooltip` from the same package, or a dismissal leaves the other package's bubble on screen.
- The `1.x → 2.0` migration snippets compile. The preview line dropped the required `nodePos` field, and the `createPopover` line passed an `editor` property that `PopoverOptions` does not have; both are copyable now.

### Internal

- The published manifest no longer declares `engines` — the monorepo's Node floor gated engine-strict consumer installs even though the shipped bundle is plain browser-targeted ESM/CJS.
- **Bundle size**: ESM `dist/index.js` ~32 KB, CJS ~33 KB, DTS ~18 KB — with the popover engine bundled in. Public surface grew (canon options + commands, `SpecialUrlType` 44-member literal union, `auxclick` handler, widened blocklist, navigation-safety helpers). JSDoc trim kept the DTS lean despite that growth — intentional trade-off for compile-time typo-protection.
- **`HyperlinkAttributes<Extra>` is generic.** The default — `HyperlinkAttributes` — is fully back-compatible with `1.x` (built-in keys plus an open-ended `Record<string, unknown>` index signature). Consumers that store additional typed mark attributes can now express that without losing the index signature: `HyperlinkAttributes<{ ariaLabel: string; campaign?: string }>`.
- **`LinkContext` cached per editor.** The dependency bag (URL Decisions pipeline + composed `isAllowedUri` gate + canon options) is built once on extension `onCreate` and stored via `addStorage`. `addCommands` / `addInputRules` / `addPasteRules` / `addProseMirrorPlugins` therefore share a single allocation instead of re-building the pipeline on every hook.
- **Three command-family files collapsed into `commands/families.ts`.** The previous `canonical.ts` / `edit.ts` / `ui.ts` split was one tight module pretending to be three; consolidating reduces import noise and keeps related families discoverable side-by-side.
- **`buildPreviewOptionsFromAnchor` extracted as a shared opener helper.** The prebuilt edit popover's Back button and BYO `editHyperlink` factories now share a single code path for recovering `PreviewHyperlinkOptions` from a live anchor. That removes the duplicate `posAtDOM → mark.attrs` lookup, which previously lived inline in two places.
- **Edit popover surfaces gate rejections inline.** `editHyperlink({ newURL })` returns `false` when the URL fails the composed XSS / `isAllowedUri` gate. On that result, the prebuilt edit popover now keeps the form open and shows an error against the href input, instead of silently closing.
- Dead `.floating-popover` positioning declarations and the unused `--hl-z-index` token dropped from `styles.css` pre-release. Positioning is inline (see the stylesheet notes under Added), so neither ever shipped.
- **Pre-`2.0` history trimmed out of the active changelog.** The `1.x` notes and the internal milestone log were archived to `docs/HISTORY.md`, since removed from the tracked tree. Recover it from git history if you need it. Everything user-facing is rolled up into this entry.
- **`logger` helper** at `src/utils/logger.ts` standardizes `[extension-hyperlink]`-prefixed `console.warn` / `console.error` calls. `tsup` strips `console.log` / `console.debug` in production builds but preserves `warn` / `error` (see Changed). The typed wrapper makes the policy explicit and gives library users a single string to grep when triaging issues. All in-package call sites (`editHyperlink`, `copyToClipboard`, `createHyperlinkPopover`, `previewHyperlinkPopover`, `validateURL`) migrated.
- **Public popover types reach the barrel.** `EditHyperlinkOptions` (the consolidated v2 name) reaches the package root through `src/index.ts`'s `export * from './hyperlink'`, so `import { EditHyperlinkOptions } from '@docs.plus/extension-hyperlink'` resolves. Previously the v1 `EditHyperlinkModalOptions` symbol was referenced in the README but unreachable from the package root.
- Option types `ValidateURLOptions` and `IconProps` are exported so the documented `validateURL` and `Copy` / `LinkOff` / `Pencil` parameters are nameable in consumer code.
- **Playground accepts policy flags via query string** (`?shouldAutoLink=block`, `?clickSelection=on`, `?exitable=on`). The dedicated specs (`canon-options`, `autolink`'s `shouldAutoLink` veto block) exercise opt-in behaviors without forking the playground bootstrap.
- `tsconfig.json` excludes `src/**/__tests__/**` and `src/**/*.test.ts` from the build so unit tests don't leak into `dist/`. `bun-types` added as a dev dep so test files typecheck against `bun:test` without polluting the build.
- `utils/index.ts` doc comment documents the explicit-named-export contract and lists every module-internal helper that intentionally does not leak through the public barrel.
- `AGENTS.md` updated with the new `SpecialUrlType` contract, the naming convention, and the consumer `Partial<Record<SpecialUrlType, IconRenderer>>` pattern. The naming convention is lowercase single-word brands, kebab-case for multi-word, and brand spelling over URL-scheme abbreviation. `AGENTS.md` also records the `floating-popover/createPopover.ts` invariant that virtual references must use a live `getBoundingClientRect` callback, never a snapshotted rect.
- **Colocated unit tests are typechecked.** `tsconfig.json` excludes them from the build, so nothing covered them; `typecheck` now runs a second `tsc -p tsconfig.test.json` pass, matching `extension-indent`. The pass surfaced three accumulated type errors in the test files, all fixed.
- **The click handler routes through `buildPreviewOptionsFromAnchor`.** It carried its own `posAtDOM → mark.attrs` lookup with a duplicate six-field fallback literal behind an `as` cast. A seventh built-in attribute updated in only one of the two literals was therefore invisible to `tsc`. Routing through the shared helper also gains its `posAtDOM` try/catch. `link.target` is still read before the mark attribute — it is `''` when unset, and `_blank` is the intended default.
- **`url-decisions` trimmed to the fields that have readers.** `WriteResult` keeps `href` / `start` / `end`; `ReadDecision` keeps `navigable`. `value`, `type`, `special`, and `safe` had no reader outside their own tests, and dropping them removes four per-write `getSpecialUrlInfo` calls. Each of those calls rebuilt two `Object.entries` catalogs, once per autolink candidate before the veto filter ran. The module is not on the public barrel, so no consumer surface changes.
- **`editHyperlinkCommand` moved to `commands/` and lost a phantom middle function.** It was annotated `RawCommands['editHyperlink']`, which advertised a middle call taking an optional attributes object that the implementation never declared or read. So `editHyperlinkCommand({ … })({ newURL })` typechecked and silently discarded `newURL`. It now returns a plain `Command`. The file also moved from the one-file `src/helpers/` directory into `src/commands/`, next to its only caller, and is named for its export.
- Dead barrel re-exports removed from `commands/index.ts`, `interactions/index.ts`, and `url-decisions/index.ts` — thirteen symbols with no importer. None reached `dist/index.d.ts`.
- `OFFSCREEN_COORD_PX` moved to `src/constants.ts`; the create and edit openers had identical copies for the same stale-anchor bail-out rect.
- Test suite pruned of banned shapes. The removed shapes are the popover-factory type fence, the `it.each` command-surface `typeof` loop, the popover-defaults options test, and the ProseMirror `Plugin`-has-a-`spec` assertion. The type fence re-proved return types the factories already declare. The key-set assertion beside the `typeof` loop already covers that loop. All three popover-defaults read sites use `??`, so `null` and `undefined` are indistinguishable. The styling spec's fourteen per-token assertions collapsed into one that reads the shipped `:root` rule text. `getComputedStyle` was resolving nine of those tokens from the playground's own `html[data-theme]` block, so they stayed green with the tokens deleted from the stylesheet.
- `.gitignore` aligned byte-for-byte with the four sibling extensions; the local copy carried a stale reference to a `HISTORY` archive that no longer exists.

---

### Migrating from `1.x` to `2.0`

If you are upgrading from `^1.5.2` directly to `2.0`, the API has been substantially redesigned. The script below handles every mechanical rename; the semantic changes are listed separately because they require code review.

#### One-shot rename script

Run this in your project root and commit the diff:

```bash
rg -l "autoHyperlink|hyperlinkOnPaste|editHyperLinkText|editHyperLinkHref|preventAutoHyperlink|hyperlinkCreatePopover|hyperlinkPreviewPopover|hyperlinkEditPopover|buttonsWrapper|inputsWrapper|textWrapper|hrefWrapper|backButton|btn_applyModal" \
  | xargs sed -i.bak \
    -e 's/autoHyperlink/autolink/g' \
    -e 's/hyperlinkOnPaste/linkOnPaste/g' \
    -e 's/editHyperLinkText/editHyperlinkText/g' \
    -e 's/editHyperLinkHref/editHyperlinkHref/g' \
    -e 's/preventAutoHyperlink/preventAutolink/g' \
    -e 's/hyperlinkCreatePopover/hyperlink-create-popover/g' \
    -e 's/hyperlinkPreviewPopover/hyperlink-preview-popover/g' \
    -e 's/hyperlinkEditPopover/hyperlink-edit-popover/g' \
    -e 's/buttonsWrapper/buttons-wrapper/g' \
    -e 's/inputsWrapper/inputs-wrapper/g' \
    -e 's/textWrapper/text-wrapper/g' \
    -e 's/hrefWrapper/href-wrapper/g' \
    -e 's/backButton/back-button/g' \
    -e 's/btn_applyModal/apply-button/g'
```

#### Code diff

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
+    editHyperlink: myEditFn,       // new in v2; defaults to the prebuilt edit popover
   }
 })

 // Commands
-editor.commands.editHyperLinkText('New Text')
-editor.commands.editHyperLinkHref('https://example.com')
+editor.commands.editHyperlinkText('New Text')
+editor.commands.editHyperlinkHref('https://example.com')

 // Meta key in transactions
-tr.setMeta('preventAutoHyperlink', true)
+tr.setMeta('preventAutolink', true)

 // Popover types — no more hand-rolled types
+import type {
+  PreviewHyperlinkOptions,
+  CreateHyperlinkOptions,
+  EditHyperlinkOptions,
+  PopoverOptions,
+  Popover,
+} from '@docs.plus/extension-hyperlink'

 // Imperative open + dismiss
-import { hideCurrentToolbar, updateCurrentToolbarPosition } from '@docs.plus/extension-hyperlink'
-hideCurrentToolbar()
-updateCurrentToolbarPosition(myAnchor)
+import {
+  openCreateHyperlink,
+  openEditHyperlink,
+  openPreviewHyperlink,
+  getDefaultController,
+} from '@docs.plus/extension-hyperlink'
+openCreateHyperlink(editor)                          // ← Mod-k equivalent
+openEditHyperlink({ editor, link, validate })
+openPreviewHyperlink(buildPreviewOptionsFromAnchor({ editor, link, validate }))
+getDefaultController().close()
+getDefaultController().reposition(myAnchor)

 // Custom popover primitive
-import { createFloatingToolbar } from '@docs.plus/extension-hyperlink'
-createFloatingToolbar({ editor, content, surface: 'preview', referenceElement })
+import { createPopover } from '@docs.plus/extension-hyperlink'
+createPopover({ content, referenceElement })  // surface tag set by controller.adopt()
```

```css
/* CSS selectors */
- .hyperlinkCreatePopover  { … }
- .hyperlinkPreviewPopover { … }
- .hyperlinkEditPopover    { … }
- .buttonsWrapper { … }
- .inputsWrapper  { … }
- .textWrapper    { … }
- .hrefWrapper    { … }
- .backButton     { … }
- .btn_applyModal { … }
+ .hyperlink-create-popover  { … }
+ .hyperlink-preview-popover { … }
+ .hyperlink-edit-popover    { … }
+ .buttons-wrapper { … }
+ .inputs-wrapper  { … }
+ .text-wrapper    { … }
+ .href-wrapper    { … }
+ .back-button     { … }
+ .apply-button    { … }
```

#### Default stylesheet

If you used the prebuilt popovers in `1.x`, their CSS was inlined by the bundle. In `2.0` it ships separately — add this once at app bootstrap:

```ts
import '@docs.plus/extension-hyperlink/styles.css'
```

Skip the import if you fully restyle the popovers in your own CSS — the JavaScript never loads it, so you pay zero cost.

#### Consumer icon mapping

The extension ships no icon catalog. Map `SpecialUrlInfo.type` to your own SVG renderer:

```ts
import { getSpecialUrlInfo, type SpecialUrlType } from '@docs.plus/extension-hyperlink'
import * as Icons from './icons'

// Partial — domain-only types (`meet`, web `github`, …) are intentionally
// absent because the favicon path always wins for `https://` URLs.
const TYPE_TO_ICON: Partial<Record<SpecialUrlType, (p: { size?: number }) => string>> = {
  email: Icons.HiMail,
  phone: Icons.HiPhone,
  whatsapp: Icons.HiChatBubbleLeftRight,
  twitter: Icons.HiUsers
  // …one entry per `type` you want a fallback icon for
}

const info = getSpecialUrlInfo(href)
if (info) {
  const renderer = TYPE_TO_ICON[info.type]
  if (renderer) renderIcon(renderer)
}
```

`Partial<Record<SpecialUrlType, …>>` gives you autocomplete and typo-protection against the extension's catalog without forcing exhaustiveness. Domain-only types like `'meet'` can be intentionally omitted because the favicon path always wins for `https://` URLs.

#### Stricter URL validation

Audit any fixtures or seeded content that relied on the previous behavior:

- `javascript:`, `data:`, and `vbscript:` URLs are now rejected at load, paste, input rule, click, and popover open. If you stored such URLs intentionally, they will be dropped.
- `validateURL` now requires a plausible host (TLD dot, `localhost`, or IP literal) for web-scheme URLs. Typos like `https://googlecom` no longer autolink.
- `localhost:3000` and `mydomain.com:8080` are now treated as host:port and canonicalized to `https://localhost:3000` / `https://mydomain.com:8080`, not left as the scheme `localhost:` / `mydomain.com:`.

#### Need help?

Open an issue at <https://github.com/docs-plus/docs.plus/issues> with the labels `extension-hyperlink` + `migration` and a snippet of the `1.x` config you're upgrading from.

---

## Pre-`2.0` history

The full `1.x` release notes plus the internal milestones between `1.5.2` and `2.0.0` were archived to `docs/HISTORY.md`, since removed from the tracked tree. Those milestones are the monorepo migration, build rewrite, popover + XSS overhaul, contract tightening, and the mispublished `4.3.0`. Recover it from git history if you need it. Everything user-facing from that stretch is rolled up into the [2.0.0](#200--2026-08-09) entry above.
