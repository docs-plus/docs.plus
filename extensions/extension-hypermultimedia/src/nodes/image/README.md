# Image

Block or inline image node with hover resize grippers, the shared media toolbar, captions, and clipboard paste handling.

> **Restrictions:** renders images only — uploading files to your server is the host's job; see [Paste behavior](#paste-behavior) for the upload hook.

## Install

```bash
bun add @docs.plus/extension-hypermultimedia
```

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  Image: { inline: false }
})
```

## Settings

### inline

Renders the node inline instead of as a block.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Image: {
    inline: true
  }
})
```

### allowBase64

Allows base64 images (`<img src="data:image/jpg;base64...">`). When `false` (the default), `data:` URLs are rejected on parse **and** on plain-text paste.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Image: {
    allowBase64: true
  }
})
```

### resizeGripper

Opt the node out of the hover resize grippers (eight drag handles around the image).

- Target: `Kit`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Image: {
    resizeGripper: false
  }
})
```

### HTMLAttributes

Custom HTML attributes added to the rendered `<img>` tag.

- Target: `Node`
- Default: `{}`

```js
HyperMultimediaKit.configure({
  Image: {
    HTMLAttributes: {
      class: 'my-custom-class',
      'data-custom': 'value'
    }
  }
})
```

## Resize

Hover the image (desktop) or tap it (touch) to activate the gripper: four side handles resize one axis, four corner handles resize both (hold Shift to lock the aspect ratio). Sizes clamp to a minimum of 160×80 and to the editor content column. Committed `width` / `height` live on the node attributes, so resizes persist and sync through collaboration. Press Escape during a drag to cancel without committing.

## Toolbar

The shared media toolbar (caption, alignment, view original, download, copy, delete) mounts in the image's top-right corner. Customize it with the kit-level `mediaActions` / `mediaToolbar` hooks — see the [package README](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia#media-toolbar).

## Caption

Add a caption from the toolbar; the text is stored in the node `caption` attribute
and persists via collaboration and JSON. Image is the only node whose caption also
round-trips through standalone HTML as `<figure>/<figcaption>`. Image, video, and
audio also expose a Download action.

## Paste behavior

Two clipboard paths, both handled by `HyperImagePastePlugin` (wired automatically):

- **Image URL as plain text** → inserts an `image` node directly. `data:` URLs follow `allowBase64`.
- **Image file** (screenshot, copied image) → the plugin calls `preventDefault()` and dispatches a `CustomEvent('editorFileUpload')` on `document` with `{ file, editor }` in `detail`. The host uploads (or creates a blob URL) and inserts the node itself:

```js
document.addEventListener('editorFileUpload', (event) => {
  const { file, editor } = event.detail
  if (!file?.type.startsWith('image/')) return
  const objectUrl = URL.createObjectURL(file)
  editor.commands.setImage({ src: objectUrl, alt: file.name })
})
```

Without a listener, pasted image files are dropped silently — no base64 ever lands in the document.

## Commands

### setImage(options)

Inserts an image node; each insert mints a unique `keyId`.

```js
// Basic usage
editor.commands.setImage({
  src: 'https://example.com/image.png'
})

// With metadata
editor.commands.setImage({
  src: 'https://example.com/image.png',
  alt: 'Professional image'
})

// With layout control
editor.commands.setImage({
  src: 'https://example.com/image.png',
  width: 400,
  height: 300,
  float: 'left',
  clear: 'none',
  display: 'block',
  margin: '0.5in'
})
```

### updateImageDimensions(options)

Sets the `width` / `height` attributes of the image with the given `keyId`.

```js
editor.commands.updateImageDimensions({
  keyId: 'img-abc123',
  width: 500,
  height: 350
})
```

### Options

| Option  | Description                                    | Default | Optional |
| ------- | ---------------------------------------------- | ------- | -------- |
| src     | The URL of the image                           | `null`  |          |
| width   | Image width in pixels                          | `null`  | ✅       |
| height  | Image height in pixels                         | `null`  | ✅       |
| float   | CSS `float` property (`left`, `right`, `none`) | `null`  | ✅       |
| clear   | CSS `clear` property                           | `none`  | ✅       |
| display | CSS `display` property                         | `block` | ✅       |
| margin  | CSS `margin` property (supports inch units)    | `auto`  | ✅       |
| alt     | Alternative text for accessibility             | `null`  | ✅       |
| title   | Image title attribute                          | `null`  | ✅       |

## Markdown syntax

Markdown export keeps `![alt](src)` only — the caption is not represented.

```md
![alt text](https://example.com/foobar.png)
```

## Source code

- [Main Implementation](./image.ts) — core image node, attributes, and commands
- [Helper Functions](./helper.ts) — URL detection and input rules
- [Plugin System](./plugin.ts) — clipboard paste detection
- [Resize System](../../extensions/decoration/) — resize grippers and drag handling
- [Toolbar System](../../toolbar/) — declarative action registry and renderer
