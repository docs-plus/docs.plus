# Resize and loading shell

Part of the [`@docs.plus/extension-hypermultimedia` README](../README.md).

## Resize

Hovering a media node on a fine-pointer device activates the gripper. A tap activates the gripper for `image` and `audio` only, on the same click path the media toolbar uses. Side handles resize one axis, and corner handles resize both. Hold `Shift` on a corner to lock the aspect ratio.

Sizes clamp to a `160` × `80` minimum and to the editor content column as the maximum. The `soundcloud` node raises the height floor to `120` compact or `166` visual. The `spotify` node raises it to `352`, or `152` for a track. A drag that seems to stop early has hit one of those floors.

Committed `width` and `height` land on the node attributes, so a resize persists and syncs through collaboration. `Escape` cancels a drag without committing. `Backspace` or `Delete` removes the hovered media node, unless the caret sits in text or in a caption, which keep normal editing.

The `x` node has no gripper at all. Size an X post through the toolbar `maxwidth` presets — see [Embeds](./embeds.md#x).

## Loading shell

Every media node view mounts inside a reserved-size shimmer shell. The shell holds the media slot at `opacity: 0` until it settles to `ready` or `error`. The shell covers remote images, local `<video>` and `<audio>`, every iframe embed, and the X oEmbed mount. The kit persists the real media node only; the shell is node-view UI.

Three paths settle without a load event. A `src`-less element settles straight to `error`, which the Replace URL action then repairs. A `<video>` or `<audio>` element with `preload: 'none'` settles straight to `ready`, because its controls are all there is to paint. An X embed settles when the oEmbed mount resolves, or to `error` when it fails.

Customize or disable the shell on the kit:

```ts
HyperMultimediaKit.configure({
  loadingShell: true // default built-in shell
  // loadingShell: false, // no overlay
  // loadingShell: (ctx) => { ... return overlay HTMLElement }, // replace overlay UI
})
```

The factory type is `MediaLoadingShellFactory`, and `ctx` is a `MediaLoadingShellContext`. That context carries five fields: `kind`, `width`, `height`, and the optional `provider` and `message`. `kind` is one of `'image'`, `'video'`, `'audio'` or `'embed'`.

A custom overlay should include a `.hm-loading-shell__message` element if you want `markError(message)` to show text. Without one, the kit sets `aria-label` on the overlay and on the shell root instead. `markError` is a `MediaLoadingController` method, and the kit calls it against the element your factory returned. A host holds a controller only when it calls `wrapMediaWithLoadingShell` itself. The shell styles ship in `styles.css` and theme through the `--hm-loading-*` tokens — see [Theming](./styling.md#theming).

`createDefaultMediaLoadingShell`, `wrapMediaWithLoadingShell` and the loading types are exported for a host that builds custom node views.
