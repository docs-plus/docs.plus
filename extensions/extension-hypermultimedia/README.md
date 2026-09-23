# @docs.plus/extension-hypermultimedia

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-hypermultimedia.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-hypermultimedia)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-hypermultimedia.svg)](https://npmcharts.com/compare/@docs.plus/extension-hypermultimedia)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-hypermultimedia.svg)](https://www.npmjs.com/package/@docs.plus/extension-hypermultimedia)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/2EmAjmgZ8)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/demo-dark.gif">
    <img alt="Pasting a YouTube URL embeds a player, and dragging a corner gripper resizes it" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hypermultimedia/assets/demo-light.gif">
  </picture>
</p>

Tiptap extension for embedding media in the editor: images, audio, video, and provider embeds (YouTube, Vimeo, SoundCloud, Spotify, X, Loom).

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/examples/vanilla?file=main.ts)

## Why use it

- **One kit adds nine media nodes.** One `HyperMultimediaKit.configure` call adds image, audio, video, YouTube, Vimeo, SoundCloud, Spotify, X and Loom. Set a node to `false` to leave it out.
- **Editing controls on every node.** Each node gets a media toolbar in its top-right corner, an editable caption, and a loading shell. Eight of the nine also get drag-to-resize.
- **A pasted provider URL becomes a player.** Paste a YouTube, SoundCloud or Spotify URL on its own, or a Loom, Vimeo or X URL anywhere, and it becomes an embed node. With `@tiptap/markdown`, every node round-trips through typed `![alt](src)` syntax.
- **The UI follows `color-scheme`.** Every visual token is a `--hm-*` CSS custom property, declared with `light-dark()`. The toolbar, loading shell, gripper and caption follow the nearest ancestor's `color-scheme`.

## Install

```sh
npm install @docs.plus/extension-hypermultimedia
```

Or use `pnpm add @docs.plus/extension-hypermultimedia`, `yarn add @docs.plus/extension-hypermultimedia`, or `bun add @docs.plus/extension-hypermultimedia`.

Requires **`@tiptap/core` ^3.31.3** and **`@tiptap/pm` ^3.31.3** (Tiptap 3.x).

This package imports no React, Vue, or Next.js code. Use it from a plain page, Vite, React, Vue, Svelte, Next.js, Nuxt, or SvelteKit. Create the editor in the browser.

React Native has no DOM. Load the editor in a web view.

Installs one runtime dependency, `@floating-ui/dom`. The popover engine and the tooltip engine ship inside `dist`, so they add no further install.

Upgrading from `1.x`? Version 2.0.0 renames the stored node types to camelCase and renames `Twitter` to `x` — see [Migrating from 1.x](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/migration.md#migrating-from-1x).

## Quickstart

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/examples/vanilla?file=main.ts)

Run this Quickstart in your browser first, with nothing to install. The app lives in [`examples/vanilla`](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/examples/vanilla).

The host page needs one mount point: `<div id="editor"></div>`. The snippet also imports `@tiptap/starter-kit`. Add it with `npm install @tiptap/starter-kit` when your app has none yet.

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'
// Required. Without it the toolbar, gripper, caption and loading shell render unstyled.
import '@docs.plus/extension-hypermultimedia/styles.css'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  // One image, then an empty paragraph to paste into.
  content: '<img src="https://docs.plus/demo-assets/sample-photo.jpg"><p></p>',
  // No `configure` call: all nine nodes load with their defaults.
  extensions: [StarterKit, HyperMultimediaKit]
})
```

You should see the image in the editor. Hover it with a mouse: the media toolbar opens in its top-right corner, and the gripper, the drag-handle overlay for resizing, appears. Then click the empty line under the image and paste a YouTube URL. The URL becomes a YouTube player.

## Caveats

- **Without `styles.css` the toolbar, gripper, caption and loading shell render unstyled.** Import the stylesheet, as the Quickstart does. See [Styling](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/styling.md).
- **`resizeGripper: false` removes the whole media toolbar for that node.** To remove the drag handles alone, replace the media toolbar with [`mediaToolbar`](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/media-toolbar.md#bring-your-own-toolbar).
- **A link extension can claim a media URL before the kit sees it.** See [Keep media URLs out of a link extension](#keep-media-urls-out-of-a-link-extension).
- **The paste handler drops pasted image files silently without a listener.** Add an `editorFileUpload` listener, as [Image file paste](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/paste-and-import.md#image-file-paste-editorfileupload) shows.

The full list, with the reason for each, is in [Caveats](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/api.md#caveats).

## Common tasks

### Insert media by command

Each provider insert command returns `false` for a `src` that fails its provider check. Chain any of them like a normal Tiptap command:

```ts
editor.chain().focus().setYoutubeVideo({ src: 'https://youtu.be/dQw4w9WgXcQ', start: 42 }).run()
```

No insert command runs the scheme gate, so validate host-supplied URLs before you insert them. [Commands](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/api.md#commands) lists all ten.

### Keep media URLs out of a link extension

Co-install [`@docs.plus/extension-hyperlink`](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hyperlink) when marks and media share one editor. `isMediaUrl(url)` lets a host yield media URLs to this kit instead of autolinking them.

```ts
import { isMediaUrl } from '@docs.plus/extension-hypermultimedia'
import { Hyperlink } from '@docs.plus/extension-hyperlink'

Hyperlink.configure({ shouldAutoLink: (url) => !isMediaUrl(url) })
```

Hyperlink also needs `StarterKit.configure({ link: false })`, as its [Quickstart](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/README.md#quickstart) shows.

YouTube, SoundCloud and Spotify only claim a URL that is the whole pasted block. Loom, Vimeo and X claim their URL anywhere in the pasted text. [Paste precedence](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/paste-and-import.md#paste-precedence) covers the tradeoffs.

### Leave out or tune a node

Each node key takes an options object, `true` for the node defaults, or `false` to drop the node.

```ts
HyperMultimediaKit.configure({
  // `inline: true` moves the node into the inline group, so it flows in a paragraph.
  Image: { inline: true, allowBase64: true },
  SoundCloud: false
})
```

[Options](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/api.md#options) lists every kit key and per-node key.

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

## Gallery

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

## Documentation

| Guide                                                                                                                                        | What it covers                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [API reference](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/api.md)                           | Kit options, per-node options, default sizes, commands, keyboard shortcuts, the full caveats list, TypeScript exports   |
| [Media toolbar](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/media-toolbar.md)                 | Toolbar actions, custom actions and icons, captions, a host-built toolbar                                               |
| [Embeds](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/embeds.md)                               | Player options for YouTube, Vimeo, Loom, SoundCloud, Spotify and X                                                      |
| [Paste and import](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/paste-and-import.md)           | Markdown import and export, paste precedence with a link extension, image file paste                                    |
| [Resize and loading shell](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/resize-and-loading.md) | Drag-resize limits, the loading shell and a custom overlay                                                              |
| [Styling](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/styling.md)                             | The stylesheet, the `--hm-*` theme tokens, class names                                                                  |
| [Security](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/security.md)                           | The scheme gate on stored `src` values, the View original allowlist                                                     |
| [Migrating from 1.x](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/docs/migration.md)                | Renamed node types and exports, removed API, the stored-data migration                                                  |
| [Changelog](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/CHANGELOG.md)                              | Every release and its breaking changes                                                                                  |
| [For AI coding agents](https://cdn.jsdelivr.net/npm/@docs.plus/extension-hypermultimedia/README.md)                                          | This README as plain Markdown for your agent. The docs are also on [Context7](https://context7.com/docs-plus/docs.plus) |

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
