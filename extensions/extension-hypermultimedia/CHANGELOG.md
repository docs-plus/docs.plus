# Change Log

All notable changes to this project are documented here. Entries from 2.0.0
onward follow [Keep a Changelog](https://keepachangelog.com); earlier entries
use the historical Conventional Commits format.

## [Unreleased]

The media toolbar is rebuilt around a declarative action registry and moves into
the node's top-right corner; every media node gains an editable caption.

### Changed

- **Breaking:** the toolbar moved from a `bottom-start` floating popover (placement
  buttons + margin select) to an in-chrome top-right overlay driven by a declarative
  action registry. Common actions render inline; copy, delete, and node extras (X
  size/theme) moved behind a `…` overflow menu.
- **Breaking:** the toolbar stylesheet is renamed `media-toolbar-popover.css` →
  `media-toolbar.css`. Update imports, including the webapp `globals.scss` `@import`.
- Toolbar icons are unified on the Google Material Symbols (outlined) set, matching
  `@docs.plus/extension-hyperlink`. Alignment now uses Google-Docs-style glyphs:
  align-left (inline), align-center (center), image-left (float left), image-right
  (float right).
- Action `id`s are kebab-cased and matched to their labels: `alignment` → `align`,
  `viewOriginal` → `view-original`, `copyNode` → `copy` (`caption`, `download`,
  `delete`, `x-options` unchanged). Hosts targeting `data-action-id` must update.
- Alignment option labels follow the wrap vocabulary: `Inline` → `Left`,
  `Float left/right` → `Wrap left/right` (`Center` unchanged).

### Added

- `caption` attribute and an editable `<figcaption>` on every media node. The
  attribute is the source of truth and persists via collaboration, JSON, and
  same-editor copy/paste; standalone-HTML `<figure>/<figcaption>` round-trip is
  `image`-only by design.
- Base actions: View original, Download (image/video/audio), Copy, Delete.
- `mediaActions` and `isUploadedMedia` kit options; exported `MediaAction` types,
  `resolveMediaActions`, and the action handlers (`viewOriginalMedia`,
  `downloadMedia`, `copyMediaNode`, `removeMediaNode`, `canViewOriginal`,
  `isDownloadable`). `BASE_ACTIONS`/`NODE_ACTIONS` stay internal.

### Fixed

- Backspace/Delete while editing a caption now edits the caption text instead of
  deleting the whole media node. The document-level delete-on-hover handler bails
  when focus is inside the `figcaption`.
- Caption text is trimmed on commit, matching the mobile sheet; a whitespace-only
  caption clears to `null`.
- A visible caption no longer overflows onto the paragraph below the media. The
  node-view wrapper drops its redundant fixed `height` (the loading shell and media
  surface still carry the pixel size), so it grows to contain the caption.

### Removed

- `utils/media-toolbar.ts` internals and `nodes/x/xToolbar.ts`, folded into the
  action registry.

### Internal

- `Logger` still preserves `console.warn`/`console.error` under the shared tsup
  pure policy.

## [2.0.0] — 2026-06-01

First major release on the docs.plus alpha-v2 line. tippy.js is fully retired in
favor of `@docs.plus/floating-popover`, node type names are normalized to
camelCase, the Twitter node is rebranded to X, and a Loom node is added.

### Highlights

- **Floating UI engine.** Every media toolbar now renders through the shared
  `@docs.plus/floating-popover` (`@floating-ui/dom`) — tippy.js is gone.
- **camelCase node names** and an **X (formerly Twitter)** node following x.com
  conventions.
- **Loom** embeds (`loom.com/share` + `/embed`).
- **One configuration entry** — markdown image support lives on the node, so a
  single `HyperMultimediaKit.configure({ Image, … })` is all a host needs.
- **Host-agnostic toolbar** — desktop floating toolbar or a mobile bottom-sheet
  via the `mediaToolbar` factory slot.

### Breaking Changes

- Node type names are camelCase: `Image→image`, `Video→video`, `Audio→audio`,
  `Youtube→youtube`, `Vimeo→vimeo`, `SoundCloud→soundcloud`, `Twitter→x`. Stored
  documents need the migration below.
- `Twitter`/`setTwitter`/`TwitterOptions` → `X`/`setX`/`XOptions`.
- Removed the tippy modal API: `createFloatingToolbar`, `hideCurrentToolbar`, the
  `*Modal` exports (`imageModal`/`youtubeModal`/`twitterModal` + aliases), and
  the `modal` node option.
- `tippy.js` removed as a dependency; `@docs.plus/floating-popover` is a runtime
  peer resolved by the host (externalized in the tsup build; not bundled into
  `dist/`).

### Added

- Built-in **loading shell** for images, video/audio, iframe embeds, and X (`loadingShell` kit option; `dist/media-loading-shell.css`).
- `Loom` node + kit option.
- `isMediaUrl(url)` export for host paste-precedence
  (`Hyperlink.configure({ shouldAutoLink: (url) => !isMediaUrl(url) })`).
- Host-agnostic `mediaToolbar` kit option + exported `createMediaToolbar`.
- Shared `utils/media-placement.ts` for desktop toolbar and mobile sheet
  placement/margin presets (`getMediaPlacementAttrs`, `getCurrentMediaPlacement`).
- Clean-room Cypress E2E suite + Bun playground.

### Fixed

- Loading shell `destroy()` detaches media `load`/`error` listeners; `markReady`/`markError` detach too. Error state keeps the overlay visible (ready-only hides it). `bindLoad: { element }` replaces paired `bindElement`/`isAlreadyReady`.
- X embed: `mountXEmbed` reports failure; `loadXScript` times out and aborts when the node view is destroyed.
- X loading shell tracks widget layout (`ResizeObserver`) and switches to fluid height after render so tall posts are not clipped.
- Media toolbar hover bridge: deferred hide + expanded popover hit area so the pointer can reach the portaled toolbar without dismissal.
- Resize gripper uses `setPointerCapture` so drags stay attached over iframes, outside the editor, and at constraint limits; ends on blur/Escape/`pointercancel`.
- Loading shell dimensions stay in sync with gripper resize on iframe embeds and video; ready shells use a transparent background so gray placeholder does not show through.
- Iframe embed resize writes pixel `style` width/height on the `<iframe>` (not only HTML attrs) so the player fills the gripper; Cypress asserts rendered iframe height matches the node attr.
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

### Internal

- `Logger` preserves `console.warn`/`console.error` under the shared tsup factory.

### Migrating from 1.x to 2.0

- Config keys are unchanged except `Twitter` → `X`; update `setTwitter` → `setX`.
- **Stored documents**: run `bun run --filter @docs.plus/hocuspocus.server
migrate:media-node-names` (fail-closed; preview with `:dry`) to rewrite legacy
  PascalCase node types. The Hocuspocus on-load shim (`ENABLE_SCHEMA_MIGRATION`)
  covers stragglers; the webapp bumps its IndexedDB cache key so clients re-sync.
- Replace removed `createFloatingToolbar`/`*Modal` usage with the built-in
  toolbar or the `mediaToolbar` factory.

## [1.3.1](https://github.com/HMarzban/extension-hypermultimedia/compare/v1.3.0...v1.3.1) (2024-01-14)

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
