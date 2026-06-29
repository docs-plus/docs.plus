# Spotify

Embeds Spotify tracks, albums, playlists, artists, shows, and episodes via the official iframe player (`open.spotify.com/embed`).

## Install

```sh
bun add @docs.plus/extension-hypermultimedia
```

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  Spotify: {
    theme: 1 // light; omit for Spotify's default (dark)
  }
})
```

## URLs

The `src` is the share URL or `spotify:` URI of any embeddable entity:

| Entity     | Example                                  |
| ---------- | ---------------------------------------- |
| `track`    | `https://open.spotify.com/track/{id}`    |
| `album`    | `https://open.spotify.com/album/{id}`    |
| `playlist` | `https://open.spotify.com/playlist/{id}` |
| `artist`   | `https://open.spotify.com/artist/{id}`   |
| `show`     | `https://open.spotify.com/show/{id}`     |
| `episode`  | `https://open.spotify.com/episode/{id}`  |

Localized `open.spotify.com/intl-xx/...` links, already-`embed/` links, and `spotify:track:{id}` URIs resolve to the same entity. The stored `src` keeps the canonical share URL; the node builds `https://open.spotify.com/embed/{type}/{id}` for the iframe.

## Layout

| Option                                                  | Default                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `inline`                                                | `false`                                  |
| `width`, `height`                                       | `640`, `352` (`152` for a `track`)       |
| `margin`, `float`, `clear`, `display`, `justifyContent` | `auto`, `null`, `none`, `block`, `start` |

The player is fixed-height: width fills the column (responsive, capped at `width`), and the committed height holds when the column shrinks rather than scaling away. Spotify's three sizes are `352` (full art), `152` (compact track), and `80` (play bar only) — drag the gripper to switch between them.

## Embed options

| Kit / attr name   | Default                                                                      | Notes                                 |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| `theme`           | —                                                                            | `0` dark (Spotify default), `1` light |
| `allow`           | `autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture` | iframe permissions                    |
| `frameborder`     | `0`                                                                          |                                       |
| `allowfullscreen` | `true`                                                                       |                                       |

## Paste

| Option            | Default |
| ----------------- | ------- |
| `addPasteHandler` | `true`  |

Pasting an `open.spotify.com` URL inserts a Spotify node (a track gets the compact height, everything else the full-art height). Pasting Spotify's **Copy embed** `<iframe>` code works too — as rich HTML or plain text — and the stored `src` is normalized back to the canonical share URL (the `?utm_source`/`&si=` params are dropped).

## Commands

### setSpotify(options)

Returns `false` for a URL that is not an embeddable Spotify entity.

```js
editor.commands.setSpotify({
  src: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  theme: 1
})
```

Layout options plus `theme` can be passed on the command.

## Markdown syntax

With `@tiptap/markdown` loaded:

```md
![spotify](https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl)
```

## Source code

[`spotify.ts`](./spotify.ts), [`embedOptions.ts`](./embedOptions.ts)
