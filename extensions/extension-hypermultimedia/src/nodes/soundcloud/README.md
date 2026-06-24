# SoundCloud

Embeds SoundCloud tracks and playlists via the official HTML5 widget (`w.soundcloud.com/player`).

## Install

```sh
bun add @docs.plus/extension-hypermultimedia
```

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  SoundCloud: {
    visual: false,
    auto_play: false
  }
})
```

## Kit options vs node attributes

Configure defaults on `HyperMultimediaKit.configure({ SoundCloud: { … } })`. Widget params use SoundCloud’s snake_case names ([widget docs](https://developers.soundcloud.com/docs/api/html5-widget)). Each node stores attrs; unset values fall back to kit defaults.

The widget `url` param is always the SoundCloud page URL from `src`. Heights above ~130px default to `visual: true` (waveform player) unless `visual` is set explicitly on the node or command.

## Layout

| Option                                                  | Default                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `inline`                                                | `false`                                  |
| `width`, `height`                                       | `450`, `120`                             |
| `margin`, `float`, `clear`, `display`, `justifyContent` | `auto`, `null`, `none`, `block`, `start` |

## Widget parameters

| Kit / attr name  | Default | Notes                           |
| ---------------- | ------- | ------------------------------- |
| `auto_play`      | `false` |                                 |
| `hide_related`   | `false` |                                 |
| `show_comments`  | `true`  |                                 |
| `show_user`      | `true`  |                                 |
| `show_reposts`   | `true`  |                                 |
| `visual`         | `false` | `true` = tall waveform player   |
| `color`          | —       | Hex, e.g. `#0066CC`             |
| `buying`         | `true`  |                                 |
| `sharing`        | `true`  |                                 |
| `download`       | `true`  |                                 |
| `show_artwork`   | `true`  |                                 |
| `show_playcount` | `true`  |                                 |
| `start_track`    | —       | Playlist track index            |
| `single_active`  | `true`  | Only one player plays at a time |

Boolean widget values are sent as `true` / `false` strings.

## Iframe HTML attributes

| Option        | Default    |
| ------------- | ---------- |
| `scrolling`   | `no`       |
| `frameborder` | `no`       |
| `allow`       | `autoplay` |

## Paste

| Option            | Default |
| ----------------- | ------- |
| `addPasteHandler` | `true`  |

## Commands

### setSoundCloud(options)

Returns `false` for an invalid URL.

```js
editor.commands.setSoundCloud({
  src: 'https://soundcloud.com/artist/track',
  visual: true,
  height: 166,
  hide_related: true
})
```

Layout options plus any widget row above can be passed on the command.

## Markdown syntax

With `@tiptap/markdown` loaded:

```md
![soundcloud](https://soundcloud.com/artist/track)
```

## Source code

[`soundcloud.ts`](./soundcloud.ts), [`embedOptions.ts`](./embedOptions.ts)
