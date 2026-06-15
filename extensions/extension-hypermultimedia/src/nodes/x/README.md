# X

Renders embedded X (formerly Twitter) posts via the official oEmbed endpoint and `widgets.js`.

## Install

```bash
bun add @docs.plus/extension-hypermultimedia@next
# stable, after promotion:
bun add @docs.plus/extension-hypermultimedia
```

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  X: true
})
```

## Settings

Kit options set the defaults; each inserted node stores its own attributes (`theme`, `lang`, `maxwidth`, `hide_media`, `hide_thread`) which win over the kit defaults.

### inline

Renders the node inline instead of as a block.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  X: {
    inline: true
  }
})
```

### addPasteHandler

Converts pasted X status URLs into embeds.

- Target: `Node`
- Default: `true`

```js
HyperMultimediaKit.configure({
  X: {
    addPasteHandler: false
  }
})
```

### theme

Sets the embed theme, `light` or `dark`; also switchable per node from the media toolbar.

- Target: `URLSearchParams`
- Default: `light`

```js
HyperMultimediaKit.configure({
  X: {
    theme: 'dark'
  }
})
```

### dnt

Controls the data-tracking opt-out parameter (sent as `dnt=1` by default).

- Target: `URLSearchParams`
- Default: `true`

```js
HyperMultimediaKit.configure({
  X: {
    dnt: false
  }
})
```

### lang

Sets the embed language (ISO 639-1), e.g. `'en'`.

- Target: `URLSearchParams`
- Default: `'en'`

```js
HyperMultimediaKit.configure({
  X: {
    lang: 'fr'
  }
})
```

### hide_media

Hides photos, videos, and link previews inside the embedded post.

- Target: `URLSearchParams`
- Default: `false`

```js
HyperMultimediaKit.configure({
  X: {
    hide_media: true
  }
})
```

### hide_thread

Hides the parent post a reply belongs to.

- Target: `URLSearchParams`
- Default: `false`

```js
HyperMultimediaKit.configure({
  X: {
    hide_thread: true
  }
})
```

## Sizing

X embeds size through the oEmbed `maxwidth` attribute, not the resize gripper. The media toolbar exposes three presets — Compact (280), Standard (400, default), Wide (550) — and `setX({ maxwidth })` accepts any of those values per insert.

## Caption

Add a caption from the toolbar; the text is stored in the node `caption` attribute
and persists via collaboration and JSON. The post emits no `<figure>` in HTML — the
caption is editor and attribute only (HTML `<figure>` round-trip is `image`-only).

## Commands

### setX(options)

Embeds an X post. Returns `false` for anything that is not a status URL.

```js
editor.commands.setX({
  src: 'https://x.com/username/status/1234567890'
})

editor.commands.setX({
  src: 'https://twitter.com/username/status/1234567890', // twitter.com URLs normalize to x.com
  theme: 'dark',
  maxwidth: 550,
  hide_thread: true,
  margin: '0.2in'
})
```

### Options

| Option         | Description                                                              | Default | Optional |
| -------------- | ------------------------------------------------------------------------ | ------- | -------- |
| src            | The status URL (x.com or twitter.com)                                    | `null`  |          |
| theme          | `'light'` or `'dark'`                                                    | `light` | ✅       |
| lang           | Post language (ISO 639-1)                                                | `'en'`  | ✅       |
| maxwidth       | oEmbed max width: `280`, `400`, or `550`                                 | `400`   | ✅       |
| hide_media     | Hide photos/videos/link previews                                         | `false` | ✅       |
| hide_thread    | Hide the parent post of a reply                                          | `false` | ✅       |
| float          | The CSS style `float` (overrides the default option, optional)           | `unset` | ✅       |
| clear          | The CSS style `clear` (overrides the default option, optional)           | `none`  | ✅       |
| display        | The CSS style `display` (overrides the default option, optional)         | `block` | ✅       |
| margin         | The CSS style `margin` (overrides the default option, optional)          | `0.0in` | ✅       |
| justifyContent | The CSS style `justify-content` (overrides the default option, optional) | `start` | ✅       |

## Source code

[`x.ts`](./x.ts)
