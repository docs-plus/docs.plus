# Video

Use this extension to render `<video>` HTML tags. Block Or Inline level node.

> **Restrictions:** This extension does only the rendering of videos. It doesn’t upload videos to your server, that’s a whole different story.

## Installation

```bash
npm install @docs.plus/extension-hypermultimedia
```

Then, import the extension into your editor:

```js
import { HyperMultimediaKit } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  Video,
})
```

## Settings

### inline

Controls if the node should be handled inline or as a block.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Video: {
    inline: true,
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
    controls: false,
  }
})

```

### autoplay

Automatically start playing the video as soon as it can do so without stopping.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Video: {
    autoplay: true,
  }
})

```

### loop

Automatically seek back to the start upon reaching the end of the video.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Video: {
    loop: true,
  }

})

```

### muted

Mute the video.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Video: {
    muted: true,
  }
})
```

### poster

A URL indicating a poster frame to show until the user plays or seeks.

- Target: `Node`
- Default: `null`

```js
HyperMultimediaKit.configure({
  Video: {
    poster: "https://example.com/poster.png",
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
    preload: "none",
  }
})
```

### HTMLAttributes

Custom HTML attributes that should be added to the rendered HTML tag.

- Target: `Node`
- Default: `{}`

```js
HyperMultimediaKit.configure({
  Video: {
    HTMLAttributes: {
      class: 'my-custom-class',
    },
  }
})
```

### modal

A modal box that appears when you **mouseover on the video**. A default modal box is provided which you can utilize or replace with your custom modal.

- Target: `Node`
- Default: `false`

```js
import { hypermultimedia, videoModal } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  Video: {
    modal: videoModal, // default modal
  }
})
```

### resizeGripper

a resize gripper that apear when you mouseover on video.

- target: `Node`
- default: `true`

```js
import { hypermultimedia, videoModal } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  Video: {
    modal: videoModal,
    resizeGripper: false,
  }
})
```

> To implement your own modal box, examine the default modal box and replicate the same methods. You can refer to the [source code](../../modals/youtube.ts) for more details.

## Commands

### setVideo

Makes the current node a video.

```js
editor.commands.setVideo({
  src: 'https://example.com/foobar.mp4'
});

editor.commands.setVideo({
  src: 'https://example.com/foobar.mp4',
  width: 640,
  height: 480,
});
```

## Markdown syntax

```md
![video](src title width height)

![video](https://example.com/foobar.mp4)
```

### Options

|Option          |Description                                                               |Default    |Optional |
|---             |---                                                                       |---        |---      |
|src             |The URL of the video                        |`null`     |         |
|width           |The embed width (overrides the default option, optional)                  |`640`      |✅       |
|height          |The embed height (overrides the default option, optional)                 |`480`      |✅       |
|float           |The CSS style `float` (overrides the default option, optional)            |`unset`    |✅       |
|clear           |The CSS style `clear` (overrides the default option, optional)            |`none`     |✅       |
|display         |The CSS style `display` (overrides the default option, optional)          |`block`    |✅       |
|margin          |The CSS style `margin` (overrides the default option, optional)           |`0.0in`    |✅       |
|justifyContent  |The CSS style `justify-content` (overrides the default option, optional)  |`start`    |✅       |

## Source code

[packages/extension-hyperMultimedia/video](./video.ts)
