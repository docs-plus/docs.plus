# HyperMultimedia

[![Version](https://img.shields.io/npm/v/@docs.plus/extension-hypermultimedia.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-hypermultimedia)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-hypermultimedia.svg)](https://npmcharts.com/compare/@docs.plus/extension-hypermultimedia)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-hypermultimedia.svg)](https://www.npmjs.com/package/@docs.plus/extension-hypermultimedia)

Tiptap extension for embedding media in the editor: images, audio, video, and provider embeds (YouTube, Vimeo, SoundCloud, X, Loom). The media toolbar mounts in the node's top-right corner; its overflow and submenu popovers render through [`@docs.plus/floating-popover`](../floating-popover) (Floating UI) — no tippy.js.

| Node         | Embeds               | Docs                                  |
| ------------ | -------------------- | ------------------------------------- |
| `image`      | images (+ markdown)  | [image](./src/nodes/image/)           |
| `audio`      | audio files          | [audio](./src/nodes/audio/)           |
| `video`      | video files          | [video](./src/nodes/video/)           |
| `youtube`    | YouTube videos       | [youtube](./src/nodes/youtube/)       |
| `vimeo`      | Vimeo videos         | [vimeo](./src/nodes/vimeo/)           |
| `soundcloud` | SoundCloud audio     | [soundcloud](./src/nodes/soundcloud/) |
| `x`          | X (formerly Twitter) | [x](./src/nodes/x/)                   |
| `loom`       | Loom recordings      | [loom](./src/nodes/loom/)             |

## Install

```bash
bun add @docs.plus/extension-hypermultimedia
```

## Usage

One `HyperMultimediaKit.configure` call adds every enabled node. Set a node to `false` to disable it; pass an options object to configure it.

```javascript
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

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

## Commands

Each node contributes one insert command; the provider commands return `false` for an invalid URL.

```javascript
editor.commands.setImage({ src: 'https://example.com/photo.png', alt: 'Example' })
editor.commands.setVideo({ src: 'https://example.com/clip.mp4' })
editor.commands.setAudio({ src: 'https://example.com/track.mp3' })
editor.commands.setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
editor.commands.setVimeo({ src: 'https://vimeo.com/123456789' })
editor.commands.setSoundCloud({ src: 'https://soundcloud.com/artist/track' })
editor.commands.setX({ src: 'https://x.com/user/status/123' })
editor.commands.setLoom({ src: 'https://www.loom.com/share/abcdef1234567890' })
```

The embed commands also accept layout options: `width`, `height`, `margin`, `float`, `display`, `justifyContent`. Provider embeds accept player options documented per node (for example YouTube `controls`, `start`, `modestbranding`). Per-node detail lives under [`src/nodes/`](./src/nodes/).

## Paste precedence

`isMediaUrl(url)` lets a host yield media URLs to this kit instead of autolinking them:

```javascript
Hyperlink.configure({ shouldAutoLink: (url) => !isMediaUrl(url) })
```

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

Desktop hosts import the toolbar stylesheet `dist/media-toolbar.css` (renamed from `media-toolbar-popover.css`) alongside the gripper and loading-shell CSS listed below.

### Customizing actions

Two kit hooks, in order of reach.

`mediaActions` rewrites the resolved action list per node — add, hide, or reorder:

```javascript
HyperMultimediaKit.configure({
  mediaActions: (defaults, { nodeType }) => {
    if (nodeType !== 'image') return defaults
    return [
      ...defaults.filter((action) => action.id !== 'download'), // hide one
      { id: 'alt', label: 'Edit alt text', placement: 'menu', run: (ctx) => editAltText(ctx) } // add one
    ]
  }
})
```

A `MediaAction` is `{ id, label, icon?, placement: 'inline' | 'menu', isVisible?(ctx), isActive?(ctx), run(ctx), renderSubmenu?(ctx) }`. The returned array order is final; the built-in `order` field only seeds the defaults.

`mediaToolbar` replaces the toolbar element outright — return an element, or `null` to let the host render its own surface (the webapp returns `null` on mobile and renders a bottom-sheet):

```javascript
HyperMultimediaKit.configure({
  mediaToolbar: (ctx) => buildCustomToolbar(ctx)
  // mediaToolbar: () => null, // opt out
})
```

`isUploadedMedia` marks which image/video/audio nodes are host uploads, so View original stays hidden for them (it always shows for provider embeds):

```javascript
HyperMultimediaKit.configure({
  isUploadedMedia: (ctx) => Boolean(ctx.attrs['data-upload-id'])
})
```

`createMediaToolbar`, `resolveMediaActions`, the `MediaAction` types, and the action handlers (`viewOriginalMedia`, `downloadMedia`, `copyMediaNode`, `removeMediaNode`, `canViewOriginal`, `isDownloadable`) are exported for hosts that build their own surface.

### Caption

Every media node view has an editable `<figcaption>`; the text is stored in the node's `caption` attribute, which is the source of truth — it persists through collaboration, JSON, and same-editor copy/paste. Two limits: markdown export keeps `![alt](src)` only, and standalone-HTML `<figure>/<figcaption>` round-trip (render **and** parse) is supported for `image` only. Video, audio, embeds, and X keep the editable caption and attribute but emit no `<figure>` in HTML, so re-importing exported HTML can't resurrect a caption as stray text.

## Loading shell (built-in UX)

Remote images, iframe embeds, and X oEmbed show a reserved-size shimmer shell until the asset is ready — same pattern as Notion/Slack embed cards. Nothing is persisted except the real media node; the shell is node-view chrome only.

Import the stylesheets next to the resize gripper CSS:

```javascript
import '@docs.plus/extension-hypermultimedia/dist/resize-gripper.css'
import '@docs.plus/extension-hypermultimedia/dist/media-loading-shell.css'
import '@docs.plus/extension-hypermultimedia/dist/media-toolbar.css'
```

Theme with CSS variables on the editor root (see `src/styles/media-loading-shell.css`): `--hm-loading-bg`, `--hm-loading-shimmer`, `--hm-loading-provider`, `--hm-loading-message`, `--hm-loading-spinner-active`.

Customize or disable on the kit:

```javascript
HyperMultimediaKit.configure({
  loadingShell: true // default built-in shell
  // loadingShell: false, // no overlay
  // loadingShell: (ctx) => { ... return overlay HTMLElement }, // replace overlay UI
})
```

Custom overlays should include a `.hm-loading-shell__message` element if you want `markError(message)` to show text. Without it, the host sets `aria-label` on the overlay and shell root instead.

Advanced: `createDefaultMediaLoadingShell`, `wrapMediaWithLoadingShell`, and types are exported from the package entry for hosts that build custom node views.

## Migrating from 1.x

2.0.0 renames node types to camelCase and rebrands Twitter to X. See the [CHANGELOG](./CHANGELOG.md) for the full breaking-change list, and the [media-node-rename runbook](../hocuspocus.server/docs/migrate-media-node-names.md) to migrate stored documents.

## Links

- Extension: [extensions/extension-hypermultimedia](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia)
- Inspired by Tiptap's [extension-image](https://tiptap.dev/api/nodes/image) and [extension-youtube](https://tiptap.dev/api/nodes/youtube). Not affiliated with Tiptap.
- [Connect with us](https://github.com/docs-plus/docs.plus#-connect-with-us).
