# Media toolbar

Part of the [`@docs.plus/extension-hypermultimedia` README](../README.md).

Hovering a media node on a fine-pointer device opens the media toolbar at the node's top-right corner. Common actions sit inline, and the rest live behind a `…` overflow menu. Icon-only buttons show a floating tooltip on hover or focus.

Toolbar popovers position through [`@docs.plus/floating-popover`](https://github.com/docs-plus/docs.plus/tree/main/packages/floating-popover) and tooltips through [`@docs.plus/floating-tooltip`](https://github.com/docs-plus/docs.plus/tree/main/packages/floating-tooltip). Both are bundled into `dist` — no tippy.js.

A tap opens the same toolbar for `image` and `audio` only. Every provider embed and the `video` node keep their in-frame controls on touch, so a tap never reaches the toolbar there. Wire a host surface for those cases — see [Bring your own toolbar](#bring-your-own-toolbar).

| Action                     | `id`            | Placement | Nodes                                                                                   |
| -------------------------- | --------------- | --------- | --------------------------------------------------------------------------------------- |
| Align                      | `align`         | inline    | all                                                                                     |
| Margin                     | `margin`        | inline    | all — wrap placements only                                                              |
| Caption                    | `caption`       | inline    | all                                                                                     |
| View original              | `view-original` | inline    | any node with a `src`; `isUploadedMedia` hides it for an uploaded image, video or audio |
| Download                   | `download`      | inline    | image, video, audio — and only with a `src`                                             |
| Replace URL                | `replace`       | overflow  | every node, including one with an empty or broken `src`                                 |
| Copy                       | `copy`          | overflow  | all                                                                                     |
| Delete                     | `delete`        | overflow  | all                                                                                     |
| Post options (size, theme) | `x-options`     | overflow  | x                                                                                       |

`composeMediaActions`, `layoutMediaActions` and `mediaToolbarIcons` all key on the `id` column — see [Customizing actions](#customizing-actions).

Align places the node Left, Center, Right, Wrap left or Wrap right. Those five labels map to the `MediaPlacementId` values `inline`, `center`, `right`, `float-left` and `float-right`, in that order. The two wrap placements add a Margin button beside Align, separated from the rest by a divider. The Margin button shows the current gap and opens the presets in a popover, from `0"` to `1"`, with `1/2"` as the default.

View original opens the `src` in a new tab. Its own allowlist admits `https:`, `http:`, `blob:` and a root-relative path, so an uploaded blob still opens. Download fetches the file and saves it, then falls back to opening a tab when the fetch fails.

Replace URL sits in the `…` overflow menu. It opens the URL form in a popover anchored below the node, and it flips above the node when the space below is too small. Confirming swaps the node's `src` in place, keeping the same node, caption, size and placement. It validates against the node's own provider, so a YouTube node only accepts another YouTube URL. It never changes the node type. It stays available on a node whose `src` is empty or broken, because that is how you repair a node with a broken `src`.

## Customizing actions

Three kit hooks change the media toolbar. They appear below from the widest reach to the narrowest.

`mediaActions` rewrites the resolved action list per node. Each action carries a stable `id`. `placement` picks the row — the inline bar or the `…` overflow — and array order is final within each row. `composeMediaActions` is an immutable builder. Rearrange by id instead of splicing arrays:

```ts
import { composeMediaActions } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  mediaActions: (defaults, { nodeType }) =>
    composeMediaActions(defaults)
      .add(
        // `editAltText` is a host-defined handler typed `(ctx: MediaActionContext) => void`.
        { id: 'alt', label: () => 'Edit alt text', placement: 'overflow', run: editAltText },
        { after: 'replace' }
      )
      .move('caption', { after: 'align' })
      .toOverflow('download')
      .remove('copy')
      .result()
})
```

Builder verbs: `add(action, { before | after })`, `move`, `replace`, `remove`, `setPlacement`, `toInline`, `toOverflow`, `order(ids)`, `has`, `result`. `add` inserts a new id, and moves an existing one.

For pure rearrangement, `layoutMediaActions` is the declarative form. List the ids per row; an unlisted known action keeps its placement and appends after:

```ts
import { layoutMediaActions } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  mediaActions: layoutMediaActions({
    inline: ['align', 'caption'],
    overflow: ['replace', 'copy', 'delete']
  })
})
```

A `MediaAction` is `{ id, label, icon?, placement: 'inline' | 'overflow', isVisible?(ctx), isActive?(ctx), run?(ctx), renderSubmenu?(ctx), dividerAfter? }`. `run` and `renderSubmenu` are mutually exclusive: with both set, `renderSubmenu` wins and `run` never fires. A built-in action omits `icon`. The Material Symbols defaults resolve by `id`, plus `align:<placement>` for alignment. A custom action can omit `icon` too and supply SVG through `mediaToolbarIcons`, or set `icon` for a one-off override. An action with no icon renders as a text button carrying `.media-toolbar__button--text`. `dividerAfter` renders a separator after the action, as the Margin button does.

`mediaToolbarIcons` swaps SVG markup without touching toolbar layout. Keys:

| Key                                                                                    | Slot                                                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `caption`, `view-original`, `download`, `replace`, `copy`, `delete`, `more`            | Built-in toolbar / overflow                                                                               |
| `align:inline`, `align:center`, `align:right`, `align:float-left`, `align:float-right` | Inline align button + alignment submenu. `align:inline` is the Left placement, not the inline node group. |
| Custom action `id` (for example `comment`)                                             | Actions you add through `mediaActions`                                                                    |

Return `null` or `undefined` to keep the built-in Material Symbols icon; return markup to override it.

`replaceUrlPopover` swaps the Replace URL form content. The factory receives `ReplaceUrlPopoverOptions` — `{ editor, nodeType, nodePos, src, validate, apply, close }`. `validate` returns an error message or `null`, and `apply` commits the normalized URL and closes. Return the element to mount, or `null` so the host renders its own surface. The docs.plus webapp returns `null` and opens a bottom sheet on mobile. The built-in content `createReplaceUrlPopover` and the action's open path `openReplaceUrlPopover` are both exported for reuse.

`isUploadedMedia` marks which `image`, `video` and `audio` nodes are host uploads, so View original stays hidden for them. View original always shows for a provider embed that carries a `src`:

```ts
HyperMultimediaKit.configure({
  isUploadedMedia: (ctx) => Boolean(ctx.attrs['data-upload-id'])
})
```

## Caption

Every media node view carries an editable `<figcaption>`. The text lives in the node's `caption` attribute, which is the source of truth, so it persists through collaboration and JSON. The toolbar Caption action reveals and focuses the field, and `Enter` commits.

Two limits apply. Markdown export keeps `![alt](src)` only, so it never carries a caption. The kit round-trips `<figure>` and `<figcaption>` for `image` only, meaning it both renders and parses them. Video, audio, the provider embeds and X keep the editable caption and the attribute, but they emit no `<figure>` in HTML. Every path that serializes to HTML therefore drops their caption, including clipboard copy and the toolbar Copy action. Re-importing exported HTML cannot bring a caption back as stray text.

## Bring your own toolbar

The `mediaToolbar` factory owns the whole media toolbar. It receives `MediaToolbarOptions` — `{ target, editor, nodeType, nodePos }`. Return the element to mount, or `null` so the host renders its own surface elsewhere. The docs.plus webapp returns `null` on mobile and opens a bottom sheet:

```ts
HyperMultimediaKit.configure({
  mediaToolbar: (options) => {
    if (window.matchMedia('(max-width: 640px)').matches) {
      openMobileSheet(options) // host-owned surface
      return null
    }
    return buildDesktopBar(options)
  }
})
```

A factory that returns `null` still keeps the resize gripper and the delete-key handling. Only `resizeGripper: false` removes both.

The kit stamps `data-hm-toolbar` on the mounted element, reuses that element on re-hover, and removes it on dismissal. No class is required. You own positioning inside the media wrapper. Add the `.media-toolbar` class to adopt the built-in top-right skin. [Class names](./styling.md#class-names) holds the rest of the contract.

Two rules bind action handlers:

- **Re-resolve the position.** `nodePos` is a snapshot at open, and an edit above the node shifts it. Call `resolveMediaNodePos(editor.view, target, nodeType)` at action time.
- **Use the popover helpers** for anchored menus. `openToolbarPopover(trigger, body, kind)` toggles a menu popover, and a second click on the same kind closes it. Pass `{ positionReference }` to align against a larger surface such as the media toolbar. Prefer `openMediaPopover({ kind, content, trigger, variant })` for a new call site. It sets the dismiss and shift options and also powers the Replace URL form. Outside-click and `Escape` dismissal are built in, and `closeToolbarPopover()` closes it.

`attachTooltip(myButton, 'Do thing')` gives a custom button the built-in hover and focus tooltip. It returns a detach function for a toolbar that re-renders in place.

```ts
import {
  closeToolbarPopover,
  removeMediaNode,
  resolveMediaNodePos
} from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  mediaToolbar: ({ target, editor, nodeType }) => {
    const bar = document.createElement('div')
    bar.className = 'media-toolbar' // optional: built-in top-right skin

    const remove = document.createElement('button')
    remove.className = 'media-toolbar__button'
    remove.textContent = 'Remove'
    remove.onclick = () => {
      const nodePos = resolveMediaNodePos(editor.view, target, nodeType)
      if (nodePos === null) return
      const node = editor.state.doc.nodeAt(nodePos)
      if (!node) return
      removeMediaNode({
        editor,
        nodeType,
        nodePos,
        attrs: node.attrs,
        wrapper: target,
        close: closeToolbarPopover
      })
    }

    bar.append(remove)
    return bar
  }
})
```

`createMediaToolbar`, `resolveMediaActions` and the `MediaAction` types are exported. So are the action handlers `viewOriginalMedia`, `downloadMedia`, `copyMediaNode`, `removeMediaNode`, `canViewOriginal` and `isDownloadable`, and the tooltip helpers `attachTooltip` and `hideTooltip`. A custom toolbar can reuse the built-in behavior instead of rewriting it.
