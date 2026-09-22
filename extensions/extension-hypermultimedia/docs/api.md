# API reference

Part of the [`@docs.plus/extension-hypermultimedia` README](../README.md).

## Options

Every option below goes inside one `HyperMultimediaKit.configure({ … })` call. The kit declares no `addOptions`. Every key starts as `undefined`, except `loadingShell`, which kit storage reads as `true`.

| Option                                                                         | Type                                                                                                                                                                                                                                                                          | Default     | Description                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Image`, `Audio`, `Video`, `Youtube`, `Vimeo`, `SoundCloud`, `Spotify`, `Loom` | `Partial<ImageOptions>`, `Partial<AudioOptions>`, `Partial<VideoOptions>`, `Partial<YoutubeOptions>`, `Partial<VimeoOptions>`, `Partial<SoundCloudOptions>`, `Partial<SpotifyOptions>` or `Partial<LoomOptions>`, each `& { resizeGripper?: boolean }`, or `true`, or `false` | `undefined` | Per-node options object. `true` keeps the node defaults, `false` drops the node. See [`resizeGripper`](#resizegripper).                                                                                     |
| `X`                                                                            | `Partial<XOptions> \| true \| false`                                                                                                                                                                                                                                          | `undefined` | Same shape, without `resizeGripper`. The `x` node never gets drag handles.                                                                                                                                  |
| `mediaToolbar`                                                                 | `MediaToolbarFactory`                                                                                                                                                                                                                                                         | `undefined` | Media toolbar factory. Return an element, or `null` so the host renders its own surface. Falls back to `createMediaToolbar`. See [Bring your own toolbar](./media-toolbar.md#bring-your-own-toolbar).       |
| `mediaActions`                                                                 | `MediaActionsResolver`                                                                                                                                                                                                                                                        | `undefined` | Rewrites the resolved action list per node. Falls back to the base actions plus the per-node recipe. See [Customizing actions](./media-toolbar.md#customizing-actions).                                     |
| `mediaToolbarIcons`                                                            | `MediaToolbarIconsResolver`                                                                                                                                                                                                                                                   | `undefined` | Swaps toolbar and menu SVG markup by icon key. Falls back to the Google Material Symbols set. See [Customizing actions](./media-toolbar.md#customizing-actions).                                            |
| `replaceUrlPopover`                                                            | `ReplaceUrlPopoverFactory`                                                                                                                                                                                                                                                    | `undefined` | Replace URL form factory. Return an element, or `null` for a host surface. Falls back to `createReplaceUrlPopover`. See [Customizing actions](./media-toolbar.md#customizing-actions).                      |
| `isUploadedMedia`                                                              | `(ctx: MediaActionContext) => boolean`                                                                                                                                                                                                                                        | `undefined` | Marks `image`, `video` and `audio` nodes as host uploads, so View original stays hidden. An absent hook reads as `false`.                                                                                   |
| `loadingShell`                                                                 | `MediaLoadingShellOption`                                                                                                                                                                                                                                                     | `true`      | `true` for the built-in shell, `false` for none, or a factory that replaces the shell overlay. An unset value falls back to the built-in shell. See [Loading shell](./resize-and-loading.md#loading-shell). |

The nine per-node interfaces are not exported from the package entry. Reach the kit shape through the exported `HyperMultimediaKitOptions`.

### Configuration example

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'
// Required. Without it the toolbar, gripper, caption and loading shell render unstyled.
// The gripper is the drag-handle overlay the kit draws on the media node.
import '@docs.plus/extension-hypermultimedia/styles.css'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  content: '<img src="https://example.com/photo.png">',
  extensions: [
    StarterKit,
    HyperMultimediaKit.configure({
      // `inline: true` moves the node into the inline group, so it flows in a paragraph.
      // `allowBase64: true` admits `data:image/*` sources on paste and on parse.
      Image: { inline: true, allowBase64: true },
      Vimeo: { inline: true },
      // `false` drops the node. Do not set `resizeGripper: false` instead:
      // that removes the whole media toolbar for the node, not only the drag handles.
      SoundCloud: false
    })
  ]
})
```

The snippet drops SoundCloud on purpose, to show what `false` does. The snippet has no host wiring for pasted image files, and no veto for a link extension. [Paste and import](./paste-and-import.md) covers both. [Image file paste (`editorFileUpload`)](./paste-and-import.md#image-file-paste-editorfileupload) owns the file path, and [Paste precedence](./paste-and-import.md#paste-precedence) owns the link veto. [Styling](./styling.md) owns the visual contract.

### `resizeGripper`

`resizeGripper: false` removes the whole media toolbar for that node, not only the drag handles. The kit drops the node from its resizable list, so it builds no gripper widget. The hover controls layer then returns before it mounts the toolbar, because only the `x` node may run toolbar-only. That node loses Align, Margin, Caption, View original, Download, Replace URL, Copy and Delete as well.

Keep the gripper on when you want the toolbar. To remove the drag handles alone, replace the media toolbar with [`mediaToolbar`](./media-toolbar.md#bring-your-own-toolbar).

### Per-node options

Each node slot accepts these keys. They are node options, not kit keys, so they go inside the node's own object.

| Option            | Type                             | Default      | Nodes                                                                                                                                                    |
| ----------------- | -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resizeGripper`   | `boolean`                        | `undefined`  | All except `x`. An unset value reads as `true`. Only an explicit `false` drops the node from the resizable list — see [`resizeGripper`](#resizegripper). |
| `width`           | `number \| null`                 | per node     | `image`, `video`, `youtube`, `vimeo`, `soundcloud`, `spotify`, `loom` — see [Default sizes](#default-sizes).                                             |
| `height`          | `number \| null`                 | per node     | `image`, `video`, `youtube`, `vimeo`, `soundcloud`, `spotify`, `loom` — see [Default sizes](#default-sizes).                                             |
| `inline`          | `boolean`                        | `false`      | All nine. `true` moves the node from the `block` group to `inline`.                                                                                      |
| `addPasteHandler` | `boolean`                        | `true`       | `youtube`, `vimeo`, `soundcloud`, `spotify`, `loom`, `x`. `false` stops a pasted provider URL from becoming a node.                                      |
| `HTMLAttributes`  | `Record<string, unknown>`        | `{}`         | All nine. The node merges it into the rendered element.                                                                                                  |
| `margin`          | `string \| null`                 | `'auto'`     | All nine.                                                                                                                                                |
| `float`           | `string \| null`                 | `null`       | All nine.                                                                                                                                                |
| `clear`           | `string`                         | `'none'`     | All nine.                                                                                                                                                |
| `display`         | `string`                         | `'block'`    | All nine.                                                                                                                                                |
| `justifyContent`  | `string \| null`                 | `'start'`    | Every node except `image`, which has no such attribute.                                                                                                  |
| `allowBase64`     | `boolean`                        | `false`      | `image` only. Gates the parse rule and the paste plugin.                                                                                                 |
| `controls`        | `boolean`                        | `true`       | `video`, `audio`.                                                                                                                                        |
| `autoplay`        | `boolean`                        | `false`      | `video`, `audio`.                                                                                                                                        |
| `loop`            | `boolean`                        | `false`      | `video`, `audio`.                                                                                                                                        |
| `muted`           | `boolean`                        | `false`      | `video`, `audio`.                                                                                                                                        |
| `preload`         | `'none' \| 'metadata' \| 'auto'` | `'metadata'` | `video`, `audio`.                                                                                                                                        |
| `poster`          | `string \| null`                 | `null`       | `video` only.                                                                                                                                            |

Player parameters are per node. See [Embeds](./embeds.md) for the provider keys, and [Nodes](../README.md#nodes) for each node's full table.

### Default sizes

`width` and `height` are node attributes, and seven of the nine also expose them as node options. A provider insert command fills a missing value from the table below. It then fits the result to the editor content column. `setImage` fits only when you pass both. `setAudio` never fits.

| Node         | `width` default | `height` default                                             |
| ------------ | --------------- | ------------------------------------------------------------ |
| `image`      | `null`          | `null` — the node view lays the shell out at 320 × 240       |
| `audio`      | `null`          | `null` — the node view lays the shell out at 450 × 120       |
| `video`      | `640`           | `480`                                                        |
| `youtube`    | `640`           | `480`                                                        |
| `vimeo`      | `640`           | `480`                                                        |
| `loom`       | `640`           | `480`                                                        |
| `spotify`    | `640`           | `352`, and `152` when the URL is a track                     |
| `soundcloud` | `450`           | `120`                                                        |
| `x`          | no attribute    | no attribute — the node sizes from `maxwidth`, default `400` |

## Commands

Ten commands land on `editor.commands`. Each provider insert command returns `false` for a `src` that fails its provider check. `setImage`, `setVideo` and `setAudio` return `false` only for an empty `src`. No insert command runs the scheme gate — see [Security](./security.md).

```ts
editor.commands.setImage({ src: 'https://example.com/photo.png', alt: 'Example' })
editor.commands.setVideo({ src: 'https://example.com/clip.mp4' })
editor.commands.setAudio({ src: 'https://example.com/track.mp3' })
editor.commands.setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
editor.commands.setVimeo({ src: 'https://vimeo.com/123456789' })
editor.commands.setSoundCloud({ src: 'https://soundcloud.com/artist/track' })
editor.commands.setSpotify({ src: 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl' })
editor.commands.setX({ src: 'https://x.com/user/status/123' })
editor.commands.setLoom({ src: 'https://www.loom.com/share/abcdef1234567890' })
editor.commands.updateImageDimensions({ keyId: 'abc123', width: 480, height: 320 })
```

For unlisted Vimeo videos, pass the full URL with its path hash or `h` query parameter. HTML export and import preserve that hash.

`updateImageDimensions` edits an image that already sits in the document. It finds the node by its `keyId` attribute and writes `width` and `height`. It returns `false` when no image carries that `keyId`, so `editor.can()` reports a miss. `setImage` writes a fresh `keyId` on every insert, and a host reads it back with `node.attrs.keyId`.

Chain any of them like a normal Tiptap command:

```ts
editor.chain().focus().setYoutubeVideo({ src: 'https://youtu.be/dQw4w9WgXcQ', start: 42 }).run()
```

Every insert command accepts the layout options `width`, `height`, `margin`, `float`, `clear` and `display`. Every command except `setImage` also accepts `justifyContent`. `setX` is the exception on size. The `x` node declares no `width` and no `height` attribute, so both values type-check and then do nothing. Size an X post through `maxwidth`:

```ts
editor
  .chain()
  .focus()
  .setX({
    src: 'https://x.com/user/status/123',
    maxwidth: 550,
    theme: 'dark'
  })
  .run()
```

`setImage` also accepts `caption`. The other eight nodes carry the same `caption` attribute and no `caption` insert option. Set one from the media toolbar, or select the node and write the attribute. Read a caption back with `node.attrs.caption`:

```ts
editor.commands.setImage({ src: 'https://example.com/photo.png', caption: 'Figure 1' })
// Select the node first. The other seven non-image nodes take the same shape.
editor.commands.updateAttributes('video', { caption: 'Figure 2' })
```

Pass provider player options on the insert call — see [Embeds](./embeds.md).

## Keyboard shortcuts

The kit declares no `addKeyboardShortcuts`. A `keydown` listener binds every key below. The listener sits on the caption element, the Replace URL field, the resize drag, or the document.

| Shortcut               | Context            | Action                                                                               |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `Enter`                | `media caption`    | Commits the caption text, blurs the field, and returns focus to the editor.          |
| `Enter`                | `replace-URL form` | Submits the URL. An invalid URL shows an inline error and the form stays open.       |
| `Escape`               | `media toolbar`    | Dismisses the toolbar and refocuses the editor, once focus sits on a toolbar button. |
| `Escape`               | `resize drag`      | Cancels the drag. The node keeps the size it had before the drag started.            |
| `Shift` (held)         | `resize drag`      | Locks the aspect ratio while a corner handle moves.                                  |
| `Backspace` / `Delete` | `document`         | Deletes the media node under the active hover controls.                              |

Hover opens the media toolbar and moves no focus. So `Escape` acts only after a click or a tab into a toolbar button. The `Escape` handler also skips the key when focus sits inside a `.floating-popover`, because the popover closes itself first. The delete-key handler ignores `Backspace` and `Delete` with `Meta`, `Control` or `Alt`, and during IME composition. It also ignores them inside a media form control, inside the caption, and while the focused editor holds a text selection.

The `x` node sets `priority: 101`, above the Tiptap default of `100`. That number decides parse-rule order, not key order. It lets `blockquote.twitter-tweet` parse as an X embed before the StarterKit blockquote rule claims it. No extension in the kit contests a key with another.

## Caveats

The media toolbar, the paste path, the insert commands and the caption each carry a limit the [README Quickstart](../README.md#quickstart) does not show.

- **`resizeGripper: false` removes the whole media toolbar for that node.** The kit drops the node from its resizable list. The hover controls layer then returns before it mounts the toolbar. Only the `x` node may run toolbar-only. Keep the gripper on, or replace the media toolbar with [`mediaToolbar`](./media-toolbar.md#bring-your-own-toolbar).
- **Without `styles.css` the toolbar, gripper, caption and loading shell render unstyled.** With the stylesheet loaded, the shell holds `.hm-media-slot` at `opacity: 0` until it settles. A shell that never settles then renders an invisible player. Import the stylesheet — see [Styling](./styling.md).
- **A tap opens the media toolbar for `image` and `audio` only.** The click path returns early on every provider embed and on `video`. So their in-frame play and scrub controls keep working. Those nodes have no touch entry point to the toolbar today. Return `null` from `mediaToolbar` on mobile and render your own surface.
- **Hover controls need a fine pointer.** The kit reads `matchMedia('(pointer: fine)')` once and gates hover on it. A coarse-pointer device reaches the toolbar through the click path above.
- **A link extension can claim a media URL before the kit sees it.** Veto media URLs in the link extension: `Hyperlink.configure({ shouldAutoLink: (url) => !isMediaUrl(url) })`. See [Paste precedence](./paste-and-import.md#paste-precedence).
- **`isMediaUrl` matches every provider, whatever the kit configuration says.** A host that disables providers then vetoes URLs nothing will claim. Compose the veto from the per-provider validators you enabled.
- **`setImage`, `setVideo` and `setAudio` accept any non-empty `src` string.** The scheme gate runs on `parseHTML`, on markdown import, and in the Replace URL form. It never runs in the commands. Validate host-supplied URLs before you call them. See [Security](./security.md).
- **`setX` types `width` and `height` but the `x` node stores neither.** `setX` accepts both values, and the node then ignores them. Size an X post with `maxwidth`.
- **`dnt` cannot be set per node.** It is a kit option and a node attribute. But `AddXOptions` omits it, so `setX` cannot write it in a type-safe way. Set it on the kit.
- **A drag can appear to stop early.** Resize clamps to a 160 × 80 minimum, and `soundcloud` and `spotify` raise the height floor further. See [Resize](./resize-and-loading.md#resize).
- **A caption survives HTML round-trip for `image` only.** Every other node keeps the editable caption and the attribute, but emits no `<figure>`. So clipboard copy and the toolbar Copy action drop the text. Markdown export drops every caption. See [Caption](./media-toolbar.md#caption).
- **The paste handler drops pasted image files silently without a listener.** Add an `editorFileUpload` listener and insert the nodes yourself. See [Image file paste (`editorFileUpload`)](./paste-and-import.md#image-file-paste-editorfileupload).

### React Native and WebView hosts

The package runs inside a browser document. It does not provide a React Native bridge.
Browser touch tests do not establish compatibility with TenTap or a specific Android or iOS WebView.

Use the current node names and commands from [Migrating from 1.x](./migration.md#migrating-from-1x).
Load `styles.css` inside the WebView document.
For X, configure `X`, call `setX`, and size posts with `maxwidth`; X has no resize gripper.
Provider and video taps keep their player controls, so expose a host action to open editing controls on touch devices.

When reporting a bridge problem, include the TenTap, WebView, Tiptap, and extension versions and the device OS.
Also include the editor HTML, the bridge setup, and the failing action.
Use a minimal runnable app. A viewport resize or browser touch simulation cannot replace a device reproduction.

## TypeScript

Definitions ship in `dist/index.d.ts`. The package entry exports the following, grouped by role.

**Kit**

`HyperMultimediaKit`, `HyperMultimediaKitOptions`. The kit bundles all nine media nodes. Enable, configure or disable each one through the kit options; the nodes themselves are not exported.

**Commands**

`MediaPublicCommands` augments `@tiptap/core`, so every insert command is typed on `editor.commands`. Their option types are `SetImageOptions`, `UpdateImageDimensionsParams`, `SetVideoOptions`, `SetAudioOptions`, `SetYoutubeVideoOptions`, `SetVimeoOptions`, `SetSoundCloudOptions`, `SetSpotifyOptions`, `SetLoomOptions` and `AddXOptions`.

**URL detection**

`isMediaUrl`, `detectMediaType`, `MediaNodeType`, plus the per-provider validators `isImageUrl`, `isVideoUrl`, `isAudioUrl`, `isValidYoutubeUrl`, `isValidVimeoUrl`, `isValidSoundCloudUrl`, `isValidSpotifyUrl`, `isValidLoomUrl` and `isValidXUrl`. `detectMediaType` also resolves a raw video or audio URL. `isMediaUrl` skips those on purpose, so a pasted `.mp4` or `.mp3` link stays a link.

**Provider helpers**

`parseYoutubeVideoId`. `parseSpotifyEntity`, `SPOTIFY_ENTITY_TYPES`, `SpotifyEntityType`, `SpotifyTheme`. `buildXOEmbedParams`, `resolveXEmbedSizeId`, `X_EMBED_DEFAULT_MAXWIDTH`, `X_EMBED_SIZE_OPTIONS`, `X_EMBED_THEME_OPTIONS`, `XEmbedSizeId`, `XEmbedTheme`.

**Toolbar**

`createMediaToolbar`, `resolveMediaActions`, `openMediaToolbar`, `closeMediaToolbar`. Action builders `composeMediaActions` and `layoutMediaActions`. Action handlers `viewOriginalMedia`, `downloadMedia`, `copyMediaNode`, `removeMediaNode`, `canViewOriginal` and `isDownloadable`. Types `MediaAction`, `MediaActionAnchor`, `MediaActionContext`, `MediaActionList`, `MediaActionPlacement`, `MediaActionsBuilder`, `MediaActionsResolver`, `MediaToolbarFactory`, `MediaToolbarLayout` and `MediaToolbarOptions`.

**Popovers and tooltips**

`openMediaPopover`, `openToolbarPopover`, `closeToolbarPopover`, `createReplaceUrlPopover`, `openReplaceUrlPopover`, `ReplaceUrlPopoverFactory`, `ReplaceUrlPopoverOptions`, `attachTooltip`, `hideTooltip`.

**Icons**

`MediaToolbarIconsResolver`, `MediaToolbarIconKey`, `MediaToolbarIconContext`.

**Loading shell**

`createDefaultMediaLoadingShell`, `wrapMediaWithLoadingShell`, `MediaLoadingBindLoadOptions`, `MediaLoadingController`, `MediaLoadingKind`, `MediaLoadingShellContext`, `MediaLoadingShellFactory`, `MediaLoadingShellOption`, `MediaLoadingShellWrapOptions`.

**Layout and placement**

`resolveMediaNodePos`, `applyNodeAttributes`, `getCurrentMediaPlacement`, `getMediaPlacementAttrs`, `MEDIA_MARGIN_OPTIONS`, `MEDIA_PLACEMENT_OPTIONS`, `MediaPlacementId`, `fitDimensionsToBounds`, `fitLayoutToEditorColumn`, `getEditorContentWidth`.

Per-node embed option interfaces live under each node's module — see [Nodes](../README.md#nodes).
