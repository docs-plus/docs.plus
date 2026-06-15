# Audio

Renders `<audio>` elements as a block or inline node.

> **Restrictions:** renders audio only — uploading files to your server is the host's job.

## Install

```bash
bun add @docs.plus/extension-hypermultimedia@next
# stable, after promotion:
bun add @docs.plus/extension-hypermultimedia
```

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  Audio: true
})
```

## Kit options vs node attributes

`HyperMultimediaKit.configure({ Audio: { controls: true, … } })` sets schema defaults on each inserted node. The node view and `renderHTML` read **node attrs** (`controls`, `autoplay`, `loop`, `muted`, `preload`, `volume`) — not live kit options after insert. Override per insert via `setAudio({ … })`.

## Settings

### inline

Renders the node inline instead of as a block.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Audio: {
    inline: true
  }
})
```

### controls

Show the native controls of the audio player.

- Target: `Node`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Audio: {
    controls: false
  }
})
```

### autoplay

Starts playback as soon as the audio can play through without stopping.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Audio: {
    autoplay: true
  }
})
```

### loop

Restarts playback when the audio ends.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Audio: {
    loop: true
  }
})
```

### preload

Hints whether and how the audio should load when the page loads.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Audio: {
    preload: 'auto'
  }
})
```

### volume

Sets the playback volume.

- Target: `Node`
- Default: `1`

```js
HyperMultimediaKit.configure({
  Audio: {
    volume: 0.5
  }
})
```

### muted

Mutes the audio.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Audio: {
    muted: true
  }
})
```

### HTMLAttributes

Custom HTML attributes added to the rendered tag.

- Target: `Node`
- Default: `{}`

```js
HyperMultimediaKit.configure({
  Audio: {
    HTMLAttributes: {
      class: 'my-custom-class'
    }
  }
})
```

## Caption

Add a caption from the toolbar; the text is stored in the node `caption` attribute
and persists via collaboration and JSON. Audio emits no `<figure>` in HTML — the
caption is editor and attribute only (HTML `<figure>` round-trip is `image`-only).
Audio also exposes a Download action.

## Commands

### setAudio(options)

Inserts an audio node. Returns `false` when `src` is missing.

```js
editor.commands.setAudio({
  src: 'https://example.com/foobar.mp3'
})

editor.commands.setAudio({
  src: 'https://example.com/foobar.mp3',
  width: 200,
  height: 160
})
```

### Options

| Option         | Description                                                              | Default | Optional |
| -------------- | ------------------------------------------------------------------------ | ------- | -------- |
| src            | The URL of the audio                                                     | `null`  |          |
| width          | The embed width (overrides the default option, optional)                 | `null`  | ✅       |
| height         | The embed height (overrides the default option, optional)                | `null`  | ✅       |
| float          | The CSS style `float` (overrides the default option, optional)           | `unset` | ✅       |
| clear          | The CSS style `clear` (overrides the default option, optional)           | `none`  | ✅       |
| display        | The CSS style `display` (overrides the default option, optional)         | `block` | ✅       |
| margin         | The CSS style `margin` (overrides the default option, optional)          | `0.0in` | ✅       |
| justifyContent | The CSS style `justify-content` (overrides the default option, optional) | `start` | ✅       |

## Markdown syntax

```md
![audio](src width height)

![audio](https://example.com/foobar.mp3)
```

## Source code

[`audio.ts`](./audio.ts)
