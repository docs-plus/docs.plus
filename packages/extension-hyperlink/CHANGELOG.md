<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/extension-hyperlink` are documented here.

The extension's major version tracks the docs.plus product line. `1.x` corresponds to the 2023 product; `2.x` corresponds to docs.plus **alpha v2**, the first major release after approximately three years of iteration in the monorepo. Versioning follows [Semantic Versioning](https://semver.org/) and commits follow [Conventional Commits](https://conventionalcommits.org/). Section headings (`Added` / `Changed` / `Fixed` / `Security` / `Removed`) repeat per version, per the [Keep a Changelog](https://keepachangelog.com/) convention.

---

## [2.0.0] — 2026-04-21

**First major release since `1.5.2`.** This entry rolls up every user-facing change made while docs.plus was iterating toward alpha v2. Treat the upgrade as effectively a rewrite of the public surface — the option names, popover contract, CSS selectors, validation rules, URL canonicalization, and type exports are all new. The bones (Tiptap extension that marks hyperlinks, autolinks on whitespace, opens a popover on click) are the same.

A complete migration guide from `1.5.2` is at the end of this entry, including a one-shot rename script for the mechanical changes and code diffs for the semantic ones.

### Highlights

- **Unified Popover vocabulary across the package.** Every layer — factory slot names, opener functions, primitive (`createPopover`), controller (`PopoverController`), CSS classes (`.floating-popover*`), state union (`ControllerState`) — speaks the same noun. The v1 split between "popover" and "floating-toolbar" is gone.
- **Two-layer integration surface.** Three named openers (`openCreateHyperlink`, `openEditHyperlink`, `openPreviewHyperlink`) cover the 90% case; a generic `PopoverController` covers the remaining lifecycle / observation cases. The `createPopover` primitive remains for fully custom popovers (the &lt;1% case).
- **New popover architecture** built on `@floating-ui/dom` — preview / create / edit popovers ship as small DOM-returning factory functions, the extension owns positioning, and the popover stays stuck to its anchor on scroll (no more drift).
- **Unified write-boundary URL canonicalization** — one `normalizeHref` used by the create popover, edit popover, `setHyperlink` command, markdown input rule, autolink plugin, paste handler, and paste rule. Bare phones become `tel:+CCNSN`, bare emails become `mailto:…`, bare domains become `https://…`, and user-typed schemes pass through untouched. The same input produces the same stored `href` no matter how it entered the editor.
- **50+ special URL scheme catalog** (`whatsapp://`, `tg://`, `vscode://`, `slack://`, `zoom://`, `figma://`, `spotify:`, and friends) exposed as a brand-neutral `SpecialUrlType` union plus a `getSpecialUrlInfo(href)` classifier. Consumers map types to their own icon set — the extension ships zero icon catalog.
- **Defense-in-depth XSS + navigation guards** — `javascript:`, `data:`, `vbscript:`, `file:`, and `blob:` are rejected at every entry point: `parseHTML`, input rule, paste handler, paste rule, click handler, middle-click (`auxclick`), and popover open. `renderHTML` re-validates on serialization and blanks tampered hrefs. Every `window.open` call re-checks the gate and passes `'noopener,noreferrer'`, eliminating tabnabbing end-to-end. The regex `DANGEROUS_SCHEME_RE` and the predicate `isSafeHref` are exported so BYO popovers apply the same check.
- **Default stylesheet ships separately** (`import '@docs.plus/extension-hyperlink/styles.css'`) and is fully themeable via `--hl-*` CSS custom properties with `light-dark()` support. Fully-custom UIs pay zero CSS cost.
- **Bun-native unit suite + clean-room Cypress E2E** — 317 unit tests (`bun test src`, ~95 ms) plus 132 E2E tests across 10 specs that exercise the **built `dist/` loaded via the published `exports` map** — exactly what an npm consumer installs.
- **`@tiptap/extension-link` canon parity** — `setHyperlink` is a pure command (writes the mark only); the side-effecting popover lives behind a dedicated `openCreateHyperlinkPopover` command so chains stay transactional. New `toggleHyperlink` plus migration aliases `setLink` / `unsetLink` / `toggleLink`. Options `defaultProtocol`, `isAllowedUri`, `shouldAutoLink`, `enableClickSelection`, `exitable` mirror the upstream Link-extension surface so existing policies port over without rewrites. `shouldAutoLink` is honored by the autolink plugin, paste handler, AND paste rule — full policy parity across every autolink entry point.

### Breaking Changes (from `1.5.2`)

Grouped by migration friction. The mechanical renames at the top have a [one-shot script](#one-shot-rename-script) below; the semantic changes require code review.

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

| Old (v1)                                  | New (v2)                                                           |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `createFloatingToolbar(opts)`             | `createPopover(opts)` — same shape minus `surface`                 |
| `hideCurrentToolbar()`                    | `getDefaultController().close()`                                   |
| `updateCurrentToolbarPosition(ref?)`      | `getDefaultController().reposition(ref?)`                          |
| `FloatingToolbarOptions` / `…Instance`    | `PopoverOptions` / `Popover`                                       |
| `HyperlinkUIController`                   | `PopoverController`                                                |
| `SurfaceKind`                             | `PopoverKind`                                                      |
| `EditHyperlinkPopoverOptions` / `…Modal…` | `EditHyperlinkOptions`                                             |
| `editHyperlinkPopover({ … onBack })`      | `openEditHyperlink(editor, { … })` — Back routes through the stash |
| `state.surface`                           | `state.popoverKind` (+ new `element`, `referenceElement` fields)   |

The only known external consumer (`packages/webapp`) is migrated in this same release; no separate `[2.0.1]` follow-up is needed.

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

- **`export *` replaced with explicit named re-exports** in `src/index.ts` and `src/utils/index.ts`. Module-internal helpers no longer leak through the public barrel:
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
- **Neither `PreviewHyperlinkOptions` nor `EditHyperlinkOptions` carry `linkCoords` or `view`.** The prebuilt preview / edit popovers derive their reference from the live `<a>` DOM node passed as `link`; the snapshotted rect was never read (the floating-popover primitive recomputes a live rect on every reposition, which is what makes scroll-stickiness work). The `view` field is reachable via `editor.view` for the rare BYO factory that needs it. BYO factory authors that need viewport coords for a custom anchor should pass them via `popover.options.coordinates` to `createPopover`.

### Added

**Openers (Layer 1 — the 90% case).**

- `openCreateHyperlink(editor, opts?)` — opens the create popover anchored to the current selection. Reads `popovers.createHyperlink`, falls back to the prebuilt factory.
- `openEditHyperlink(editor, opts)` — opens the edit popover anchored to a hyperlink. Stashes options on the controller so the prebuilt edit popover's Back button re-opens the preview without consumer wiring.
- `openPreviewHyperlink(editor, opts)` — opens the preview popover anchored to a hyperlink. Used internally by the click handler; also callable from outer toolbars.
- `buildPreviewOptionsFromAnchor({ editor, link, validate?, markName? })` — returns a fully-formed `PreviewHyperlinkOptions` derived from a live `<a>` DOM node. Centralizes the `posAtDOM → mark.attrs` lookup (with a defensible fallback when the mark cannot be located) so BYO `editHyperlink` factories and the prebuilt edit popover's Back button share the same code path.

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

- `src/floating-popover/` module (`controller.ts` + `createPopover.ts` + barrel) — replaces the v1 `helpers/floatingToolbar.ts` + `ui-controller/` split. Functional, ~270 LOC, no class hierarchy.
- `updateReference()` on every popover — reposition after async updates (e.g. metadata fetch) without tearing the popover down. Re-subscribes `autoUpdate` to the new reference's overflow ancestors so scroll listeners stay live across reference swaps.
- `hide` middleware from `@floating-ui/dom` — popover auto-hides when the reference scrolls out of view.
- Virtual references support a live `getBoundingClientRect` callback (recomputed on every mount/scroll/resize) plus an optional `contextElement` that anchors `autoUpdate`'s overflow-ancestor walk. The create popover uses this to position from captured ProseMirror `from`/`to` positions without snapshotting viewport coords at open time.

**URL canonicalization + classification.**

- `normalizeHref(raw)` — canonicalizes user-typed hrefs: prepends `https://` to bare domains, preserves explicit schemes, passes protocol-relative URLs (`//example.com`) through untouched, canonicalizes bare phones to `tel:+CCNSN`, and bare emails to `mailto:…`.
- `normalizeLinkifyHref(match)` — same canonical form for `linkifyjs` matches. Routes URL matches through `normalizeHref` to upgrade linkifyjs's `http://` default to `https://`; trusts linkifyjs's `href` for non-URL matches (emails → `mailto:`, custom schemes).
- `getSpecialUrlInfo(href)` — classifies a URL against a 50+ scheme catalog and returns `{ type, title, category } | null`. Type is a `SpecialUrlType` string-literal.
- `isBarePhone(trimmed)` _(module-internal, pinned by 39 unit tests)_ — one-shot E.164 detection + canonicalization. Returns `{ ok: true, href: 'tel:+CCNSN' } | { ok: false }`. Strict: only `+`-prefixed 8–15 digit numbers are recognized, so years (`2024`), ZIPs (`90210`), and bare numerics (`5551234567`) never get turned into broken `tel:` links.
- `DANGEROUS_SCHEME_RE` — shared regex for the XSS check; exported so BYO popovers apply the same invariant as the prebuilt ones.
- `isSafeHref(href)` — single-call boolean predicate (with type narrowing) wrapping `DANGEROUS_SCHEME_RE`. Used at every WRITE boundary in the extension (`setHyperlink`, paste handler, paste rule, input rule, `parseHTML`, `editHyperlink`); exported so BYO popovers reuse the exact same gate.

**Tiptap canon options.**

- `defaultProtocol: string` (default `'https'`) — scheme used by `normalizeHref` when promoting bare domains.
- `isAllowedUri?: (uri, ctx) => boolean` — composes WITH the built-in safety floor. Receives `{ defaultValidate, protocols, defaultProtocol }` so policies can reuse `isSafeHref` instead of re-implementing it. Mirrors the `@tiptap/extension-link` shape; `IsAllowedUriContext` is exported.
- `shouldAutoLink?: (uri) => boolean` — per-URI veto consulted by the autolink plugin, the paste handler (smart-paste over a non-empty selection), AND the markdown paste rule — full parity across every autolink surface. Lets hosts block app-wide categories (e.g. internal mention syntax) without losing paste-as-link UX for everything else.
- `enableClickSelection: boolean` (default `false`) — when `true`, clicking inside a link in editable mode selects the entire mark range.
- `exitable: boolean` (default `false`) — when `true`, ArrowRight at the end of a hyperlink mark exits the mark so the next typed character is plain text.

**Tiptap canon commands.**

- `openCreateHyperlinkPopover(attributes?)` — dedicated UI command that opens the create popover anchored to the current selection. The historic side-effect on `setHyperlink()` (no-args) lives here now; `Mod-k` rebinds to it. No-op when no popover factory is wired up.
- `toggleHyperlink({ href, … })` — toggles the mark on/off across the current selection. Same XSS + `isAllowedUri` gates as `setHyperlink`.
- `setLink` / `unsetLink` / `toggleLink` — drop-in delegating aliases that ease migration from `@tiptap/extension-link`. They forward to the canonical `setHyperlink` / `unsetHyperlink` / `toggleHyperlink`, so future policy changes flow through automatically.

**Default stylesheet.**

- `@docs.plus/extension-hyperlink/styles.css` — small, framework-agnostic, opt-in. The extension's JavaScript never imports it; fully-custom UIs pay zero CSS cost.
- Every visual token (colors, radii, shadow, font, transitions, z-index) exposed as `--hl-*` custom properties. Colors use `light-dark()` so the popover tracks the nearest ancestor's `color-scheme`, falling back to `prefers-color-scheme` when none is set.
- `package.json`'s `sideEffects` is `["**/*.css"]` so bundlers preserve the stylesheet import while still tree-shaking JS. `./styles.css` and `./package.json` are advertised as public subpaths in the `exports` map.

**Write-boundary behaviors.**

- **Bare-phone canonicalization** at create / edit / markdown input rule / `setHyperlink`. Typing `+1 (555) 123-4567` stores `tel:+15551234567` — formatting stripped, digits-only after the `+`. Matches what autolink produces on whitespace; all paths now agree.
- **Bare-email canonicalization** at the same boundary. `hi@example.com` stores `mailto:hi@example.com` instead of `https://hi@example.com` (which browsers resolve as HTTP basic-auth credentials).
- **Deep-link autolink** — whitespace-triggered autolink now handles `whatsapp://`, `tg://`, `vscode://`, `slack://`, `spotify:`, `zoom://`, and 40+ others in addition to `http(s)://`. Custom protocols registered via `registerCustomProtocol('mychat')` pass through untouched.
- **Read-side origin-leak defense** — the click handler and preview popover prefer the stored mark attribute (`attrs.href`) over the DOM `link.href` property, which resolves relative URLs against `document.baseURI`. Prevents `<a href="google.com">` injected via `setContent` from rendering as `http://<host-origin>/google.com`.

**Test harness.**

- Bun-native unit suite at `src/utils/__tests__/` — 317 tests across `normalizeHref`, `phone`, `specialUrls`, `validateURL`, `findLinks`, `isSafeHref`, `DANGEROUS_SCHEME_RE`. Runs via `bun test src` (~95 ms). New scripts: `bun run test:unit`, `bun run test:unit:watch`.
- Clean-room Cypress specs in `cypress/e2e/` (10 specs, 132 tests): `create`, `preview-edit`, `autolink`, `special-schemes`, `xss-guards`, `nav-guards`, `canon-options`, `styling`, `custom-popover`, `scroll-stickiness`. Exercise the built `dist/` loaded via the published `exports` map — i.e. the install-time surface. Run with `bun run test:e2e`. `xss-guards` covers the wider scheme regex plus `renderHTML` re-validation (tampered marks injected via raw transaction); `nav-guards` covers middle-click navigation safety; `autolink` pins the `code`-mark skip and the `shouldAutoLink` veto across all three autolink surfaces; `canon-options` pins `enableClickSelection` and `exitable`.
- Bun-native playground at `test/playground/server.ts` (~15 LOC): `Bun.serve({ routes: { '/': index } })` with an HTML import bundles the playground's TypeScript + CSS on demand. No bundler config, no dedupe knobs, one less dev dependency than the previous Vite setup.
- Root `test` script composes all three: unit → build → e2e.

### Changed

- **Floating-popover internals rewritten.** 800-LOC singleton class (`FloatingToolbarManager`) replaced with a lean functional module under `src/floating-popover/`. Strategy switched from `position: absolute` to `strategy: 'fixed'` for body-appended elements, eliminating scroll lag under transformed ancestors.
- **`createHyperlinkPopover` simplified** — no longer manages its own positioning. Returns DOM content only; positioning lives in the floating-popover module via `createPopover`.
- **Popover scroll-stickiness** — the edit popover uses the live `<a>` DOM node as `referenceElement` (the browser recomputes its rect on every call). The create popover passes a closure that recomputes coords from captured ProseMirror `from`/`to` positions on every reposition, instead of the v1-era snapshot-at-open approach that caused the popover to drift while the page scrolled.
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
- **Symbol renames for naming consistency** (`getUrlScheme` → `getURLScheme` to match the SCREAMING-acronym policy used by `validateURL` / `DANGEROUS_SCHEME_RE`; internal `isValidSpecialScheme` → `isRecognizedSpecialScheme`; `EditHyperlinkModalOptions` / `EditHyperlinkPopoverOptions` → `EditHyperlinkOptions` (no deprecated alias kept — this is a single major bump that consolidates both v1 names into the v2 vocabulary); internal `showPopover` → `openHyperlinkToolbar`; autolink internals `TRAILING_PUNCT_RE` / `stripTrailingPunct` → `TRAILING_PUNCTUATION_RE` / `stripTrailingPunctuation`).
- **All cross-module string literals replaced by `src/constants.ts`** — `HYPERLINK_MARK_NAME` (`'hyperlink'`) and `PREVENT_AUTOLINK_META` (`'preventAutolink'`) are imported by every site that previously had the magic string inline. Internal-only — neither is re-exported from the public barrel.
- **`autolinkPlugin` `findLinks` core extracted to `utils/findLinks.ts`** for unit testing without spinning up a ProseMirror editor. The plugin's `appendTransaction` body shrinks; matcher behavior is now pinned by an additional 12 unit tests covering URLs, emails, special schemes, phones, and trailing-punctuation stripping.
- **Autolink boundary detection is Unicode-aware.** Word splitting uses `/\s+/` (not just `' '`), so links followed by a tab, NBSP, em-space, ideographic space, or any other Unicode whitespace are recognized as link boundaries. Fixes silent autolink misses in CJK / European-typography content.
- **Autolink skips `code` marks.** A URL typed inside an inline `code` mark is content, not a navigation target — it must round-trip verbatim. The autolink plugin consults `state.schema.marks.code` and refuses to apply a hyperlink mark inside any range that already carries the `code` mark. Mirrors `@tiptap/extension-link` v3 canon.

### Fixed

**URL handling.**

- `localhost:3000` stored as the scheme `localhost:`. The old `SCHEME_RE` matched any `[a-z][a-z0-9+.-]*:` prefix, so `localhost:3000` and `mydomain.com:8080` were treated as already-absolute and returned unchanged from `normalizeHref` — the browser then resolved `localhost:` / `mydomain.com:` as scheme names and the link broke. Fixed by the `hasRealScheme` gate; pinned by two `create.cy.ts` regression tests.
- Bare email stored as `https://user@example.com` (the `user@` part is HTTP basic-auth in a URL context). Now stores `mailto:user@example.com` from every entry point.
- Bare phone was never autolinked — `linkifyjs` has no phone matcher (upstream issue open since 2016). The autolink plugin now emits a synthetic `type: 'phone'` entry with the canonical `tel:+CCNSN` href when the whitespace-delimited token matches `isBarePhone`. Typing `+4733378901<space>` now autolinks.
- Autolink email href clobber — `findLinks`'s trailing-punctuation cleanup was overwriting `linkifyjs`'s canonical `href` (including the `mailto:` prefix) with the punctuation-stripped `value`. Emails now correctly store `mailto:user@example.com` on whitespace autolink.
- Stateful `/g` regex — `SPECIAL_SCHEME_REGEX` split into global and non-global variants to prevent intermittent `test()` failures caused by a preserved `lastIndex`.

**Popover positioning + lifecycle.**

- Popover stayed glued to the viewport while its anchor scrolled away. Both popovers used frozen `getBoundingClientRect` snapshots feeding `floating-ui` a static rect; `position: fixed` + a frozen rect means the toolbar stays nailed to its open-time viewport position. Fixed by using live rect sources (DOM node for edit; live `coordsAtPos` closure for create). Pinned by `scroll-stickiness.cy.ts`.
- Unhandled rejection from `view.coordsAtPos()` on doc mutation. A remote collab op (Yjs / Hocuspocus) shrinking the doc while the create popover was open made the captured `from`/`to` positions out-of-range, and the next `autoUpdate`-triggered reposition threw inside `computePosition` as an uncaught promise rejection. Now caught; the popover dismisses itself on the next microtask. The anchor is gone — there's nothing for the form to attach to. Hiding via `referenceHidden` was the first instinct, but it leaves a phantom popover with `autoUpdate` still firing and focus trapped inside the invisible form; full dismissal is the honest behavior.
- Stale `autoUpdate` subscription after `updateReference()`. The subscription stayed bound to the _previous_ reference's overflow ancestors, so a new reference in a different scroll container stopped following scroll. Now torn down and re-bound on every reference swap.
- `updatePosition` async race — checks `visible` after `await computePosition()` to avoid writing to a detached toolbar element if `hide()` ran mid-computation.

**Popover + command correctness.**

- `editHyperlink` "mismatched transaction" error when editing text + href together (see Changed above).
- `editHyperlink` helper rewritten to use the ProseMirror model (`getMarkRange`) instead of fragile DOM traversal (`domAtPos` → `closest('a')`).
- Missing `.run()` — the edit popover now correctly executes the `editHyperlink` command chain.
- Click handler `attrs` mismatch — `showPopover` now reads mark attributes from the **clicked link's document position** (`view.posAtDOM`) instead of from the current selection (`getAttributes`). Previously, clicking a link when the cursor was on a different link returned the wrong `attrs` to the popover.
- Edit-popover back button — replaced the fragile `setTimeout(() => link.click(), 1)` with controller-managed back navigation. `openEditHyperlink` stashes the caller's options on the controller; the prebuilt edit popover's Back button calls `openPreviewHyperlink` with the stashed options. No more simulated DOM clicks, and consumer factories no longer need to wire an `onBack` prop themselves.
- Silent error swallowing — the `editHyperlink` helper logs a `console.warn` on `catch` instead of returning `false` without signal.

**Platform + environment.**

- `linkifyjs` global `reset()` call removed from `onDestroy`. The previous behavior cleared the global linkify protocol registry and broke other editors on the same page. Registered protocols are now additive for the page lifetime.
- Stale `view` capture — the click handler passes `view` directly from `handleDOMEvents` instead of capturing it at plugin creation time.
- `autoUpdate` subscription + listener leaks — proper cleanup on `hide()` and `destroy()`.

### Security

- **Dangerous-scheme blocklist at every entry point.** `javascript:`, `data:`, `vbscript:`, `file:`, and `blob:` are uniformly refused at `parseHTML` (callback-based `getAttrs` runs `DANGEROUS_SCHEME_RE`), input rule, paste handler, paste rule, click handler, middle-click `auxclick` handler, preview popover, and autolink. The previous check was inconsistent — `parseHTML` allowed only `javascript:` via a CSS selector, every other surface allowed everything, and collaborative editing plus `setContent` on untrusted HTML made it a stored XSS vector. `file:` exfiltrates local-disk paths; `blob:` persists scriptable HTML across the document's lifetime; both join the blocklist. `DANGEROUS_SCHEME_RE` and `isSafeHref` are exported so BYO popovers inherit the same floor.
- **Defensive `isSafeHref` gate inside `validateURL`.** Even if a downstream consumer skips the regex, the WHATWG `URL`-based validator refuses dangerous schemes before parsing. Closes the "validator-as-public-API" hole where consumers used `validateURL` directly to vet user input.
- **`renderHTML` re-validates on serialization.** The mark serializer passes the stored `href` through `isSafeHref` and blanks the attribute on failure. Even if a tampered document smuggles `<a href="javascript:…">` past parse — collaborative edit, misbehaving extension, downstream HTML serializer — it is never written back into the editor DOM as a live anchor.
- **Middle-click (`auxclick`) navigation safety.** Without it, middle-click bypasses the capture-phase primary-click guard and the browser opens `javascript:` / `data:` / `file:` / `blob:` anchors in a new tab, fully circumventing the posture above. The new handler runs `isSafeHref` + `isAllowedUri`, then opens with `'noopener,noreferrer'`. Right-click (`button === 2`) is left untouched so the native context menu still works.
- **`window.open` safety harness on every read-side path.** Preview popover "Open" button, `clickHandler` read-only fallback, and the new `auxclick` handler all re-check `isSafeHref(href)`, run the composed `isAllowedUri` policy (mirroring the write side), and pass `SAFE_WINDOW_FEATURES` (`'noopener,noreferrer'`) so the new tab cannot reach back into `window.opener` or leak a Referer header. Tabnabbing surface eliminated end-to-end.
- **`isAllowedUri` threaded through the preview popover.** `PreviewHyperlinkOptions` carries an optional `isAllowedUri` field, defaulted from the click-handler plugin to the composed gate; the prebuilt preview popover's "Open" button consults it before `window.open`. Closes the last asymmetry where a tightened policy was honored on click + middle-click but not on the popover's anchor button. BYO popovers should call the same gate for parity.

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
- `helpers/floatingToolbar.ts` and `ui-controller/` — both modules deleted; logic lives in `floating-popover/`.

**Other.**

- `SpecialUrlIcon` typed union and the `SpecialUrlInfo.icon?: SpecialUrlIcon` optional field. See Breaking Changes and [icon-mapping migration](#consumer-icon-mapping).
- `isSpecialSchemeUrl(url)` from the public utility surface. Use `getSpecialUrlInfo(url) != null`.
- Internal helpers `getCurrentToolbar`, `isToolbarVisible`, `destroyCurrentToolbar` (never made the public surface).
- Per-platform brand icons (`FaWhatsapp`, `SiZoom`, etc.) — never in the published bundle; the brand-neutral `getSpecialUrlInfo` contract makes this explicit.
- Internal `Logger`, `HTMLSanitizer`, and `CleanupTracker` classes — replaced by simpler direct implementations.
- Redundant default export from `specialUrls.ts`; empty `types.ts`.

### Documentation

- README quick-start for the prebuilt popovers, plus two runnable vanilla-JS DOM examples (under `<details>`) showing how to build a custom `previewHyperlink` / `createHyperlink` from scratch — wired to the current `PreviewHyperlinkOptions` / `CreateHyperlinkOptions` shapes.
- README badge row reorganized: docs.plus product badge (auto-switching dark / light variant), npm version, monthly downloads, MIT license, and a Discord community badge.
- Community section added above License with a Discord invite for questions and help.
- Badge SVGs moved to their canonical home at `packages/webapp/public/badges/` (also served from `https://docs.plus/badges/...`); the README's `<picture>` source URLs updated to match.
- README accuracy pass — `HTMLAttributes` no longer documents `target` / `image` (those keys are stripped on render); the BYO `setHyperlink` example uses `editor.chain().setHyperlink({ href }).run()` instead of `setMark`; the URL-handling section names `normalizeHref` (the actual export) instead of `normalizeLinkifyHref` (internal); the Security section reflects the widened blocklist, the `renderHTML` re-validation, and the `'noopener,noreferrer'` features arg.
- README rewritten for the v2 popover API — the "Popovers" intro now describes the two-layer surface (factory slots, openers, primitive); a new "Openers" section documents `openCreateHyperlink` / `openEditHyperlink` / `openPreviewHyperlink`; the "Floating-popover primitive" and "UI controller" sections document `createPopover`, `PopoverOptions`, `Popover`, `getDefaultController`, `PopoverController`, and the richer `ControllerState` (with `popoverKind`, `element`, `referenceElement`); the "Class names" table renames every `.floating-toolbar*` row to `.floating-popover*`; the "TypeScript" section lists the v2 exports and drops the v1 ones.
- README restructured for junior-developer onboarding. The Popovers intro is now task-framed (use prebuilt / open from outside / replace) instead of percentage-tiered; the Openers section moved up next to the option shapes so consumers see the canonical entry points before BYO; a new `## Advanced` umbrella heading walls off the BYO factories, the `createPopover` primitive, and the `PopoverController` — sections you only read when replacing a prebuilt or building a non-link-anchored popover. A `Common recipes` block under Commands shows the four tasks every consumer hits in the first hour. The standalone "Wiring the edit popover's Back button" section was deleted; its contract lives in the BYO `editHyperlink` example as a brief comment. The `validate` description in the Options table was corrected (it gates every write boundary, not just autolinks); a new `validate` vs `isAllowedUri` subsection explains the signature-only difference. The `1.x → 2.0` migration callout demoted from an `[!IMPORTANT]` block at the top to a one-line link inside Install.
- `CONTRIBUTING.md` added at the package root. The `## Testing` section (run commands, playground query-string flags, the 10-spec Cypress matrix) moved out of the README and into the contributor doc; the README links to it from a single-paragraph `## Contributing` section.

### Internal

- **Bundle size**: ESM `dist/index.js` 28.40 KB, CJS 29.23 KB, DTS 12.69 KB. Public surface grew (canon options + commands, `SpecialUrlType` 43-member literal union, `auxclick` handler, widened blocklist, navigation-safety helpers); JSDoc trim kept the DTS lean despite that growth — intentional trade-off for compile-time typo-protection.
- **`HyperlinkAttributes<Extra>` is generic.** The default — `HyperlinkAttributes` — is fully back-compatible with `1.x` (built-in keys plus an open-ended `Record<string, unknown>` index signature). Consumers that store additional typed mark attributes can now express that without losing the index signature: `HyperlinkAttributes<{ ariaLabel: string; campaign?: string }>`.
- **`LinkContext` cached per editor.** The dependency bag (URL Decisions pipeline + composed `isAllowedUri` gate + canon options) is built once on extension `onCreate` and stored via `addStorage`, so `addCommands` / `addInputRules` / `addPasteRules` / `addProseMirrorPlugins` share a single allocation instead of re-building the pipeline on every hook.
- **Three command-family files collapsed into `commands/families.ts`.** The previous `canonical.ts` / `edit.ts` / `ui.ts` split was one tight module pretending to be three; consolidating reduces import noise and keeps related families discoverable side-by-side.
- **`buildPreviewOptionsFromAnchor` extracted as a shared opener helper.** The prebuilt edit popover's Back button and BYO `editHyperlink` factories now share a single code path for recovering `PreviewHyperlinkOptions` from a live anchor, eliminating the duplicate `posAtDOM → mark.attrs` lookup that previously lived inline in two places.
- **Edit popover surfaces gate rejections inline.** When `editHyperlink({ newURL })` returns `false` (URL fails the composed XSS / `isAllowedUri` gate), the prebuilt edit popover now keeps the form open and shows an error against the href input instead of silently closing.
- **Pre-`2.0` history archived to [`docs/HISTORY.md`](./docs/HISTORY.md).** Keeps the active changelog proportional while preserving the `1.x` notes and the internal milestone log for anyone tracing a commit hash back to a documented release phase.
- **`logger` helper** at `src/utils/logger.ts` standardizes `[extension-hyperlink]`-prefixed `console.warn` / `console.error` calls. `tsup` strips `console.log` / `console.debug` in production builds but preserves `warn` / `error` (see Changed) — the typed wrapper makes the policy explicit and gives library users a single string to grep when triaging issues. All in-package call sites (`editHyperlink`, `copyToClipboard`, `createHyperlinkPopover`, `previewHyperlinkPopover`, `validateURL`) migrated.
- **Public popover types reach the barrel.** `EditHyperlinkOptions` (the consolidated v2 name) is re-exported from `src/popovers/index.ts`, so `import { EditHyperlinkOptions } from '@docs.plus/extension-hyperlink'` resolves — previously the v1 `EditHyperlinkModalOptions` symbol was referenced in the README but unreachable from the package root.
- **Playground accepts policy flags via query string** (`?shouldAutoLink=block`, `?clickSelection=on`, `?exitable=on`) so the dedicated specs (`canon-options`, `autolink`'s `shouldAutoLink` veto block) exercise opt-in behaviors without forking the playground bootstrap.
- `tsconfig.json` excludes `src/**/__tests__/**` and `src/**/*.test.ts` from the build so unit tests don't leak into `dist/`. `bun-types` added as a dev dep so test files typecheck against `bun:test` without polluting the build.
- `utils/index.ts` doc comment documents the explicit-named-export contract and lists every module-internal helper that intentionally does not leak through the public barrel.
- `AGENTS.md` updated with the new `SpecialUrlType` contract, the naming convention (lowercase single-word brands, kebab-case for multi-word, brand spelling over URL-scheme abbreviation), the consumer `Partial<Record<SpecialUrlType, IconRenderer>>` pattern, and the `floating-popover/createPopover.ts` invariant that virtual references must use a live `getBoundingClientRect` callback — never a snapshotted rect.

---

## Migrating from `1.x` to `2.0`

If you are upgrading from `^1.5.2` directly to `2.0`, the API has been substantially redesigned. The script below handles every mechanical rename; the semantic changes are listed separately because they require code review.

### One-shot rename script

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

### Code diff

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
+openEditHyperlink(editor, { editor, link, validate })
+openPreviewHyperlink(editor, { editor, link, attrs, validate })
+getDefaultController().close()
+getDefaultController().reposition(myAnchor)

 // Custom popover primitive
-import { createFloatingToolbar } from '@docs.plus/extension-hyperlink'
-createFloatingToolbar({ editor, content, surface: 'preview', referenceElement })
+import { createPopover } from '@docs.plus/extension-hyperlink'
+createPopover({ editor, content, referenceElement })  // surface tag set by controller.adopt()
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

### Default stylesheet

If you used the prebuilt popovers in `1.x`, their CSS was inlined by the bundle. In `2.0` it ships separately — add this once at app bootstrap:

```ts
import '@docs.plus/extension-hyperlink/styles.css'
```

Skip the import if you fully restyle the popovers in your own CSS — the JavaScript never loads it, so you pay zero cost.

### Consumer icon mapping

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

`Partial<Record<SpecialUrlType, …>>` gives you autocomplete and typo-protection against the extension's catalog without forcing exhaustiveness — domain-only types like `'meet'` can be intentionally omitted because the favicon path always wins for `https://` URLs.

### Stricter URL validation

Audit any fixtures or seeded content that relied on the previous behavior:

- `javascript:`, `data:`, and `vbscript:` URLs are now rejected at load, paste, input rule, click, and popover open. If you stored such URLs intentionally, they will be dropped.
- `validateURL` now requires a plausible host (TLD dot, `localhost`, or IP literal) for web-scheme URLs. Typos like `https://googlecom` no longer autolink.
- `localhost:3000` and `mydomain.com:8080` are now treated as host:port and canonicalized to `https://localhost:3000` / `https://mydomain.com:8080`, not left as the scheme `localhost:` / `mydomain.com:`.

### Need help?

Open an issue at <https://github.com/docs-plus/docs.plus/issues> with the labels `extension-hyperlink` + `migration` and a snippet of the `1.x` config you're upgrading from.

---

## Pre-`2.0` history

The full `1.x` release notes plus the internal milestones between `1.5.2` and `2.0.0` (monorepo migration, build rewrite, popover + XSS overhaul, contract tightening, the unpublished `4.3.0` pre-release) live in [`docs/HISTORY.md`](./docs/HISTORY.md). Everything user-facing from that stretch is rolled up into the [2.0.0](#200--2026-04-21) entry above.
