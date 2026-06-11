# Loom

Embeds Loom recordings. `share` and `embed` URLs normalize to `loom.com/embed/<id>` with optional query params.

## Install

```bash
bun add @docs.plus/extension-hypermultimedia
```

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

## Source code

[`loom.ts`](./loom.ts), [`embedOptions.ts`](./embedOptions.ts)
