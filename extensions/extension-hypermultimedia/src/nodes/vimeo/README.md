# Vimeo

Embeds Vimeo watch and player URLs as iframe players. Paste a link or call `setVimeo`.

## Install

```sh
bun add @docs.plus/extension-hypermultimedia
```

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  Vimeo: {
    autoplay: false,
    quality: 'auto'
  }
})
```

## Kit options vs node attributes

Configure defaults on `HyperMultimediaKit.configure({ Vimeo: { … } })`. Each node stores its own attributes; unset values fall back to kit defaults when the embed URL is built.

Override player behavior per insert with `setVimeo({ … })`. The node `start` attribute (seconds) maps to Vimeo `start_time`. Unlisted videos need the full watch URL including the `h` query param — it is preserved in the embed URL.

Query names follow [Vimeo embed options](https://developer.vimeo.com/player/sdk/embed) (`start_time`, `end_time`, etc.).

## Layout

| Option                                                  | Default                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `inline`                                                | `false`                                  |
| `width`, `height`                                       | `640`, `480`                             |
| `margin`, `float`, `clear`, `display`, `justifyContent` | `auto`, `null`, `none`, `block`, `start` |

## Iframe HTML attributes

| Option            | Default                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| `frameborder`     | `0`                                                                          |
| `allow`           | `autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media` |
| `allowfullscreen` | `true`                                                                       |

## Player URL parameters

| Kit / attr name | Vimeo query   | Default | Notes                                              |
| --------------- | ------------- | ------- | -------------------------------------------------- |
| `autopause`     | `autopause`   | `true`  | Pause when another Vimeo player on the page starts |
| `autoplay`      | `autoplay`    | `false` |                                                    |
| `background`    | `background`  | `false` | Controls-free loop mode                            |
| `byline`        | `byline`      | `true`  | `true`, `false`, or `site-default`                 |
| `color`         | `color`       | —       | Hex accent (with or without `#`)                   |
| `controls`      | `controls`    | `true`  |                                                    |
| `dnt`           | `dnt`         | `false` | Do-not-track                                       |
| `keyboard`      | `keyboard`    | `true`  |                                                    |
| `loop`          | `loop`        | `false` |                                                    |
| `muted`         | `muted`       | `false` |                                                    |
| `pip`           | `pip`         | `true`  | Picture-in-picture button                          |
| `playsinline`   | `playsinline` | `true`  |                                                    |
| `portrait`      | `portrait`    | `true`  | Owner avatar; `site-default` allowed               |
| `quality`       | `quality`     | `auto`  | `240p` … `4k`, `auto`                              |
| `speed`         | `speed`       | `false` | Playback-speed menu                                |
| `texttrack`     | `texttrack`   | —       | Caption track code, e.g. `en`                      |
| `title`         | `title`       | `true`  | Video title overlay                                |
| `transparent`   | `transparent` | `true`  |                                                    |
| `endTime`       | `end_time`    | —       | Segmented playback end (seconds)                   |
| `start`         | `start_time`  | `0`     | Start offset (seconds; node attr)                  |

`width` and `height` on the node are also passed as embed query params when set.

## Paste

| Option            | Default |
| ----------------- | ------- |
| `addPasteHandler` | `true`  |

Accepts `vimeo.com/<id>` and `player.vimeo.com/video/<id>` URLs.

## Commands

### setVimeo(options)

Returns `false` for an invalid URL.

```js
editor.commands.setVimeo({
  src: 'https://vimeo.com/123456789',
  start: 30,
  autoplay: false,
  byline: true
})
```

Layout options: `width`, `height`, `margin`, `float`, `clear`, `display`, `justifyContent`. Any player row above can override kit defaults for that node.

## Markdown syntax

With `@tiptap/markdown` loaded:

```md
![vimeo](https://vimeo.com/123456789)
```

## Source code

[`vimeo.ts`](./vimeo.ts), [`embedOptions.ts`](./embedOptions.ts)
