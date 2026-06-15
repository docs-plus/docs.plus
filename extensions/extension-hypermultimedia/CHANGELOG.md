# Changelog

All notable changes to `@docs.plus/extension-hypermultimedia` are documented
here. Entries from 2.0.0 onward follow
[Keep a Changelog](https://keepachangelog.com); earlier entries use the
historical Conventional Commits format.

## [2.0.0] — 2026-06-12

First major release on the docs.plus alpha-v2 line. tippy.js is fully retired in
favor of Floating UI positioning, node type names are normalized to camelCase,
the Twitter node is rebranded to X, a Loom node is added, the media toolbar is
rebuilt around a declarative action registry in the node's top-right corner, and
every media node gains an editable caption.

### Highlights

- **Floating UI engine.** Media toolbars and popovers render through
  `@docs.plus/floating-popover` (`@floating-ui/dom`) — tippy.js is gone.
- **Top-right media toolbar.** A declarative action registry drives an overlay
  inside the node: common actions inline, the rest behind a `…` overflow menu;
  hosts swap the whole surface via the `mediaToolbar` factory slot (e.g. a
  mobile bottom-sheet).
- **Editable captions** on every media node, stored in the `caption` attribute.
- **camelCase node names** and an **X (formerly Twitter)** node following x.com
  conventions.
- **Loom** embeds (`loom.com/share` + `/embed`).
- **One configuration entry** — markdown image support lives on the node, so a
  single `HyperMultimediaKit.configure({ Image, … })` covers everything.

### Breaking

- Node type names are camelCase: `Image→image`, `Video→video`, `Audio→audio`,
  `Youtube→youtube`, `Vimeo→vimeo`, `SoundCloud→soundcloud`, `Twitter→x`. Stored
  documents need the migration below.
- `Twitter`/`setTwitter`/`TwitterOptions` → `X`/`setX`/`XOptions`.
- The media toolbar moved from a floating popover (placement buttons + margin
  select) to a top-right overlay inside the node, driven by a declarative
  action registry. Common actions render inline; Replace URL, copy, delete, and
  node extras (X size/theme) live behind a `…` overflow menu; alignment options
  follow the wrap vocabulary (Left, Center, Right, Wrap left, Wrap right).
- Removed the tippy modal API: `createFloatingToolbar`, `hideCurrentToolbar`, the
  `*Modal` exports (`imageModal`/`youtubeModal`/`twitterModal` + aliases), and
  the `modal` node option.
- `tippy.js` removed as a dependency. Floating positioning comes from
  `@docs.plus/floating-popover`, a private workspace package bundled into `dist`
  at build time — nothing extra to install; `@floating-ui/dom` is the package's
  only runtime dependency.
- Removed the dead `ImageNodeOptions.toolbar` option and `ImageToolbarFunction`
  type (superseded by the kit-level `mediaToolbar`/`mediaActions`), the dead
  `transform` image attribute, and the unused exported image helper types
  (`ImageUrlValidator`, `ImageExtension`, `ImageUrlProtocol`, `ImageFloat`,
  `ImageClear`, `ImageDisplay`).

### Added

- `caption` attribute and an editable `<figcaption>` on every media node. The
  attribute is the source of truth and persists via collaboration, JSON, and
  same-editor copy/paste; standalone-HTML `<figure>/<figcaption>` round-trip is
  `image`-only by design.
- Built-in **loading shell** for images, video/audio, iframe embeds, and X
  (`loadingShell` kit option; `dist/media-loading-shell.css`).
- Base toolbar actions — inline: Align, wrap-margin presets, Caption,
  View original (↗ arrow-outward), Download (image/video/audio); overflow `…`:
  Replace URL, Copy, Delete.
- `right` placement — block-aligns a node to the right edge without text wrap
  (Align offers Left, Center, Right, Wrap left, Wrap right) and round-trips
  through `getMediaPlacementAttrs` / `getCurrentMediaPlacement` as
  `margin: 0 0 0 auto`.
- Margin control for wrap placements: choosing Wrap left/right adds a button
  beside Align showing the current gap; it opens the presets (0"–1", default
  1/2") in a floating-popover submenu, with a divider grouping the alignment
  section. Adds the optional `MediaAction.dividerAfter` flag.
- Replace URL — a URL-editor dialog popover anchored to the media node (below
  it, flipping above when space runs out) swaps the node's `src` in place,
  preserving the node identity (`keyId`), caption, size, and placement instead
  of delete-and-reinsert. Replacement is same-type only: each provider node
  validates with its own canonical URL guard (a YouTube node accepts only
  YouTube URLs, an X node normalizes to the canonical status URL), while
  image/video/audio accept any non-empty URL, mirroring their insert commands.
  The dialog content is a factory slot: the `replaceUrlPopover` kit option
  returns custom content or `null` to render a host surface instead, and
  `createReplaceUrlPopover` / `openReplaceUrlPopover` (plus their option types)
  are exported for reuse.
- `openToolbarPopover` / `closeToolbarPopover` exports — the positioned-popover
  building blocks the built-in toolbar uses, available to custom `mediaToolbar`
  surfaces. One popover at a time; outside-click and Escape dismissal built in.
- `resolveMediaNodePos` export — resolves a media wrapper element to its
  current document position, so custom toolbar actions re-resolve at action
  time instead of trusting the open-time snapshot.
- Hover controls track the node through collaborative edits: the toolbar,
  resize gripper, and Delete-key targeting follow position shifts from content
  inserted above the node.
- Toolbar accessibility: the bar carries `aria-label="Media toolbar"`, toggle
  actions and submenu items expose `aria-pressed`, Escape with focus inside the
  toolbar dismisses it and refocuses the editor, and overflow/submenu popover
  shells are intentionally role-neutral.
- Icon-only toolbar buttons show a floating tooltip on hover and focus (shared
  `role="tooltip"` bubble, 400ms delay, hidden on click so it never lingers
  over an opening menu) in place of the native `title`. The tooltip ships from
  the shared `@docs.plus/floating-tooltip` package — bundled into `dist` like
  the popover engine — with `attachTooltip` / `hideTooltip` re-exported for
  custom `mediaToolbar` surfaces, and `.floating-tooltip` joins the
  styling-contract classes.
- Micro-motion: the toolbar eases in (120ms, 2px settle), hover states fade,
  tooltips rise toward rest, and popover entrances decelerate — all
  compositor-only (`transform`/`opacity`/color) and fully zeroed under
  `prefers-reduced-motion: reduce`.
- `mediaActions` and `isUploadedMedia` kit options; exported `MediaAction` types,
  `resolveMediaActions`, and the action handlers (`viewOriginalMedia`,
  `downloadMedia`, `copyMediaNode`, `removeMediaNode`, `canViewOriginal`,
  `isDownloadable`). `BASE_ACTIONS`/`NODE_ACTIONS` stay internal.
- Host-agnostic `mediaToolbar` kit option + exported `createMediaToolbar`.
  Custom elements are stamped with a structural `data-hm-toolbar` lifecycle
  marker — reuse, dismissal, and context refresh are handled for you, no
  built-in skin class required.
- `Loom` node + kit option.
- `isMediaUrl(url)` export for host paste-precedence
  (`Hyperlink.configure({ shouldAutoLink: (url) => !isMediaUrl(url) })`).
- Shared `utils/media-placement.ts` for desktop toolbar and mobile sheet
  placement/margin presets (`getMediaPlacementAttrs`, `getCurrentMediaPlacement`).
- `./styles.css` export — `dist/styles.css` bundles `resize-gripper.css`,
  `media-loading-shell.css`, `media-node-x.css`, `media-node-loom.css`, and
  `media-toolbar.css`. Import it in one line
  (`import '@docs.plus/extension-hypermultimedia/styles.css'`) to load the shipped
  styles, matching `@docs.plus/extension-hyperlink`. The five individual files
  stay in `dist` for hosts that import them separately.
- Dark mode in the shipped stylesheet — `--hm-*` tokens use `light-dark()` and
  follow the nearest ancestor's `color-scheme`.
- `styles.css` ships the `.floating-popover` shell rules (fade/scale/arrow) so
  toolbar popovers animate standalone.
- `prefers-reduced-motion: reduce` disables the loading shimmer/spinner animation.
- Escape cancels a resize drag (snaps back, commits nothing).
- README **Gallery** — nine node types in light/dark (`assets/*-{light,dark}.png`); regenerate with `bun run docs:screenshots`.

### Changed

- Toolbar icons are unified on the Google Material Symbols (outlined) set,
  matching `@docs.plus/extension-hyperlink`; alignment uses Google-Docs-style
  glyphs (align-left, align-center, image-left, image-right).
- `closeMediaToolbar()`'s document-wide fallback only removes toolbars carrying
  `data-node-type`.
- Loom embed defaults include `scrolling: 'no'` to avoid iframe scrollbars at fixed heights.

### Fixed

- `getHTML()` and clipboard copy no longer throw once a `video`/`audio` node
  exists (leaf-node content hole removed; bogus `contentDOM` dropped).
- Resize drags commit to the node actually under the gripper — the drag-end
  position is re-resolved from the DOM (keyId-first, type-guarded); listeners and
  pointer capture release even if the commit throws; `updateNodeDimensions`
  refuses non-media positions.
- Gripper-resized `audio` no longer snaps back visually (`syncAudioNodeLayout`
  mirrors committed `width`/`height`).
- The document-level delete-on-hover handler yields to real editing: Backspace/
  Delete with a focused text caret edits text (bails on `TextSelection`), and
  while editing a caption it edits the caption text instead of deleting the
  whole media node.
- Caption text is trimmed on commit, matching the mobile sheet; a whitespace-only
  caption clears to `null`.
- A visible caption no longer overflows onto the paragraph below the media. The
  node-view wrapper drops its redundant fixed `height` (the loading shell and media
  surface still carry the pixel size), so it grows to contain the caption.
- YouTube `ccLanguage` maps to the official `cc_lang_pref` param; YouTube URL
  detection uses exact host matching.
- Pasted plain-text `data:image/...` URLs respect `allowBase64: false`.
- Invalid or hostile `blockquote.twitter-tweet` hrefs no longer create a broken
  X node; the X parse rule outranks StarterKit's blockquote rule.
- `setVideo`/`setAudio` return `false` on missing `src` (documented contract).
- Static-HTML export prefers committed `width`/`height` over kit defaults.
- The image markdown input rule requires the leading `!` (plain links no longer
  convert) and drops the global flag.
- Loading shell `destroy()` detaches media `load`/`error` listeners; `markReady`/`markError` detach too. Error state keeps the overlay visible (ready-only hides it). `bindLoad: { element }` replaces paired `bindElement`/`isAlreadyReady`.
- X embed: `mountXEmbed` reports failure; `loadXScript` times out and aborts when the node view is destroyed.
- X loading shell tracks widget layout (`ResizeObserver`) and switches to fluid height after render so tall posts are not clipped.
- X post embeds: wrapper width follows `maxwidth`; `data-x-theme` backgrounds and corner clip remove light/dark corner bleed after `widgets.js` paint.
- Media toolbar hover bridge: deferred hide + expanded popover hit area so the pointer can reach the portaled toolbar without dismissal.
- Resize gripper uses `setPointerCapture` so drags stay attached over iframes, outside the editor, and at constraint limits; drags also end on blur and `pointercancel`.
- Loading shell dimensions stay in sync with gripper resize on iframe embeds and video; ready shells use a transparent background so gray placeholder does not show through.
- Iframe embed resize writes pixel `style` width/height on the `<iframe>` (not only HTML attrs) so the player fills the gripper.
- Image node view uses subtree `ignoreMutation` (not ignore-all).
- Image insertion no longer appends a phantom empty image node (`priority: 1100`
  had made image ProseMirror's default-fill block).
- `keyId` is minted per insert (was a shared build-time default).
- `video` input-rule width/height destructuring.
- X (Twitter) oEmbed HTML is sanitized before `innerHTML`; the embed anchor reads
  the correct `src`.
- Resize gripper no longer leaks `document` keyboard listeners across rebuilds.

### Removed

- `tippy.js`; `utils/floating-toolbar.ts`, `utils/tippyHelper.ts`; dead rotation
  code.
- `utils/media-toolbar.ts` internals and `nodes/x/xToolbar.ts`, folded into the
  action registry.

### Internal

- `Logger` (`src/utils/logger.ts`) is error-only: `console.error` survives the
  shared tsup pure policy; the unused `warn`/`debug` levels were dropped.
- Clean-room Cypress E2E suite + Bun playground. The playground harness lives in
  the shared `@docs.plus/playground` package; `test/playground/` holds only
  `main.ts`. No change to the published package.

### Migrating from 1.x to 2.0

- Config keys are unchanged except `Twitter` → `X`; update `setTwitter` → `setX`.
- **Stored documents (docs.plus / Hocuspocus)**: run `bun run --filter @docs.plus/hocuspocus.server migrate:media-node-names` (fail-closed; preview with `:dry`) to rewrite legacy PascalCase node types. The on-load shim (`ENABLE_SCHEMA_MIGRATION`) covers stragglers.
- **Stored documents (external adopters)**: rewrite node `type` strings in JSON or Yjs exports — `Image`→`image`, `Video`→`video`, `Audio`→`audio`, `Youtube`→`youtube`, `Vimeo`→`vimeo`, `SoundCloud`→`soundcloud`, `Twitter`→`x`. Attr keys are unchanged except command renames (`setTwitter`→`setX`). See the [media-node-rename runbook](https://github.com/docs-plus/docs.plus/blob/main/apps/hocuspocus.server/docs/migrate-media-node-names.md) for the full mapping even if you do not run the CLI.
- Replace removed `createFloatingToolbar`/`*Modal` usage with the built-in toolbar or the `mediaToolbar` factory.
- **Recommended pairing with `@docs.plus/extension-hyperlink`** when both ship in one editor — configure `shouldAutoLink: (url) => !isMediaUrl(url)` so media URLs become nodes, not links.

## Pre-2.0 release history

The `1.x` changelog below lived on the pre-monorepo `HMarzban/extension-hypermultimedia` repository. Public versions from that era are superseded by this `2.0.0` entry. Recover the full text from git history (`extensions/extension-hypermultimedia/CHANGELOG.md` before this archive) if you need per-patch notes.

## [1.3.1] (2024-01-14) — archived

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** depricate "defaultOptions" [#1](https://github.com/HMarzban/extension-hypermultimedia/issues/1) ([89add0e](https://github.com/HMarzban/extension-hypermultimedia/commit/89add0ecbf35e18d534f9157b805292b5c80bee7))

# [1.3.0](https://github.com/HMarzban/extension-hypermultimedia/compare/v1.2.0...v1.3.0) (2023-11-14)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** naming ([5ecadef](https://github.com/HMarzban/extension-hypermultimedia/commit/5ecadef366036e122e286b7050d3397a4db81ec4))
- **@docs.plus/extension-hypermultimedia:** use default value for width and height ([5e65aee](https://github.com/HMarzban/extension-hypermultimedia/commit/5e65aee3a4669ca388e8acad5fcf2fd5f1cd4b62))

### Features

- **@docs.plus/extension-hypermultimedia:** audio and video extension support ([4de250b](https://github.com/HMarzban/extension-hypermultimedia/commit/4de250bf3b4bdfd4effaee82382b3fff32383ac2))
- **@docs.plus/extension-hypermultimedia:** support audio tag ([814a956](https://github.com/HMarzban/extension-hypermultimedia/commit/814a956025da841cd48cc73d5509c6673904dcb8))
- **@docs.plus/extension-hypermultimedia:** support video tag ([606ae44](https://github.com/HMarzban/extension-hypermultimedia/commit/606ae4499f9ed096a4f29a195a969c8205ffacc7))

# [1.3.0-alpha.1](https://github.com/HMarzban/extension-hypermultimedia/compare/v1.2.0...v1.3.0-alpha.1) (2023-11-09)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** naming ([5ecadef](https://github.com/HMarzban/extension-hypermultimedia/commit/5ecadef366036e122e286b7050d3397a4db81ec4))

### Features

- **@docs.plus/extension-hypermultimedia:** audio and video extension support ([4de250b](https://github.com/HMarzban/extension-hypermultimedia/commit/4de250bf3b4bdfd4effaee82382b3fff32383ac2))
- **@docs.plus/extension-hypermultimedia:** support audio tag ([814a956](https://github.com/HMarzban/extension-hypermultimedia/commit/814a956025da841cd48cc73d5509c6673904dcb8))
- **@docs.plus/extension-hypermultimedia:** support video tag ([606ae44](https://github.com/HMarzban/extension-hypermultimedia/commit/606ae4499f9ed096a4f29a195a969c8205ffacc7))

# [1.3.0-alpha.0](https://github.com/HMarzban/extension-hypermultimedia/compare/v1.2.0...v1.3.0-alpha.0) (2023-11-09)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** naming ([5ecadef](https://github.com/HMarzban/extension-hypermultimedia/commit/5ecadef366036e122e286b7050d3397a4db81ec4))

### Features

- **@docs.plus/extension-hypermultimedia:** audio and video extension support ([4de250b](https://github.com/HMarzban/extension-hypermultimedia/commit/4de250bf3b4bdfd4effaee82382b3fff32383ac2))
- **@docs.plus/extension-hypermultimedia:** support audio tag ([814a956](https://github.com/HMarzban/extension-hypermultimedia/commit/814a956025da841cd48cc73d5509c6673904dcb8))
- **@docs.plus/extension-hypermultimedia:** support video tag ([606ae44](https://github.com/HMarzban/extension-hypermultimedia/commit/606ae4499f9ed096a4f29a195a969c8205ffacc7))

# 1.2.0 (2023-10-31)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/HMarzban/extension-hypermultimedia/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/HMarzban/extension-hypermultimedia/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))
- **@docs.plus/extension-hypermultimedia:** make sure pick attrs from node attrs ([8e00479](https://github.com/HMarzban/extension-hypermultimedia/commit/8e004797454d8c70892f3a6c4804b50d2f9ee254))

### Features

- **@docs.plus/extension-hypermultimedia:** inline or block node level ([11dd402](https://github.com/HMarzban/extension-hypermultimedia/commit/11dd402e86ad689d6146ffd1f9d1e156919af719))

## 1.1.2-alpha.5 (2023-10-31)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/HMarzban/extension-hypermultimedia/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/HMarzban/extension-hypermultimedia/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))
- **@docs.plus/extension-hypermultimedia:** make sure pick attrs from node attrs ([8e00479](https://github.com/HMarzban/extension-hypermultimedia/commit/8e004797454d8c70892f3a6c4804b50d2f9ee254))

### Features

- **@docs.plus/extension-hypermultimedia:** inline or block node level ([11dd402](https://github.com/HMarzban/extension-hypermultimedia/commit/11dd402e86ad689d6146ffd1f9d1e156919af719))

## 1.1.2-alpha.4 (2023-10-30)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/HMarzban/extension-hypermultimedia/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/HMarzban/extension-hypermultimedia/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))
- **@docs.plus/extension-hypermultimedia:** make sure pick attrs from node attrs ([8e00479](https://github.com/HMarzban/extension-hypermultimedia/commit/8e004797454d8c70892f3a6c4804b50d2f9ee254))

### Features

- **@docs.plus/extension-hypermultimedia:** inline or block node level ([11dd402](https://github.com/HMarzban/extension-hypermultimedia/commit/11dd402e86ad689d6146ffd1f9d1e156919af719))

## 1.1.2-alpha.3 (2023-10-30)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/HMarzban/extension-hypermultimedia/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/HMarzban/extension-hypermultimedia/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))
- **@docs.plus/extension-hypermultimedia:** make sure pick attrs from node attrs ([8e00479](https://github.com/HMarzban/extension-hypermultimedia/commit/8e004797454d8c70892f3a6c4804b50d2f9ee254))

### Features

- **@docs.plus/extension-hypermultimedia:** inline or block node level ([11dd402](https://github.com/HMarzban/extension-hypermultimedia/commit/11dd402e86ad689d6146ffd1f9d1e156919af719))

## 1.1.2-alpha.2 (2023-10-30)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/docs-plus/docs.plus/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/docs-plus/docs.plus/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))
- **@docs.plus/extension-hypermultimedia:** make sure pick attrs from node attrs ([8e00479](https://github.com/docs-plus/docs.plus/commit/8e004797454d8c70892f3a6c4804b50d2f9ee254))

### Features

- **@docs.plus/extension-hypermultimedia:** inline or block node level ([11dd402](https://github.com/docs-plus/docs.plus/commit/11dd402e86ad689d6146ffd1f9d1e156919af719))

## 1.1.2-alpha.1 (2023-10-27)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/docs-plus/docs.plus/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/docs-plus/docs.plus/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))
- **@docs.plus/extension-hypermultimedia:** make sure pick attrs from node attrs ([8e00479](https://github.com/docs-plus/docs.plus/commit/8e004797454d8c70892f3a6c4804b50d2f9ee254))

### Features

- **@docs.plus/extension-hypermultimedia:** inline or block node level ([11dd402](https://github.com/docs-plus/docs.plus/commit/11dd402e86ad689d6146ffd1f9d1e156919af719))

## 1.1.2-alpha.0 (2023-10-26)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/docs-plus/docs.plus/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/docs-plus/docs.plus/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))
- **@docs.plus/extension-hypermultimedia:** make sure pick attrs from node attrs ([8e00479](https://github.com/docs-plus/docs.plus/commit/8e004797454d8c70892f3a6c4804b50d2f9ee254))

## 1.1.1-alpha.0 (2023-10-26)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/docs-plus/docs.plus/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/docs-plus/docs.plus/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))

# 1.1.0 (2023-10-26)

**Note:** Version bump only for package @docs.plus/extension-hypermultimedia
