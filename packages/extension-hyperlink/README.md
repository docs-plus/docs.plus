# @docs.plus/extension-hyperlink

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/packages/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/packages/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-hyperlink.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-hyperlink)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-hyperlink.svg)](https://npmcharts.com/compare/@docs.plus/extension-hyperlink)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-hyperlink.svg)](https://www.npmjs.com/package/@docs.plus/extension-hyperlink)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/25JPG38J59)

> [!IMPORTANT]
> **`2.0` is a major rewrite.** Coming from `1.x`? The API has been substantially
> redesigned (renamed options, renamed commands, kebab-case CSS classes,
> separate stylesheet, hardened XSS guards). Read the
> [`1.x` → `2.0` migration guide](./CHANGELOG.md#migrating-from-1x-to-20)
> before upgrading.

A Tiptap extension for hyperlinks. Ships with optional prebuilt popovers for creating, previewing, and editing links, plus auto-linking, markdown input rules, and support for 50+ URL schemes (`mailto:`, `tel:`, `zoommtg:`, `vscode:`, `spotify:`, …).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/packages/extension-hyperlink/docs/screenshots/preview-dark.png">
    <img alt="Hyperlink preview popover anchored to a link, with copy / edit / remove actions" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/packages/extension-hyperlink/docs/screenshots/preview-light.png">
  </picture>
</p>

## Install

```sh
npm install @docs.plus/extension-hyperlink
```

Peer dependencies:

```sh
npm install @tiptap/core @tiptap/pm
```

## Usage

```ts
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Hyperlink,
  createHyperlinkPopover,
  previewHyperlinkPopover
} from '@docs.plus/extension-hyperlink'
import '@docs.plus/extension-hyperlink/styles.css'

const editor = useEditor({
  extensions: [
    StarterKit.configure({ link: false }),
    Hyperlink.configure({
      popovers: {
        previewHyperlink: previewHyperlinkPopover,
        createHyperlink: createHyperlinkPopover
      }
    })
  ]
})
```

The `styles.css` import and `popovers` options are optional — see [Popovers](#popovers) and [Styling](#styling) to bring your own UI.

## Options

| Option                 | Type                                      | Default                                   | Description                                                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `autolink`             | `boolean`                                 | `true`                                    | Convert URLs to links as you type.                                                                                                                                                                                                               |
| `openOnClick`          | `boolean`                                 | `true`                                    | Open links on click. Overridden by `popovers.previewHyperlink` when set.                                                                                                                                                                         |
| `linkOnPaste`          | `boolean`                                 | `true`                                    | Wrap the current selection in a link when a URL is pasted.                                                                                                                                                                                       |
| `protocols`            | `Array<string \| LinkProtocolOptions>`    | `[]`                                      | Extra protocols to register with [linkifyjs](https://linkify.js.org). 50+ are already built in.                                                                                                                                                  |
| `HTMLAttributes`       | `Partial<HyperlinkAttributes>`            | `{ rel: 'noopener noreferrer nofollow' }` | Attributes applied to rendered `<a>` tags. Set a key to `null` to remove it. `target` and `image` are stored on the mark but **never** rendered to the DOM (the click handler decides where to open the link, and `<a image>` isn't valid HTML). |
| `validate`             | `(url: string) => boolean`                | —                                         | Reject auto-linked URLs when this returns `false`.                                                                                                                                                                                               |
| `popovers`             | `{ previewHyperlink?, createHyperlink? }` | —                                         | Factory functions that return `HTMLElement`. See [Popovers](#popovers).                                                                                                                                                                          |
| `defaultProtocol`      | `string`                                  | `'https'`                                 | Scheme used when promoting bare domains (`example.com` → `${defaultProtocol}://example.com`). See [URL handling](#url-handling).                                                                                                                 |
| `isAllowedUri`         | `(uri, ctx) => boolean`                   | —                                         | Optional URI policy hook. Runs AFTER the built-in `isSafeHref` gate (so dangerous schemes are always blocked) and BEFORE the mark is written. `ctx` mirrors `extension-link`.                                                                    |
| `shouldAutoLink`       | `(uri) => boolean`                        | —                                         | Optional per-URI autolink veto. Called by the autolink plugin, the paste handler (smart-paste over a non-empty selection), AND the markdown paste rule. Return `false` to skip autolinking that specific URI.                                    |
| `enableClickSelection` | `boolean`                                 | `false`                                   | When `true`, clicking inside a link in editable mode selects the entire mark range. Mirrors `@tiptap/extension-link`.                                                                                                                            |
| `exitable`             | `boolean`                                 | `false`                                   | When `true`, ArrowRight at the end of a hyperlink mark exits the mark — the next typed character is plain text.                                                                                                                                  |

Example with options:

```ts
import { isSafeHref, Hyperlink } from '@docs.plus/extension-hyperlink'

Hyperlink.configure({
  autolink: true,
  openOnClick: true,
  linkOnPaste: true,
  defaultProtocol: 'https',
  protocols: ['ftp', { scheme: 'tel', optionalSlashes: true }],
  HTMLAttributes: { rel: 'noopener noreferrer nofollow' }, // `target` and `image` are stored on the mark but not rendered to the DOM
  validate: (href) => /^https?:\/\//.test(href),
  isAllowedUri: (uri, ctx) => ctx.defaultValidate(uri) && !uri.includes('blocked.example'),
  shouldAutoLink: (uri) => !uri.startsWith('@'),
  enableClickSelection: true,
  exitable: true
})
```

## Commands

| Command                                              | Description                                                                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setHyperlink({ href, target?, title?, image? })`    | Pure command — write the hyperlink mark over the current selection. Returns `false` (no-op) if `href` is empty/missing or fails the XSS / `isAllowedUri` gate. |
| `unsetHyperlink()`                                   | Remove the link mark from the current selection.                                                                                                               |
| `toggleHyperlink({ href, target?, title?, image? })` | Toggle the hyperlink mark on/off across the current selection. Same gates as `setHyperlink`.                                                                   |
| `openCreateHyperlinkPopover(attributes?)`            | UI command — open the create-hyperlink popover anchored to the current selection. No-op when no popover factory is configured.                                 |
| `editHyperlink({ newURL?, newText? })`               | Update the href and/or inner text of the link at the current selection.                                                                                        |
| `editHyperlinkHref(url)`                             | Shorthand for href-only edits.                                                                                                                                 |
| `editHyperlinkText(text)`                            | Shorthand for text-only edits.                                                                                                                                 |
| `setLink` / `unsetLink` / `toggleLink`               | Drop-in delegating aliases for `setHyperlink` / `unsetHyperlink` / `toggleHyperlink` to ease migration from `@tiptap/extension-link`.                          |

```ts
editor.commands.setHyperlink({ href: 'https://example.com' })
editor.commands.toggleHyperlink({ href: 'https://example.com' })
editor.commands.openCreateHyperlinkPopover() // bound to Mod-k
editor.commands.editHyperlink({ newURL: 'https://new.example.com', newText: 'New label' })
editor.commands.unsetHyperlink()

editor.getAttributes('hyperlink').href // read current href
```

> **v2 note** — `setHyperlink` is now a pure command. The historic
> `setHyperlink()` (no-args) overload that opened the create popover
> moved to `openCreateHyperlinkPopover()`. `Mod-k` rebinds automatically.

## Keyboard shortcuts

| Shortcut     | Action                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `Mod-k`      | Open the create-hyperlink popover anchored to the current selection (no-op without a popover factory).      |
| `ArrowRight` | When `exitable: true`, exits the hyperlink mark at the right boundary so the next typed char is plain text. |

## Popovers

The extension is headless — you decide what the UI looks like. Three paths, from easiest to most flexible:

1. **Use the prebuilt popovers** (shown in [Usage](#usage)) and import `styles.css`.
2. **Restyle the prebuilt popovers** by overriding `--hl-*` custom properties (see [Styling](#styling)).
3. **Bring your own popover** — each popover is a factory that returns an `HTMLElement` (or `null` to opt out). The extension handles positioning, outside-click dismissal, keyboard navigation, and cleanup. See [option shapes](#popover-factory-option-shapes) and the [BYO examples](#bring-your-own-popover) below.

For a fully custom toolbar that bypasses the click handler entirely (e.g. a quick-toggle inline UI), drop down to the [Floating-toolbar primitive](#floating-toolbar-primitive).

### Popover-factory option shapes

Every BYO factory receives one `options` argument. The shape depends on which slot it fills.

**`PreviewHyperlinkOptions`** — passed to `popovers.previewHyperlink` on every link click.

| Field           | Type                       | Description                                                                                                                                               |
| --------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                   | The Tiptap editor instance.                                                                                                                               |
| `view`          | `EditorView`               | The ProseMirror view (escape hatch for advanced cases — most factories don't need it).                                                                    |
| `link`          | `HTMLAnchorElement`        | The clicked `<a>` node. Use it as the toolbar's `referenceElement` so the popover follows the link on scroll.                                             |
| `nodePos`       | `number`                   | Document position of the link mark; pair with `editor.state.doc.nodeAt(nodePos)` to read the mark.                                                        |
| `attrs`         | `HyperlinkAttributes`      | The mark's stored attributes. Prefer `attrs.href` over `link.href` (the DOM property resolves against `document.baseURI` and would leak the host origin). |
| `linkCoords`    | `{ x, y, width, height }`  | Snapshot of the link's `getBoundingClientRect()` at click time.                                                                                           |
| `validate?`     | `(url: string) => boolean` | The configured `validate` option, forwarded.                                                                                                              |
| `isAllowedUri?` | `(uri: string) => boolean` | Composed XSS + `isAllowedUri` policy gate. **BYO popovers must call this before any `window.open`.**                                                      |

Return `null` to opt out for this click (e.g. open a mobile bottom sheet); the extension hides the floating toolbar.

**`CreateHyperlinkOptions`** — passed to `popovers.createHyperlink` when `Mod-k` (or `editor.commands.openCreateHyperlinkPopover()`) fires.

| Field           | Type                           | Description                                                                                               |
| --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                       | The Tiptap editor instance.                                                                               |
| `extensionName` | `string`                       | The mark name (`'hyperlink'` by default). Pass it to commands when you've renamed the mark.               |
| `attributes`    | `Partial<HyperlinkAttributes>` | Pre-fill values forwarded from `openCreateHyperlinkPopover(attributes?)`. Empty when invoked via `Mod-k`. |
| `validate?`     | `(url: string) => boolean`     | The configured `validate` option, forwarded.                                                              |

Return `null` if the popover can't open (e.g. DOM construction fails); the command then returns `false`.

**`EditHyperlinkPopoverOptions`** — passed to the standalone [`editHyperlinkPopover`](#wiring-the-edit-popovers-back-button) factory (typically called from your preview popover's "Edit" button).

| Field       | Type                       | Description                                                                                                                            |
| ----------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `editor`    | `Editor`                   | The Tiptap editor instance.                                                                                                            |
| `link`      | `HTMLAnchorElement`        | The link being edited — anchors the toolbar.                                                                                           |
| `validate?` | `(url: string) => boolean` | The configured `validate` option, forwarded — the edit form rejects the same URLs as `Mod-k`.                                          |
| `onBack?`   | `() => void`               | Invoked when the user taps **Back**. Without it, Back is a no-op. See [wiring the Back button](#wiring-the-edit-popovers-back-button). |
| `markName?` | `string`                   | Mark name to extend the range over. Defaults to `'hyperlink'`; override when you've renamed the mark.                                  |

> `EditHyperlinkModalOptions` is a `@deprecated` alias scheduled for removal in 3.0. New code uses `EditHyperlinkPopoverOptions`.

### Bring your own popover

Two minimal factories matching the option shapes above. Both are runnable as written.

<details>
<summary><b>Custom <code>previewHyperlink</code></b></summary>

```ts
import {
  Hyperlink,
  hideCurrentToolbar,
  type PreviewHyperlinkOptions
} from '@docs.plus/extension-hyperlink'

function previewHyperlink(options: PreviewHyperlinkOptions): HTMLElement {
  const { editor, attrs } = options
  const root = document.createElement('div')

  const link = document.createElement('a')
  link.href = attrs.href
  link.textContent = attrs.href
  link.target = '_blank'
  link.rel = 'noopener noreferrer'

  const remove = document.createElement('button')
  remove.textContent = 'Remove'
  remove.addEventListener('click', () => {
    hideCurrentToolbar()
    editor.chain().focus().unsetHyperlink().run()
  })

  root.append(link, remove)
  return root
}

Hyperlink.configure({ popovers: { previewHyperlink } })
```

</details>

<details>
<summary><b>Custom <code>createHyperlink</code></b></summary>

```ts
import {
  Hyperlink,
  hideCurrentToolbar,
  validateURL,
  type CreateHyperlinkOptions
} from '@docs.plus/extension-hyperlink'

function createHyperlink(options: CreateHyperlinkOptions): HTMLElement {
  const { editor, validate } = options
  const form = document.createElement('form')

  const input = document.createElement('input')
  input.type = 'url'
  input.placeholder = 'https://example.com'

  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.textContent = 'Apply'

  form.append(input, submit)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const url = input.value.trim()
    if (!validateURL(url, { customValidator: validate })) return

    // Delegate to the canonical command — it normalizes against
    // `defaultProtocol`, runs the composed XSS + `isAllowedUri` gate,
    // and stamps the autolink-suppression meta. Returns `false` (no-op)
    // when the gate rejects, so the popover can stay open and re-prompt.
    const applied = editor.chain().setHyperlink({ href: url }).run()
    if (applied) hideCurrentToolbar()
  })

  return form
}

Hyperlink.configure({ popovers: { createHyperlink } })
```

</details>

### Wiring the edit popover's `Back` button

Tapping **Back** in `editHyperlinkPopover` invokes `onBack` — and nothing else. Without it, the button is a silent no-op. BYO preview popovers must pass `onBack` and re-mount themselves on the `'preview'` surface; the prebuilt `previewHyperlinkPopover` does the same.

```ts
import {
  createFloatingToolbar,
  editHyperlinkPopover,
  type PreviewHyperlinkOptions
} from '@docs.plus/extension-hyperlink'

function previewHyperlink(options: PreviewHyperlinkOptions): HTMLElement {
  const { editor, link, validate } = options
  const root = document.createElement('div')
  const editButton = document.createElement('button')
  editButton.textContent = 'Edit'

  editButton.addEventListener('click', () => {
    editHyperlinkPopover({
      editor,
      link,
      validate,
      onBack: () => showPreview(options)
    })
  })

  root.append(editButton /* + your other buttons */)
  return root
}

function showPreview(options: PreviewHyperlinkOptions): void {
  createFloatingToolbar({
    referenceElement: options.link,
    content: previewHyperlink(options),
    placement: 'bottom',
    showArrow: true,
    surface: 'preview'
  }).show()
}
```

`createFloatingToolbar` registers through [`getDefaultController()`](#ui-controller), so re-mounting the preview tears down the edit popover automatically and inherits outside-click dismissal.

> Mobile-only popovers that return `null` from the factory (to open a bottom sheet instead) handle Back through their own UI and don't need this wiring.

### Floating-toolbar primitive

`createFloatingToolbar(options)` mounts every popover the extension shows. It handles Floating-UI placement, scroll-stickiness, outside-click dismissal, keyboard navigation, and registration with the [UI controller](#ui-controller). Reach for it directly when you want a toolbar without the click handler — e.g. a quick-toggle inline UI driven by your own selection logic.

`FloatingToolbarOptions`:

| Field               | Type                                         | Default                | Description                                                                                                                                 |
| ------------------- | -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `referenceElement?` | `HTMLElement`                                | —                      | Anchor element. **One of `referenceElement` or `coordinates` is required.**                                                                 |
| `coordinates?`      | `{ getBoundingClientRect, contextElement? }` | —                      | Virtual reference factory. `getBoundingClientRect` MUST recompute on every call (a frozen rect breaks scroll-stickiness).                   |
| `content`           | `HTMLElement`                                | —                      | Popover content node.                                                                                                                       |
| `placement?`        | `Placement`                                  | `'bottom-start'`       | Floating-UI placement. Auto-flips to fit the viewport.                                                                                      |
| `offset?`           | `number`                                     | `DEFAULT_OFFSET` (`8`) | Distance in px between the reference and the toolbar.                                                                                       |
| `showArrow?`        | `boolean`                                    | `false`                | Render an arrow pointing at the reference.                                                                                                  |
| `className?`        | `string`                                     | `''`                   | Extra class on the toolbar root (in addition to `.floating-toolbar`).                                                                       |
| `zIndex?`           | `number`                                     | `9999`                 | Stacking context for the toolbar.                                                                                                           |
| `onShow?`           | `() => void`                                 | —                      | Fires after the toolbar's first paint and `.visible` class is applied.                                                                      |
| `onHide?`           | `() => void`                                 | —                      | Fires when the toolbar is dismissed (outside click, programmatic `hide()`, or controller replacement).                                      |
| `surface?`          | `SurfaceKind`                                | `'unknown'`            | Tag observed by the [UI controller](#ui-controller). One of `'preview' \| 'edit' \| 'create' \| 'unknown'`; match it to the popover's role. |

Returns a `FloatingToolbarInstance`:

| Member                           | Description                                                   |
| -------------------------------- | ------------------------------------------------------------- |
| `element`                        | The toolbar root (`.floating-toolbar` div).                   |
| `show()`                         | Mount and reveal. Idempotent.                                 |
| `hide()`                         | Dismiss without destroying. Re-callable via `show()`.         |
| `destroy()`                      | Tear down for good — removes from DOM and stops `autoUpdate`. |
| `isVisible()`                    | `true` between `show()` and `hide()`/`destroy()`.             |
| `setContent(el)`                 | Swap the content node in place without re-positioning.        |
| `updateReference(ref?, coords?)` | Re-anchor to a different element or virtual reference.        |

```ts
import { createFloatingToolbar } from '@docs.plus/extension-hyperlink'

const toolbar = createFloatingToolbar({
  referenceElement: someButton,
  content: myMenu,
  placement: 'top',
  showArrow: true,
  surface: 'unknown'
})
toolbar.show()
// later: toolbar.destroy()
```

Three companion exports:

| Export                               | What it does                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `hideCurrentToolbar()`               | Dismiss the active toolbar from inside its own content (e.g. after a form submits). No instance ref needed. |
| `updateCurrentToolbarPosition(ref?)` | Re-anchor the active toolbar after the link mark moves (external edit, doc rewrite).                        |
| `DEFAULT_OFFSET`                     | The default offset (`8` px). Import this rather than hardcoding `8`.                                        |

### UI controller

`getDefaultController()` returns the singleton that owns the floating-popover lifecycle. Subscribe to surface-state changes from custom outer toolbars, devtools panels, or e2e harnesses — no DOM spelunking required.

`ControllerState`:

```ts
type SurfaceKind = 'preview' | 'edit' | 'create' | 'unknown'
type ControllerState = { kind: 'idle' } | { kind: 'mounted'; surface: SurfaceKind }
```

`HyperlinkUIController`:

| Member                         | Description                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `subscribe(listener)`          | Register a state-change listener. Returns an unsubscribe function. Fires once with the current state on subscribe. |
| `getState()`                   | One-shot read of `ControllerState`.                                                                                |
| `close()`                      | Dismiss the active surface (no-op when idle).                                                                      |
| `reposition(ref?, coords?)`    | Re-anchor the active surface — same semantics as `updateCurrentToolbarPosition`.                                   |
| `register(instance, surface?)` | Internal-style hook used by `createFloatingToolbar`; consumers rarely need it directly.                            |

```ts
import { getDefaultController } from '@docs.plus/extension-hyperlink'

const unsubscribe = getDefaultController().subscribe((state) => {
  console.log('[hyperlink-ui]', state)
  // { kind: 'idle' } | { kind: 'mounted', surface: 'preview' | 'edit' | 'create' | 'unknown' }
})

// later:
unsubscribe()
```

## Styling

The prebuilt popovers ship with a framework-agnostic stylesheet. Import it once:

```ts
import '@docs.plus/extension-hyperlink/styles.css'
```

The CSS is opt-in — the extension's JavaScript never imports it, so custom UIs pay zero CSS cost.

### Theming

Every visual token is a `--hl-*` custom property. Colors use [`light-dark()`](https://developer.mozilla.org/docs/Web/CSS/color_value/light-dark), so the popover follows the nearest ancestor's `color-scheme` — or the OS preference when none is set.

<details>
<summary>Default values</summary>

```css
:root {
  --hl-bg: light-dark(#ffffff, #1f2937);
  --hl-fg: light-dark(#111827, #f3f4f6);
  --hl-muted: light-dark(#6b7280, #9ca3af);
  --hl-border: light-dark(#e5e7eb, #374151);
  --hl-hover: light-dark(#f3f4f6, #374151);
  --hl-accent: light-dark(#2563eb, #60a5fa);
  --hl-accent-fg: light-dark(#ffffff, #0b1220);
  --hl-danger: light-dark(#dc2626, #f87171);
  --hl-shadow:
    0 1px 2px light-dark(rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.4)),
    0 4px 12px light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.5));
  --hl-radius: 6px;
  --hl-radius-sm: 4px;
  --hl-font: system-ui, sans-serif;
  --hl-font-size: 14px;
  --hl-z-index: 9999;
  --hl-transition: 120ms ease-in-out;
}
```

</details>

#### Switching themes

If your app has a light/dark toggle, set `color-scheme` on the theme root — the popover follows along:

```css
html[data-theme='light'] {
  color-scheme: light;
}
html[data-theme='dark'] {
  color-scheme: dark;
}
```

> **Bundler note.** Some CSS minifiers (lightningcss, for one) down-level `light-dark()` into a `@media (prefers-color-scheme: dark)` block, which pins colors to the OS preference. If that happens, re-declare the tokens on each branch — the attribute selector wins over the media query:
>
> ```css
> html[data-theme='light'] {
>   --hl-bg: #ffffff;
>   --hl-fg: #111827; /* … */
> }
> html[data-theme='dark'] {
>   --hl-bg: #1f2937;
>   --hl-fg: #f3f4f6; /* … */
> }
> ```

### Class names

Stable class names you can target:

| Class                        | Element                                              |
| ---------------------------- | ---------------------------------------------------- |
| `.floating-toolbar`          | Toolbar container (adds `.visible` after mount).     |
| `.floating-toolbar-arrow`    | Arrow pointing at the reference element.             |
| `.floating-toolbar-content`  | Content wrapper inside the toolbar.                  |
| `.hyperlink-create-popover`  | Create-link popover root.                            |
| `.hyperlink-preview-popover` | Preview popover root.                                |
| `.hyperlink-edit-popover`    | Edit popover root.                                   |
| `.inputs-wrapper`            | Input group container (adds `.error` on validation). |
| `.buttons-wrapper`           | Button group container.                              |
| `.search-icon`               | Leading icon inside an input group.                  |
| `.error-message`             | Validation error text (shown with `.show`).          |

## URL handling

Every write path canonicalizes hrefs before storing them:

- **Bare domains** get `https://` prepended: `google.com` → `https://google.com`.
- **Explicit schemes** pass through as typed: `http://`, `ftp://`, `whatsapp://`, `mailto:`.
- **Protocol-relative URLs** stay as-is: `//example.com`.

The create popover, markdown input rule, autolink, and paste all produce the same `href` for the same input.

Validation rejects scheme-prefixed typos with no real host. `https://googlecom` fails; `http://localhost`, `https://127.0.0.1`, and any registered custom scheme pass.

`normalizeHref(raw, defaultProtocol?)` returns the canonical href the editor would store. Use it in custom popovers to mirror the canonicalization.

### Scheme classification

`getSpecialUrlInfo(href)` classifies a URL against the 50+ scheme catalog and returns `{ type, title, category } | null`. The extension ships **no** icon catalog — `type` is a string-literal `SpecialUrlType` you map to your own renderer:

```ts
import { getSpecialUrlInfo, type SpecialUrlType } from '@docs.plus/extension-hyperlink'
import * as Icons from './icons'

const TYPE_TO_ICON: Partial<Record<SpecialUrlType, () => string>> = {
  email: Icons.Mail,
  phone: Icons.Phone,
  whatsapp: Icons.Chat,
  spotify: Icons.Music
  // …one entry per `type` you want a fallback icon for
}

const info = getSpecialUrlInfo(href)
if (info) renderIcon(TYPE_TO_ICON[info.type])
```

`Partial<Record<SpecialUrlType, …>>` gives autocomplete and typo-protection against the catalog without forcing exhaustiveness. Domain-only types (`meet`, web `github`, …) can be omitted — the favicon path always wins for plain `https://` URLs.

## Security

Dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`) are blocked at every entry point:

- **Parse** — `parseHTML` strips matching `<a>` tags on document load and paste.
- **Write** — input rule, paste rule, paste handler, autolink, and `setHyperlink` / `toggleHyperlink` / `editHyperlink` all route through the shared `isSafeHref` gate composed with the user's `isAllowedUri` policy.
- **Serialize** — `renderHTML` re-checks `isSafeHref` and emits an empty `href` if a hostile mark ever lands in the doc (legacy migration, raw `addMark`, Yjs replay).
- **Navigate** — primary click, middle-click (`auxclick`), touch, and the preview "Open" button short-circuit `window.open(…)` for unsafe hrefs and pass `'noopener,noreferrer'` so opened tabs cannot read `window.opener` or leak Referer.

On the read side, the click handlers prefer the stored mark attribute over the DOM `link.href` property — a relative href injected via `setContent` won't resolve against the host page's origin.

`isSafeHref(href)` and `DANGEROUS_SCHEME_RE` are exported for custom popovers that need the same check; prefer `isSafeHref` (returns a TS type guard).

`SAFE_WINDOW_FEATURES` is the `'noopener,noreferrer'` string the extension passes to every `window.open(href, '_blank', …)` call. BYO popovers and custom click-handlers should pin the same constant — future tightening (e.g. adding `nofollow`) then propagates from one place:

```ts
import { isSafeHref, SAFE_WINDOW_FEATURES } from '@docs.plus/extension-hyperlink'

if (isSafeHref(href)) {
  window.open(href, '_blank', SAFE_WINDOW_FEATURES)
}
```

## TypeScript

Definitions are bundled. Full public surface:

- **Extension** — `Hyperlink` (default export) + `HyperlinkOptions`, `HyperlinkAttributes`, `IsAllowedUriContext`, `LinkProtocolOptions`.
- **Popovers** — `previewHyperlinkPopover`, `createHyperlinkPopover`, `editHyperlinkPopover` factories. Option types `PreviewHyperlinkOptions`, `CreateHyperlinkOptions`, `EditHyperlinkPopoverOptions` are documented under [Popover-factory option shapes](#popover-factory-option-shapes); `EditHyperlinkModalOptions` is a `@deprecated` alias.
- **Floating toolbar** — `createFloatingToolbar`, `DEFAULT_OFFSET`, `hideCurrentToolbar`, `updateCurrentToolbarPosition`, types `FloatingToolbarOptions` / `FloatingToolbarInstance`. See [Floating-toolbar primitive](#floating-toolbar-primitive).
- **UI controller** — `getDefaultController()`, types `HyperlinkUIController` / `SurfaceKind` / `ControllerState`. See [UI controller](#ui-controller).
- **URL utilities** — `normalizeHref`, `getSpecialUrlInfo`, `validateURL`, `isSafeHref`, `DANGEROUS_SCHEME_RE`, `SAFE_WINDOW_FEATURES`; types `SpecialUrlInfo`, `SpecialUrlType`, `LinkifyMatchLike`.
- **Linkify re-export** — `registerCustomProtocol` (passes through to [linkifyjs](https://linkify.js.org)).

## Testing

Two suites: a Bun-native unit suite (~95 ms) and Cypress E2E that runs against the built `dist/` output via a `Bun.serve` playground — the same bytes an npm consumer installs.

```sh
bun run test             # unit + build + Cypress headless
bun run test:unit        # unit only (Bun native, ~95 ms)
bun run test:unit:watch  # unit in watch mode
bun run test:e2e         # build + Cypress headless (skip unit)
bun run test:open        # build + open the Cypress runner
bun run playground       # playground only, http://127.0.0.1:5173
bun run docs:screenshots # regenerate README hero PNGs in docs/screenshots/
```

The playground accepts query-string flags so the dedicated specs can exercise opt-in behaviors without forking the bootstrap:

| Flag                    | Effect                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| `?popover=custom`       | Swap prebuilt popovers for minimal BYO factories that record calls on `_byo`.   |
| `?shouldAutoLink=block` | Wire `shouldAutoLink: () => false` so the per-URI veto is exercised everywhere. |
| `?clickSelection=on`    | Set `enableClickSelection: true` (click-to-select-mark-range).                  |
| `?exitable=on`          | Set `exitable: true` (ArrowRight at the right edge clears the storedMark).      |

Cypress specs (10 files, ~132 tests):

| Spec                      | Covers                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `create.cy.ts`            | `Mod+K`, Apply state, href canonicalization, host validation, dismiss.                           |
| `preview-edit.cy.ts`      | Click → preview → edit/copy/remove, Back, Escape lifecycle.                                      |
| `autolink.cy.ts`          | Autolink, paste, and `mailto:` produce the same `href`; `code`-mark skip; `shouldAutoLink` veto. |
| `special-schemes.cy.ts`   | 50+ scheme catalog (`whatsapp:`, `tg:`, `vscode:`, `spotify:`, …) parses + previews.             |
| `xss-guards.cy.ts`        | `javascript:` / `data:` / `vbscript:` / `file:` / `blob:` blocked; `renderHTML` re-validation.   |
| `nav-guards.cy.ts`        | Middle-click safety — safe-href passthrough, dangerous-scheme refusal, right-click untouched.    |
| `canon-options.cy.ts`     | `enableClickSelection` and `exitable` canon-option semantics.                                    |
| `styling.cy.ts`           | `styles.css` loaded, `--hl-*` tokens resolve, `light-dark()` branch.                             |
| `custom-popover.cy.ts`    | BYO factory contract — options, mount lifecycle, exports.                                        |
| `scroll-stickiness.cy.ts` | Popover follows its anchor across scroll without drift.                                          |

The suite also runs from the repo root via `bun run test:all`, alongside the Jest and webapp Cypress suites.

## Community

Questions, ideas, or help with this extension? Chat with the docs.plus community on [Discord](https://discord.gg/25JPG38J59).

## Credits

Inspired by Tiptap's [@tiptap/extension-link](https://github.com/ueberdosis/tiptap/tree/main/packages/extension-link). Part of [docs.plus](https://github.com/docs-plus/docs.plus).

## License

MIT
