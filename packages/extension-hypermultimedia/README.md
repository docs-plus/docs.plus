# HyperMultimedia

[![Version](https://img.shields.io/npm/v/@docs.plus/extension-hypermultimedia.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-hypermultimedia)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-hypermultimedia.svg)](https://npmcharts.com/compare/@docs.plus/extension-hypermultimedia)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-hypermultimedia.svg)](https://www.npmjs.com/package/@docs.plus/extension-hypermultimedia)

HyperMultimedia is a powerful extension for the TipTap editor, enabling the embedding of various types of multimedia and posts directly within the editor.

Below is a list of supported media types:

| Media Type  | Description                                       | Documentation                           |
|-------------|---------------------------------------------------|-----------------------------------------|
| `Images`      | Embed images within the editor.                 | [More details](./src/nodes/image/)      |
| `Audio`      | Embed Audio within the editor.                   | [More details](./src/nodes/audio/)      |
| `Video`      | Embed Video within the editor.                   | [More details](./src/nodes/video/)      |
| `YouTube`     | Embed YouTube videos within the editor.         | [More details](./src/nodes/youtube/)    |
| `Vimeo`       | Embed Vimeo videos within the editor.           | [More details](./src/nodes/vimeo/)      |
| `SoundCloud`  | Embed SoundCloud audio within the editor.       | [More details](./src/nodes/soundcloud/) |
| `Twitter`     | Embed Twitter posts within the editor.          | [More details](./src/nodes/twitter/)    |

> Missing a media type? Let us know. 📬

## Installation

Install the `extension-hypermultimedia` package via npm:

```bash
npm install @docs.plus/extension-hypermultimedia
```

## Configuration

Configure the `HyperMultimediaKit` by passing an object with the desired settings for each media type you wish to use.

```javascript
import { HyperMultimediaKit, vimeoModal } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  Image,
  Youtube,
  Vimeo: {
    modal: vimeoModal, // default modal
    inline: true, // default false
  },
  SoundCloud: false,
  Twitter: false,
});
```

### Modals, Exciting Features 💡

The `HyperMultimedia` extension comes with a <u>modal</u> for each media type.
You can use the default modal or create your own.

#### Default Modals

you import and use the default modal for each media type like this:

<details>
<summary>The `hypermultimedia` styles.scss</summary>

```scss
.hypermultimedia {
  iframe,
  audio,
  video {
    background-color: #cfcfcf;
  }

  &__resize-gripper {
    position: absolute;
    margin: 0;
    display: none;
    z-index: 1;

    .media-resize-clamp {
      width: 10px;
      height: 10px;
      background-color: #1a73e8;
      border: 1px solid #fff;
      display: none;
      z-index: 4;

      &--rotate {
        border-radius: 50%;
        position: absolute;
        top: -28px;
        left: 50%;
        transform: translateX(-50%);
        cursor: crosshair;

        &::after {
          content: "";
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 1.5px;
          height: 30px;
          background-color: #1a73e8;
        }
      }

      &--left {
        position: absolute;
        top: 50%;
        left: -5px;
        transform: translateY(-50%);
        cursor: ew-resize;
        z-index: 2;
      }

      &--right {
        position: absolute;
        top: 50%;
        right: -5px;
        transform: translateY(-50%);
        cursor: ew-resize;
        z-index: 2;
      }

      &--top {
        position: absolute;
        top: -5px;
        left: 50%;
        transform: translateX(-50%);
        cursor: ns-resize;
        z-index: 2;
      }

      &--bottom {
        position: absolute;
        bottom: -5px;
        left: 50%;
        transform: translateX(-50%);
        cursor: ns-resize;
        z-index: 2;
      }

      &--top-left {
        position: absolute;
        top: -5px;
        left: -5px;
        cursor: nwse-resize;
      }

      &--top-right {
        position: absolute;
        top: -5px;
        right: -5px;
        cursor: nesw-resize;
      }

      &--bottom-left {
        position: absolute;
        bottom: -5px;
        left: -5px;
        cursor: nesw-resize;
      }

      &--bottom-right {
        position: absolute;
        bottom: -5px;
        right: -5px;
        cursor: nwse-resize;
      }
    }

    &--active {
      border: 1.5px solid #1a73e8;
      display: block;
      .media-resize-clamp {
        display: block;
      }
    }
  }

  &__modal {
    padding: 8px 8px;
    background-color: #fff;
    border-radius: 6px;
    display: flex;
    align-items: center;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(0, 0, 0, 0.1);
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;

    &__divider {
      border-left: 2px solid #e5e7eb;
      height: 5px;
      margin: 6px 10px;
    }

    select {
      @apply border-gray-300 py-2 px-2 rounded-md;
      &:hover {
        background-color: #eee;
      }
    }

    button {
      border-color: #d1d5db;
      padding: 8px;
      border-radius: 0.375rem;
      &:hover {
        background-color: #eee;
      }
    }

    &__btn--resize {
      svg {
      }
    }

    &--active {
      background-color: #1a73e8;
      fill: #fff;
      &:hover {
        svg {
          fill: black;
        }
      }
      svg {
        fill: #fff;
      }
    }
  }
}
```

</details>

```javascript
import { HyperMultimediaKit, vimeoModal } from "@docs.plus/extension-hypermultimedia";

HyperMultimediaKit.configure({
  Vimeo: {
    modal: vimeoModal,
  }
});

```

#### Custom Modals

OR you can create your own modal for each media type. To do so, you must pass a function.

<details>
<summary>Custom TwitterModal</summary>

```js
const twitterModal = (options) => {
 const { editor, tooltip, tippyModal, iframe, wrapper } = options;
  const nodePos = editor.view.posAtDOM(wrapper, 0);

  // Get the node attributes.
  const node = editor.state.doc.nodeAt(nodePos);
  const { float, display, margin } = attrs.attrs;

  // Remove all children from the modal, clear the modal content.
  while (tippyModal.firstChild) node.removeChild(tippyModal.firstChild);

  // Create a wrapper for the modal content.
  const div = createElement("div", "twitter-modal__wrapper");

  // Create action buttons for the node.
  const buttonFloadLeft = createElement("button", "twitter-modal__fload__left");
  const btnFloadRight = createElement("button", "twitter-modal__fload__right");

  buttonFloadLeft.addEventListener("click", () => {
    const { state, dispatch } = editor.view;
    const { tr } = state;

    tr.setNodeAttribute("Twitter", "float", "left");
    tooltip.hide();
    dispatch(tr);
  });

  btnFloadRight.addEventListener("click", () => {
    const { state, dispatch } = editor.view;
    const { tr } = state;

    tr.setNodeAttribute("Twitter", "float", "right");
    tooltip.hide();
    dispatch(tr);
  });

  // Append the buttons to the modal.
  div.append(buttonFloadLeft, btnFloadRight);

  // Append the modal wrapper to the modal.
  tippyModal.append(div);

  // Update the modal position, and place it on the bottom of the iframe,
  // then display the modal.
  tooltip.update(editor.view, { placement: "bottom-start" }, iframe);
}
```

</details>

```javascript
import { HyperMultimediaKit } from "@docs.plus/extension-hypermultimedia";

Editor = new Editor({
  // Other configurations
  extensions: [
    // Other extensions
    HyperMultimediaKit.configure({
      Twitter: {
        modal: twitterModal,
      }
    }),
  ]
});
```

> For more details, check out [the modal document](./src/modals/twitter.ts).

## Commands

### Youtube

```js
editor.commands.setYoutubeVideo({
  src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  width: 560,
  height: 315,
});
```

> For more details, check out [the Youtube document](./src/nodes/youtube/).

### Vimeo

```js
editor.commands.setVimeo({
  src: 'https://vimeo.com/123456789'
})
```

> For more details, check out [the Vimeo document](./src/nodes/vimeo/).

### Twitter

```js
editor.commands.setTwitter({
  src: 'https://twitter.com/tim_cook/status/1719021344854069441'
  float: "left",
});
```

> For more details, check out [the Twitter document](./src/nodes/twitter/).

### SoundCloud

```js
editor.commands.setSoundCloud({
  src: 'https://soundcloud.com/artist/track'
  margin: "0.2in"
});
```

> For more details, check out [the SoundCloud document](./src/nodes/soundcloud/).

### Image

```js
editor.commands.setImage({
  src: 'https://example.com/foobar.png',
  alt: 'A boring example image',
  title: 'An example'
})
```

#### Markdown syntax

```md
![alt text](src alt title)

![alt text](https://example.com/foobar.png)
```

> For more details, check out [the Image document](./src/nodes/image/).

### Video

```js
editor.commands.setVideo({
  src: 'https://example.com/foobar.mp4',
})
```

#### Markdown syntax

```md
![video](src title width height)

![video](https://example.com/foobar.mp4)
```

> For more details, check out [the Video document](./src/nodes/video/).

### Audio

```js
editor.commands.setAudio({
  src: 'https://example.com/foobar.mp3',
})
```

#### Markdown syntax

```md
![audio](src width height)

![audio](https://example.com/foobar.mp3)
```

> For more details, check out [the Audio document](./src/nodes/audio/).

## Sorce code and Example

- Demo: [extension-hypermultimedia](https://github.com/HMarzban/extension-hypermultimedia#demo-time-)
- Extension: [packages/extension-hypermultimedia](https://github.com/HMarzban/extension-hypermultimedia/tree/main/packages/extension-hypermultimedia)
- Usage: [packages/nextjs/src/components/Tiptap.tsx](https://github.com/HMarzban/extension-hypermultimedia/blob/main/packages/nextjs/src/components/Tiptap.tsx#L47)

## Inspiration and Acknowledgment, Let's Connect

Thank you for exploring our `HyperMultimedia` extension from docs.plus! We aim to make collaboration and knowledge sharing not just easy, but also enjoyable.

Our extension is inspired by Tiptap's [extension-image](https://tiptap.dev/api/nodes/image) and [extension-youtube](https://tiptap.dev/api/nodes/youtube). While we've incorporated our own enhancements, we'd like to tip our hats to Tiptap for pioneering the "headless" approach that we admire greatly.

> Please note: We're not affiliated with Tiptap, but we believe in recognizing foundational work.

Your feedback and interest in [docs.plus](https://github.com/docs-plus/docs.plus) are invaluable to us. Share your thoughts, suggestions, or dive deeper into our mission at the docs.plus repository.

Wish to converse?
Connect with us [here](https://github.com/docs-plus/docs.plus#-connect-with-us).
