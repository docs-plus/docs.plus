# SoundCloud

This extension allows embedding SoundCloud tracks/playlist within your editor as a block-level node.

## Installation

```bash
npm install @docs.plus/extension-hypermultimedia
```

Then, import the extension into your editor:

```js
import { HyperMultimediaKit } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  SoundCloud,
})
```

## Settings

### inline

Controls if the node should be handled inline or as a block.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    inline: true,
  }
})
```

### visual

Switch to a video player with `true` or an audio player with `false`.

- target: `URLSearchParams`
- Default: `false`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    visual: true,
  }
})
```

### autoPlay

Set to `true` to autoplay the track on load.

- target: `URLSearchParams`
- Default: `false`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    autoPlay: true,
  }
})
```

### showComments, showReposts

Toggle visibility of related tracks, comments and reposts respectively.

- target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    showComments: false,
    showReposts: false,
  }
})
```

### hideRelated

Toggle visibility of related tracks.

- target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    hideRelated: true,
  }
})
```

### autoPlay

Set to `true` to autoplay the track on load. This attribute is used in `URLSearchParams` for the SoundCloud API request.

- target: `URLSearchParams`
- Default: `false`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    autoPlay: true,
  }
})
```

### hide_related

Toggle visibility of related tracks.

- target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    hide_related: true,
  }
})
```

### color

Specify the color of the embedded player. Default color is `#ff5500`.

- target: `URLSearchParams`
- Default: `#ff5500`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    color: "#ff5500",
  }
})
```

### buying

Toggle visibility of the buy button.

- target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    buying: false,
  }
})
```

### sharing

Toggle visibility of the share button.

- target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    sharing: false,
  }
})
```

### download

Toggle visibility of the download button.

- target: `URLSearchParams`

```js

HyperMultimediaKit.configure({
  SoundCloud: {
    download: false,
  }
})
```

### show_artwork

Toggle visibility of the artwork.

- target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    show_artwork: false,
  }
})
```

### show_playcount

Toggle visibility of the play count.

- target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    show_playcount: false,
  }
})
```

### show_user

Toggle visibility of the uploader name and avatar.

- target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    show_user: false,
  }
})
```

### start_track

Specify the track number to start playing from.

- target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    start_track: 2,
  }
})
```

### single_active

Toggle the single active player.

- target: `URLSearchParams`
- Default: `null`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    single_active: false,
  }
})
```

### width, height

Specify the dimensions of the embedded player. Default width is `460` and height is `130`.

- target: `iframe`
- Default: `460` x `130`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    width: 500,
    height: 160,
  }
})
```

### scrolling

Toggle scrolling of the embedded player.

- target: `iframe`
- Default: `no`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    scrolling: "yes",
  }
})
```

### frameborder

Toggle the frame border of the embedded player.

- target: `iframe`
- Default: `no`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    frameborder: "yes",
  }
})
```

### allow

Toggle autoplay of the embedded player.

- target: `iframe`
- Default: `autoplay`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    allow: "autoplay",
  }
})
```

### addPasteHandler

Enable the auto-embedding of SoundCloud tracks by pasting URLs directly into the editor.

- target: `Node`
- Default: `true`

```js
HyperMultimediaKit.configure({
  SoundCloud: {
    addPasteHandler: false,
  }
})
```

### HTMLAttributes

Custom HTML attributes that should be added to the rendered HTML wrapper tag.

- target: `Node`
- Default: `{}`

```js
import { HyperMultimediaKit } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  SoundCloud: {
    HTMLAttributes: {
      class: 'my-custom-class',
    },
  }
})
```

### modal

A modal box that appears when you <u>**click on the track**</u>. A default modal box is provided which you can utilize or replace with your custom modal.

- target: `Node`
- Default: `true`

```js
import { hypermultimedia, soundCloudModal } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  SoundCloud: {
    modal: soundCloudModal, // default modal
  }
})
```

> To implement your own modal box, examine the default modal box and replicate the same methods. You can refer to the [source code](../../modals/youtube.ts) for more details.

## Commands

### setSoundCloud()

Embed a SoundCloud track into the current node.

```js
editor.commands.setSoundCloud({
  src: 'https://soundcloud.com/artist/track'
});

editor.commands.setSoundCloud({
  src: 'https://soundcloud.com/artist/track',
  visual: true,
  autoPlay: false,
  width: 500,
  height: 160,
  float: "unset",
  clear: "none",
  display: "block",
  margin: "0.2in"
})
```

### Options

|Option          |Description                                                               |Default    |Optional |
|---             |---                                                                       |---        |---      |
|src             |The URL of the youtube, (Iframe Source Attribute)                         |`null`     |         |
|width           |The embed width (overrides the default option, optional)                  |`450`      |✅       |
|height          |The embed height (overrides the default option, optional)                 |`120`      |✅       |
|float           |The CSS style `float` (overrides the default option, optional)            |`unset`    |✅       |
|clear           |The CSS style `clear` (overrides the default option, optional)            |`none`     |✅       |
|display         |The CSS style `display` (overrides the default option, optional)          |`block`    |✅       |
|margin          |The CSS style `margin` (overrides the default option, optional)           |`0.0in`    |✅       |
|justifyContent  |The CSS style `justify-content` (overrides the default option, optional)  |`start`    |✅       |

## Source Code

[packages/extension-hyperMultimedia/soundcloud](./soundCloud.ts)
