# X

This extension render embedded X tweets in your editor.

## Installation

```bash
bun add @docs.plus/extension-hypermultimedia
```

Then, import the extension into your editor:

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  X
})
```

## Settings

### inline

Controls if the node should be handled inline or as a block.

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

Enable the auto-embedding of tweets by pasting X URLs directly into the editor.

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

Define the theme of the embedded tweet, either light or dark.

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

Enable the data tracking parameter.

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

Specify the language of the embedded tweet, e.g., `'en'` for English.

- Target: `URLSearchParams`
- Default: `'en'`

```js
HyperMultimediaKit.configure({
  X: {
    lang: 'fr'
  }
})
```

### width

Define the width of the embedded tweet.

- Target: `URLSearchParams`
- Default: `450`

```js
HyperMultimediaKit.configure({
  X: {
    width: 550
  }
})
```

### height

Define the height of the embedded tweet.

- Target: `URLSearchParams`
- Default: `120`

```js
HyperMultimediaKit.configure({
  X: {
    height: 600
  }
})
```

### limit

Define the maximum number of tweets to display.

- Target: `URLSearchParams`
- Default: `20`

```js
HyperMultimediaKit.configure({
  X: {
    limit: 10
  }
})
```

### maxwidth

Define the maximum width of the embedded tweet.

- Target: `URLSearchParams`
- Default: `550`

```js
HyperMultimediaKit.configure({
  X: {
    maxwidth: 600
  }
})
```

### maxheight

Define the maximum height of the embedded tweet.

- Target: `URLSearchParams`
- Default: `600`

```js
HyperMultimediaKit.configure({
  X: {
    maxheight: 650
  }
})
```

### chrome

Define the chrome of the embedded tweet.

- Target: `URLSearchParams`
- Default: `noheader nofooter noborders noscrollbar transparent`

```js
HyperMultimediaKit.configure({
  X: {
    chrome: 'noheader nofooter noborders noscrollbar transparent'
  }
})
```

### aria_polite

Define the ARIA live region politeness value for tweets added to a timeline.

- Target: `URLSearchParams`
- Default: `polite`

```js
HyperMultimediaKit.configure({
  X: {
    aria_polite: 'assertive'
  }
})
```

### modal

A modal box that appears when you <u>**click on the tweet**</u>. A default modal box is provided which you can utilize or replace with your custom modal.

- Target: `Node`
- Default: `false`

```js
import { hypermultimedia, twitterModal } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  X: {
    modal: twitterModal // default modal
  }
})
```

> To implement your own modal box, examine the default modal box and replicate the same methods. You can refer to the [source code](../../modals/twitter.ts) for more details.

## Caption

Add a caption from the toolbar; the text is stored in the node `caption` attribute
and persists via collaboration and JSON. The post emits no `<figure>` in HTML — the
caption is editor and attribute only (HTML `<figure>` round-trip is `image`-only).

## Commands

### setX()

Embed a X tweet into the current node.

```js
editor.commands.setX({
  src: 'https://twitter.com/username/status/1234567890'
})

editor.commands.setX({
  src: 'https://twitter.com/username/status/1234567890',
  theme: 'dark',
  width: '550px',
  height: '600px',
  float: 'unset',
  clear: 'none',
  display: 'block',
  margin: '0.2in'
})
```

### Options

| Option         | Description                                                              | Default | Optional |
| -------------- | ------------------------------------------------------------------------ | ------- | -------- |
| src            | The URL of the youtube, (Iframe Source Attribute)                        | `null`  |          |
| float          | The CSS style `float` (overrides the default option, optional)           | `unset` | ✅       |
| clear          | The CSS style `clear` (overrides the default option, optional)           | `none`  | ✅       |
| display        | The CSS style `display` (overrides the default option, optional)         | `block` | ✅       |
| margin         | The CSS style `margin` (overrides the default option, optional)          | `0.0in` | ✅       |
| justifyContent | The CSS style `justify-content` (overrides the default option, optional) | `start` | ✅       |

## Source code

[packages/extension-hyperMultimedia/twitter](./twitter.ts)
