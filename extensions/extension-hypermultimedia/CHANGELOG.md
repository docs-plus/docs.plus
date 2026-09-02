# Changelog

All notable changes to `@docs.plus/extension-hypermultimedia` are documented
here. Entries from 2.0.0 onward follow
[Keep a Changelog](https://keepachangelog.com); earlier entries use the
historical Conventional Commits format. The project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Export `isSafeMediaSrc` from the package entry. Markdown import uses it to
  refuse an unsafe URL before it mints a media node.

### Fixed

- Iframe embeds no longer set `allowfullscreen` when `allow` already includes
  `fullscreen`. Chrome treats `allow` as the winner and warned on Vimeo, Loom,
  and Spotify. YouTube still emits `allowfullscreen` because its `allow` list
  does not include fullscreen.

## [2.0.0] — 2026-08-11

First major release on the docs.plus alpha-v2 line. The kit fully retires
tippy.js and positions every surface with Floating UI. It renames node types to
camelCase, renames the Twitter node to X, and adds a Loom node. The kit rebuilds
the media toolbar around a declarative action registry, in the node's top-right
corner. Every media node gains an editable caption.

### Highlights

- **Floating UI engine.** Media toolbars and popovers render through
  `@docs.plus/floating-popover` (`@floating-ui/dom`) — tippy.js is gone.
- **Top-right media toolbar.** A declarative action registry drives an overlay
  inside the node: common actions inline, the rest behind a `…` overflow menu.
  Hosts swap the whole surface via the `mediaToolbar` factory slot (e.g. a
  mobile bottom-sheet).
- **Editable captions** on every media node, stored in the `caption` attribute.
- **camelCase node names** and an **X (formerly Twitter)** node following x.com
  conventions.
- **Loom** embeds (`loom.com/share` + `/embed`).
- **One configuration entry** — markdown image support lives on the node, so a
  single `HyperMultimediaKit.configure({ Image, … })` covers everything.

### Breaking

- **No default export.** Import the named `HyperMultimediaKit` — the former `{ HyperMultimediaKit }` wrapper default was an undocumented runtime trap and is gone.
- Node type names are camelCase: `Image→image`, `Video→video`, `Audio→audio`,
  `Youtube→youtube`, `Vimeo→vimeo`, `SoundCloud→soundcloud`, `Twitter→x`. Stored
  documents need the migration below.
- `Twitter`/`setTwitter`/`TwitterOptions` → `X`/`setX`/`XOptions`.
- The media toolbar moved from a floating popover (placement buttons + margin
  select) to a top-right overlay inside the node. A declarative action registry
  drives it. Common actions render inline. Replace URL, copy, delete, and
  node extras (X size/theme) live behind a `…` overflow menu. Alignment options
  follow the wrap vocabulary (Left, Center, Right, Wrap left, Wrap right).
- Removed the tippy modal API: `createFloatingToolbar`, `hideCurrentToolbar`, the
  `*Modal` exports (`imageModal`/`youtubeModal`/`twitterModal` + aliases), and
  the `modal` node option.
- `tippy.js` removed as a dependency. Floating positioning comes from
  `@docs.plus/floating-popover`, a private workspace package bundled into `dist`
  at build time — nothing extra to install. `@floating-ui/dom` is the package's
  only runtime dependency.
- Removed the dead `ImageNodeOptions.toolbar` option and `ImageToolbarFunction`
  type, superseded by the kit-level `mediaToolbar`/`mediaActions`. Also removed
  the dead `transform` image attribute and the unused exported image helper types
  (`ImageUrlValidator`, `ImageExtension`, `ImageUrlProtocol`, `ImageFloat`,
  `ImageClear`, `ImageDisplay`).
- Removed the audio `volume` kit option and node attribute. `volume` is not an
  HTML content attribute. It exists only as a property of `HTMLMediaElement`.
  The node rendered it with `setAttribute`, so `<audio volume="0.5">` was
  ignored by every browser and the option never changed playback in any
  published version. Set `HTMLMediaElement.volume` on the element directly if
  you need it.

### Added

- URL detection API. `detectMediaType(url)` returns the media node a URL should
  render (`'image' | 'video' | 'audio' | 'youtube' | 'vimeo' | 'soundcloud' |
'spotify' | 'loom' | 'x'`) or `null` for non-media, testing specific providers and images
  before the generic video/audio file-extension matchers. The new `isVideoUrl` /
  `isAudioUrl` matchers are exported from the package root. So are the existing
  per-node validators (`isImageUrl`, `isValidYoutubeUrl`, `isValidVimeoUrl`,
  `isValidSoundCloudUrl`, `isValidLoomUrl`, `isValidXUrl`), `parseYoutubeVideoId`,
  and the `MediaNodeType` union. `isMediaUrl`, the paste-autoconvert
  predicate, is unchanged — it still excludes raw video/audio URLs so pasted
  `.mp4`/`.mp3` links stay links.
- `caption` attribute and an editable `<figcaption>` on every media node. The
  attribute is the source of truth and persists via collaboration and JSON.
  HTML serialization carries the caption for `image` only — which includes
  clipboard copy/paste and the toolbar Copy action.
- **`editorFileUpload` host contract.** Pasting image files dispatches one
  `CustomEvent` on `document` with `{ files, editor }` in `detail`. The event
  carries every image on the clipboard, so the host uploads and inserts them itself.
  No base64 ever enters the document. One event per paste carries every image;
  the host inserts them in clipboard order.
- Built-in **loading shell** for images, video/audio, iframe embeds, and X
  (`loadingShell` kit option; styles ship in `./styles.css`).
- Base toolbar actions — inline: Align, wrap-margin presets, Caption,
  View original (↗ arrow-outward), Download (image/video/audio); overflow `…`:
  Replace URL, Copy, Delete.
- `right` placement — block-aligns a node to the right edge without text wrap
  (Align offers Left, Center, Right, Wrap left, Wrap right). It round-trips
  through `getMediaPlacementAttrs` / `getCurrentMediaPlacement` as
  `margin: 0 0 0 auto`.
- Margin control for wrap placements: choosing Wrap left/right adds a button
  beside Align showing the current gap. It opens the presets (0"–1", default
  1/2") in a floating-popover submenu, with a divider grouping the alignment
  section. Adds the optional `MediaAction.dividerAfter` flag.
- Replace URL — a URL-editor dialog popover anchored to the media node (below
  it, flipping above when space runs out) swaps the node's `src` in place. It
  preserves the node identity (`keyId`), caption, size, and placement instead
  of delete-and-reinsert. Replacement is same-type only: each provider node
  validates with its own canonical URL guard. A YouTube node accepts only
  YouTube URLs, and an X node normalizes to the canonical status URL. The
  image, video and audio nodes accept any non-empty URL, mirroring their insert
  commands. The dialog content is a factory slot: the `replaceUrlPopover` kit
  option returns custom content or `null` to render a host surface instead.
  `createReplaceUrlPopover` / `openReplaceUrlPopover` (plus their option types)
  are exported for reuse.
- `openToolbarPopover` / `closeToolbarPopover` exports — the positioned-popover
  building blocks the built-in toolbar uses, available to custom `mediaToolbar`
  surfaces. One popover at a time; outside-click and Escape dismissal built in.
- `resolveMediaNodePos` export — resolves a media wrapper element to its
  current document position. Custom toolbar actions re-resolve at action
  time instead of trusting the open-time snapshot.
- Hover controls track the node through collaborative edits: the toolbar,
  resize gripper, and Delete-key targeting follow position shifts from content
  inserted above the node.
- Toolbar accessibility: the bar carries `aria-label="Media toolbar"`, and
  toggle actions and submenu items expose `aria-pressed`. Escape with focus
  inside the toolbar dismisses it and refocuses the editor. Overflow/submenu
  popover shells are intentionally role-neutral.
- Icon-only toolbar buttons show a floating tooltip on hover and focus, in
  place of the native `title`. The tooltip is a shared `role="tooltip"` bubble
  with a 400ms delay, hidden on click so it never lingers over an opening menu.
  The tooltip ships from the shared `@docs.plus/floating-tooltip` package,
  bundled into `dist` like the popover engine. `attachTooltip` /
  `hideTooltip` are re-exported for custom `mediaToolbar` surfaces, and
  `.floating-tooltip` joins the styling-contract classes.
- The bundled popover engine treats a popover as one-shot once opened: hiding
  releases its ownership, so it is never re-shown. Toolbar menus, submenus and
  the Replace URL dialog already build a fresh popover per open, so no toolbar
  behaviour changes. The guarantee is that a dismissed menu cannot reappear
  detached from the single-popover invariant.
- Micro-motion: the media toolbar fades in on mount and fades out before removal
  (the exit is deferred past the fade). Hover states fade, and tooltips rise
  toward rest. Overflow/submenu popovers play both transitions and scale from
  the anchored side via a placement-derived `transform-origin`. Motion follows
  the docs.plus language — 120ms `ease-out` enter, 80ms `ease-in` exit — all
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
  `media-loading-shell.css`, `media-node-x.css`, `media-node-loom.css`,
  `media-node-spotify.css`, and `media-toolbar.css`. Import it in one line
  (`import '@docs.plus/extension-hypermultimedia/styles.css'`) to load the shipped
  styles, matching `@docs.plus/extension-hyperlink`.
- Dark mode in the shipped stylesheet — `--hm-*` tokens use `light-dark()` and
  follow the nearest ancestor's `color-scheme`.
- `styles.css` ships the `.floating-popover` shell rules (fade/scale/arrow) so
  toolbar popovers animate standalone.
- `prefers-reduced-motion: reduce` disables the loading shimmer/spinner animation.
- Escape cancels a resize drag (snaps back, commits nothing).
- README **Gallery** — nine node types in light/dark (`assets/*-{light,dark}.png`); regenerate with `bun run docs:screenshots`.
- **Spotify embed node.** A ninth media node embeds Spotify tracks, albums,
  playlists, artists, shows, and episodes through the official iframe player
  (`open.spotify.com/embed/{type}/{id}`). Paste a Spotify URL or call
  `setSpotify({ src, theme })` — `theme: 1` selects the light player; a track
  defaults to the compact height, everything else to the full-art height. The
  player is fixed-height (drag-resizable, height pinned on narrow columns) and
  round-trips through `![spotify](url)` markdown. Pasting a Spotify URL or its
  "Copy embed" `<iframe>` code (HTML or plain text) inserts the node. New root
  exports: `isValidSpotifyUrl`, `parseSpotifyEntity`, `SPOTIFY_ENTITY_TYPES`.
- **`mediaToolbarIcons` kit slot.** Hosts swap toolbar, overflow, alignment
  submenu, and replace-URL icons by key (`caption`, `more`, `align:center`,
  custom action ids) without replacing toolbar factories or reimplementing
  submenus. The inline align button reuses the `align:<placement>` icons, so a
  host supplies one icon per placement and never a dynamic resolver.
- **`composeMediaActions` builder + `layoutMediaActions` sugar.** Rearrange
  toolbar bricks by id with `add` / `move` / `replace` / `remove` /
  `setPlacement` / `order`. You can also declare the inline and overflow rows by
  id, instead of hand-splicing the `mediaActions` array. Both compose over the
  existing `mediaActions` slot.

### Changed

- Toolbar icons are unified on the Google Material Symbols (outlined) set,
  matching `@docs.plus/extension-hyperlink`; alignment uses Google-Docs-style
  glyphs (align-left, align-center, image-left, image-right).
- `closeMediaToolbar()`'s document-wide fallback only removes toolbars carrying
  `data-node-type`.
- Loom embed defaults include `scrolling: 'no'` to avoid iframe scrollbars at fixed heights.
- The default media-toolbar skin aligns with the docs.plus floating-surface
  language: 10px shells (toolbar + menus, was 8px) with 8px inner controls
  (was 6px). The radii are lockstep with extension-hyperlink's radii. The skin
  also carries a deeper two-layer overlay shadow (`--hm-toolbar-shadow`).
  Consumers who retheme via the `--hm-*` custom properties are unaffected; the
  lockstep `.floating-tooltip` block is unchanged.
- Built-in toolbar icons resolve from a single Material map in `resolveMediaToolbarIcon`
  (host `mediaToolbarIcons` override first). `MediaAction.icon` is optional — omit it
  on custom bricks and supply keys via `mediaToolbarIcons` instead.
- The toolbar action list is now ordered purely by array position. The internal
  numeric `order` field on `MediaAction` is removed. Author bricks in display
  order and arrange with the builder (X's "Post options" now anchors after
  Replace URL via a per-node recipe rather than `order: 45`).

### Fixed

- `![alt](src)` markdown routing to media nodes is now gated on the src actually
  validating for that node type. As a result, an image whose alt text collides with
  a reserved literal (`x`, `video`, `audio`, …) imports as an image. It no longer
  imports as a permanently broken embed. Trade-off: an `![audio]`/`![video]` whose URL has no
  recognized media extension now imports as an image rather than a media node.
- Vimeo and X paste rules claim a URL pasted mid-sentence (previously they read the whole
  pasted block and silently failed). The Vimeo pattern keeps the full URL tail, so the
  unlisted-video `?h=` param survives into the embed. `.webm` is no longer treated as an
  image extension — those URLs route to the video pipeline.
- The media toolbar's Copy action no longer throws out of its clipboard fallback in
  non-secure contexts. Download routes HTTP error responses (404/expired signed URL)
  to the open-in-tab fallback instead of saving a corrupt file.
- The shipped type definitions no longer augment the global `Window` with `twttr`
  (a local accessor replaces the `declare global` block). `prefers-reduced-motion`
  now actually suppresses the toolbar entrance animation and popover transition (the
  entrance rules out-specified both guards). The unused `.floating-popover-arrow` rules
  moved out of this package — the hyperlink bundle owns arrow skins.
- `getHTML()` and clipboard copy no longer throw once a `video`/`audio` node
  exists (leaf-node content hole removed; bogus `contentDOM` dropped).
- Resize drags commit to the node actually under the gripper — the drag-end
  position is re-resolved from the DOM (keyId-first, type-guarded). Listeners and
  pointer capture release even if the commit throws. `updateNodeDimensions`
  refuses non-media positions.
- Gripper-resized `audio` no longer snaps back visually (`syncAudioNodeLayout`
  mirrors committed `width`/`height`).
- The document-level delete-on-hover handler yields to real editing: Backspace/
  Delete with a focused text caret edits text (bails on `TextSelection`). While
  editing a caption it edits the caption text instead of deleting the whole
  media node.
- Caption text is trimmed on commit, matching the mobile sheet; a whitespace-only
  caption clears to `null`.
- A visible caption no longer overflows onto the paragraph below the media. The
  node-view wrapper drops its redundant fixed `height`, so it grows to contain the
  caption. The loading shell and media surface still carry the pixel size.
- YouTube `ccLanguage` maps to the official `cc_lang_pref` param; YouTube URL
  detection uses exact host matching.
- Pasted plain-text `data:image/...` URLs respect `allowBase64: false`.
- Invalid or hostile `blockquote.twitter-tweet` hrefs no longer create a broken
  X node; the X parse rule outranks StarterKit's blockquote rule.
- `setVideo`/`setAudio` return `false` on missing `src` (documented contract).
- Static-HTML export prefers committed `width`/`height` over kit defaults.
- The image markdown input rule requires the leading `!` (plain links no longer
  convert) and drops the global flag.
- Loading shell `destroy()` detaches media `load`/`error` listeners; `markReady`/`markError` detach too. Error state keeps the overlay visible (ready-only hides it).
- X embed: `mountXEmbed` reports failure; `loadXScript` times out and aborts when the node view is destroyed.
- X loading shell tracks widget layout (`ResizeObserver`) and switches to fluid height after render so tall posts are not clipped.
- X post embeds: wrapper width follows `maxwidth`; `data-x-theme` backgrounds and corner clip remove light/dark corner bleed after `widgets.js` paint.
- Media toolbar hover bridge: deferred hide + expanded popover hit area so the pointer can reach the portaled toolbar without dismissal.
- Re-hovering a media node within the toolbar exit window no longer mounts a
  second toolbar — `openMediaToolbar` purges `[data-hm-closing]` siblings before
  append.
- Resize gripper uses `setPointerCapture` so drags stay attached over iframes, outside the editor, and at constraint limits; drags also end on blur and `pointercancel`.
- Loading shell dimensions stay in sync with gripper resize on iframe embeds and video. Ready shells use a transparent background so gray placeholder does not show through.
- Iframe embed resize writes pixel `style` width/height on the `<iframe>` (not only HTML attrs) so the player fills the gripper.
- Image node view uses subtree `ignoreMutation` (not ignore-all).
- Image insertion no longer appends a phantom empty image node (`priority: 1100`
  had made image ProseMirror's default-fill block).
- `keyId` is minted per insert (was a shared build-time default).
- `video` input-rule width/height destructuring.
- X (Twitter) oEmbed HTML is sanitized before `innerHTML`; the embed anchor reads
  the correct `src`.
- Resize gripper no longer leaks `document` keyboard listeners across rebuilds.
- Iframe embeds (YouTube, Vimeo, SoundCloud, Loom) set
  `referrerpolicy="strict-origin-when-cross-origin"` on the player iframe. Under a
  host page whose `Referrer-Policy` strips the cross-origin `Referer`, the provider
  could not verify the embedding domain. It rendered a "player configuration error"
  instead of the video. The element-level policy sends the origin without relaxing
  the page's global header.
- Resize gripper overlays the visible media box exactly. The overlay widget was
  inheriting the host editor's content-flow margin, which shifted it off the media
  box and desynced its drag coordinates. It now forces `margin: 0` and measures the
  loading-shell host via `getBoundingClientRect`, so the selection box hugs the
  player and excludes the caption.
- Media embeds (YouTube, Vimeo, SoundCloud, Loom, X) no longer reload when a
  focus-trap opens elsewhere in the editor — a Floating UI popover, a dialog. The
  loading shell is no longer an `aria-live` / `role="status"` region. Such a region
  inside the editor makes focus-trap libraries stamp `inert` across the document,
  which ProseMirror reconciles by recreating the iframe node views. Iframe embeds
  are now leaf node views with no `contentDOM`, matching the other media nodes.
- Caption editing no longer deletes the media node on the first typed character.
  The trigger was a `NodeSelection` that ProseMirror still held on the node
  (click-to-lock, then toolbar Caption). Focus now collapses that selection before
  input reaches the editor.
- Media blocks no longer overflow the editor column on narrow viewports. Wrappers
  and loading shells cap at `max-width: 100%` while preserving committed
  width/height attrs via `aspect-ratio` (live editor; static HTML export still
  emits fixed pixel dimensions).
- Media toolbar `…` overflow menu toggles closed on a second click (outside
  dismiss no longer races the trigger). Menu anchors to the toolbar bar with
  `bottom-end` so it aligns to the toolbar's right edge.
- Overflow/submenu gap under the toolbar tightened (2px offset); cross-axis
  `shift` disabled so the menu stays flush with the bar's end edge.
- Wrap left/right no longer overflows the editor column: floated media gets
  `max-width: calc(100% - horizontal margins)` so pixel width + wrap gap stay
  inside the parent.
- Pasting a copied media node mints a fresh `keyId` instead of reusing the
  serialized one. Two nodes sharing an id resolved to the same first-match
  `[data-key-id]`, so the resize gripper drove the original while sitting over
  the copy.
- A captioned image keeps `float`, `margin`, `clear` and `display` through an
  HTML round-trip. It parses from its `<figure>`, and those four attributes were
  read off that element instead of the inner `<img>`. As a result, a wrapped
  image came back centred after a copy/paste.
- `video` and `audio` keep width, height and placement through an HTML
  round-trip. The values were emitted only inside the wrapper's inline `style`,
  which nothing parses back, so the node returned at schema defaults.
- Reserved markdown alts route only through each node's own tokenizer. The image
  node's `parseMarkdown` also emitted `{ type: 'audio' }`, `{ type: 'youtube' }`
  and so on, which have no schema node when the kit disabled them. Tiptap caught
  the schema error and replaced the whole document with an empty one. Side effect:
  marked-image shapes the tokenizer does not match (`![audio](url "title")`,
  `![audio](<url>)`) now import as images.
- YouTube and Vimeo store the page URL after an HTML round-trip, not the player
  URL. `renderHTML` serializes the iframe widget URL and both nodes read it back
  verbatim, so markdown export emitted the embed URL. With
  `Youtube: { nocookie: true }` the round-trip was worse. The nocookie host is not
  a watch host, so the next embed build produced an empty `src` and the video went
  blank. Vimeo keeps the unlisted-video `?h=` token through the unwrap.
- An X node ignores a literal `src` attribute on pasted `blockquote.twitter-tweet`
  markup. Tiptap merges per-attribute reads over the parse rule's own result, and
  `src` had no per-attribute reader, so the raw attribute overwrote the normalized
  status URL. `renderHTML` now normalizes the value it emits as well, which also
  covers documents persisted before the parse fix.
- The `![alt](url)` image input rule no longer swallows the space that triggers
  it. The trailing lookahead let the match end one character before the typed
  text. The rule therefore inserted a duplicated `)` and left the `!` in the document.
- `editor.can().updateImageDimensions({ keyId })` reports `false` when no image
  carries that `keyId`. The command ran its scan only when dispatching, then
  returned `true` unconditionally.
- Hover controls in one editor no longer tear down another editor's media
  toolbar. With no active target the teardown fell back to a `document`-wide
  query for mounted bars; it is now scoped to the editor's own DOM.
- The media toolbar no longer writes node attributes on a read-only editor. An
  open toolbar survived `setEditable(false)`, and align, margin, size, theme and
  Replace URL all still dispatched.

### Security

- **Toolbar button labels render as text, not markup.** A media node's `margin`
  attribute is document-controlled and was reported verbatim inside the label. An
  attribute carrying HTML therefore executed script the moment the toolbar opened.
  Labels are written with `textContent`; a stored payload now renders as literal
  text.
- **Dangerous schemes are refused where `src` enters the document.**
  `javascript:`, `data:`, `vbscript:`, `file:` and `blob:` are rejected at
  `parseHTML` for the four nodes that lacked a check: `video`, `audio`, `vimeo`
  and `youtube`. They are also rejected on markdown import, and in the Replace URL
  dialog. Markdown import and the Replace URL dialog admit inline `data:image/*`
  payloads for the image node; SVG stays excluded because it carries script. The embed builders already refused to render a bad
  URL, but the raw value still reached the collaborative document. This is not a
  whole-document guarantee. Insert commands and collaborative sync write `src`
  without passing the gate, which is why the read side carries its own allowlist.
- **Layout attributes cannot inject CSS declarations into exported HTML.**
  `margin` is read verbatim off pasted elements and concatenated into the
  wrapper's inline `style`; a value carrying `;`, `}` or `url(` is dropped. This
  also covers the server-side DOCX/ODT/HTML export path, which serializes through
  the same `renderHTML`.
- **"View original" and the download fallback open only `http(s):`, `blob:` and
  root-relative sources.** Insert commands and collaborative sync can both put a
  value in `src` that the parse-time gate never saw. The `window.open` sink
  therefore re-checks rather than trusting the stored value.

### Removed

- `tippy.js`; `utils/floating-toolbar.ts`, `utils/tippyHelper.ts`; dead rotation
  code.
- `utils/media-toolbar.ts` internals and `nodes/x/xToolbar.ts`, folded into the
  action registry.

### Internal

- The published manifest no longer declares `engines` — the monorepo's Node floor gated engine-strict consumer installs even though the shipped bundle is plain browser-targeted ESM/CJS.
- `Logger` (`src/utils/logger.ts`) is error-only: `console.error` survives the
  shared tsup pure policy; the unused `warn`/`debug` levels were dropped.
- Clean-room Cypress E2E suite + Bun playground. The playground harness lives in
  the shared `@docs.plus/playground` package; `test/playground/` holds only
  `main.ts`. No change to the published package.
- Media layout CSS (live + export + image block) routes through one
  `layoutStyle` module (`StyleLayoutOptions` / `mediaLayoutCss` /
  `applyMediaLayoutToDom`). Node options re-export the same type (no dual
  layout contracts).
- Toolbar popovers open via `openMediaPopover` (menu + Replace dialog); engine
  dismiss/shift knobs stay inside that adapter.

### Migrating from 1.x to 2.0

- Config keys are unchanged except `Twitter` → `X`; update `setTwitter` → `setX`.
- **Stored documents (docs.plus / Hocuspocus)**: run `bun run --filter @docs.plus/hocuspocus migrate:media-node-names` (fail-closed; preview with `:dry`) to rewrite legacy PascalCase node types. The on-load shim (`ENABLE_SCHEMA_MIGRATION`) covers stragglers.
- **Stored documents (external adopters)**: rewrite node `type` strings in JSON or Yjs exports. The mappings are `Image`→`image`, `Video`→`video`, `Audio`→`audio`, `Youtube`→`youtube`, `Vimeo`→`vimeo`, `SoundCloud`→`soundcloud`, `Twitter`→`x`. Attr keys are unchanged except command renames (`setTwitter`→`setX`). See the [media-node-rename runbook](https://github.com/docs-plus/docs.plus/blob/main/apps/hocuspocus.server/docs/migrate-media-node-names.md) for the full mapping even if you do not run the CLI.
- Replace removed `createFloatingToolbar`/`*Modal` usage with the built-in toolbar or the `mediaToolbar` factory.
- **Recommended pairing with `@docs.plus/extension-hyperlink`** when both ship in one editor — configure `shouldAutoLink: (url) => !isMediaUrl(url)` so media URLs become nodes, not links.

#### One-shot rename script

Run this in your project root and review the diff. The patterns are anchored on
purpose — a blanket `Twitter` → `X` replace would corrupt `twitter.com` hosts in
URLs, parse rules, and the sanitizer allowlist.

```bash
rg -l "setTwitter|TwitterOptions|Twitter:" \
  | xargs sed -i.bak \
    -e 's/setTwitter/setX/g' \
    -e 's/TwitterOptions/XOptions/g' \
    -e 's/Twitter:/X:/g'
```

#### Code diff

Import the named kit:

```diff
-import HyperMultimediaKit from '@docs.plus/extension-hypermultimedia'
+import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'
```

Rename the kit config key:

```diff
 HyperMultimediaKit.configure({
-  Twitter: { theme: 'dark' }
+  X: { theme: 'dark' }
 })
```

Rename the insert command:

```diff
-editor.commands.setTwitter({ src: 'https://x.com/jack/status/20' })
+editor.commands.setX({ src: 'https://x.com/jack/status/20' })
```

Drop the tippy modal API. The toolbar is built in. Pass `mediaToolbar` only to
render your own surface:

```diff
-import { createFloatingToolbar, imageModal, youtubeModal, twitterModal } from '@docs.plus/extension-hypermultimedia'
-
 HyperMultimediaKit.configure({
-  Image: { modal: imageModal },
-  Youtube: { modal: youtubeModal },
-  Twitter: { modal: twitterModal }
+  mediaToolbar: (options) => renderMobileSheet(options)
 })
```

Drop the per-node toolbar option:

```diff
 HyperMultimediaKit.configure({
-  Image: { toolbar: myImageToolbar }
+  Image: {}
 })
```

## Pre-2.0 release history

The `1.x` changelog below lived on the pre-monorepo `HMarzban/extension-hypermultimedia` repository. Public versions from that era are superseded by this `2.0.0` entry. Recover the full text from git history (`extensions/extension-hypermultimedia/CHANGELOG.md` before this archive) if you need per-patch notes.

## [1.3.1] (2024-01-14) — archived

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** depricate "defaultOptions" [#1](https://github.com/HMarzban/extension-hypermultimedia/issues/1) ([89add0e](https://github.com/HMarzban/extension-hypermultimedia/commit/89add0ecbf35e18d534f9157b805292b5c80bee7))

## [1.3.0](https://github.com/HMarzban/extension-hypermultimedia/compare/v1.2.0...v1.3.0) (2023-11-14)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** naming ([5ecadef](https://github.com/HMarzban/extension-hypermultimedia/commit/5ecadef366036e122e286b7050d3397a4db81ec4))
- **@docs.plus/extension-hypermultimedia:** use default value for width and height ([5e65aee](https://github.com/HMarzban/extension-hypermultimedia/commit/5e65aee3a4669ca388e8acad5fcf2fd5f1cd4b62))

### Features

- **@docs.plus/extension-hypermultimedia:** audio and video extension support ([4de250b](https://github.com/HMarzban/extension-hypermultimedia/commit/4de250bf3b4bdfd4effaee82382b3fff32383ac2))
- **@docs.plus/extension-hypermultimedia:** support audio tag ([814a956](https://github.com/HMarzban/extension-hypermultimedia/commit/814a956025da841cd48cc73d5509c6673904dcb8))
- **@docs.plus/extension-hypermultimedia:** support video tag ([606ae44](https://github.com/HMarzban/extension-hypermultimedia/commit/606ae4499f9ed096a4f29a195a969c8205ffacc7))

## [1.3.0-alpha.1](https://github.com/HMarzban/extension-hypermultimedia/compare/v1.2.0...v1.3.0-alpha.1) (2023-11-09)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** naming ([5ecadef](https://github.com/HMarzban/extension-hypermultimedia/commit/5ecadef366036e122e286b7050d3397a4db81ec4))

### Features

- **@docs.plus/extension-hypermultimedia:** audio and video extension support ([4de250b](https://github.com/HMarzban/extension-hypermultimedia/commit/4de250bf3b4bdfd4effaee82382b3fff32383ac2))
- **@docs.plus/extension-hypermultimedia:** support audio tag ([814a956](https://github.com/HMarzban/extension-hypermultimedia/commit/814a956025da841cd48cc73d5509c6673904dcb8))
- **@docs.plus/extension-hypermultimedia:** support video tag ([606ae44](https://github.com/HMarzban/extension-hypermultimedia/commit/606ae4499f9ed096a4f29a195a969c8205ffacc7))

## [1.3.0-alpha.0](https://github.com/HMarzban/extension-hypermultimedia/compare/v1.2.0...v1.3.0-alpha.0) (2023-11-09)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** naming ([5ecadef](https://github.com/HMarzban/extension-hypermultimedia/commit/5ecadef366036e122e286b7050d3397a4db81ec4))

### Features

- **@docs.plus/extension-hypermultimedia:** audio and video extension support ([4de250b](https://github.com/HMarzban/extension-hypermultimedia/commit/4de250bf3b4bdfd4effaee82382b3fff32383ac2))
- **@docs.plus/extension-hypermultimedia:** support audio tag ([814a956](https://github.com/HMarzban/extension-hypermultimedia/commit/814a956025da841cd48cc73d5509c6673904dcb8))
- **@docs.plus/extension-hypermultimedia:** support video tag ([606ae44](https://github.com/HMarzban/extension-hypermultimedia/commit/606ae4499f9ed096a4f29a195a969c8205ffacc7))

## 1.2.0 (2023-10-31)

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

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/HMarzban/extension-hypermultimedia/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/HMarzban/extension-hypermultimedia/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))
- **@docs.plus/extension-hypermultimedia:** make sure pick attrs from node attrs ([8e00479](https://github.com/HMarzban/extension-hypermultimedia/commit/8e004797454d8c70892f3a6c4804b50d2f9ee254))

### Features

- **@docs.plus/extension-hypermultimedia:** inline or block node level ([11dd402](https://github.com/HMarzban/extension-hypermultimedia/commit/11dd402e86ad689d6146ffd1f9d1e156919af719))

## 1.1.2-alpha.1 (2023-10-27)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/HMarzban/extension-hypermultimedia/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/HMarzban/extension-hypermultimedia/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))
- **@docs.plus/extension-hypermultimedia:** make sure pick attrs from node attrs ([8e00479](https://github.com/HMarzban/extension-hypermultimedia/commit/8e004797454d8c70892f3a6c4804b50d2f9ee254))

### Features

- **@docs.plus/extension-hypermultimedia:** inline or block node level ([11dd402](https://github.com/HMarzban/extension-hypermultimedia/commit/11dd402e86ad689d6146ffd1f9d1e156919af719))

## 1.1.2-alpha.0 (2023-10-26)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/HMarzban/extension-hypermultimedia/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/HMarzban/extension-hypermultimedia/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))
- **@docs.plus/extension-hypermultimedia:** make sure pick attrs from node attrs ([8e00479](https://github.com/HMarzban/extension-hypermultimedia/commit/8e004797454d8c70892f3a6c4804b50d2f9ee254))

## 1.1.1-alpha.0 (2023-10-26)

### Bug Fixes

- **@docs.plus/extension-hypermultimedia:** adjust iframe width & height when resize again ([ed6657c](https://github.com/HMarzban/extension-hypermultimedia/commit/ed6657c011001e65599d7f5baa1bc4a80709f852))
- **@docs.plus/extension-hypermultimedia:** ensure the tippy wrapper stretches widely ([1bf84db](https://github.com/HMarzban/extension-hypermultimedia/commit/1bf84db78f0bd4a838ca5a6975657c35e55b856e))

## 1.1.0 (2023-10-26)

**Note:** Version bump only for package @docs.plus/extension-hypermultimedia
