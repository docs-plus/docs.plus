# YouTube

Embeds YouTube watch, embed, Shorts, and `youtu.be` URLs as iframe players. Paste a link or call `setYoutubeVideo`.

## Install

```bash
bun add @docs.plus/extension-hypermultimedia
```

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  Youtube: {
    controls: 1,
    nocookie: false
  }
})
```

## Kit options vs node attributes

Configure defaults on `HyperMultimediaKit.configure({ Youtube: { … } })`. Each inserted node stores its own attributes; unset values fall back to those kit defaults when the embed URL is built.

Override player behavior per insert with `setYoutubeVideo({ … })`. Pasting a watch URL with `?t=`, `?start=`, or `#t=` sets the node `start` attribute (seconds).

Embed query names follow [YouTube’s IFrame Player API](https://developers.google.com/youtube/player_parameters). This extension maps camelCase kit/attr names to those query keys (for example `ccLanguage` → `cc_lang_pref`, `disableKBcontrols` → `disablekb`).

When `loop` is `1` and `playlist` is omitted, the builder sets `playlist` to the current video ID so single-video loop works.

## Layout

| Option                                        | Target  | Default                          |
| --------------------------------------------- | ------- | -------------------------------- |
| `inline`                                      | Node    | `false`                          |
| `width`, `height`                             | iframe  | `640`, `480`                     |
| `margin`                                      | wrapper | `auto`                           |
| `float`, `clear`, `display`, `justifyContent` | wrapper | `null`, `none`, `block`, `start` |

```js
HyperMultimediaKit.configure({
  Youtube: {
    width: 560,
    height: 315
  }
})
```

## Iframe HTML attributes

| Option            | Target | Default                                                                                    |
| ----------------- | ------ | ------------------------------------------------------------------------------------------ |
| `frameborder`     | iframe | `0`                                                                                        |
| `allow`           | iframe | `accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture` |
| `allowfullscreen` | iframe | `true`                                                                                     |

```js
HyperMultimediaKit.configure({
  Youtube: {
    allowfullscreen: false
  }
})
```

## Player URL parameters

| Kit / attr name     | YouTube query    | Default | Notes                                                           |
| ------------------- | ---------------- | ------- | --------------------------------------------------------------- |
| `autoplay`          | `autoplay`       | `0`     | `0` or `1`                                                      |
| `controls`          | `controls`       | `1`     | `0` or `1`                                                      |
| `nocookie`          | (embed host)     | `false` | Uses `youtube-nocookie.com` when `true`                         |
| `ccLanguage`        | `cc_lang_pref`   | —       | ISO 639-1, e.g. `es`                                            |
| `ccLoadPolicy`      | `cc_load_policy` | —       | `1` shows captions by default                                   |
| `color`             | `color`          | —       | `red` or `white` (progress bar)                                 |
| `disableKBcontrols` | `disablekb`      | `0`     | `1` disables keyboard controls                                  |
| `enableIFrameApi`   | `enablejsapi`    | `0`     | Requires `origin` when `1`                                      |
| `endTime`           | `end`            | —       | Stop time in seconds                                            |
| `fs`                | `fs`             | `1`     | `0` hides the fullscreen button in the player chrome            |
| `interfaceLanguage` | `hl`             | —       | Player UI language, ISO 639-1                                   |
| `ivLoadPolicy`      | `iv_load_policy` | `1`     | `1` show annotations; `3` hide                                  |
| `loop`              | `loop`           | `0`     | `1` loops; auto-sets `playlist` to video id                     |
| `modestbranding`    | `modestbranding` | `0`     | `1` reduces YouTube logo in control bar                         |
| `origin`            | `origin`         | —       | Required with `enableIFrameApi`                                 |
| `playlist`          | `playlist`       | —       | Comma-separated video IDs                                       |
| `playsinline`       | `playsinline`    | `0`     | `1` for inline playback on iOS                                  |
| `rel`               | `rel`            | `1`     | `0` limits related videos to same channel                       |
| `list`              | `list`           | —       | Playlist id with `listType`                                     |
| `listType`          | `listType`       | —       | `playlist` or `user_uploads`                                    |
| `start`             | `start`          | `0`     | Start time in seconds (node attr; also parsed from pasted URLs) |

```js
HyperMultimediaKit.configure({
  Youtube: {
    modestbranding: 1,
    rel: 0,
    playsinline: 1,
    nocookie: true
  }
})
```

## Paste

| Option            | Default | Description                                  |
| ----------------- | ------- | -------------------------------------------- |
| `addPasteHandler` | `true`  | Convert pasted YouTube URLs into embed nodes |

Supported URL shapes include `youtube.com/watch?v=…`, `youtu.be/…`, `/embed/…`, and `/shorts/…`. Query params such as `?t=90` or `?start=90` set `start`.

```js
HyperMultimediaKit.configure({
  Youtube: {
    addPasteHandler: false
  }
})
```

## Resize gripper

On desktop, the kit shows a drag resize gripper on hover (not on the X node). Disable per node:

```js
HyperMultimediaKit.configure({
  Youtube: {
    resizeGripper: false
  }
})
```

## Caption

Add a caption from the toolbar; the text is stored in the node `caption` attribute
and persists via collaboration and JSON. The embed emits no `<figure>` in HTML —
the caption is editor and attribute only (HTML `<figure>` round-trip is `image`-only).

## Commands

### setYoutubeVideo(options)

Inserts a YouTube embed at the cursor. Returns `false` for an invalid URL.

```js
editor.commands.setYoutubeVideo({
  src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  width: 640,
  height: 480,
  start: 30,
  controls: 0,
  modestbranding: 1
})
```

Layout options: `width`, `height`, `margin`, `float`, `clear`, `display`, `justifyContent`.

Any player row from the table above can be passed on the command to override kit defaults for that node only.

## Source code

[`youtube.ts`](./youtube.ts), [`embedOptions.ts`](./embedOptions.ts)
