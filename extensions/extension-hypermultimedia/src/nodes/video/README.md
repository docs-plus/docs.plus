# Video

Renders `<video>` elements as a block or inline node.

> **Restrictions:** renders video only — uploading files to your server is the host's job.

## Install

```sh
bun add @docs.plus/extension-hypermultimedia
```

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  Video: true
})
```

## Kit options vs node attributes

`HyperMultimediaKit.configure({ Video: { controls: true, … } })` sets schema defaults on each inserted node. The node view and `renderHTML` read **node attrs** (`controls`, `autoplay`, `loop`, `muted`, `preload`, `poster`) — not live kit options after insert. Override per insert via `setVideo({ … })`.

## Settings

### inline

Renders the node inline instead of as a block.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Video: {
    inline: true
  }
})
```

### controls

Show the native controls of the video player.

- Target: `Node`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Video: {
    controls: false
  }
})
```

### autoplay

Starts playback as soon as the video can play through without stopping.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Video: {
    autoplay: true
  }
})
```

### loop

Seeks back to the start when the video ends.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Video: {
    loop: true
  }
})
```

### muted

Mutes the video.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Video: {
    muted: true
  }
})
```

### poster

URL of a poster frame shown until the user plays or seeks.

- Target: `Node`
- Default: `null`

```js
HyperMultimediaKit.configure({
  Video: {
    poster: 'https://example.com/poster.png'
  }
})
```

### preload

Hints how much buffering the media resource will likely need.

- Target: `Node`
- Default: `auto`

```js
HyperMultimediaKit.configure({
  Video: {
    preload: 'none'
  }
})
```

### HTMLAttributes

Custom HTML attributes added to the rendered tag.

- Target: `Node`
- Default: `{}`

```js
HyperMultimediaKit.configure({
  Video: {
    HTMLAttributes: {
      class: 'my-custom-class'
    }
  }
})
```

### resizeGripper

Opt the node out of the hover resize gripper (eight drag handles).

- Target: `Kit`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Video: {
    resizeGripper: false
  }
})
```

## Caption

Add a caption from the toolbar; the text is stored in the node `caption` attribute
and persists via collaboration and JSON. Video emits no `<figure>` in HTML — the
caption is editor and attribute only (HTML `<figure>` round-trip is `image`-only).
Video also exposes a Download action.

## Commands

### setVideo(options)

Inserts a video node. Returns `false` when `src` is missing.

```js
editor.commands.setVideo({
  src: 'https://example.com/foobar.mp4'
})

editor.commands.setVideo({
  src: 'https://example.com/foobar.mp4',
  width: 640,
  height: 480
})
```

### Options

| Option         | Description                                                              | Default | Optional |
| -------------- | ------------------------------------------------------------------------ | ------- | -------- |
| src            | The URL of the video                                                     | `null`  |          |
| width          | The embed width (overrides the default option, optional)                 | `640`   | ✅       |
| height         | The embed height (overrides the default option, optional)                | `480`   | ✅       |
| float          | The CSS style `float` (overrides the default option, optional)           | `unset` | ✅       |
| clear          | The CSS style `clear` (overrides the default option, optional)           | `none`  | ✅       |
| display        | The CSS style `display` (overrides the default option, optional)         | `block` | ✅       |
| margin         | The CSS style `margin` (overrides the default option, optional)          | `0.0in` | ✅       |
| justifyContent | The CSS style `justify-content` (overrides the default option, optional) | `start` | ✅       |

## Markdown syntax

With `@tiptap/markdown` loaded:

```md
![video](https://example.com/foobar.mp4)
![video](https://example.com/foobar.mp4 width=640 height=480)
```

## Source code

[`video.ts`](./video.ts)
