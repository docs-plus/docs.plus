# Hovercard

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

The `hovercard` option shows a card when a mouse pointer rests on a link. The package is the engine: it owns the timing, the gates, the keys and the frame. You give it the data.

You have two choices:

- **Use the built-in card.** Return a title, a description and a picture from `fetchMetadata`. The package draws a simple card.
- **Draw your own card.** Add `render`. It gets the link, the state and your data, and it returns the card content. Return `null` to keep the built-in card for that state.

The package makes no request of its own. Your `fetchMetadata` decides where the data comes from.

## Quickstart

```ts
import { Hyperlink } from '@docs.plus/extension-hyperlink'
import '@docs.plus/extension-hyperlink/hovercard.css'
import '@docs.plus/extension-hyperlink/styles.css'

Hyperlink.configure({
  hovercard: {
    fetchMetadata: async ({ href }) => {
      const res = await fetch(`/metadata?url=${encodeURIComponent(href)}`)
      return res.ok ? res.json() : null
    }
  }
})
```

`hovercard.css` styles the frame and the built-in card. Without it, the card renders unstyled. `styles.css` styles the tooltips on the built-in card's buttons, the same `.floating-tooltip` bubble the click preview uses. Without it, a tooltip shows as plain text and never hides. See [Theming](#theming).

## The built-in card

Top to bottom, the built-in card shows:

1. The picture, in a full-width 1.91:1 well, cropped to fill it.
2. The title, two lines at most. A click on it opens the link.
3. The description, two lines at most.
4. The link line: the site icon, the host and the path, a **Use page title** button when `applyTitle` is set, and one **Copy link** button.

Data with no `title` shows one line, "No preview for this page.", above the link line. Copy link writes the href to the clipboard and shows a check for 1500 ms. A refused write keeps the copy icon.

A click on the title opens the link through the [`navigate`](./api.md#options) option. A Mod-click or a middle click passes `newTab: true`. With `navigate` unset, every open uses a new tab, so `newTab` matters only when you set `navigate`.

## Options

| Field           | Type                                                                       | Description                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fetchMetadata` | `(ctx: HovercardContext) => Promise<D \| null>`                            | **Required.** Returns the card data. Before the card opens, `null`, a rejection or a throw shows no card. After it opens, they show the `empty` state.                   |
| `siteIcon?`     | `LinkIconResolver`                                                         | The icon in the built-in link line. Same contract as `linkIcon`: a fresh element with no text, or `null`. A throw shows no icon and logs once. A custom card ignores it. |
| `shouldShow?`   | `(ctx: HovercardShowContext) => boolean`                                   | Return `false` to show no card for this link. It runs before any request. A throw shows no card and logs once per editor.                                                |
| `render?`       | `(ctx: HovercardRenderContext<D>) => HTMLElement \| HovercardView \| null` | Draws the card content. `null` keeps the built-in card for this state. See [Draw your own card](#draw-your-own-card).                                                    |

`HovercardContext` is `{ href, editor }`. `href` is the link's stored href. `editor` is the editor that holds the link. It helps when one page has two editors. `HovercardShowContext` is `{ href, link }`, where `link` is the `<a>` element.

`fetchMetadata` gets no `AbortSignal`, unlike `fetchTitle` in [Paste title](./paste-title.md). Leaving the link never cancels the request, so its answer can fill your cache for the next hover or click.

## The data contract

`HovercardData` is the shape the built-in card reads. Every field is optional:

| Field         | Type              | Description                                                                                                 |
| ------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `title`       | `string`          | The title. Without it, the built-in card shows "No preview for this page."                                  |
| `description` | `string`          | Two lines at most.                                                                                          |
| `image`       | `{ url: string }` | The picture. The card loads exactly `url`. Route pictures through your own server, so readers stay private. |

A custom card can need more fields. `HovercardOptions<D>` takes your own data type, and `render` then gets `ctx.data` as `D`:

```ts
import type { HovercardData, HovercardOptions } from '@docs.plus/extension-hyperlink'

type RepoData = HovercardData & { stars: number }

const hovercard: HovercardOptions<RepoData> = {
  fetchMetadata: ({ href }) => loadRepo(href),
  render: (ctx) => (ctx.state === 'data' ? drawRepo(ctx.data.stars) : null)
}

Hyperlink.configure({ hovercard })
```

`loadRepo` and `drawRepo` stand for your own code.

## States

Every card is in one of three states. `render` gets the state in `ctx.state`.

| State     | When                                                              | Built-in card                       |
| --------- | ----------------------------------------------------------------- | ----------------------------------- |
| `loading` | No answer at 500 ms. The card opens anyway.                       | Three static loading bars.          |
| `data`    | `fetchMetadata` answered with an object.                          | The picture, title and description. |
| `empty`   | No answer at 4 s, or `null` or a rejection after the card opened. | "No preview for this page."         |

A `loading` card changes state once, to `data` or `empty`, in the same popover. An answer after the 4 s give-up leaves the open card alone. A `null` answer before the open shows no card at all.

## Draw your own card

`render(ctx)` returns the card content. The engine puts it inside its frame, `.hyperlink-hovercard`. The frame keeps the width, border, radius and shadow, so your content only fills it.

`HovercardRenderContext<D>`:

| Field        | Type                             | Description                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `href`       | `string`                         | The link's stored href, never `link.href`.                                                                                                                                                                                                                                                                                                                                                      |
| `link`       | `HTMLAnchorElement`              | The link the pointer rests on. The card is anchored to it.                                                                                                                                                                                                                                                                                                                                      |
| `editor`     | `Editor`                         | The editor that holds the link.                                                                                                                                                                                                                                                                                                                                                                 |
| `state`      | `'loading' \| 'empty' \| 'data'` | See [States](#states).                                                                                                                                                                                                                                                                                                                                                                          |
| `data`       | `D`                              | Only when `state` is `'data'`. Your `fetchMetadata` answer, as it came.                                                                                                                                                                                                                                                                                                                         |
| `open`       | `(newTab: boolean) => void`      | Hides this link's card if it is open, then opens `href` through the read gate and `navigate`.                                                                                                                                                                                                                                                                                                   |
| `copy`       | `() => Promise<boolean>`         | Copies `href`. Resolves `false` when the write fails.                                                                                                                                                                                                                                                                                                                                           |
| `applyTitle` | `(() => boolean) \| undefined`   | Swaps the link text for `data.title`, in one undoable step, then hides the card. Answers whether it did. Set only in the `data` state, when the editor is editable, the link text is its own URL, and the title passes the [paste title](./paste-title.md) rules. It checks the link again when called. Then it focuses the editor with the caret after the new text, so Mod-Z undoes the swap. |

Return one of three values:

- An `HTMLElement`. The engine shows it and drops it later.
- A `HovercardView`, `{ element, destroy? }`. The engine calls `destroy` when it is done with `element`.
- `null`. The built-in card draws this state.

The engine calls `destroy` in these cases:

- It swaps the content, for example from `loading` to `data`.
- The card closes. `destroy` runs after the card has left the page, at the end of its exit fade. So your content never empties while it is still on screen.
- The pointer leaves before the open, after `render` already drew the `data` state.
- The open is dropped because the link left the page or another popover opened, after `render` already drew the `data` state.

Each view is destroyed once. A view that `render` returns again for the next state stays in use and is not destroyed. Use `destroy` to unmount a framework component or to clear timers.

When `render` runs:

- `data`: when the answer comes, before the card opens. The card then opens filled, and a framework has time to paint.
- `loading`: when the card opens with no answer.
- `data` after a `loading` open: at the swap, when the answer comes.
- `empty`: at the swap.

An answer that comes after the pending open was dropped never reaches `render`.

A `render` that throws logs one console error per editor. The built-in card then draws that state.

The picture wait uses the same rule for a custom card: only data with both `title` and `image` gets it. The engine then loads `image.url` and waits up to 300 ms for it. An `<img>` with the same URL in your card then reads the browser cache. Give that `<img>` `referrerPolicy="no-referrer"`, as the built-in card does.

### Rules for a custom card

- Open links with `ctx.open`. On an `<a>`, call `preventDefault()` in the click handler first. A raw `target="_blank"` link skips the read gate and `navigate`.
- Handle `auxclick` too. A middle click on an `<a>` does not fire `click`, so call `preventDefault()` and `ctx.open(true)` for button 1.
- Set `tabIndex = -1` on every control. Tab keeps its editor meaning, so no card control joins the Tab order.
- Call `preventDefault()` on `mousedown` for every button. A press then keeps the caret in the editor.
- A tooltip outside the card must set `pointer-events: none`, or a pointer over it starts the 300 ms close. The built-in card's tooltips use the `.floating-tooltip` skin from `styles.css`, which does.
- Put text in with `textContent`, or a framework that escapes it. Treat every field of your data as untrusted.

### Example: plain DOM

This card draws its own `data` state and keeps the built-in loading bars and empty line:

```ts
import { hasMod, Hyperlink } from '@docs.plus/extension-hyperlink'

Hyperlink.configure({
  hovercard: {
    fetchMetadata: loadPage,
    render: (ctx) => {
      if (ctx.state !== 'data') return null

      const root = document.createElement('div')
      root.style.padding = '12px'

      const title = document.createElement('a')
      title.href = ctx.href
      title.tabIndex = -1
      title.textContent = ctx.data.title ?? ctx.href
      title.addEventListener('click', (e) => {
        e.preventDefault()
        ctx.open(hasMod(e))
      })
      title.addEventListener('auxclick', (e) => {
        if (e.button !== 1) return
        e.preventDefault()
        ctx.open(true)
      })

      const copy = document.createElement('button')
      copy.type = 'button'
      copy.tabIndex = -1
      copy.textContent = 'Copy'
      copy.addEventListener('mousedown', (e) => e.preventDefault())
      copy.addEventListener('click', async () => {
        copy.textContent = (await ctx.copy()) ? 'Copied' : 'Copy failed'
      })

      root.append(title, copy)
      return root
    }
  }
})
```

`loadPage` stands for your own `fetchMetadata`. The clean-room playground draws every state this way: see `renderCard` in [`test/playground/main.ts`](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/test/playground/main.ts). That file lives in the repository, not in the npm package.

### Example: a React portal

`render` must return an element at once, so a React card goes through a portal. `render` registers an empty host element, and one React component draws a portal into each host. `flushSync` makes React paint the card before `render` returns. `destroy` removes the entry, and React unmounts the card.

```tsx
import { useSyncExternalStore } from 'react'
import { createPortal, flushSync } from 'react-dom'
import {
  hasMod,
  type HovercardData,
  type HovercardRenderContext,
  type HovercardView
} from '@docs.plus/extension-hyperlink'

type Mount = { id: number; host: HTMLElement; ctx: HovercardRenderContext<HovercardData> }

let mounts: Mount[] = []
let nextId = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function renderCard(ctx: HovercardRenderContext<HovercardData>): HovercardView {
  const mount = { id: nextId++, host: document.createElement('div'), ctx }
  flushSync(() => {
    mounts = [...mounts, mount]
    emit()
  })
  return {
    element: mount.host,
    destroy: () => {
      mounts = mounts.filter((m) => m !== mount)
      emit()
    }
  }
}

const noMounts: Mount[] = []

// Mount this once, next to your editor.
export function HovercardPortals() {
  const list = useSyncExternalStore(
    subscribe,
    () => mounts,
    () => noMounts
  )
  return list.map(({ id, host, ctx }) => createPortal(<MyCard ctx={ctx} />, host, String(id)))
}

function MyCard({ ctx }: { ctx: HovercardRenderContext<HovercardData> }) {
  if (ctx.state !== 'data') return <p>{ctx.state === 'loading' ? 'Loading…' : 'No preview'}</p>
  const { title, image } = ctx.data
  return (
    <div>
      {image && <img src={image.url} alt="" referrerPolicy="no-referrer" />}
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => ctx.open(hasMod(e))}>
        {title ?? ctx.href}
      </button>
    </div>
  )
}
```

Pass `render: renderCard` in the `hovercard` option. `MyCard` is a short sample; replace it with your own component.

Mount `HovercardPortals` once per page, even with two editors or two React roots. One store serves every editor. Render it inside your providers. A portal keeps the React context of the place it renders, so a theme provider above it reaches the card.

The third argument of `useSyncExternalStore` is the server snapshot. A stable empty list keeps server rendering safe. The engine places the card again when its size changes.

## Timing

- The request starts after the pointer rests on the link for 150 ms. A pointer that only passes over a link sends no request.
- The card opens 500 ms after the pointer enters the link, at the earliest.
- With data before 500 ms, the card opens at `max(enter + 500, min(data + 300, picture settled))`. So most cards open with the picture painted.
- With no data at 500 ms, the card opens in the `loading` state. At 4 s with no data, it shows the `empty` state.
- The card closes 300 ms after the pointer leaves both the link and the card.
- Leaving the link drops the pending open, but the request runs on. A cache in your `fetchMetadata` can then serve the next hover or click.

The engine calls `fetchMetadata` once per hover, and it keeps no cache. Dedupe requests by URL in your own code, so a hover and the click that follows share one request.

## Keys

- A bare Shift, Control, Alt, Meta, AltGraph or CapsLock keeps the card open.
- So do the arrow keys, Home, End, PageUp, PageDown, F1 to F12 and Mod-C.
- Every other key closes it. Mod-Shift-C and Mod-Alt-C close it too.
- A press outside the card and `compositionstart` close it.

`keepsHovercardOpen(event, isMac?)` is a root export with the same rule.

## When the card shows

- Only for a mouse on a `(hover: hover) and (pointer: fine)` device, and never while a mouse button is down.
- Only for a link with a stored `hyperlink` mark. An embed's own anchor gets no card.
- Only for an href the [read gate](./api.md#validate-vs-isalloweduri) allows: `isSafeHref` plus your `isAllowedUri`. `validate` does not run here. Then `shouldShow` runs.
- Never while another popover of this bundle is mounted, such as the preview, create or edit popover. The card closes only its own popover.

A pointer that already rests on a link when it renders gets no card until it leaves and comes back. See [Caveats](./api.md#caveats).

## Theming

The frame and the built-in card read `--hl-*` tokens, each with a fallback. Set them on `.hyperlink-hovercard`, or on any parent:

```css
.hyperlink-hovercard {
  --hl-bg: #fffdf7;
  --hl-hovercard-width: 22rem;
}
```

`--hl-hovercard-width` sets the frame width. `--hl-well` and `--hl-skeleton` fill the picture well and the loading bars. The frame also reads the shared tokens, such as `--hl-bg`, `--hl-border`, `--hl-radius` and `--hl-shadow`. The full list and the class names are in [Styling](./styling.md#hovercard).

A custom card can use the same tokens, so it follows the theme and dark mode.

## Accessibility

- The card is a pointer preview. The keyboard path is `Mod-k` with a collapsed caret strictly inside a link. It opens the same preview a click opens, when `popovers.previewHyperlink` is set.
- No card control joins the Tab order, and Tab closes the card.
- The popover has no role. The loading body carries `aria-busy="true"`, and Copy link changes its name to "Link copied" for 1500 ms.
- Loading-to-data fades and picture motion turn off under `prefers-reduced-motion: reduce`.

A custom card keeps these rules when it follows [Rules for a custom card](#rules-for-a-custom-card).

## Safety

The built-in card sets every text with `textContent`, and its icons are static package strings. No data ever reaches `innerHTML`. Pictures load with `referrerPolicy: 'no-referrer'`, and the card loads only the URLs your data returns. No mark attribute reaches the card.

## Lifecycle

The card is a ProseMirror plugin, and its popover kind is `'hovercard'`. Every listener and timer lives in the plugin view. So `editor.destroy()` removes them, closes the card, and leaves other editors alone.
