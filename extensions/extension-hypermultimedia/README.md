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

Tiptap extension for embedding media in the editor: images, audio, video, and provider embeds (YouTube, Vimeo, SoundCloud, Spotify, X, Loom).

One `HyperMultimediaKit.configure` call adds all nine nodes. Every node gets a media toolbar in its top-right corner, an editable caption, and a loading shell. Eight of the nine also get drag-to-resize; the `x` node sizes through toolbar `maxwidth` presets instead. Toolbar popovers position through [`@docs.plus/floating-popover`](https://github.com/docs-plus/docs.plus/tree/main/packages/floating-popover) and tooltips through [`@docs.plus/floating-tooltip`](https://github.com/docs-plus/docs.plus/tree/main/packages/floating-tooltip). Both are bundled into `dist` — no tippy.js.

## Install

```sh
bun add @docs.plus/extension-hypermultimedia
```

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x).

Installs one runtime dependency, `@floating-ui/dom`. The popover engine and the tooltip engine ship inside `dist`, so they add no further install.

The Quickstart also imports `@tiptap/starter-kit`. Add it with `bun add @tiptap/starter-kit` when your app has none yet.

Markdown round-trip is optional and needs `bun add @tiptap/markdown` — see [Markdown import/export](#markdown-importexport).

Co-install [`@docs.plus/extension-hyperlink`](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hyperlink) when marks and media share one editor, then read [Paste precedence](#paste-precedence).

Upgrading from `1.x`? Version 2.0.0 renames the stored node types to camelCase and renames `Twitter` to `x` — see [Migrating from 1.x](#migrating-from-1x).

## Quickstart

The host page needs one mount point: `<div id="editor"></div>`. The snippet then renders one image node you can hover.

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'
// Required. Without it the toolbar, gripper, caption and loading shell render unstyled.
// The gripper is the drag-handle overlay the kit draws on the media node.
import '@docs.plus/extension-hypermultimedia/styles.css'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  content: '<img src="https://example.com/photo.png">',
  extensions: [
    StarterKit,
    HyperMultimediaKit.configure({
      // `inline: true` moves the node into the inline group, so it flows in a paragraph.
      // `allowBase64: true` admits `data:image/*` sources on paste and on parse.
      Image: { inline: true, allowBase64: true },
      Vimeo: { inline: true },
      // `false` drops the node. Do not set `resizeGripper: false` instead:
      // that removes the whole media toolbar for the node, not only the drag handles.
      SoundCloud: false
    })
  ]
})
```

The snippet drops SoundCloud on purpose, to show what `false` does. Hover the rendered image to reach the [Media toolbar](#media-toolbar). The snippet has no host wiring for pasted image files, and no veto for a link extension. [Paste and import](#paste-and-import) covers both: [Image file paste (`editorFileUpload`)](#image-file-paste-editorfileupload) owns the file path, and [Paste precedence](#paste-precedence) owns the link veto. [Styling](#styling) owns the visual contract.

## Options

Every option below goes inside one `HyperMultimediaKit.configure({ … })` call. The kit declares no `addOptions`. Every key starts as `undefined`, except `loadingShell`, which kit storage reads as `true`.

| Option                                                                         | Type                                                                                                                                                                                                                                                                          | Default     | Description                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Image`, `Audio`, `Video`, `Youtube`, `Vimeo`, `SoundCloud`, `Spotify`, `Loom` | `Partial<ImageOptions>`, `Partial<AudioOptions>`, `Partial<VideoOptions>`, `Partial<YoutubeOptions>`, `Partial<VimeoOptions>`, `Partial<SoundCloudOptions>`, `Partial<SpotifyOptions>` or `Partial<LoomOptions>`, each `& { resizeGripper?: boolean }`, or `true`, or `false` | `undefined` | Per-node options object. `true` keeps the node defaults, `false` drops the node. See [`resizeGripper`](#resizegripper).                                                              |
| `X`                                                                            | `Partial<XOptions> \| true \| false`                                                                                                                                                                                                                                          | `undefined` | Same shape, without `resizeGripper`. The `x` node never gets drag handles.                                                                                                           |
| `mediaToolbar`                                                                 | `MediaToolbarFactory`                                                                                                                                                                                                                                                         | `undefined` | Media toolbar factory. Return an element, or `null` so the host renders its own surface. Falls back to `createMediaToolbar`. See [Bring your own toolbar](#bring-your-own-toolbar).  |
| `mediaActions`                                                                 | `MediaActionsResolver`                                                                                                                                                                                                                                                        | `undefined` | Rewrites the resolved action list per node. Falls back to the base actions plus the per-node recipe. See [Customizing actions](#customizing-actions).                                |
| `mediaToolbarIcons`                                                            | `MediaToolbarIconsResolver`                                                                                                                                                                                                                                                   | `undefined` | Swaps toolbar and menu SVG markup by icon key. Falls back to the Google Material Symbols set. See [Customizing actions](#customizing-actions).                                       |
| `replaceUrlPopover`                                                            | `ReplaceUrlPopoverFactory`                                                                                                                                                                                                                                                    | `undefined` | Replace URL form factory. Return an element, or `null` for a host surface. Falls back to `createReplaceUrlPopover`. See [Customizing actions](#customizing-actions).                 |
| `isUploadedMedia`                                                              | `(ctx: MediaActionContext) => boolean`                                                                                                                                                                                                                                        | `undefined` | Marks `image`, `video` and `audio` nodes as host uploads, so View original stays hidden. An absent hook reads as `false`.                                                            |
| `loadingShell`                                                                 | `MediaLoadingShellOption`                                                                                                                                                                                                                                                     | `true`      | `true` for the built-in shell, `false` for none, or a factory that replaces the shell overlay. An unset value falls back to the built-in shell. See [Loading shell](#loading-shell). |

The nine per-node interfaces are not exported from the package entry. Reach the kit shape through the exported `HyperMultimediaKitOptions`.

### `resizeGripper`

`resizeGripper: false` removes the whole media toolbar for that node, not only the drag handles. The kit drops the node from its resizable list, so it builds no gripper widget. The hover controls layer then returns before it mounts the toolbar, because only the `x` node may run toolbar-only. That node loses Align, Margin, Caption, View original, Download, Replace URL, Copy and Delete as well.

Keep the gripper on when you want the toolbar. To remove the drag handles alone, replace the media toolbar with [`mediaToolbar`](#bring-your-own-toolbar).

### Per-node options

Each node slot accepts these keys. They are node options, not kit keys, so they go inside the node's own object.

| Option            | Type                             | Default      | Nodes                                                                                                                                                    |
| ----------------- | -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resizeGripper`   | `boolean`                        | `undefined`  | All except `x`. An unset value reads as `true`. Only an explicit `false` drops the node from the resizable list — see [`resizeGripper`](#resizegripper). |
| `width`           | `number \| null`                 | per node     | `image`, `video`, `youtube`, `vimeo`, `soundcloud`, `spotify`, `loom` — see [Default sizes](#default-sizes).                                             |
| `height`          | `number \| null`                 | per node     | `image`, `video`, `youtube`, `vimeo`, `soundcloud`, `spotify`, `loom` — see [Default sizes](#default-sizes).                                             |
| `inline`          | `boolean`                        | `false`      | All nine. `true` moves the node from the `block` group to `inline`.                                                                                      |
| `addPasteHandler` | `boolean`                        | `true`       | `youtube`, `vimeo`, `soundcloud`, `spotify`, `loom`, `x`. `false` stops a pasted provider URL from becoming a node.                                      |
| `HTMLAttributes`  | `Record<string, unknown>`        | `{}`         | All nine. The node merges it into the rendered element.                                                                                                  |
| `margin`          | `string \| null`                 | `'auto'`     | All nine.                                                                                                                                                |
| `float`           | `string \| null`                 | `null`       | All nine.                                                                                                                                                |
| `clear`           | `string`                         | `'none'`     | All nine.                                                                                                                                                |
| `display`         | `string`                         | `'block'`    | All nine.                                                                                                                                                |
| `justifyContent`  | `string \| null`                 | `'start'`    | Every node except `image`, which has no such attribute.                                                                                                  |
| `allowBase64`     | `boolean`                        | `false`      | `image` only. Gates the parse rule and the paste plugin.                                                                                                 |
| `controls`        | `boolean`                        | `true`       | `video`, `audio`.                                                                                                                                        |
| `autoplay`        | `boolean`                        | `false`      | `video`, `audio`.                                                                                                                                        |
| `loop`            | `boolean`                        | `false`      | `video`, `audio`.                                                                                                                                        |
| `muted`           | `boolean`                        | `false`      | `video`, `audio`.                                                                                                                                        |
| `preload`         | `'none' \| 'metadata' \| 'auto'` | `'metadata'` | `video`, `audio`.                                                                                                                                        |
| `poster`          | `string \| null`                 | `null`       | `video` only.                                                                                                                                            |

Player parameters are per node — see [Embeds](#embeds) for the provider keys, and [Nodes](#nodes) for each node's full table.

### Default sizes

`width` and `height` are node attributes, and seven of the nine also expose them as node options. A provider insert command fills a missing value from the table below, then fits the result to the editor content column. `setImage` fits only when you pass both. `setAudio` never fits.

| Node         | `width` default | `height` default                                             |
| ------------ | --------------- | ------------------------------------------------------------ |
| `image`      | `null`          | `null` — the node view lays the shell out at 320 × 240       |
| `audio`      | `null`          | `null` — the node view lays the shell out at 450 × 120       |
| `video`      | `640`           | `480`                                                        |
| `youtube`    | `640`           | `480`                                                        |
| `vimeo`      | `640`           | `480`                                                        |
| `loom`       | `640`           | `480`                                                        |
| `spotify`    | `640`           | `352`, and `152` when the URL is a track                     |
| `soundcloud` | `450`           | `120`                                                        |
| `x`          | no attribute    | no attribute — the node sizes from `maxwidth`, default `400` |

## Commands

Ten commands land on `editor.commands`. Each provider insert command returns `false` for a `src` that fails its provider check. `setImage`, `setVideo` and `setAudio` return `false` only for an empty `src`. No insert command runs the scheme gate — see [Security](#security).

```ts
editor.commands.setImage({ src: 'https://example.com/photo.png', alt: 'Example' })
editor.commands.setVideo({ src: 'https://example.com/clip.mp4' })
editor.commands.setAudio({ src: 'https://example.com/track.mp3' })
editor.commands.setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
editor.commands.setVimeo({ src: 'https://vimeo.com/123456789' })
editor.commands.setSoundCloud({ src: 'https://soundcloud.com/artist/track' })
editor.commands.setSpotify({ src: 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl' })
editor.commands.setX({ src: 'https://x.com/user/status/123' })
editor.commands.setLoom({ src: 'https://www.loom.com/share/abcdef1234567890' })
editor.commands.updateImageDimensions({ keyId: 'abc123', width: 480, height: 320 })
```

`updateImageDimensions` edits an image that already sits in the document. It finds the node by its `keyId` attribute and writes `width` and `height`. It returns `false` when no image carries that `keyId`, so `editor.can()` reports a miss. `setImage` writes a fresh `keyId` on every insert, and a host reads it back with `node.attrs.keyId`.

Chain any of them like a normal Tiptap command:

```ts
editor.chain().focus().setYoutubeVideo({ src: 'https://youtu.be/dQw4w9WgXcQ', start: 42 }).run()
```

Every insert command accepts the layout options `width`, `height`, `margin`, `float`, `clear` and `display`. Every command except `setImage` also accepts `justifyContent`. `setX` is the exception on size: the `x` node declares no `width` and no `height` attribute, so both values type-check and then do nothing. Size an X post through `maxwidth`:

```ts
editor
  .chain()
  .focus()
  .setX({
    src: 'https://x.com/user/status/123',
    maxwidth: 550,
    theme: 'dark'
  })
  .run()
```

`setImage` also accepts `caption`. The other eight nodes carry the same `caption` attribute and no `caption` insert option. Set one from the media toolbar, or select the node and write the attribute. Read a caption back with `node.attrs.caption`:

```ts
editor.commands.setImage({ src: 'https://example.com/photo.png', caption: 'Figure 1' })
// Select the node first. The other seven non-image nodes take the same shape.
editor.commands.updateAttributes('video', { caption: 'Figure 2' })
```

Pass provider player options on the insert call — see [Embeds](#embeds).

## Keyboard shortcuts

The kit declares no `addKeyboardShortcuts`. A `keydown` listener binds every key below, on the caption element, the Replace URL field, the resize drag, or the document.

| Shortcut               | Context            | Action                                                                               |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `Enter`                | `media caption`    | Commits the caption text, blurs the field, and returns focus to the editor.          |
| `Enter`                | `replace-URL form` | Submits the URL. An invalid URL shows an inline error and the form stays open.       |
| `Escape`               | `media toolbar`    | Dismisses the toolbar and refocuses the editor, once focus sits on a toolbar button. |
| `Escape`               | `resize drag`      | Cancels the drag. The node keeps the size it had before the drag started.            |
| `Shift` (held)         | `resize drag`      | Locks the aspect ratio while a corner handle moves.                                  |
| `Backspace` / `Delete` | `document`         | Deletes the media node under the active hover controls.                              |

Hover opens the media toolbar and moves no focus. So `Escape` acts only after a click or a tab into a toolbar button. The `Escape` handler also skips the key when focus sits inside a `.floating-popover`, because the popover closes itself first. The delete-key handler ignores `Backspace` and `Delete` with `Meta`, `Control` or `Alt`, and during IME composition. It also ignores them inside a media form control, inside the caption, and while the focused editor holds a text selection.

The `x` node sets `priority: 101`, above the Tiptap default of `100`. That number decides parse-rule order, not key order: it lets `blockquote.twitter-tweet` parse as an X embed before the StarterKit blockquote rule claims it. No extension in the kit contests a key with another.

## Caveats

The media toolbar, the paste path, the insert commands and the caption each carry a limit the Quickstart does not show.

- **`resizeGripper: false` removes the whole media toolbar for that node.** The kit drops the node from its resizable list, and the hover controls layer then returns before it mounts the toolbar. Only the `x` node may run toolbar-only. Keep the gripper on, or replace the media toolbar with [`mediaToolbar`](#bring-your-own-toolbar).
- **Without `styles.css` the toolbar, gripper, caption and loading shell render unstyled.** With the stylesheet loaded, the shell holds `.hm-media-slot` at `opacity: 0` until it settles. A shell that never settles then renders an invisible player. Import the stylesheet — see [Styling](#styling).
- **A tap opens the media toolbar for `image` and `audio` only.** The click path returns early on every provider embed and on `video`, so their in-frame play and scrub controls keep working. Those nodes have no touch entry point to the toolbar today. Return `null` from `mediaToolbar` on mobile and render your own surface.
- **Hover controls need a fine pointer.** The kit reads `matchMedia('(pointer: fine)')` once and gates hover on it. A coarse-pointer device reaches the toolbar through the click path above.
- **A link extension can claim a media URL before the kit sees it.** Veto media URLs in the link extension: `Hyperlink.configure({ shouldAutoLink: (url) => !isMediaUrl(url) })`. See [Paste precedence](#paste-precedence).
- **`isMediaUrl` matches every provider, whatever the kit configuration says.** A host that disables providers then vetoes URLs nothing will claim. Compose the veto from the per-provider validators you enabled.
- **`setImage`, `setVideo` and `setAudio` accept any non-empty `src` string.** The scheme gate runs on `parseHTML`, on markdown import, and in the Replace URL form, never in the commands. Validate host-supplied URLs before you call them. See [Security](#security).
- **`setX` types `width` and `height` but the `x` node stores neither.** `setX` accepts both values, and the node then ignores them. Size an X post with `maxwidth`.
- **`dnt` cannot be set per node.** It is a kit option and a node attribute, but `AddXOptions` omits it, so `setX` cannot write it in a type-safe way. Set it on the kit.
- **A drag can appear to stop early.** Resize clamps to a 160 × 80 minimum, and `soundcloud` and `spotify` raise the height floor further. See [Resize](#resize).
- **A caption survives HTML round-trip for `image` only.** Every other node keeps the editable caption and the attribute, but emits no `<figure>`, so clipboard copy and the toolbar Copy action drop the text. Markdown export drops every caption. See [Caption](#caption).
- **The paste handler drops pasted image files silently without a listener.** Add an `editorFileUpload` listener and insert the nodes yourself — see [Image file paste (`editorFileUpload`)](#image-file-paste-editorfileupload).

## Styling

The package ships one stylesheet. It carries the resize gripper, the loading shell, the media toolbar, the caption, and the `x`, `loom` and `spotify` embed styles.

```ts
import '@docs.plus/extension-hypermultimedia/styles.css'
```

### Theming

Every visual token is a `--hm-*` CSS custom property, declared with `light-dark()`. The toolbar, loading shell, gripper and caption follow the nearest ancestor's `color-scheme`. Set `color-scheme: light | dark` on `<html>` or any ancestor and they flip with it. Under the default `color-scheme: normal` they follow the OS `prefers-color-scheme`.

The X embed plate keys on the node's own `theme` attribute instead, so the plate matches what the embedded widget renders.

| Token                         | Description                                |
| ----------------------------- | ------------------------------------------ |
| `--hm-toolbar-bg`             | Toolbar and menu background                |
| `--hm-toolbar-fg`             | Toolbar icon and menu text color           |
| `--hm-toolbar-border`         | Toolbar and menu borders                   |
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

Override any token to retheme:

```css
:root {
  --hm-toolbar-active: #ecfdf5;
  --hm-resize-border: #059669;
}
```

The shimmer and spinner animations are disabled under `prefers-reduced-motion: reduce`.

### Class names

These names are the stable styling contract. A custom toolbar, a custom action and a custom loading overlay all hook into the same class names.

| Class or attribute                                                      | Element                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `.media-toolbar`                                                        | Toolbar root, in the built-in top-right skin.                                       |
| `[data-hm-toolbar]`                                                     | Lifecycle marker. The kit stamps this on every mounted toolbar, built-in or custom. |
| `.hm-has-toolbar`                                                       | On the media wrapper while a toolbar is mounted.                                    |
| `.media-toolbar__button`                                                | Inline action button. Adds `--active` when toggled.                                 |
| `.media-toolbar__button--text`                                          | Inline button with a text label, used when no icon resolves for the id.             |
| `.media-toolbar__more`                                                  | The `…` overflow trigger.                                                           |
| `.media-toolbar__divider`                                               | Separator grouping inline actions.                                                  |
| `.media-toolbar__menu`                                                  | Overflow menu body. Rows are `__menu-item`, plus `--active`.                        |
| `.media-toolbar__menu-section` / `.media-toolbar__menu-heading`         | Expanded submenu block inside the overflow menu, and its title.                     |
| `.media-toolbar__submenu`                                               | Submenu body. Rows are `__submenu-item`, plus `--active`.                           |
| `.media-toolbar__submenu-section` / `.media-toolbar__submenu-heading`   | Grouped rows inside a submenu, and the group title (X Size and Theme).              |
| `.media-toolbar__input`                                                 | URL field in the Replace URL form.                                                  |
| `.media-toolbar__error`                                                 | Validation message under the URL field.                                             |
| `.floating-tooltip`                                                     | Shared hover and focus tooltip bubble on icon buttons.                              |
| `.floating-popover`                                                     | Positioning container for every menu and form the toolbar opens.                    |
| `.hm-caption`                                                           | Editable `<figcaption>`. Adds `--empty` when the text is blank.                     |
| `.hypermultimedia--figure`                                              | The node emits this `<figure>` wrapper for a captioned image.                       |
| `.hypermultimedia--<type>__content`                                     | Media wrapper per node, for example `.hypermultimedia--youtube__content`.           |
| `.hypermultimedia__resize-gripper`                                      | Gripper widget. Adds `--active` on hover and `--dragging` during a drag.            |
| `.hypermultimedia--resize-dragging`                                     | On `<html>` for the duration of a drag.                                             |
| `.hm-media-host` / `[data-hm-loading]`                                  | Loading shell host, and its `pending` / `ready` / `error` state.                    |
| `.hm-media-host--plain` / `.hm-media-host--fluid`                       | Host with the shell disabled, and host after an X embed settles.                    |
| `.hm-media-slot`                                                        | Holds the real media. Stays at `opacity: 0` until the shell settles.                |
| `.hm-loading-shell` / `.hm-loading-shell__overlay`                      | Overlay root. The kit stamps this on the built-in overlay and on a custom one.      |
| `.hm-loading-shell__body`                                               | Row holding the provider label, message and spinner.                                |
| `.hm-loading-shell__provider` / `__message` / `__shimmer` / `__spinner` | Provider label, status text, shimmer sweep, spinner.                                |

## Nodes

The kit ships nine nodes. Each one has its own README with the full option table and the paste rules.

| Node         | Embeds                        | Docs                                                                                                                     |
| ------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `image`      | images (+ markdown)           | [image](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/image)           |
| `audio`      | audio files (+ markdown)      | [audio](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/audio)           |
| `video`      | video files (+ markdown)      | [video](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/video)           |
| `youtube`    | YouTube videos (+ markdown)   | [youtube](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/youtube)       |
| `vimeo`      | Vimeo videos (+ markdown)     | [vimeo](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/vimeo)           |
| `soundcloud` | SoundCloud audio (+ markdown) | [soundcloud](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/soundcloud) |
| `spotify`    | Spotify player (+ markdown)   | [spotify](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/spotify)       |
| `x`          | X / Twitter (+ markdown)      | [x](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/x)                   |
| `loom`       | Loom recordings (+ markdown)  | [loom](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/loom)             |

### Gallery

The shots below show every node the kit ships: the local asset files `image`, `video` and `audio`, and the six provider embeds. Each shot pairs a light capture and a dark capture, and your system preference picks one. Every shot hovers the node, so the media toolbar and the gripper both show. The `x` node has no gripper, so its shot shows the media toolbar alone.

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
<summary><strong>Spotify</strong></summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/spotify-dark.png">
    <img alt="Spotify playlist embed player" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/spotify-light.png">
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

Provider embeds resolve options in two layers. Kit defaults come from `HyperMultimediaKit.configure({ Youtube: { … } })`, node attributes come from the insert call such as `setYoutubeVideo({ … })`, and node attributes win. The option key you write and the query name the kit emits are not always the same word, so both are named below.

**YouTube** maps camelCase option keys to the official iframe query names: `ccLanguage` → `cc_lang_pref`, `disableKBcontrols` → `disablekb`, `ivLoadPolicy` → `iv_load_policy`, `endTime` → `end`, `interfaceLanguage` → `hl`, `enableIFrameApi` → `enablejsapi`. Defaults: `controls: 1`, `modestbranding: 0`, `loop: 0`, `rel: 1`, `fs: 1`, `autoplay: 0`, `playsinline: 0`, `nocookie: false`, `ccLanguage: undefined`. Paste reads `start` from `?t=`, `?start=` or `#t=`. `loop: 1` auto-fills `playlist` with the video id. `nocookie: true` embeds from `youtube-nocookie.com`.

**Vimeo** writes the option key `start` as the query name `start_time`, and defaults to `0`. Player defaults include `controls: true`, `title: true`, `byline: true`, `portrait: true`, `quality: 'auto'`, `transparent: true`, `dnt: false`. A `color` value drops a leading `#` before it reaches the query. An unlisted video keeps its `?h=` access token through both parse and render.

**Loom** writes the option keys `hideOwner`, `hideShare`, `hideTitle` and `hideEmbedTopBar` as the query names `hide_owner`, `hide_share`, `hide_title` and `hideEmbedTopBar`. All four default to `false`. `autoplay` and `muted` default to `0`. A host that writes `hide_title` gets a type error and no effect.

**SoundCloud** passes the HTML5 widget parameters straight through, so the option key and the query name match: `auto_play`, `show_comments`, `show_user`, `show_reposts`, `show_artwork`, `show_playcount`, `hide_related`, `buying`, `sharing`, `download`, `single_active`, `start_track`, `color`. `visual` defaults to `false` and also drives the resize height floor: `166` when visual, `120` when compact. A stored `height` above `130` turns the visual player on by itself.

**Spotify** builds `open.spotify.com/embed/{type}/{id}` from any `track`, `album`, `playlist`, `artist`, `show` or `episode` URL. The Spotify node also accepts a `spotify:type:id` URI, an `intl-xx` path, an already-`embed` path, and the "Copy embed" `<iframe>` markup. Two paths rewrite `src` to the canonical share URL: `parseHTML` and the pasted `<iframe>` rule. `setSpotify` and a pasted plain URL store the string you pass. `theme` is `0` for dark and `1` for light; leaving it unset lets Spotify render its own default, which is dark. The player is fixed-height, so it pins its height on a narrow column instead of scaling like a video embed.

**X** sizes through the oEmbed `maxwidth` presets Compact `280`, Standard `400` and Wide `550`. The toolbar Post options menu switches both `maxwidth` and `theme`. `maxwidth` defaults to `400`. `theme` defaults to `'light'`, `lang` to `'en'`, `hide_media` and `hide_thread` to `false`. An X post reads its own `theme` attribute, not the page `color-scheme` — see [Theming](#theming). `dnt` defaults to `true` and is a kit option only, because `AddXOptions` omits it. The `align` attribute is a schema attribute passed straight to oEmbed, with no kit option and no `setX` field. The `x` node has no drag-resize.

## Media toolbar

Hovering a media node on a fine-pointer device opens the media toolbar at the node's top-right corner. Common actions sit inline, and the rest live behind a `…` overflow menu. Icon-only buttons show a floating tooltip on hover or focus.

A tap opens the same toolbar for `image` and `audio` only. Every provider embed and the `video` node keep their in-frame controls on touch, so a tap never reaches the toolbar there. Wire a host surface for those cases — see [Bring your own toolbar](#bring-your-own-toolbar).

| Action                     | `id`            | Placement | Nodes                                                                                   |
| -------------------------- | --------------- | --------- | --------------------------------------------------------------------------------------- |
| Align                      | `align`         | inline    | all                                                                                     |
| Margin                     | `margin`        | inline    | all — wrap placements only                                                              |
| Caption                    | `caption`       | inline    | all                                                                                     |
| View original              | `view-original` | inline    | any node with a `src`; `isUploadedMedia` hides it for an uploaded image, video or audio |
| Download                   | `download`      | inline    | image, video, audio — and only with a `src`                                             |
| Replace URL                | `replace`       | overflow  | every node, including one with an empty or broken `src`                                 |
| Copy                       | `copy`          | overflow  | all                                                                                     |
| Delete                     | `delete`        | overflow  | all                                                                                     |
| Post options (size, theme) | `x-options`     | overflow  | x                                                                                       |

`composeMediaActions`, `layoutMediaActions` and `mediaToolbarIcons` all key on the `id` column — see [Customizing actions](#customizing-actions).

Align places the node Left, Center, Right, Wrap left or Wrap right. Those five labels map to the `MediaPlacementId` values `inline`, `center`, `right`, `float-left` and `float-right`, in that order. The two wrap placements add a Margin button beside Align, separated from the rest by a divider. The Margin button shows the current gap and opens the presets in a popover, from `0"` to `1"`, with `1/2"` as the default.

View original opens the `src` in a new tab. Its own allowlist admits `https:`, `http:`, `blob:` and a root-relative path, so an uploaded blob still opens. Download fetches the file and saves it, then falls back to opening a tab when the fetch fails.

Replace URL sits in the `…` overflow menu. It opens the URL form in a popover anchored below the node, and it flips above the node when the space below is too small. Confirming swaps the node's `src` in place, keeping the same node, caption, size and placement. It validates against the node's own provider, so a YouTube node only accepts another YouTube URL. It never changes the node type. It stays available on a node whose `src` is empty or broken, because that is how you repair a node with a broken `src`.

### Customizing actions

Three kit hooks change the media toolbar. They appear below from the widest reach to the narrowest.

`mediaActions` rewrites the resolved action list per node. Each action carries a stable `id`. `placement` picks the row — the inline bar or the `…` overflow — and array order is final within each row. `composeMediaActions` is an immutable builder. Rearrange by id instead of splicing arrays:

```ts
import { composeMediaActions } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  mediaActions: (defaults, { nodeType }) =>
    composeMediaActions(defaults)
      .add(
        // `editAltText` is a host-defined handler typed `(ctx: MediaActionContext) => void`.
        { id: 'alt', label: () => 'Edit alt text', placement: 'overflow', run: editAltText },
        { after: 'replace' }
      )
      .move('caption', { after: 'align' })
      .toOverflow('download')
      .remove('copy')
      .result()
})
```

Builder verbs: `add(action, { before | after })`, `move`, `replace`, `remove`, `setPlacement`, `toInline`, `toOverflow`, `order(ids)`, `has`, `result`. `add` inserts a new id, and moves an existing one.

For pure rearrangement, `layoutMediaActions` is the declarative form. List the ids per row; an unlisted known action keeps its placement and appends after:

```ts
import { layoutMediaActions } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  mediaActions: layoutMediaActions({
    inline: ['align', 'caption'],
    overflow: ['replace', 'copy', 'delete']
  })
})
```

A `MediaAction` is `{ id, label, icon?, placement: 'inline' | 'overflow', isVisible?(ctx), isActive?(ctx), run?(ctx), renderSubmenu?(ctx), dividerAfter? }`. `run` and `renderSubmenu` are mutually exclusive: with both set, `renderSubmenu` wins and `run` never fires. A built-in action omits `icon`, and the Material Symbols defaults resolve by `id`, plus `align:<placement>` for alignment. A custom action can omit `icon` too and supply SVG through `mediaToolbarIcons`, or set `icon` for a one-off override. An action with no icon renders as a text button carrying `.media-toolbar__button--text`. `dividerAfter` renders a separator after the action, as the Margin button does.

`mediaToolbarIcons` swaps SVG markup without touching toolbar layout. Keys:

| Key                                                                                    | Slot                                                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `caption`, `view-original`, `download`, `replace`, `copy`, `delete`, `more`            | Built-in toolbar / overflow                                                                               |
| `align:inline`, `align:center`, `align:right`, `align:float-left`, `align:float-right` | Inline align button + alignment submenu. `align:inline` is the Left placement, not the inline node group. |
| Custom action `id` (for example `comment`)                                             | Actions you add through `mediaActions`                                                                    |

Return `null` or `undefined` to keep the built-in Material Symbols icon; return markup to override it.

`replaceUrlPopover` swaps the Replace URL form content. The factory receives `ReplaceUrlPopoverOptions` — `{ editor, nodeType, nodePos, src, validate, apply, close }`. `validate` returns an error message or `null`, and `apply` commits the normalized URL and closes. Return the element to mount, or `null` so the host renders its own surface, the way the docs.plus webapp opens a bottom sheet on mobile. The built-in content `createReplaceUrlPopover` and the action's open path `openReplaceUrlPopover` are both exported for reuse.

`isUploadedMedia` marks which `image`, `video` and `audio` nodes are host uploads, so View original stays hidden for them. View original always shows for a provider embed that carries a `src`:

```ts
HyperMultimediaKit.configure({
  isUploadedMedia: (ctx) => Boolean(ctx.attrs['data-upload-id'])
})
```

### Caption

Every media node view carries an editable `<figcaption>`. The text lives in the node's `caption` attribute, which is the source of truth, so it persists through collaboration and JSON. The toolbar Caption action reveals and focuses the field, and `Enter` commits.

Two limits apply. Markdown export keeps `![alt](src)` only, so it never carries a caption. The kit round-trips `<figure>` and `<figcaption>` for `image` only, meaning it both renders and parses them. Video, audio, the provider embeds and X keep the editable caption and the attribute, but they emit no `<figure>` in HTML. Every path that serializes to HTML therefore drops their caption, including clipboard copy and the toolbar Copy action. Re-importing exported HTML cannot bring a caption back as stray text.

### Bring your own toolbar

The `mediaToolbar` factory owns the whole media toolbar. It receives `MediaToolbarOptions` — `{ target, editor, nodeType, nodePos }`. Return the element to mount, or `null` so the host renders its own surface elsewhere. The docs.plus webapp returns `null` on mobile and opens a bottom sheet:

```ts
HyperMultimediaKit.configure({
  mediaToolbar: (options) => {
    if (window.matchMedia('(max-width: 640px)').matches) {
      openMobileSheet(options) // host-owned surface
      return null
    }
    return buildDesktopBar(options)
  }
})
```

A factory that returns `null` still keeps the resize gripper and the delete-key handling. Only `resizeGripper: false` removes both.

The kit stamps `data-hm-toolbar` on the mounted element, reuses that element on re-hover, and removes it on dismissal. No class is required. You own positioning inside the media wrapper. Add the `.media-toolbar` class to adopt the built-in top-right skin. [Class names](#class-names) holds the rest of the contract.

Two rules bind action handlers:

- **Re-resolve the position.** `nodePos` is a snapshot at open, and an edit above the node shifts it. Call `resolveMediaNodePos(editor.view, target, nodeType)` at action time.
- **Use the popover helpers** for anchored menus. `openToolbarPopover(trigger, body, kind)` toggles a menu popover, and a second click on the same kind closes it. Pass `{ positionReference }` to align against a larger surface such as the media toolbar. Prefer `openMediaPopover({ kind, content, trigger, variant })` for a new call site — it sets the dismiss and shift options and also powers the Replace URL form. Outside-click and `Escape` dismissal are built in, and `closeToolbarPopover()` closes it.

`attachTooltip(myButton, 'Do thing')` gives a custom button the built-in hover and focus tooltip. It returns a detach function for a toolbar that re-renders in place.

```ts
import {
  closeToolbarPopover,
  removeMediaNode,
  resolveMediaNodePos
} from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  mediaToolbar: ({ target, editor, nodeType }) => {
    const bar = document.createElement('div')
    bar.className = 'media-toolbar' // optional: built-in top-right skin

    const remove = document.createElement('button')
    remove.className = 'media-toolbar__button'
    remove.textContent = 'Remove'
    remove.onclick = () => {
      const nodePos = resolveMediaNodePos(editor.view, target, nodeType)
      if (nodePos === null) return
      const node = editor.state.doc.nodeAt(nodePos)
      if (!node) return
      removeMediaNode({
        editor,
        nodeType,
        nodePos,
        attrs: node.attrs,
        wrapper: target,
        close: closeToolbarPopover
      })
    }

    bar.append(remove)
    return bar
  }
})
```

`createMediaToolbar`, `resolveMediaActions` and the `MediaAction` types are exported. So are the action handlers `viewOriginalMedia`, `downloadMedia`, `copyMediaNode`, `removeMediaNode`, `canViewOriginal` and `isDownloadable`, and the tooltip helpers `attachTooltip` and `hideTooltip`. A custom toolbar can reuse the built-in behavior instead of rewriting it.

## Resize

Hovering a media node on a fine-pointer device activates the gripper. A tap activates the gripper for `image` and `audio` only, on the same click path the media toolbar uses. Side handles resize one axis, and corner handles resize both. Hold `Shift` on a corner to lock the aspect ratio.

Sizes clamp to a `160` × `80` minimum and to the editor content column as the maximum. The `soundcloud` node raises the height floor to `120` compact or `166` visual. The `spotify` node raises it to `352`, or `152` for a track. A drag that seems to stop early has hit one of those floors.

Committed `width` and `height` land on the node attributes, so a resize persists and syncs through collaboration. `Escape` cancels a drag without committing. `Backspace` or `Delete` removes the hovered media node, unless the caret sits in text or in a caption, which keep normal editing.

The `x` node has no gripper at all. Size an X post through the toolbar `maxwidth` presets — see [Embeds](#embeds).

## Paste and import

Media reaches the document three ways: a markdown token, a pasted URL, and a pasted image file. Each has its own rules.

### Markdown import/export

With `@tiptap/markdown` loaded, every media node round-trips through typed `![alt](src)` syntax. Use the node name as the alt literal for non-image media:

| Node         | Import / export syntax                                      |
| ------------ | ----------------------------------------------------------- |
| `image`      | `![alt text](src)` — caption is not exported                |
| `audio`      | `![audio](src)` — optional `width=N height=N` after the URL |
| `video`      | `![video](src)` — optional `width=N height=N`               |
| `youtube`    | `![youtube](src)`                                           |
| `vimeo`      | `![vimeo](src)`                                             |
| `soundcloud` | `![soundcloud](src)`                                        |
| `spotify`    | `![spotify](src)`                                           |
| `loom`       | `![loom](src)`                                              |
| `x`          | `![x](src)`                                                 |

Reserved alts — `audio`, `video`, `youtube`, `vimeo`, `soundcloud`, `spotify`, `loom`, `x` — route to the matching node. A GFM image token would otherwise create an `image` node.

Routing needs two things. The node must be enabled in the kit, and the URL must validate for that node type. Validation means a recognized media file extension for `audio` and `video`, and a provider URL for the embeds. A token that fails either check imports as a plain `image` node, so `![audio](https://files.example.com/podcast?id=42)` becomes an image.

A provider URL in `[label](url)` link syntax stays a hyperlink. Only the typed `![…](url)` form creates an embed node. A bare URL line in a `.md` file does not become an embed either; paste the URL directly to get an embed node.

Per-node markdown details live in each node's README — see [Nodes](#nodes).

### Paste precedence

`isMediaUrl(url)` lets a host yield media URLs to this kit instead of autolinking them:

```ts
import { isMediaUrl } from '@docs.plus/extension-hypermultimedia'
import { Hyperlink } from '@docs.plus/extension-hyperlink'

Hyperlink.configure({ shouldAutoLink: (url) => !isMediaUrl(url) })
```

Two tradeoffs come with that recipe.

Paste claims are per provider. YouTube, SoundCloud and Spotify only claim a URL that is the whole pasted block. Loom, Vimeo and X claim their URL anywhere in the pasted text. A media URL _typed_ mid-sentence gets neither a media node nor an autolink, because the veto applies to paste-linkify and typed autolink alike. Explicit linking with `Mod-K` or `setHyperlink` still works, since that path skips `shouldAutoLink`.

`isMediaUrl` also matches every provider regardless of kit configuration, so a host that disables providers vetoes URLs nothing will claim. Compose the veto from the per-provider validators for the providers you enable:

```ts
import { isImageUrl, isValidYoutubeUrl } from '@docs.plus/extension-hypermultimedia'
import { Hyperlink } from '@docs.plus/extension-hyperlink'

// Kit configured with only Image and Youtube enabled:
Hyperlink.configure({
  shouldAutoLink: (url) => !isImageUrl(url) && !isValidYoutubeUrl(url)
})
```

### Image file paste (`editorFileUpload`)

Pasting an image **file**, such as a screenshot or a copied image, never inserts base64 into the document. The paste handler calls `preventDefault()` and dispatches one `CustomEvent` named `editorFileUpload` on `document`, with `{ files, editor }` in `detail`. Every image on the clipboard arrives in that one event. You decide where the bytes go, and you insert the nodes:

```ts
import type { Editor } from '@tiptap/core'

document.addEventListener('editorFileUpload', (event) => {
  const { files, editor } = (event as CustomEvent<{ files: File[]; editor: Editor }>).detail

  for (const file of files) {
    const objectUrl = URL.createObjectURL(file) // or upload and use the remote URL
    editor.commands.setImage({ src: objectUrl, alt: file.name })
    // `setImage` leaves a NodeSelection on the new node, so the next insert
    // would replace that node. Collapse the selection past the node between files.
    editor.commands.setTextSelection(editor.state.doc.content.size)
  }
})
```

Insert sequentially when your handler awaits anything first, such as an upload or an image decode. Otherwise the nodes land in completion order rather than clipboard order.

Without a listener, the paste handler drops pasted image files silently. A pasted image **URL** in plain text inserts an `image` node directly, and a `data:` URL follows the `allowBase64` option.

## Loading shell

Every media node view mounts inside a reserved-size shimmer shell. The shell holds the media slot at `opacity: 0` until it settles to `ready` or `error`. The shell covers remote images, local `<video>` and `<audio>`, every iframe embed, and the X oEmbed mount. The kit persists the real media node only; the shell is node-view UI.

Three paths settle without a load event. A `src`-less element settles straight to `error`, which the Replace URL action then repairs. A `<video>` or `<audio>` element with `preload: 'none'` settles straight to `ready`, because its controls are all there is to paint. An X embed settles when the oEmbed mount resolves, or to `error` when it fails.

Customize or disable the shell on the kit:

```ts
HyperMultimediaKit.configure({
  loadingShell: true // default built-in shell
  // loadingShell: false, // no overlay
  // loadingShell: (ctx) => { ... return overlay HTMLElement }, // replace overlay UI
})
```

The factory type is `MediaLoadingShellFactory`, and `ctx` is a `MediaLoadingShellContext`. That context carries five fields: `kind`, `width`, `height`, and the optional `provider` and `message`. `kind` is one of `'image'`, `'video'`, `'audio'` or `'embed'`.

A custom overlay should include a `.hm-loading-shell__message` element if you want `markError(message)` to show text. Without one, the kit sets `aria-label` on the overlay and on the shell root instead. `markError` is a `MediaLoadingController` method, and the kit calls it against the element your factory returned. A host holds a controller only when it calls `wrapMediaWithLoadingShell` itself. The shell styles ship in `styles.css` and theme through the `--hm-loading-*` tokens — see [Theming](#theming).

`createDefaultMediaLoadingShell`, `wrapMediaWithLoadingShell` and the loading types are exported for a host that builds custom node views.

## Security

One scheme gate guards every stored media `src`. It rejects `javascript:`, `data:`, `vbscript:`, `file:` and `blob:`, and it strips ASCII control characters first, so `java\tscript:` cannot pass the check as a scheme. Inline images are the one exception: markdown import and the Replace URL form admit `data:image/*`, with SVG excluded because it carries script.

The gate runs on `parseHTML` for `video`, `audio`, `vimeo` and `youtube`, on markdown import, and in the Replace URL form. It does **not** run in the insert commands, so `setImage`, `setVideo` and `setAudio` store any non-empty string. The kit never re-validates collaborative attributes either. Treat any value you read back off a node as untrusted, and validate host-supplied URLs before you insert them.

The read side carries its own allowlist on purpose. View original permits `https:`, `http:`, `blob:` and a root-relative path, because `blob:` is a legitimate source for an uploaded asset. Both `window.open` calls in the kit pass through that check with `noopener,noreferrer`.

Embed URL parsing rejects an invalid host before insert. X and Loom paste paths carry dedicated security specs. Hosts should still validate storage and CSP for an iframe `src` the same way they do for a user-authored link.

## Migrating from 1.x

Version 2.0.0 renames the Twitter node to X, renames the stored node types to camelCase, and drops the tippy modal API. Four kinds of change need your attention.

**Imports, options and commands**

| 1.x                 | 2.0.0                                 |
| ------------------- | ------------------------------------- |
| default export      | named export `{ HyperMultimediaKit }` |
| `Twitter` (kit key) | `X`                                   |
| `setTwitter`        | `setX`                                |
| `TwitterOptions`    | `XOptions`                            |

Every other kit key keeps its name. `XOptions` is a source-level interface, and the package entry does not export it, so reach the kit shape through `HyperMultimediaKitOptions`. See Removed API for the attributes and options that are gone.

**Removed API**

`createFloatingToolbar`, `hideCurrentToolbar`, the `imageModal`, `youtubeModal` and `twitterModal` exports, and the per-node `modal` option are gone. The media toolbar is built in. Pass [`mediaToolbar`](#bring-your-own-toolbar) only to render your own surface. Also removed: `ImageNodeOptions.toolbar`, the `ImageToolbarFunction` type, the `transform` image attribute, and the audio `volume` option.

**Stored node types**

| 1.x          | 2.0.0        |
| ------------ | ------------ |
| `Image`      | `image`      |
| `Video`      | `video`      |
| `Audio`      | `audio`      |
| `Youtube`    | `youtube`    |
| `Vimeo`      | `vimeo`      |
| `SoundCloud` | `soundcloud` |
| `Twitter`    | `x`          |

The `loom` and `spotify` nodes are new in 2.0.0, so no `1.x` document holds them.

**Behavior differences**

- The media toolbar moved from a floating popover, with placement buttons and a margin select, into the node's top-right corner. A declarative action registry drives it — see [Customizing actions](#customizing-actions).
- Alignment follows the wrap vocabulary: Left, Center, Right, Wrap left, Wrap right.
- The kit no longer ships tippy.js. Floating UI positions every popover and tooltip. The kit bundles the popover engine and the tooltip engine into `dist`.

**Running the migration**

docs.plus and Hocuspocus hosts: run `bun run --filter @docs.plus/hocuspocus migrate:media-node-names`, and preview it first with `:dry`.

External adopters: rewrite the stored JSON and Yjs node `type` strings yourself. The [media-node-rename runbook](https://github.com/docs-plus/docs.plus/blob/main/apps/hocuspocus.server/docs/migrate-media-node-names.md) lists every mapping, even if you never run the CLI.

The [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/CHANGELOG.md) holds the full breaking-change list.

## TypeScript

Definitions ship in `dist/index.d.ts`. The package entry exports the following, grouped by role.

**Kit**

`HyperMultimediaKit`, `HyperMultimediaKitOptions`. The kit bundles all nine media nodes. Enable, configure or disable each one through the kit options; the nodes themselves are not exported.

**Commands**

`MediaPublicCommands` augments `@tiptap/core`, so every insert command is typed on `editor.commands`. Their option types are `SetImageOptions`, `UpdateImageDimensionsParams`, `SetVideoOptions`, `SetAudioOptions`, `SetYoutubeVideoOptions`, `SetVimeoOptions`, `SetSoundCloudOptions`, `SetSpotifyOptions`, `SetLoomOptions` and `AddXOptions`.

**URL detection**

`isMediaUrl`, `detectMediaType`, `MediaNodeType`, plus the per-provider validators `isImageUrl`, `isVideoUrl`, `isAudioUrl`, `isValidYoutubeUrl`, `isValidVimeoUrl`, `isValidSoundCloudUrl`, `isValidSpotifyUrl`, `isValidLoomUrl` and `isValidXUrl`. `detectMediaType` also resolves a raw video or audio URL, which `isMediaUrl` skips on purpose so a pasted `.mp4` or `.mp3` link stays a link.

**Provider helpers**

`parseYoutubeVideoId`. `parseSpotifyEntity`, `SPOTIFY_ENTITY_TYPES`, `SpotifyEntityType`, `SpotifyTheme`. `buildXOEmbedParams`, `resolveXEmbedSizeId`, `X_EMBED_DEFAULT_MAXWIDTH`, `X_EMBED_SIZE_OPTIONS`, `X_EMBED_THEME_OPTIONS`, `XEmbedSizeId`, `XEmbedTheme`.

**Toolbar**

`createMediaToolbar`, `resolveMediaActions`, `openMediaToolbar`, `closeMediaToolbar`. Action builders `composeMediaActions` and `layoutMediaActions`. Action handlers `viewOriginalMedia`, `downloadMedia`, `copyMediaNode`, `removeMediaNode`, `canViewOriginal` and `isDownloadable`. Types `MediaAction`, `MediaActionAnchor`, `MediaActionContext`, `MediaActionList`, `MediaActionPlacement`, `MediaActionsBuilder`, `MediaActionsResolver`, `MediaToolbarFactory`, `MediaToolbarLayout` and `MediaToolbarOptions`.

**Popovers and tooltips**

`openMediaPopover`, `openToolbarPopover`, `closeToolbarPopover`, `createReplaceUrlPopover`, `openReplaceUrlPopover`, `ReplaceUrlPopoverFactory`, `ReplaceUrlPopoverOptions`, `attachTooltip`, `hideTooltip`.

**Icons**

`MediaToolbarIconsResolver`, `MediaToolbarIconKey`, `MediaToolbarIconContext`.

**Loading shell**

`createDefaultMediaLoadingShell`, `wrapMediaWithLoadingShell`, `MediaLoadingBindLoadOptions`, `MediaLoadingController`, `MediaLoadingKind`, `MediaLoadingShellContext`, `MediaLoadingShellFactory`, `MediaLoadingShellOption`, `MediaLoadingShellWrapOptions`.

**Layout and placement**

`resolveMediaNodePos`, `applyNodeAttributes`, `getCurrentMediaPlacement`, `getMediaPlacementAttrs`, `MEDIA_MARGIN_OPTIONS`, `MEDIA_PLACEMENT_OPTIONS`, `MediaPlacementId`, `fitDimensionsToBounds`, `fitLayoutToEditorColumn`, `getEditorContentWidth`.

Per-node embed option interfaces live under each node's module — see [Nodes](#nodes).

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
