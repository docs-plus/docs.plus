# Audio

Use this extension to render `<audio>` HTML tags. Block Or Inline level node.

> **Restrictions:** This extension does only the rendering of audios. It doesn’t upload audios to your server, that’s a whole different story.

## Installation

```bash
npm install @docs.plus/extension-hypermultimedia
```

Then, import the extension into your editor:

```js
import { HyperMultimediaKit } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  Audio,
})
```

## Settings

### inline

Controls if the node should be handled inline or as a block.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Audio: {
    inline: true,
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
    controls: false,
  }
})
```

### autoplay

Automatically start playing the audio as soon as it can do so without stopping.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Audio: {
    autoplay: true,
  }
})
```

### loop

Automatically start playing the audio again after it is finished.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Audio: {
    loop: true,
  }
})
```

### preload

Specifies if and how the author thinks the audio should be loaded when the page loads.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Audio: {
    preload: "auto",
  }
})
```

### volume

Specifies the volume of the audio.

- Target: `Node`
- Default: `1`

```js
HyperMultimediaKit.configure({
  Audio: {
    volume: 0.5,
  }
})
```

### muted

Mute the audio.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Audio: {
    muted: true,
  }
})
```

### HTMLAttributes

Custom HTML attributes that should be added to the rendered HTML tag.

- Target: `Node`
- Default: `{}`

```js
HyperMultimediaKit.configure({
  Audio: {
    HTMLAttributes: {
      class: 'my-custom-class',
    },
  }
})
```

### modal

A modal that apear when you click on audio.

- Target: `Node`
- Default: `true`

```js
import { hypermultimedia, audioModal } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  Audio: {
    modal: audioModal,
  }
})
```

## Commands

### setAudio()

Makes the current node an audio.

```js

editor.commands.setAudio({
  src: 'https://example.com/foobar.mp3'
});

editor.commands.setAudio({
  src: 'https://example.com/foobar.mp3',
  width: 200,
  height: 160,
})
```

## Markdown syntax

```md
![audio](src width height)

![audio](https://example.com/foobar.mp3)
```

### Options

|Option          |Description                                                               |Default    |Optional |
|---             |---                                                                       |---        |---      |
|src             |The URL of the audio                                                      |`null`     |         |
|width           |The embed width (overrides the default option, optional)                  |`null`     |✅       |
|height          |The embed height (overrides the default option, optional)                 |`null`     |✅       |
|float           |The CSS style `float` (overrides the default option, optional)            |`unset`    |✅       |
|clear           |The CSS style `clear` (overrides the default option, optional)            |`none`     |✅       |
|display         |The CSS style `display` (overrides the default option, optional)          |`block`    |✅       |
|margin          |The CSS style `margin` (overrides the default option, optional)           |`0.0in`    |✅       |
|justifyContent  |The CSS style `justify-content` (overrides the default option, optional)  |`start`    |✅       |

## Source code

[packages/extension-hyperMultimedia/audio](./audio.ts)
