# Vimeo

Use this extension to render `<iframe>` HTML tags for embedding Vimeo videos.

## Installation

```bash
npm install @docs.plus/extension-hypermultimedia
```

Then, import the extension into your editor:

```js
import { HyperMultimediaKit } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  Vimeo,
})
```

## Settings

### inline

Controls if the node should be handled inline or as a block.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    inline: true,
  }
})
```

### frameborder

The frameborder attribute specifies whether or not to display a border around the video.

- Target: `iframe`
- Default: `0`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    frameborder: 1,
  }
})
```

### allowfullscreen

The allowfullscreen attribute specifies whether or not to display a full-screen button.

- Target: `iframe`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    allowfullscreen: false,
  }
})
```

### HTMLAttributes

Custom HTML attributes that should be added to the rendered HTML tag.

- Target: `iframe`
- Default: `{}`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    HTMLAttributes: {
      class: 'my-custom-class',
    },
  }
})
```

### autopause

The autopause attribute specifies whether or not to pause the video when another video is played.

- Target: `URLSearchParams`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    autopause: false,
  }
})
```

### autoplay

The autoplay attribute specifies whether or not to automatically start playing the video.

- Target: `URLSearchParams`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    autoplay: true,
  }
})
```

### background

The background attribute specifies whether or not to display the video in the background of the page.

- Target: `URLSearchParams`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    background: true,
  }
})
```

### byline

The byline attribute specifies whether or not to display the video owner's name.

- Target: `URLSearchParams`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    byline: false,
  }
})
```

### color

The color attribute specifies the color of the video controls.

- Target: `URLSearchParams`
- Default: `#00adef`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    color: '#ff0000',
  }
})
```

### controls

The controls attribute specifies whether or not to display the video controls.

- Target: `URLSearchParams`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    controls: false,
  }
})
```

### dnt

The dnt attribute specifies whether or not to honor the "Do Not Track" browser setting.

- Target: `URLSearchParams`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    dnt: true,
  }
})
```

### keyboard

The keyboard attribute specifies whether or not to allow keyboard controls.

- Target: `URLSearchParams`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    keyboard: false,
  }
})
```

### loop

The loop attribute specifies whether or not to loop the video.

- Target: `URLSearchParams`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    loop: true,
  }
})
```

### muted

The muted attribute specifies whether or not to mute the video.

- Target: `URLSearchParams`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    muted: true,
  }
})
```

### pip

The pip attribute specifies whether or not to display the picture-in-picture button.

- Target: `URLSearchParams`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    pip: false,
  }
})
```

### playsinline

The playsinline attribute specifies whether or not to play the video inline on mobile devices.

- Target: `URLSearchParams`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    playsinline: false,
  }
})
```

### portrait

The portrait attribute specifies whether or not to display the video owner's portrait.

- Target: `URLSearchParams`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    portrait: false,
  }
})
```

### quality

The quality attribute specifies the default video quality.

- Target: `URLSearchParams`
- Default: `auto`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    quality: '1080p',
  }
})
```

### speed

The speed attribute specifies whether or not to display the speed controls.

- Target: `URLSearchParams`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    speed: false,
  }
})
```

### startTime

The startTime attribute specifies the time at which the video should start playing.

- Target: `URLSearchParams`
- Default: `0`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    startTime: '1m30s',
  }
})
```

### texttrack

The texttrack attribute specifies the default language of the video's captions.

- Target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    texttrack: 'en',
  }
})
```

### title

The title attribute specifies whether or not to display the video title.

- Target: `URLSearchParams`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    title: false,
  }
})
```

### width

The width attribute specifies the width of the video.

- Target: `URLSearchParams`
- Default: `640`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    width: 1280,
  }
})
```

### height

The height attribute specifies the height of the video.

- Target: `URLSearchParams`
- Default: `360`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    height: 720,
  }
})
```

### addPasteHandler

Allows pasting Vimeo URLs directly into the editor to auto-generate the embedded video.

- Target: `Node`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Vimeo: {
    addPasteHandler: false,
  }
})
```

### modal

A modal box that appears when you <u>**mouseover on the video**</u>. A default modal box is provided which you can utilize or replace with your custom modal.

- Target: `Node`
- Default: `false`

```js
import { hypermultimedia, vimeoModal } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  Vimeo: {
    modal: vimeoModal, // default modal
  }
})
```

> To implement your own modal box, examine the default modal box and replicate the same methods. You can refer to the [source code](../../modals/youtube.ts) for more details.

## Commands

### setVimeo()

Makes the current node a Vimeo video.

```js
editor.commands.setVimeo({
  src: 'https://vimeo.com/123456789'
});

editor.commands.setVimeo({
  src: 'https://vimeo.com/123456789',
  width: 640,
  height: 480,
  float: "unset",
  clear: "none",
  display: "block",
  margin: "0.2in"
})
```

### Options

|Option          |Description                                                               |Default    |Optional |
|---             |---                                                                       |---        |---      |
|src             |The URL of the Vimeo, (Iframe Source Attribute)                           |`null`     |         |
|width           |The embed width (overrides the default option, optional)                  |`640`      |✅       |
|height          |The embed height (overrides the default option, optional)                 |`480`      |✅       |
|float           |The CSS style `float` (overrides the default option, optional)            |`unset`    |✅       |
|clear           |The CSS style `clear` (overrides the default option, optional)            |`none`     |✅       |
|display         |The CSS style `display` (overrides the default option, optional)          |`block`    |✅       |
|margin          |The CSS style `margin` (overrides the default option, optional)           |`0.0in`    |✅       |
|justifyContent  |The CSS style `justify-content` (overrides the default option, optional)  |`start`    |✅       |

## Source code

[packages/extension-hyperMultimedia/vimeo](./vimeo.ts)
