# Loom

Embeds Loom recordings. `share` and `embed` URLs normalize to `loom.com/embed/<id>` with optional query params.

## Install

```sh
npm install @docs.plus/extension-hypermultimedia
```

Or use `pnpm add @docs.plus/extension-hypermultimedia`, `yarn add @docs.plus/extension-hypermultimedia`, or `bun add @docs.plus/extension-hypermultimedia`.

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  Loom: {
    hideTitle: true,
    autoplay: 0
  }
})
```

## Kit options vs node attributes

Kit defaults apply to every insert; per-node attrs override when building the embed URL. URL validation lives under [Security](#security).

## Layout

| Option                                                  | Default                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `inline`                                                | `false`                                  |
| `width`, `height`                                       | `640`, `480`                             |
| `margin`, `float`, `clear`, `display`, `justifyContent` | `auto`, `null`, `none`, `block`, `start` |

## Embed query parameters

| Kit / attr name   | Query param       | Default | Notes                       |
| ----------------- | ----------------- | ------- | --------------------------- |
| `autoplay`        | `autoplay`        | `0`     | `0` or `1`                  |
| `muted`           | `muted`           | `0`     | `0` or `1`                  |
| `hideOwner`       | `hide_owner`      | `false` |                             |
| `hideShare`       | `hide_share`      | `false` |                             |
| `hideTitle`       | `hide_title`      | `false` |                             |
| `hideEmbedTopBar` | `hideEmbedTopBar` | `false` | Loom uses this exact casing |

## Iframe HTML attributes

| Option            | Default                          |
| ----------------- | -------------------------------- |
| `frameborder`     | `0`                              |
| `allow`           | `fullscreen; picture-in-picture` |
| `allowfullscreen` | `true`                           |
| `scrolling`       | `no`                             |

Fullscreen lives only in `allow`. `allowfullscreen: true` adds `fullscreen` to the rendered `allow` list, and `false` removes it. The iframe never gets the legacy `allowfullscreen` attribute, because Chrome warns when it sits beside `allow`. Old HTML that carries the attribute still parses.

## Paste

| Option            | Default |
| ----------------- | ------- |
| `addPasteHandler` | `true`  |

## Commands

### setLoom(options)

Returns `false` for a non-Loom URL.

```js
editor.commands.setLoom({
  src: 'https://www.loom.com/share/abcdef1234567890',
  hideTitle: true,
  autoplay: 0
})
```

Layout options plus embed params can be passed on the command.

## Security

Only valid Loom URLs enter the document. Non-Loom `src` values render an empty iframe `src`.

## Markdown syntax

With `@tiptap/markdown` loaded:

```text
![loom](https://www.loom.com/share/abcdef1234567890)
![loom](https://www.loom.com/share/abcdef1234567890 "Walkthrough"){width=800 float=right}
```

The title slot holds the caption, and the block holds the options. Markdown drops the player options in the table above. Keys, values and defaults: [Caption and options](../../../docs/paste-and-import.md#caption-and-options).

## Source code

[`loom.ts`](./loom.ts), [`embedOptions.ts`](./embedOptions.ts)
