# @docs.plus/extension-hypermultimedia

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-hypermultimedia.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-hypermultimedia)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-hypermultimedia.svg)](https://npmcharts.com/compare/@docs.plus/extension-hypermultimedia)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-hypermultimedia.svg)](https://www.npmjs.com/package/@docs.plus/extension-hypermultimedia)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/25JPG38J59)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/preview-dark.png">
    <img alt="Embedded image with hover toolbar and resize gripper in the editor" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/preview-light.png">
  </picture>
</p>

Tiptap extension for embedding media in the editor: images, audio, video, and provider embeds (YouTube, Vimeo, SoundCloud, X, Loom).

One kit call configures all eight nodes. Each media node gets a hover toolbar in its top-right corner, drag-to-resize, an editable caption, and a loading shell; toolbar popovers position through [`@docs.plus/floating-popover`](https://github.com/docs-plus/docs.plus/tree/main/packages/floating-popover) (Floating UI, bundled into `dist`) — no tippy.js.

## Install

```sh
bun add @docs.plus/extension-hypermultimedia@next
# stable, after promotion:
bun add @docs.plus/extension-hypermultimedia
```

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x).

Co-install [`@docs.plus/extension-hyperlink`](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hyperlink) when both marks and media share one editor — see [Paste precedence](#paste-precedence).

## Quickstart

One `HyperMultimediaKit.configure` call adds every node; pass an options object to configure one, or `false` to disable it.

```ts
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'
import '@docs.plus/extension-hypermultimedia/styles.css'

new Editor({
  extensions: [
    HyperMultimediaKit.configure({
      Image: { inline: true, allowBase64: true },
      Vimeo: { inline: true },
      SoundCloud: false
    })
  ]
})
```

Markdown image import/export lives on the `image` node — no separate extension. With a Markdown extension loaded, `![alt](src)` round-trips.

## Options

Kit-level options on `HyperMultimediaKit.configure({ … })`:

| Option                                                                   | Default          | Description                                                                                                                                   |
| ------------------------------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Image`, `Audio`, `Video`, `Youtube`, `Vimeo`, `SoundCloud`, `Loom`, `X` | enabled          | Per-node options object, `true`, or `false` to disable. Every node except `X` also accepts `resizeGripper: false`.                            |
| `mediaToolbar`                                                           | built-in toolbar | Toolbar factory — return your own element, or `null` to render a host surface. See [Customizing actions](#customizing-actions).               |
| `mediaActions`                                                           | built-in actions | Rewrites the resolved toolbar action list per node. See [Customizing actions](#customizing-actions).                                          |
| `isUploadedMedia`                                                        | `undefined`      | Marks image/video/audio nodes as host uploads so View original stays hidden for them. See [Customizing actions](#customizing-actions).        |
| `loadingShell`                                                           | `true`           | Loading overlay: `true` for the built-in shell, `false` for none, or a factory replacing the overlay UI. See [Loading shell](#loading-shell). |

Per-node options (player params, paste handlers, layout) are documented per node — see [Nodes](#nodes).

## Commands

Each node contributes one insert command; every command returns `false` for a missing or invalid `src`.

```ts
editor.commands.setImage({ src: 'https://example.com/photo.png', alt: 'Example' })
editor.commands.setVideo({ src: 'https://example.com/clip.mp4' })
editor.commands.setAudio({ src: 'https://example.com/track.mp3' })
editor.commands.setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
editor.commands.setVimeo({ src: 'https://vimeo.com/123456789' })
editor.commands.setSoundCloud({ src: 'https://soundcloud.com/artist/track' })
editor.commands.setX({ src: 'https://x.com/user/status/123' })
editor.commands.setLoom({ src: 'https://www.loom.com/share/abcdef1234567890' })
```

Every command also accepts layout options: `width`, `height`, `margin`, `float`, `clear`, `display`, `justifyContent`. Provider embeds accept the player options documented per node (for example YouTube `controls`, `start`, `modestbranding`) — see [Embeds](#embeds).

## Styling

Import the single shipped stylesheet — it bundles the resize gripper, loading shell,
media toolbar, and node-specific X/Loom embed chrome:

```ts
import '@docs.plus/extension-hypermultimedia/styles.css'
```

Every visual token is a `--hm-*` CSS custom property declared with `light-dark()`, so the media UI follows the nearest ancestor's `color-scheme`. Toggle `color-scheme: light | dark` on `<html>` (or any ancestor) and the toolbar, loading shell, gripper, and X/Loom embed surfaces flip with it; with the default `color-scheme: normal` they follow the OS `prefers-color-scheme`. Override any token to retheme:

| Token                         | Description                                |
| ----------------------------- | ------------------------------------------ |
| `--hm-toolbar-bg`             | Toolbar and menu background                |
| `--hm-toolbar-fg`             | Toolbar icon and menu text color           |
| `--hm-toolbar-border`         | Toolbar, menu, and popover-arrow borders   |
| `--hm-toolbar-hover`          | Toolbar button / menu row hover background |
| `--hm-toolbar-active`         | Active (toggled) action background         |
| `--hm-toolbar-active-fg`      | Active action icon/text color              |
| `--hm-toolbar-shadow`         | Toolbar and menu drop shadow               |
| `--hm-caption-fg`             | Caption text                               |
| `--hm-caption-placeholder`    | Empty-caption placeholder text             |
| `--hm-loading-bg`             | Loading shell background                   |
| `--hm-loading-shimmer`        | Loading shimmer sweep                      |
| `--hm-loading-provider`       | Provider label ("YouTube", …)              |
| `--hm-loading-message`        | Loading status message                     |
| `--hm-loading-error`          | Error-state message color                  |
| `--hm-loading-spinner-track`  | Spinner track ring                         |
| `--hm-loading-spinner-active` | Spinner active arc                         |
| `--hm-resize-border`          | Gripper selection border                   |
| `--hm-resize-handle-bg`       | Gripper handle fill                        |

```css
:root {
  --hm-toolbar-active: #ecfdf5;
  --hm-resize-border: #059669;
}
```

The shimmer and spinner animations are disabled under `prefers-reduced-motion: reduce`.

## Nodes

| Node         | Embeds               | Docs                                                                                                                     |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `image`      | images (+ markdown)  | [image](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/image)           |
| `audio`      | audio files          | [audio](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/audio)           |
| `video`      | video files          | [video](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/video)           |
| `youtube`    | YouTube videos       | [youtube](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/youtube)       |
| `vimeo`      | Vimeo videos         | [vimeo](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/vimeo)           |
| `soundcloud` | SoundCloud audio     | [soundcloud](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/soundcloud) |
| `x`          | X (formerly Twitter) | [x](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/x)                   |
| `loom`       | Loom recordings      | [loom](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/loom)             |

### Gallery

Each node type in the kit — local asset files (image, video, audio) and public provider embeds. Pairs follow your system light/dark preference. Gallery captures center each node (`margin: 0 auto`), wait for the loading shell to clear, hover for toolbar + gripper (X: toolbar only), then screenshot at a consistent width (480px embeds, 332px image). X embeds use a per-node `theme` (`light` / `dark`) so the tweet card matches the playground; set it on insert or from the toolbar Post options menu.

<details>
<summary><strong>Image</strong> — local file</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/image-dark.png">
    <img alt="Image node with resize gripper and caption area" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/image-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>Video</strong> — local file</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/video-dark.png">
    <img alt="Video node with native controls" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/video-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>Audio</strong> — local file</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/audio-dark.png">
    <img alt="Audio node with native controls" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/audio-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>YouTube</strong></summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/youtube-dark.png">
    <img alt="YouTube embed with loading shell cleared" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/youtube-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>Vimeo</strong></summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/vimeo-dark.png">
    <img alt="Vimeo embed player" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/vimeo-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>SoundCloud</strong></summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/soundcloud-dark.png">
    <img alt="SoundCloud embed widget" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/soundcloud-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>Loom</strong></summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/loom-dark.png">
    <img alt="Loom embed player" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/loom-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>X</strong> — post embed (per-node light/dark theme)</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/x-dark.png">
    <img alt="X post blockquote embed" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/x-light.png">
  </picture>
</p>

</details>

## Embeds

Provider embeds resolve options in two layers: kit defaults (`HyperMultimediaKit.configure({ Youtube: { … } })`) and node attributes written at insert (`setYoutubeVideo({ … })`) — node attributes win. Query names follow each provider's embed API; the full option tables live in the node READMEs.

- **YouTube** maps camelCase options to the official iframe params (`ccLanguage` → `cc_lang_pref`, `disableKBcontrols` → `disablekb`, …). Paste extracts `start` from `?t=`, `?start=`, or `#t=`; `loop: 1` auto-sets `playlist` to the video id; `nocookie: true` embeds from `youtube-nocookie.com`.
- **X** sizes through oEmbed `maxwidth` presets — Compact (280), Standard (400, default), Wide (550) — plus a light/dark theme, both switchable from the toolbar's Post options; X has no drag-resize. `hide_media`, `hide_thread`, `lang`, and `dnt` ship as kit defaults and per-node attrs.
- **Vimeo**, **SoundCloud**, and **Loom** follow the same two-layer pattern with their own params (`start_time`, the SoundCloud widget params, `hide_title`, …).

## Media toolbar

Hover a media node (desktop) or tap it (touch) and a toolbar appears at the node's top-right corner. Common actions sit inline; the rest live behind a `…` overflow menu.

| Action                     | Placement | Nodes                                                                   |
| -------------------------- | --------- | ----------------------------------------------------------------------- |
| Caption                    | inline    | all                                                                     |
| Alignment                  | inline    | all                                                                     |
| View original              | inline    | any node with an external `src` (hidden for uploaded image/video/audio) |
| Download                   | inline    | image, video, audio                                                     |
| Copy                       | overflow  | all                                                                     |
| Delete                     | overflow  | all                                                                     |
| Post options (size, theme) | overflow  | x                                                                       |

### Customizing actions

Two kit hooks, in order of reach.

`mediaActions` rewrites the resolved action list per node — add, hide, or reorder:

```ts
HyperMultimediaKit.configure({
  mediaActions: (defaults, { nodeType }) => {
    if (nodeType !== 'image') return defaults
    return [
      ...defaults.filter((action) => action.id !== 'download'), // hide one
      { id: 'alt', label: () => 'Edit alt text', placement: 'menu', run: (ctx) => editAltText(ctx) } // add one
    ]
  }
})
```

A `MediaAction` is `{ id, label, icon?, placement: 'inline' | 'menu', isVisible?(ctx), isActive?(ctx), run(ctx), renderSubmenu?(ctx) }`; `label` and `icon` are functions of the action context. The returned array order is final; the built-in `order` field only seeds the defaults.

`mediaToolbar` replaces the toolbar element outright — return an element, or `null` to let the host render its own surface (the webapp returns `null` on mobile and renders a bottom-sheet):

```ts
HyperMultimediaKit.configure({
  mediaToolbar: (ctx) => buildCustomToolbar(ctx)
  // mediaToolbar: () => null, // opt out
})
```

`isUploadedMedia` marks which image/video/audio nodes are host uploads, so View original stays hidden for them (it always shows for provider embeds):

```ts
HyperMultimediaKit.configure({
  isUploadedMedia: (ctx) => Boolean(ctx.attrs['data-upload-id'])
})
```

`createMediaToolbar`, `resolveMediaActions`, the `MediaAction` types, and the action handlers (`viewOriginalMedia`, `downloadMedia`, `copyMediaNode`, `removeMediaNode`, `canViewOriginal`, `isDownloadable`) are exported for hosts that build their own surface.

### Caption

Every media node view has an editable `<figcaption>`; the text is stored in the node's `caption` attribute, which is the source of truth — it persists through collaboration, JSON, and same-editor copy/paste. Two limits: markdown export keeps `![alt](src)` only, and standalone-HTML `<figure>/<figcaption>` round-trip (render **and** parse) is supported for `image` only. Video, audio, embeds, and X keep the editable caption and attribute but emit no `<figure>` in HTML, so re-importing exported HTML can't resurrect a caption as stray text.

## Resize

Hover a media node (desktop) or tap it (touch) to activate the gripper: side handles resize one axis, corner handles resize both (hold Shift to lock the aspect ratio). Sizes clamp to the editor content column; committed `width`/`height` live on the node attributes, so resizes persist and sync through collaboration. Escape cancels a drag without committing. X embeds size through toolbar presets instead — see [Embeds](#embeds).

Backspace/Delete removes the hovered media node — unless the caret is in text or a caption, which keep normal editing.

## Paste precedence

`isMediaUrl(url)` lets a host yield media URLs to this kit instead of autolinking them:

```ts
Hyperlink.configure({ shouldAutoLink: (url) => !isMediaUrl(url) })
```

## Image file paste (`editorFileUpload`)

Pasting an image **file** (a screenshot, a copied image) never inserts base64 into the document. The paste handler calls `preventDefault()` and dispatches a `CustomEvent` named `editorFileUpload` on `document` with `{ file, editor }` in `detail` — the host decides where the bytes go (upload, blob URL, …) and inserts the node itself:

```ts
document.addEventListener('editorFileUpload', (event) => {
  const { file, editor } = event.detail
  if (!file?.type.startsWith('image/')) return

  const objectUrl = URL.createObjectURL(file) // or upload and use the remote URL
  editor.commands.setImage({ src: objectUrl, alt: file.name })
})
```

Without a listener, pasted image files are dropped silently. Pasted image **URLs** (plain text) insert an `image` node directly; `data:` URLs follow the `allowBase64` option.

## Loading shell

Remote images, iframe embeds, and X oEmbed show a reserved-size shimmer shell until the asset is ready. Nothing is persisted except the real media node; the shell is node-view UI only. The shell styles ship in `styles.css` and theme via the `--hm-loading-*` tokens above.

Customize or disable on the kit:

```ts
HyperMultimediaKit.configure({
  loadingShell: true // default built-in shell
  // loadingShell: false, // no overlay
  // loadingShell: (ctx) => { ... return overlay HTMLElement }, // replace overlay UI
})
```

Custom overlays should include a `.hm-loading-shell__message` element if you want `markError(message)` to show text. Without it, the host sets `aria-label` on the overlay and shell root instead.

Advanced: `createDefaultMediaLoadingShell`, `wrapMediaWithLoadingShell`, and types are exported from the package entry for hosts that build custom node views.

## Migrating from 1.x

2.0.0 renames node types to camelCase and rebrands Twitter to X. See the [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/CHANGELOG.md) for the full breaking-change list.

**docs.plus / Hocuspocus:** `bun run --filter @docs.plus/hocuspocus.server migrate:media-node-names` (preview with `:dry`).

**External adopters:** rewrite stored JSON/Yjs node `type` strings (`Image`→`image`, `Twitter`→`x`, …). The [media-node-rename runbook](https://github.com/docs-plus/docs.plus/blob/main/apps/hocuspocus.server/docs/migrate-media-node-names.md) lists every mapping even if you do not run the CLI.

## Security

Embed URL parsing rejects invalid hosts before insert (`guards/invalid-urls` in the clean-room suite). X and Loom paste paths have dedicated security specs (`cypress/e2e/security/`). Hosts should still treat pasted URLs as untrusted input — validate storage and CSP for iframe `src` the same way you would for user-authored links.

## TypeScript

Definitions ship in `dist/`. Main exports: `HyperMultimediaKit`, per-node extensions (`Image`, `Youtube`, `X`, …), insert commands (`setImage`, `setX`, …), `isMediaUrl`, loading-shell helpers (`createDefaultMediaLoadingShell`, `wrapMediaWithLoadingShell`), toolbar types (`MediaToolbarContext`, `MediaAction`), and kit options types. Per-node embed options live under each node's module — see [Nodes](#nodes).

## Family

Sibling packages and `@next` install policy: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md).

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
