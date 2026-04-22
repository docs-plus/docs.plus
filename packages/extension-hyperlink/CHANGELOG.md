<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/extension-hyperlink` are documented here.

The extension's major version tracks the docs.plus product line. `1.x` corresponds to the 2023 product; `2.x` corresponds to docs.plus **alpha v2**, the first major release after approximately three years of iteration in the monorepo. Versioning follows [Semantic Versioning](https://semver.org/) and commits follow [Conventional Commits](https://conventionalcommits.org/). Section headings (`Added` / `Changed` / `Fixed` / `Security` / `Removed`) repeat per version, per the [Keep a Changelog](https://keepachangelog.com/) convention.

---

## [2.1.0] — 2026-04-21

Post-`2.0.0` hardening pass. No public-API breakage: every change widens an existing safety net or closes a parity gap with `@tiptap/extension-link` v3. Minor (not patch) bump because the public barrel grew: `SAFE_WINDOW_FEATURES` and `EditHyperlinkPopoverOptions` are new re-exports from the package root — per the project's semver policy any new symbol on the barrel is a minor.

### Security

- **Widened dangerous-scheme blocklist.** `DANGEROUS_SCHEME_RE` now also rejects `file:` and `blob:` URIs at every entry point (`parseHTML`, input rule, paste handler, paste rule, click handler, preview popover, autolink). `file:` exfiltrates local-disk paths from the host page when followed; `blob:` URLs persist scriptable HTML across the document's lifetime. Both are now uniformly refused. The exported `DANGEROUS_SCHEME_RE` and `isSafeHref` helpers reflect the new floor — BYO popovers automatically inherit the wider blocklist.
- **Defensive `isSafeHref` gate inside `validateURL`.** Belt-and-braces — even if a downstream consumer skips the regex, the `WHATWG URL`-based validator now refuses dangerous schemes before parsing. Closes the "validator-as-public-API" hole where consumers used `validateURL` directly to vet user input.
- **`renderHTML` re-validation.** The mark serializer now passes the stored `href` through `isSafeHref` and blanks the attribute if it fails. Even if a tampered document smuggles `<a href="javascript:…">` past parse — e.g. via collaborative edits, a misbehaving extension, or a downstream HTML serializer — it is never written back into the editor DOM as a live anchor.
- **`window.open` safety harness.** All read-side navigation paths (preview "Open" button, `clickHandler` read-only fallback, new middle-click `auxclick` handler) now:
  - re-check `isSafeHref(href)`,
  - run the composed `isAllowedUri` policy (mirroring write-side),
  - and pass `'noopener,noreferrer'` as the `window.open` features arg, so the new tab cannot reach back into `window.opener` or leak a Referer header. Tabnabbing surface eliminated end-to-end.
- **`isAllowedUri` threaded through the preview popover.** `PreviewHyperlinkOptions` gains an optional `isAllowedUri` field (defaulted from the click-handler plugin to the composed gate); the prebuilt preview popover's "Open" button consults it before `window.open`. Closes the last asymmetry where a tightened `isAllowedUri` policy was honored on click + middle-click but not on the popover's anchor button. BYO popovers should call the same gate for parity.

### Added

- **Middle-click (`auxclick`) handler.** Without it, middle-click bypasses the capture-phase primary-click guard and the browser would happily open `javascript:` / `data:` / `file:` / `blob:` anchors in a new tab — a full circumvention of the security posture above. The new handler runs `isSafeHref` + `isAllowedUri`, then opens with `noopener,noreferrer`. Right-click (`button === 2`) is left untouched so the native context menu still works.
- **`shouldAutoLink` honored by paste handler plugin.** Previously only the `markPasteRule` and `autolinkPlugin` consulted the per-URI veto, leaving the smart-paste path (paste a URL with a non-empty selection) as a hole. The plugin now respects the same hook for full parity with `@tiptap/extension-link` v3 and with the rest of the package's autolink policy surface.
- **Internal `logger` helper.** New `src/utils/logger.ts` standardizes `[extension-hyperlink]` prefixed `console.warn` / `console.error` calls. Bundlers strip `console.log`/`debug` in production builds but keep `warn`/`error` — using a typed wrapper makes the lifecycle explicit and the prefix gives library users a single string to grep when triaging issues. All in-package call sites (`editHyperlink`, `copyToClipboard`, `createHyperlinkPopover`, `previewHyperlinkPopover`, `validateURL`) migrated.

### Changed

- **Autolink boundary detection now Unicode-aware.** Word splitting uses `/\s+/` (not just `' '`), so links followed by a tab, NBSP, em-space, ideographic space, or any other Unicode whitespace are recognized as link boundaries. Fixes silent autolink misses in CJK / European-typography content.
- **Autolink skips `code` marks.** A URL typed inside an inline `code` mark is content, not a navigation target — it must round-trip verbatim. The autolink plugin now consults `state.schema.marks.code` and refuses to apply a hyperlink mark inside any range that already carries the `code` mark. Mirrors `@tiptap/extension-link` v3 canon and matches user expectation in technical documents.
- **`setHyperlink` / `unsetHyperlink` / `toggleHyperlink` are now strictly composable.** The shared body operates on the parent transaction via `commands.setMark` (which shares `tr` across the chain) instead of dispatching a nested `chain().run()`. `editor.chain().extendMarkRange('hyperlink').setHyperlink({ href }).run()` now lands as a single transaction — same fix that landed for `editHyperlinkCommand` in v2.0.0 ("Applying a mismatched transaction"). No behavior change for the common single-command call site.

### Fixed

- **`README` accuracy pass.** `HTMLAttributes` no longer documents `target` / `image` (those keys are stripped on render); the BYO `setHyperlink` example uses `editor.chain().setHyperlink({ href }).run()` (was `setMark`); the URL-handling section names `normalizeHref` (the actual export) instead of `normalizeLinkifyHref` (internal); the Security section reflects the widened blocklist, the `renderHTML` re-validation, and the `noopener,noreferrer` features arg.

### Tests

- **Bun unit suite** extended with coverage for `file:` and `blob:` schemes across `validateURL`, `DANGEROUS_SCHEME_RE`, and `isSafeHref`.
- **Cypress E2E** gains:
  - `nav-guards.cy.ts` — middle-click navigation safety (safe-href passthrough with `noopener,noreferrer`, `javascript:` / `file:` / `blob:` refusal, right-click left untouched).
  - `xss-guards.cy.ts` — wider dangerous-scheme regex assertion plus a new `renderHTML` re-validation block that injects a tampered mark via raw transaction and asserts the serialized anchor's `href` is blanked.
  - `autolink.cy.ts` — pins the `code`-mark autolink skip, and a new `shouldAutoLink` veto block that exercises the policy hook across all three autolink surfaces (autolink plugin, paste handler, paste rule) — closes the regression hole where the paste handler bypassed `shouldAutoLink`.
  - `canon-options.cy.ts` (new) — pins `enableClickSelection: true` (click-to-select-mark-range) and `exitable: true` (ArrowRight at the right edge clears the storedMark).

### Internal

- **Playground accepts policy/option flags via query string** (`?shouldAutoLink=block`, `?clickSelection=on`, `?exitable=on`) so the dedicated specs can exercise opt-in behaviors without forking the playground bootstrap.
- **Public popover types are now actually exported.** `EditHyperlinkPopoverOptions` / `EditHyperlinkModalOptions` (the deprecated alias) are re-exported from `src/popovers/index.ts` so they reach the public barrel — they were referenced in TypeScript section of the README but unreachable via `import { EditHyperlinkPopoverOptions } from '@docs.plus/extension-hyperlink'`.
- **Webapp `navigateHref` guards relative hrefs.** `isSafeHref` accepts scheme-less hrefs by design (relative paths / fragments) but `new URL(href)` would throw on them; wrap the parse in a `try/catch` and fall through to the new-tab open path so legacy / external-authoring hrefs don't crash navigation.

---

## [2.0.0] — 2026-04-20

**First major release since `1.5.2`.** This entry rolls up every user-facing change made while docs.plus was iterating toward alpha v2. Treat the upgrade as effectively a rewrite of the public surface — the option names, popover contract, CSS selectors, validation rules, URL canonicalization, and type exports are all new. The bones (Tiptap extension that marks hyperlinks, autolinks on whitespace, opens a popover on click) are the same.

A complete migration guide from `1.5.2` is at the end of this entry, including a one-shot rename script for the mechanical changes and code diffs for the semantic ones.

### Highlights

- **New popover architecture** built on `@floating-ui/dom` — preview / create / edit popovers ship as small DOM-returning factory functions, the extension owns positioning, and the toolbar stays stuck to its anchor on scroll (no more drift).
- **Unified write-boundary URL canonicalization** — one `normalizeHref` used by the create popover, edit popover, `setHyperlink` command, markdown input rule, autolink plugin, paste handler, and paste rule. Bare phones become `tel:+CCNSN`, bare emails become `mailto:…`, bare domains become `https://…`, and user-typed schemes pass through untouched. The same input produces the same stored `href` no matter how it entered the editor.
- **50+ special URL scheme catalog** (`whatsapp://`, `tg://`, `vscode://`, `slack://`, `zoom://`, `figma://`, `spotify:`, and friends) exposed as a brand-neutral `SpecialUrlType` union plus a `getSpecialUrlInfo(href)` classifier. Consumers map types to their own icon set — the extension ships zero icon catalog.
- **Defense-in-depth XSS guards** — `javascript:`, `data:`, and `vbscript:` are rejected at every entry point: `parseHTML`, paste handler, input rule, click handler, and popover open. The regex is exported as `DANGEROUS_SCHEME_RE` so BYO popovers can apply the same check.
- **Default stylesheet ships separately** (`import '@docs.plus/extension-hyperlink/styles.css'`) and is fully themeable via `--hl-*` CSS custom properties with `light-dark()` support. Fully-custom UIs pay zero CSS cost.
- **Bun-native unit suite + clean-room Cypress E2E** — 215 unit tests (`bun test src`, ~80 ms) plus ~112 E2E tests that exercise the **built `dist/` loaded via the published `exports` map**, i.e. exactly what an npm consumer installs.
- **`@tiptap/extension-link` canon parity** — `setHyperlink` is a pure command (writes the mark only); the side-effecting popover lives behind a dedicated `openCreateHyperlinkPopover` command so chains stay transactional. New `toggleHyperlink` plus migration aliases `setLink` / `unsetLink` / `toggleLink`. New options `defaultProtocol`, `isAllowedUri`, `shouldAutoLink`, `enableClickSelection`, `exitable` mirror the upstream Link-extension surface so existing policies port over without rewrites.

### Breaking Changes (from `1.5.2`)

Grouped by migration friction. The mechanical renames at the top have a [one-shot script](#one-shot-rename-script) below; the semantic changes require code review.

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

- `createHyperlink` (and the preview / edit callbacks) now return **`HTMLElement | null`** instead of `void`. The extension owns positioning via its floating-toolbar module; the consumer owns content only. `null` keeps the extension from opening a toolbar when the callback decides the popover shouldn't render.
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
- **Three floating-toolbar helpers removed** — they bypassed the singleton-replacement contract and had no in-repo callers:
  - `getCurrentToolbar()`, `isToolbarVisible()`, `destroyCurrentToolbar()`. Use `hideCurrentToolbar()` for dismissal and `updateCurrentToolbarPosition(ref, coords)` for repositioning; disposal is handled implicitly when the next `createFloatingToolbar` call lands.
- **`EditHyperlinkModalOptions`** no longer declares `linkCoords` and `view`. The prebuilt edit popover derives its reference from the live `<a>` DOM node; those fields were never read. Affects direct importers of the prebuilt edit popover only — BYO factory authors are unaffected (the public `PreviewHyperlinkOptions` still carries both).

### Added

**Public types.**

- `PreviewHyperlinkOptions`, `CreateHyperlinkOptions`, `EditHyperlinkModalOptions` — no more hand-rolled popover option types.
- `SpecialUrlType` — string-literal union of every recognized special-URL type. Type-only, zero runtime cost. Declare your icon table as `Partial<Record<SpecialUrlType, IconRenderer>>` and TypeScript catches typos and catalog renames at compile time.
- `LinkifyMatchLike` — for consumers building BYO popovers that interact with `linkifyjs` matches directly.
- `FloatingToolbarInstance`, `FloatingToolbarOptions` — explicit type exports for the floating-toolbar module.

**Popover + floating-toolbar module.**

- New `helpers/floatingToolbar.ts` module (~270 LOC, functional) replacing an over-engineered 800-LOC `FloatingToolbarManager` class. Exposes `createFloatingToolbar`, `hideCurrentToolbar`, `updateCurrentToolbarPosition`, and the `FloatingToolbarInstance` type.
- `updateReference()` on the instance — reposition the toolbar after async updates (e.g. metadata fetch) without tearing the popover down. Re-subscribes `autoUpdate` to the new reference's overflow ancestors so scroll listeners stay live across reference swaps.
- `hide` middleware from `@floating-ui/dom` — toolbar auto-hides when the reference scrolls out of view.
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
- `shouldAutoLink?: (uri) => boolean` — per-link veto inside the autolink plugin and paste rules. Lets hosts block app-wide categories (e.g. internal mention syntax) without losing paste-as-link UX for everything else.
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

- Bun-native unit suite at `src/utils/__tests__/` — 199 tests across `normalizeHref`, `phone`, `specialUrls`, `validateURL`. Runs via `bun test src` (~80 ms). New scripts: `bun run test:unit`, `bun run test:unit:watch`.
- Clean-room Cypress specs in `cypress/e2e/`: `create`, `preview-edit`, `autolink`, `special-schemes`, `xss-guards`, `styling`, `custom-popover`, `scroll-stickiness`. Exercise the built `dist/` loaded via the published `exports` map — i.e. the install-time surface. Run with `bun run test:e2e`.
- Bun-native playground at `test/playground/server.ts` (~15 LOC): `Bun.serve({ routes: { '/': index } })` with an HTML import bundles the playground's TypeScript + CSS on demand. No bundler config, no dedupe knobs, one less dev dependency than the previous Vite setup.
- Root `test` script composes all three: unit → build → e2e.

### Changed

- **Floating-toolbar internals rewritten.** 800-LOC singleton class (`FloatingToolbarManager`) replaced with a lean functional module. Strategy switched from `position: absolute` to `strategy: 'fixed'` for body-appended elements, eliminating scroll lag under transformed ancestors.
- **`createHyperlinkPopover` simplified** — no longer manages its own floating toolbar. Returns DOM content only; positioning lives in the floating-toolbar module.
- **Popover scroll-stickiness** — the edit popover uses the live `<a>` DOM node as `referenceElement` (the browser recomputes its rect on every call). The create popover passes a closure that recomputes coords from captured ProseMirror `from`/`to` positions on every reposition, instead of the v1-era snapshot-at-open approach that caused the popover to drift while the page scrolled.
- **`editHyperlink` command** is a composable Tiptap command (`editHyperlinkCommand`) that reads positions + marks off `tr.doc` inside the caller's single transaction. The previous helper dispatched its own nested `editor.chain()…run()` and collided with the outer `.extendMarkRange(...).editHyperlink(...).run()` in the popover ("mismatched transaction" error).
- **Mark name is no longer hardcoded.** The `editHyperlink` helper and the edit popover accept a `markName` parameter (default `'hyperlink'`) instead of hardcoding `state.schema.marks.hyperlink` and `.extendMarkRange('hyperlink')`. All callers pass `this.name`.
- **Production build preserves `console.warn` / `console.error`** — `tsup` now uses `pure: ['console.log', 'console.debug']` instead of `drop: ['console']`. Library errors are visible in production.
- **Reference type**: `any` → `ReferenceElement | VirtualElement` for floating-toolbar references.
- **`TOOLBAR_OFFSET`** in `clickHandler.ts` deduplicated; callers use the shared `DEFAULT_OFFSET` from `floatingToolbar.ts`.
- **Plugin factories and keys** renamed camelCase: `autolinkPlugin`, `clickHandlerPlugin`, `pasteHandlerPlugin`; plugin-key strings `hyperlinkAutolink`, `hyperlinkClickHandler`, `hyperlinkPasteHandler`.
- **File renames** to match casing: `copy2Clipboard.ts` → `copyToClipboard.ts`, `floating-toolbar.ts` → `floatingToolbar.ts`, `autoHyperlink.ts` → `autolink.ts`.
- **`setHyperlink` is now a pure command.** The historic no-args overload that opened the create popover is split out into `openCreateHyperlinkPopover()` per Tiptap canon (commands stay pure; UI is its own command). The Mod-k shortcut rebinds automatically; programmatic callers that relied on `editor.commands.setHyperlink()` opening the popover must migrate to `editor.commands.openCreateHyperlinkPopover()`. With an `href` (`setHyperlink({ href })`), behaviour is unchanged.
- **`Hyperlink` mark `image` attribute is no longer rendered to the DOM** (`rendered: false`). `<a>` has no standard `image` attribute, so the previous behaviour produced invalid HTML and polluted downstream sanitizers. The mark still carries the value for the preview popover (favicon / OG image); only the DOM serialization changed.
- **Popover-internal write paths now route through `setHyperlink`.** The prebuilt `createHyperlink` popover used to call `editor.chain().setMark(...).setMeta(...).run()` directly; it now delegates to `editor.chain().setHyperlink({ href }).run()` so the composed XSS + `isAllowedUri` gate runs unconditionally. The popover surfaces a "Please enter a valid URL" error if the gate rejects.
- **Symbol renames for naming consistency** (`getUrlScheme` → `getURLScheme` to match the SCREAMING-acronym policy used by `validateURL` / `DANGEROUS_SCHEME_RE`; internal `isValidSpecialScheme` → `isRecognizedSpecialScheme`; `EditHyperlinkModalOptions` → `EditHyperlinkPopoverOptions` with a `@deprecated` alias kept for one major; internal `showPopover` → `openHyperlinkToolbar`; autolink internals `TRAILING_PUNCT_RE` / `stripTrailingPunct` → `TRAILING_PUNCTUATION_RE` / `stripTrailingPunctuation`).
- **All cross-module string literals replaced by `src/constants.ts`** — `HYPERLINK_MARK_NAME` (`'hyperlink'`) and `PREVENT_AUTOLINK_META` (`'preventAutolink'`) are imported by every site that previously had the magic string inline. Internal-only — neither is re-exported from the public barrel.
- **`autolinkPlugin` `findLinks` core extracted to `utils/findLinks.ts`** for unit testing without spinning up a ProseMirror editor. The plugin's `appendTransaction` body shrinks; matcher behaviour is now pinned by an additional 12 unit tests covering URLs, emails, special schemes, phones, and trailing-punctuation stripping.

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
- Edit-popover back button — replaced the fragile `setTimeout(() => link.click(), 1)` with an explicit `onBack` callback that recreates the preview toolbar without simulating DOM clicks.
- Silent error swallowing — the `editHyperlink` helper logs a `console.warn` on `catch` instead of returning `false` without signal.

**Platform + environment.**

- `linkifyjs` global `reset()` call removed from `onDestroy`. The previous behavior cleared the global linkify protocol registry and broke other editors on the same page. Registered protocols are now additive for the page lifetime.
- Stale `view` capture — the click handler passes `view` directly from `handleDOMEvents` instead of capturing it at plugin creation time.
- `autoUpdate` subscription + listener leaks — proper cleanup on `hide()` and `destroy()`.

### Security

- **Blocked dangerous URL schemes at every entry point.** `javascript:`, `data:`, `vbscript:`. The previous check was inconsistent — `parseHTML` allowed only `javascript:` via a CSS selector (`a[href]:not([href^="javascript:"])`), the input rule allowed everything, the click handler allowed everything, and the preview popover opened whatever the mark said. Collaborative editing plus `setContent` on untrusted HTML made this a stored XSS vector. Now: a callback-based `getAttrs` in `parseHTML` runs the full `DANGEROUS_SCHEME_RE` check, and the same regex is applied in the input rule, paste handler, click handler, and preview popover. `DANGEROUS_SCHEME_RE` is exported from the package root so BYO popovers can apply the same invariant.

### Removed

- `SpecialUrlIcon` typed union and the `SpecialUrlInfo.icon?: SpecialUrlIcon` optional field. See Breaking Changes and [icon-mapping migration](#consumer-icon-mapping).
- `isSpecialSchemeUrl(url)` from the public utility surface. Use `getSpecialUrlInfo(url) != null`.
- Floating-toolbar helpers: `getCurrentToolbar`, `isToolbarVisible`, `destroyCurrentToolbar`.
- Per-platform brand icons (`FaWhatsapp`, `SiZoom`, etc.) — never in the published bundle; the brand-neutral `getSpecialUrlInfo` contract makes this explicit.
- `linkCoords` and `view` from `EditHyperlinkModalOptions` (never read by the prebuilt popover).
- Internal `Logger`, `HTMLSanitizer`, and `CleanupTracker` classes — replaced by simpler direct implementations.
- Redundant default export from `specialUrls.ts`; empty `types.ts`.

### Documentation

- README quick-start for the prebuilt popovers, plus two runnable vanilla-JS DOM examples (under `<details>`) showing how to build a custom `previewHyperlink` / `createHyperlink` from scratch — wired to the current `PreviewHyperlinkOptions` / `CreateHyperlinkOptions` shapes.
- README badge row reorganized: docs.plus product badge (auto-switching dark / light variant), npm version, monthly downloads, MIT license, and a Discord community badge.
- Community section added above License with a Discord invite for questions and help.
- Badge SVGs moved to their canonical home at `packages/webapp/public/badges/` (also served from `https://docs.plus/badges/...`); the README's `<picture>` source URLs updated to match.

### Internal

- **Bundle size**: ESM `dist/index.js` 25.78 KB, CJS 26.54 KB, DTS 14.91 KB. The DTS grew slightly versus late-cycle drafts because the `SpecialUrlType` literal union surfaces 43 string members in the public types and the new canon options + commands add to the declared command surface — intentional trade-off for compile-time typo-protection.
- `tsconfig.json` excludes `src/**/__tests__/**` and `src/**/*.test.ts` from the build so unit tests don't leak into `dist/`. `bun-types` added as a dev dep so test files typecheck against `bun:test` without polluting the build.
- `utils/index.ts` doc comment documents the explicit-named-export contract and lists every module-internal helper that intentionally does not leak through the public barrel.
- `AGENTS.md` updated with the new `SpecialUrlType` contract, the naming convention (lowercase single-word brands, kebab-case for multi-word, brand spelling over URL-scheme abbreviation), the consumer `Partial<Record<SpecialUrlType, IconRenderer>>` pattern, and the `floatingToolbar.ts` invariant that virtual references must use a live `getBoundingClientRect` callback — never a snapshotted rect.

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
+import type { PreviewHyperlinkOptions, CreateHyperlinkOptions } from '@docs.plus/extension-hyperlink'
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

## Pre-`2.0` development history

Between `1.5.2` and `2.0.0` the package went through several internal major revisions inside the `docs.plus` monorepo. None were promoted to the `@latest` npm dist-tag; everything user-facing from this stretch is rolled up into the [2.0.0](#200--2026-04-20) entry above. The milestones are recorded here for anyone tracing a commit hash back to a documented release phase:

- **Monorepo migration** _(late 2023 – early 2024)_ — moved from a standalone repository into `docs.plus/packages/extension-hyperlink`; adopted `catalog:` dependency pins.
- **Build rewrite** _(2024)_ — migrated to `tsup` (ESM + CJS + DTS dual emit); introduced the 50+ special URL scheme catalog; added markdown link input rules (`[text](url)`) and image-syntax protection for autolink.
- **Popover + XSS overhaul** _(April 2026)_ — replaced the ~800 LOC `FloatingToolbarManager` class with a lean functional module; hardened every entry point against `javascript:` / `data:` / `vbscript:`; unified write-boundary canonicalization; shipped the default stylesheet as a separate import; stood up the clean-room Cypress harness.
- **Contract tightening** _(April 2026)_ — brand-neutral `SpecialUrlType`; bare phone / email / host:port canonicalization; `export *` eliminated from the public barrel; popover scroll-stickiness fix; Bun-native unit test suite.

A single pre-release, `4.3.0`, was briefly published to the `@next` dist-tag during the April 2026 contract-tightening phase and then unpublished ahead of the `2.0.0` alignment release. If you installed from `@next` during that window, upgrade directly to `2.0.0`.

---

## [1.3.7] — 2023-07-26

Version bump only.

## [1.3.6] — 2023-07-26

Version bump only.

## [1.3.5] — 2023-07-26

Version bump only.

## [1.3.4] — 2023-07-25

### Fixed

- Hide popover on outside click.
- Prevent popover from displaying in the wrong position.
- Fix typo.

## [1.3.3] — 2023-07-23

Version bump only.

## [1.3.2] — 2023-07-21

### Fixed

- Fix interfaces and types.
- Fix replacing hyperlink with new text.
- Fix selecting closest anchor element.
- Fix wrong selection of the anchor node.

## [1.3.1] — 2023-07-20

### Fixed

- Fix interfaces and types.
- Fix replacing hyperlink with new text.
- Fix selecting closest anchor element.
- Fix wrong selection of the anchor node.

## [1.3.0] — 2023-07-20

### Fixed

- Fix interfaces and types.
- Fix replacing hyperlink with new text.
- Fix selecting closest anchor element.

## [1.2.1] — 2023-07-19

### Fixed

- Fix interfaces and types.

## [1.2.0] — 2023-07-19

Version bump only.

## [1.1.0] — 2023-07-18

Version bump only.

## [1.0.4] — 2023-07-17

Version bump only.
