# Embeds

Part of the [`@docs.plus/extension-hypermultimedia` README](../README.md).

Provider embeds resolve options in two layers. Kit defaults come from `HyperMultimediaKit.configure({ Youtube: { … } })`. Node attributes come from the insert call such as `setYoutubeVideo({ … })`, and node attributes win. The option key you write and the query name the kit emits are not always the same word, so both are named below.

## YouTube

YouTube maps camelCase option keys to the official iframe query names: `ccLanguage` → `cc_lang_pref`, `disableKBcontrols` → `disablekb`, `ivLoadPolicy` → `iv_load_policy`, `endTime` → `end`, `interfaceLanguage` → `hl`, `enableIFrameApi` → `enablejsapi`. Defaults: `controls: 1`, `modestbranding: 0`, `loop: 0`, `rel: 1`, `fs: 1`, `autoplay: 0`, `playsinline: 0`, `nocookie: false`, `ccLanguage: undefined`. Paste reads `start` from `?t=`, `?start=` or `#t=`. `loop: 1` auto-fills `playlist` with the video id. `nocookie: true` embeds from `youtube-nocookie.com`.

## Vimeo

Vimeo writes the option key `start` as the query name `start_time`, and defaults to `0`. Player defaults include `controls: true`, `title: true`, `byline: true`, `portrait: true`, `quality: 'auto'`, `transparent: true`, `dnt: false`. A `color` value drops a leading `#` before it reaches the query. An unlisted video keeps its `?h=` access token through both parse and render.

## Loom

Loom writes the option keys `hideOwner`, `hideShare`, `hideTitle` and `hideEmbedTopBar` as the query names `hide_owner`, `hide_share`, `hide_title` and `hideEmbedTopBar`. All four default to `false`. `autoplay` and `muted` default to `0`. A host that writes `hide_title` gets a type error and no effect.

## SoundCloud

SoundCloud passes the HTML5 widget parameters straight through, so the option key and the query name match: `auto_play`, `show_comments`, `show_user`, `show_reposts`, `show_artwork`, `show_playcount`, `hide_related`, `buying`, `sharing`, `download`, `single_active`, `start_track`, `color`. `visual` defaults to `false` and also drives the resize height floor: `166` when visual, `120` when compact. A stored `height` above `130` turns the visual player on by itself.

## Spotify

Spotify builds `open.spotify.com/embed/{type}/{id}` from any `track`, `album`, `playlist`, `artist`, `show` or `episode` URL. The Spotify node also accepts a `spotify:type:id` URI, an `intl-xx` path, an already-`embed` path, and the "Copy embed" `<iframe>` markup. Two paths rewrite `src` to the canonical share URL: `parseHTML` and the pasted `<iframe>` rule. `setSpotify` and a pasted plain URL store the string you pass. `theme` is `0` for dark and `1` for light. Leaving it unset lets Spotify render its own default, which is dark. The player is fixed-height, so it pins its height on a narrow column instead of scaling like a video embed.

## X

X sizes through the oEmbed `maxwidth` presets Compact `280`, Standard `400` and Wide `550`. The toolbar Post options menu switches both `maxwidth` and `theme`. `maxwidth` defaults to `400`. `theme` defaults to `'light'`, `lang` to `'en'`, `hide_media` and `hide_thread` to `false`. An X post reads its own `theme` attribute, not the page `color-scheme` — see [Theming](./styling.md#theming). `dnt` defaults to `true` and is a kit option only, because `AddXOptions` omits it. The `align` attribute is a schema attribute passed straight to oEmbed, with no kit option and no `setX` field. The `x` node has no drag-resize.

When X's oEmbed endpoint fails, fallback markup keeps the configured widget options.
If `widgets.js` also fails, a canonical post link stays visible.
Keep browser CORS protection enabled; see [X network failures](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hypermultimedia/src/nodes/x#network-failures).
