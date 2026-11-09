# Paste and import

Part of the [`@docs.plus/extension-hypermultimedia` README](../README.md).

Media reaches the document three ways: a markdown token, a pasted URL, and a pasted image file. Each has its own rules.

## Markdown import/export

Markdown round-trip is optional and needs `npm install @tiptap/markdown`. Add its `Markdown` extension next to the kit:

```ts
import { Markdown } from '@tiptap/markdown'

const editor = new Editor({ extensions: [StarterKit, Markdown, HyperMultimediaKit] })

const markdown = editor.getMarkdown() // export
editor.commands.setContent(markdown, { contentType: 'markdown' }) // import
```

With `@tiptap/markdown` loaded, every media node round-trips through typed `![alt](src)` syntax. Use the node name as the alt literal for non-image media:

| Node         | Import / export syntax |
| ------------ | ---------------------- |
| `image`      | `![alt text](src)`     |
| `audio`      | `![audio](src)`        |
| `video`      | `![video](src)`        |
| `youtube`    | `![youtube](src)`      |
| `vimeo`      | `![vimeo](src)`        |
| `soundcloud` | `![soundcloud](src)`   |
| `spotify`    | `![spotify](src)`      |
| `loom`       | `![loom](src)`         |
| `x`          | `![x](src)`            |

### Caption and options

Two optional parts follow the URL. Write them in this order:

```text
![youtube](https://www.youtube.com/watch?v=dQw4w9WgXcQ "How docs.plus works"){width=800 float=right}
```

- **The caption** rides the CommonMark title slot, in quotes after the URL. It maps to the `caption` attribute, on every node. Escape a `"` or a `\` inside it with a backslash. Export joins a caption with line breaks into one line.
- **The option block** is `{key=value key=value}`, right after the closing parenthesis. Separate keys with spaces. Quote a value that holds a space: `margin="0 0 0 auto"`.

| Keys                                    | Nodes                     | Values                                                                                        |
| --------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `width`, `height`                       | every node except `x`     | a positive number; import accepts an optional `px`, export omits it                           |
| `display`                               | every node                | `block`, `inline`, `inline-block`, `flex`, `inline-flex`                                      |
| `float`                                 | every node                | `left`, `right`, `none`                                                                       |
| `clear`                                 | every node                | `none`, `left`, `right`, `both`                                                               |
| `margin`                                | every node                | one to four of `auto`, `0`, or a number with `px`, `in`, `em`, `rem`, `%`, `pt`, `cm` or `mm` |
| `justify-content`                       | every node except `image` | `start`, `center`, `end`, `flex-start`, `flex-end`, `left`, `right`                           |
| `controls`, `autoplay`, `loop`, `muted` | `video`, `audio`          | `true`, `false`                                                                               |
| `preload`                               | `video`, `audio`          | `none`, `metadata`, `auto`                                                                    |
| `poster`                                | `video`                   | a URL that passes the [scheme gate](./security.md#write-side-the-scheme-gate)                 |
| `maxwidth`                              | `x`                       | a positive number                                                                             |
| `theme`                                 | `x`                       | `light`, `dark`                                                                               |
| `lang`                                  | `x`                       | a language tag, such as `fr` or `zh-cn`                                                       |
| `hide_media`, `hide_thread`             | `x`                       | `true`, `false`                                                                               |

The layout keys are `width`, `height`, `display`, `float`, `clear`, `margin` and `justify-content`. Import reads `justifyContent` as well as `justify-content`. Export writes `justify-content`.

Import drops a key the node does not take, and a value that fails its check. The node then keeps its default. Export runs every value through the same checks.

**Export writes only what differs from the default.** It checks each key on its own, so a changed width alone writes `{width=800}`. A node nobody styled exports as `![youtube](src)`.

Export compares each key with the writer's node options. With the kit defaults, these values write nothing:

- the layout keys `display=block`, `float=none`, `clear=none`, `margin=auto` and `justify-content=start`;
- a `video`, `youtube`, `vimeo` or `loom` at 640 × 480, and a `soundcloud` at 450 × 120;
- a Spotify track at 640 × 152, and any other Spotify player at 640 × 352;
- the `video` and `audio` player options `controls=true`, `autoplay=false`, `loop=false`, `muted=false` and `preload=metadata`;
- the `x` options `maxwidth=400`, `theme=light`, `lang=en`, `hide_media=false` and `hide_thread=false`.

`image` and `audio` have no default size, so export writes any size they hold. [Default sizes](./api.md#default-sizes) lists every node.

The toolbar placements set `margin`. Center writes no block, because `margin=auto` is the default. Left writes `{margin=0}`, and Right writes `{margin="0 0 0 auto"}`. Wrap left and Wrap right write `float` and `margin`.

Import still reads the old in-parenthesis size, `![video](src width=640 height=360)`. `image` does not read it, and `x` drops it. That form takes `width=` then `height=` inside the parentheses, each one optional, as a whole number with no `px`. When a token holds both forms, the block wins. Export writes only the block. See [Migrating to the Markdown option block](./migration.md#migrating-to-the-markdown-option-block).

Markdown still drops these attributes:

- the image `title` attribute, because the title slot holds the caption;
- the `youtube`, `vimeo`, `soundcloud`, `spotify` and `loom` player options, such as YouTube `start` and SoundCloud `visual`;
- the X `dnt` and `align` attributes.

Outside docs.plus, a renderer shows the media and prints the block as plain text. GitHub does this.

Reserved alts — `audio`, `video`, `youtube`, `vimeo`, `soundcloud`, `spotify`, `loom`, `x` — route to the matching node. A GFM image token would otherwise create an `image` node.

Routing needs two things. The node must be enabled in the kit, and the URL must validate for that node type. Validation means a provider URL for the embeds. For `audio` and `video`, the URL must end in a media file extension, with no query string or fragment. The path before the extension may hold only letters, digits, `_`, `-` and `/`. A token that fails either check imports as a plain `image` node, so `![audio](https://files.example.com/podcast?id=42)` becomes an image.

- `audio` extensions: `mp3`, `wav`, `aac`, `flac`, `ogg`, `m4a`, `aiff`, `ape`, `asf`, `m4p`, `m4b`, `mp2`, `mpc`, `wma`, `webm`, `opus`, `ra`, `rm`, `wavpack`, `wv`.
- `video` extensions: `mp4`, `avi`, `mov`, `wmv`, `flv`, `mkv`, `3gp`, `3g2`, `asf`, `divx`, `m4v`, `mpg`, `m2v`, `m4p`, `mts`, `m2ts`, `ogv`, `rm`, `rmvb`, `ts`, `vob`, `webm`, `qt`, `f4v`.

A provider URL in `[label](url)` link syntax stays a hyperlink. Only the typed `![…](url)` form creates an embed node. A bare URL line in a `.md` file does not become an embed either; paste the URL directly to get an embed node.

Per-node markdown details live in each node's README — see [Nodes](../README.md#nodes).

## Paste precedence

Co-install [`@docs.plus/extension-hyperlink`](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hyperlink) when marks and media share one editor, then read this section.

`isMediaUrl(url)` lets a host yield media URLs to this kit instead of autolinking them:

```ts
import { isMediaUrl } from '@docs.plus/extension-hypermultimedia'
import { Hyperlink } from '@docs.plus/extension-hyperlink'

Hyperlink.configure({ shouldAutoLink: (url) => !isMediaUrl(url) })
```

Two tradeoffs come with that recipe.

Paste claims are per provider. YouTube, SoundCloud and Spotify only claim a URL pasted alone on its line, with no other text. Loom, Vimeo and X claim their URL anywhere in the pasted text. A media URL _typed_ mid-sentence gets neither a media node nor an autolink. The veto applies to paste-linkify and typed autolink alike. Explicit linking with `Mod-K` or `setHyperlink` still works, since that path skips `shouldAutoLink`.

`isMediaUrl` also matches every provider regardless of kit configuration. So a host that disables providers vetoes URLs nothing will claim. Compose the veto from the per-provider validators for the providers you enable:

```ts
import { isImageUrl, isValidYoutubeUrl } from '@docs.plus/extension-hypermultimedia'
import { Hyperlink } from '@docs.plus/extension-hyperlink'

// Kit configured with only Image and Youtube enabled:
Hyperlink.configure({
  shouldAutoLink: (url) => !isImageUrl(url) && !isValidYoutubeUrl(url)
})
```

## Image file paste (`editorFileUpload`)

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

Without a listener, the paste handler drops pasted image files silently. A pasted image **URL** in plain text inserts an `image` node directly, and a `data:` URL follows the `allowBase64` option. That URL must end in an image file extension, or it stays text. Pasted or imported HTML is different: an `<img>` keeps any absolute `http(s)` or `//` `src`, with or without an extension, because the tag already says it is an image.

So a tracking pixel in pasted web or email HTML also becomes an image node. The kit has no filter for it. To drop such tags on paste, strip them in the ProseMirror `transformPastedHTML` editor prop. That prop does not run on `setContent`.
