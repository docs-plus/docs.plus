# Migration guide

Part of the [`@docs.plus/extension-hypermultimedia` README](../README.md).

Pick the section for the version you upgrade from:

- [Upgrading from 2.2.0](#upgrading-from-220) to 2.3.0. A minor release: nothing was removed, but the Markdown and HTML output changed.
- [Migrating from 1.x](#migrating-from-1x) to 2.0.0. A major release: node types and exports were renamed.

## Upgrading from 2.2.0

Version 2.3.0 removes no export and no option. Stored JSON and Yjs documents need no migration. The changes below alter what the kit writes. One value no longer survives an HTML round trip: a per-node `allowfullscreen: false`, as [HTML output](#html-output) explains. Check each one that your app relies on. The [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/CHANGELOG.md) has the full entry for each.

The `@tiptap/core` and `@tiptap/pm` peer floor is now `^3.32.2`. Update both before you update this package.

### Migrating to the Markdown option block

This change ships in a minor release, because the old input still parses ([#244](https://github.com/docs-plus/docs.plus/issues/244)).

Markdown export now writes size after the closing parenthesis, in an option block:

| Before                               | Now                                        |
| ------------------------------------ | ------------------------------------------ |
| `![video](src width=400 height=300)` | `![video](src){width=400 height=300}`      |
| `![audio](src width=400 height=80)`  | `![audio](src){width=400 height=80}`       |
| `![video](src width=640 height=480)` | `![video](src)` — 640 × 480 is the default |
| `![Alt](src)`, caption dropped       | `![Alt](src "My caption")`                 |

Every node can now write a block, not only `video` and `audio`. A floated YouTube node exports as `![youtube](src){float=right}`, for example.

Import still reads the old in-parenthesis form, so documents you already exported import as before. Version 2.2.0 wrote that form only for `video` and `audio`. It holds `width=` then `height=`, each one optional, as a whole number with no `px`. The order is required: `![video](src height=300 width=400)` imports as text with a link. Import reads no other key in it. An `image` token in this form imports as text too, and `x` drops the size. When a token holds both forms, the block wins.

Five cases need a change:

- **Your own parser reads our Markdown.** Read the `{…}` block after `)`, and read the title slot as the caption. The full syntax is in [Markdown import/export](./paste-and-import.md#markdown-importexport).
- **Your code expects a size on every node.** Export now leaves out a value equal to the node default. Read a missing key as that default. [Caption and options](./paste-and-import.md#caption-and-options) lists the defaults that export leaves out.
- **Your editors use different node defaults.** Export compares each value with the node options of the editor that writes it. `width` and `height` are node options too. With `HyperMultimediaKit.configure({ Video: { width: 800, height: 600 } })`, a video at 800 × 600 exports as `![video](src)`. An editor with the default options then reads it as 640 × 480. Give every editor that reads and writes the same Markdown the same node options.
- **An editor on 2.2.0 still reads your Markdown.** Version 2.2.0 reads neither the option block nor the title slot. Upgrade every editor that reads your Markdown before one that writes it.
- **Another renderer shows your Markdown.** A sized or placed node now writes a `{…}` block, such as `![A](src){width=300 height=200}`. GitHub and other CommonMark renderers show that block as plain text. See [Markdown import/export](./paste-and-import.md#markdown-importexport).

Import changed in three ways you can see:

- An image title, `![Alt](src "Title")`, now becomes the visible caption. In 2.2.0 import dropped it.
- An `x` node stores the normalized `https://x.com/<user>/status/<id>` URL, and a `spotify` node the canonical share URL.
- A Spotify track gets the 152 px track height, not 352 px.

Export also writes `(` in a `src` as `%28`, as it already wrote `)` as `%29`.

### HTML output

These changes reach `getHTML()`, clipboard copy and any server that renders the document to HTML.

- **A captioned node is wrapped in a `<figure>`.** In 2.2.0 only `image` did this. Now every captioned node renders `<figure data-hm-figure>` around the media, with a `<figcaption>`. The figure takes the clear and margin. A floated node also moves its float to the figure. X writes no layout to HTML, so its figure has none. A node without a caption renders the same HTML as before. If an HTML sanitizer runs on our output, allow `figure`, `figcaption` and the `data-hm-figure` attribute. Otherwise the caption is lost.
- **Embed iframes carry no `allowfullscreen` attribute.** This covers `youtube`, `vimeo`, `spotify` and `loom`. Fullscreen lives only in the `allow` list. The YouTube `allow` default now names `fullscreen`. A sanitizer must keep the `allow` attribute, or fullscreen stops working. A per-node `allowfullscreen: false` does not survive an HTML round trip. Set it in the kit options to keep it. See [Fullscreen](./embeds.md#fullscreen).
- **An `<img>` with no file extension now imports.** A `src` such as `https://picsum.photos/id/1/200/100` becomes an image node. Pasted web or email HTML can carry tracking pixels like this, and those become image nodes too. A bare URL pasted as text still needs an extension.

### Loading shell

- **The error text changed.** "Could not load media" is gone. A failed node shows "Couldn’t load this image", "…video", "…audio" or "…embed". Update any test or host code that matches the old text. The apostrophe is the curly `’`. The loading text did not change: "Loading image…", "Loading video…", "Loading audio…" or "Loading embed…". One shell element serves both states.
- **No option changes the error text.** The kit writes it in English. It replaces the text of any `.hm-loading-shell__message` element in the shell, built-in or custom. It never rewrites a `.hm-loading-shell__detail` element. It writes once, when the node fails. A new URL, such as one from Replace URL, mounts a new shell.
- **A custom shell can show other words, but screen readers still hear English.** This is a workaround, not an option. A custom shell is a function passed as the `loadingShell` kit option: `(ctx) => HTMLElement`. `ctx` has six fields: `kind` (`'image'`, `'video'`, `'audio'` or `'embed'`), `width`, `height`, and the optional `provider`, `message` and `sourceHost`. Leave out the `.hm-loading-shell__message` element. Put your text in an element of your own. Show it only under `.hm-media-host[data-hm-loading='error']`, the attribute the kit sets when the node fails. Then the kit sets an English `aria-label` on your shell and on its `.hm-media-host` parent. It replaces any `aria-label` already there. For an image, that label ends with "From <site>. The link may be broken." The visible text never changes. The built-in shell keeps its message element, so it gets no `aria-label`. See [Loading shell](./resize-and-loading.md#loading-shell).
- **A failed image names its site.** The built-in shell adds a `.hm-loading-shell__detail` line, such as "From picsum.photos. The link may be broken." The stylesheet shows it only in the error state. A custom shell gets the site as `ctx.sourceHost` and draws it itself. Only `image` sets `sourceHost`, and only for an absolute `http(s)` or `//` `src`. Video, audio and embeds get no site line, so check for `undefined`. See [Loading shell](./resize-and-loading.md#loading-shell).
- **The stylesheet hides a failed `<img>`.** The browser's broken-image glyph no longer shows behind the error. The `alt` text stays for screen readers.

## Migrating from 1.x

Version 2.0.0 renames the Twitter node to X, renames the stored node types to camelCase, and drops the tippy modal API. Four kinds of change need your attention.

### Imports, options and commands

| 1.x                 | 2.0.0                                 |
| ------------------- | ------------------------------------- |
| default export      | named export `{ HyperMultimediaKit }` |
| `Twitter` (kit key) | `X`                                   |
| `setTwitter`        | `setX`                                |
| `TwitterOptions`    | `XOptions`                            |

Every other kit key keeps its name. `XOptions` is a source-level interface, and the package entry does not export it. Reach the kit shape through `HyperMultimediaKitOptions`. See [Removed API](#removed-api) for the attributes and options that are gone.

### Removed API

`createFloatingToolbar`, `hideCurrentToolbar`, the `imageModal`, `youtubeModal` and `twitterModal` exports, and the per-node `modal` option are gone. The media toolbar is built in. Pass [`mediaToolbar`](./media-toolbar.md#bring-your-own-toolbar) only to render your own surface. Also removed: `ImageNodeOptions.toolbar`, the `ImageToolbarFunction` type, the `transform` image attribute, and the audio `volume` option.

### Stored node types

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

### Behavior differences

- The media toolbar moved from a floating popover, with placement buttons and a margin select, into the node's top-right corner. A declarative action registry drives it — see [Customizing actions](./media-toolbar.md#customizing-actions).
- Alignment follows the wrap vocabulary: Left, Center, Right, Wrap left, Wrap right.
- The kit no longer ships tippy.js. Floating UI positions every popover and tooltip. The kit bundles the popover engine and the tooltip engine into `dist`.

### Running the migration

docs.plus and Hocuspocus hosts: run `bun run --filter @docs.plus/hocuspocus migrate:media-node-names`, and preview it first with `:dry`.

External adopters: rewrite the stored JSON and Yjs node `type` strings yourself. The [media-node-rename runbook](https://github.com/docs-plus/docs.plus/blob/main/apps/hocuspocus.server/docs/migrate-media-node-names.md) lists every mapping, even if you never run the CLI.

The [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/CHANGELOG.md) holds the full breaking-change list.
