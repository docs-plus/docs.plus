# @docs.plus/extension-hyperlink

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-hyperlink.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-hyperlink)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-hyperlink.svg)](https://npmcharts.com/compare/@docs.plus/extension-hyperlink)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-hyperlink.svg)](https://www.npmjs.com/package/@docs.plus/extension-hyperlink)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/25JPG38J59)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/preview-dark.png">
    <img alt="Preview popover on a link — copy, edit, and remove actions" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/preview-light.png">
  </picture>
</p>

Tiptap hyperlink mark with optional prebuilt popovers for creating, previewing, and editing links.

Beyond the mark itself, it covers the link behavior hosts usually hand-roll: autolink as you type (bare domains → `https://`, emails → `mailto:`, E.164 phones → `tel:`), markdown round-trip, a 50+ app-scheme catalog (`zoommtg:`, `vscode:`, `spotify:`, …), and a dangerous-scheme gate at every write boundary. The popovers and the stylesheet are both opt-in — bring your own UI and ship zero CSS from this package.

## Install

```sh
bun add @docs.plus/extension-hyperlink
```

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x).

Upgrading from `1.x`? Option names, command names, and CSS class names all changed — see the [`1.x` → `2.0` migration guide](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/CHANGELOG.md#migrating-from-1x-to-20).

## Quickstart

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
  Hyperlink,
  createHyperlinkPopover,
  editHyperlinkPopover,
  previewHyperlinkPopover
} from '@docs.plus/extension-hyperlink'
import '@docs.plus/extension-hyperlink/styles.css'

const editor = new Editor({
  extensions: [
    StarterKit.configure({ link: false }),
    Hyperlink.configure({
      popovers: {
        previewHyperlink: previewHyperlinkPopover,
        editHyperlink: editHyperlinkPopover,
        createHyperlink: createHyperlinkPopover
      }
    })
  ]
})
```

The `styles.css` import and the `popovers` option are both optional — see [Popovers](#popovers) and [Styling](#styling) to bring your own UI.

## Options

| Option                 | Type                                                      | Default                                   | Description                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `autolink`             | `boolean`                                                 | `true`                                    | Convert URLs to links as you type.                                                                                                                                                                                                               |
| `openOnClick`          | `boolean`                                                 | `true`                                    | Open links on click. Overridden by `popovers.previewHyperlink` when set.                                                                                                                                                                         |
| `linkOnPaste`          | `boolean`                                                 | `true`                                    | Wrap the current selection in a link when a URL is pasted.                                                                                                                                                                                       |
| `protocols`            | `Array<string \| LinkProtocolOptions>`                    | `[]`                                      | Extra protocols to register with [linkifyjs](https://linkify.js.org). 50+ are already built in.                                                                                                                                                  |
| `HTMLAttributes`       | `Partial<HyperlinkAttributes>`                            | `{ rel: 'noopener noreferrer nofollow' }` | Attributes applied to rendered `<a>` tags. Set a key to `null` to remove it. `target` and `image` are stored on the mark but **never** rendered to the DOM (the click handler decides where to open the link, and `<a image>` isn't valid HTML). |
| `validate`             | `(url: string) => boolean`                                | —                                         | URL gate at every write boundary, AFTER `isSafeHref`. Return `false` to reject. See [`validate` vs `isAllowedUri`](#validate-vs-isalloweduri).                                                                                                   |
| `popovers`             | `{ previewHyperlink?, editHyperlink?, createHyperlink? }` | —                                         | Factory functions for the three popover slots. See [Popovers](#popovers).                                                                                                                                                                        |
| `defaultProtocol`      | `string`                                                  | `'https'`                                 | Scheme used when promoting bare domains (`example.com` → `${defaultProtocol}://example.com`). See [URL handling](#url-handling).                                                                                                                 |
| `isAllowedUri`         | `(uri, ctx) => boolean`                                   | —                                         | URL gate, Tiptap-canon shape. Same write boundaries as `validate`; `ctx` carries `{ defaultValidate, protocols, defaultProtocol }`. See [`validate` vs `isAllowedUri`](#validate-vs-isalloweduri).                                               |
| `shouldAutoLink`       | `(uri) => boolean`                                        | —                                         | Per-URI autolink veto. Consulted by the autolink plugin, the paste handler (smart-paste over a non-empty selection), AND the markdown paste rule. Return `false` to skip autolinking that URI.                                                   |
| `enableClickSelection` | `boolean`                                                 | `false`                                   | When `true`, clicking inside a link in editable mode selects the entire mark range. Mirrors `@tiptap/extension-link`.                                                                                                                            |
| `exitable`             | `boolean`                                                 | `false`                                   | When `true`, ArrowRight at the end of a hyperlink mark exits the mark — the next typed character is plain text.                                                                                                                                  |

The non-obvious shapes:

```ts
Hyperlink.configure({
  protocols: ['ftp', { scheme: 'tel', optionalSlashes: true }],
  isAllowedUri: (uri, ctx) => ctx.defaultValidate(uri) && !uri.includes('blocked.example'),
  shouldAutoLink: (uri) => !uri.startsWith('@')
})
```

### `validate` vs `isAllowedUri`

Both are URL gates. Both fire at every write boundary (set, edit, paste, input rule, autolink) AFTER the built-in `isSafeHref` blocklist (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`). The only difference is signature shape:

- **`validate(url)`** — predates `isAllowedUri`. Use for simple URL→boolean checks ("only http(s)", "block this domain").
- **`isAllowedUri(uri, ctx)`** — Tiptap-canon shape, drop-in compatible with `@tiptap/extension-link` policies. Use when porting an existing policy or when you want the `ctx` (e.g. `ctx.defaultValidate(uri)` to reuse the safety check).

Pick one. Setting both works — they compose (a URL must pass both) — but it's rarely what you want.

## Commands

| Command                                                | Description                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setHyperlink({ href, target?, title?, image? })`      | Pure command — write the hyperlink mark over the current selection. Returns `false` (no-op) if `href` is empty/missing or fails the XSS / `isAllowedUri` gate.                                                                                |
| `unsetHyperlink()`                                     | Remove the link mark from the current selection.                                                                                                                                                                                              |
| `toggleHyperlink({ href, target?, title?, image? })`   | Toggle the hyperlink mark on/off across the current selection. Same gates as `setHyperlink`.                                                                                                                                                  |
| `openCreateHyperlinkPopover(attributes?)`              | UI command — open the create-hyperlink popover anchored to the current selection. No-op when no popover factory is configured.                                                                                                                |
| `editHyperlink({ newURL?, newText?, title?, image? })` | Update any combination of href, inner text, `title`, and `image` on the link at the current selection. Returns `false` (no-op) when `newURL` fails the XSS / `isAllowedUri` gate; the prebuilt edit popover surfaces this as an inline error. |
| `editHyperlinkHref(url)`                               | Shorthand for href-only edits.                                                                                                                                                                                                                |
| `editHyperlinkText(text)`                              | Shorthand for text-only edits.                                                                                                                                                                                                                |
| `setLink` / `unsetLink` / `toggleLink`                 | Drop-in delegating aliases for `setHyperlink` / `unsetHyperlink` / `toggleHyperlink` to ease migration from `@tiptap/extension-link`.                                                                                                         |

```ts
editor.chain().focus().setHyperlink({ href: 'https://example.com' }).run()
editor.getAttributes('hyperlink').href // read the current href
```

## Keyboard shortcuts

| Shortcut     | Action                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `Mod-k`      | Open the create-hyperlink popover anchored to the current selection (no-op without a popover factory).      |
| `ArrowRight` | When `exitable: true`, exits the hyperlink mark at the right boundary so the next typed char is plain text. |

## Styling

The prebuilt popovers ship a stylesheet — import it once if you use them:

```ts
import '@docs.plus/extension-hyperlink/styles.css'
```

The extension's JavaScript never imports this file. Skip the import with a fully custom UI and you ship zero CSS from this package.

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
  --hl-font:
    ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --hl-font-size: 14px;
  --hl-transition: 120ms ease-in-out;
}
```

</details>

The popover shell is positioned by JS, not by the stylesheet: `position: fixed` with an inline `z-index: 9999`. To change stacking, pass `createPopover({ zIndex })` — a CSS variable can't override the inline style.

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
| `.floating-popover`          | Popover container (adds `.visible` after mount).     |
| `.floating-popover-arrow`    | Arrow pointing at the reference element.             |
| `.floating-popover-content`  | Content wrapper inside the popover.                  |
| `.floating-tooltip`          | Tooltip on popover icon buttons (adds `.visible`).   |
| `.hyperlink-create-popover`  | Create-link popover root.                            |
| `.hyperlink-preview-popover` | Preview popover root.                                |
| `.hyperlink-edit-popover`    | Edit popover root.                                   |
| `.inputs-wrapper`            | Input group container (adds `.error` on validation). |
| `.buttons-wrapper`           | Button group container.                              |
| `.search-icon`               | Leading icon inside an input group.                  |
| `.error-message`             | Validation error text (shown with `.show`).          |

Tooltips on the prebuilt popovers' icon buttons are shipped by the bundled `@docs.plus/floating-tooltip` — one body-appended bubble per bundle, shown on hover and keyboard focus, skinned in `styles.css` by a fixed literal block kept lockstep with extension-hypermultimedia.

## Popovers

### Gallery

Prebuilt create, preview, and edit popovers (`styles.css` + `popovers` config). Each pair follows your system light/dark preference.

<details>
<summary><strong>Create</strong> — Mod+K with text selected</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/create-dark.png">
    <img alt="Create-link popover with URL field and Add button" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/create-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>Preview</strong> — click a link</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/preview-dark.png">
    <img alt="Preview popover on a link — copy, edit, and remove actions" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/preview-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>Edit</strong> — preview → Edit</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/edit-dark.png">
    <img alt="Edit-link popover with URL and text fields and Update button" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/edit-light.png">
  </picture>
</p>

</details>

Three ways in, pick what you need:

- **Use the prebuilt popovers** — slot the three factories into `Hyperlink.configure({ popovers })`, as in [Quickstart](#quickstart). Positioning, dismissal, focus, and cleanup are handled.
- **Open them from outside the editor** — call [the openers](#openers) from a toolbar button or React component.
- **Replace one or all of them** — pass your own factory (any function returning `HTMLElement`) into the matching slot. See [Bring your own popover](#bring-your-own-popover); for popovers not anchored to a hyperlink, or observing popover state from outside, see [Advanced](#advanced).

### Popover-factory option shapes

Every BYO factory receives one `options` argument; the shape depends on the slot.

**`PreviewHyperlinkOptions`** — passed to `popovers.previewHyperlink` on every link click.

| Field           | Type                       | Description                                                                                                                                                             |
| --------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                   | The Tiptap editor instance. Reach the `EditorView` via `editor.view` when you need it.                                                                                  |
| `link`          | `HTMLAnchorElement`        | The clicked `<a>` node. Use it as the toolbar's `referenceElement` so the popover follows the link on scroll.                                                           |
| `nodePos`       | `number`                   | Document position of the link mark; pair with `editor.state.doc.nodeAt(nodePos)` to read the mark.                                                                      |
| `attrs`         | `HyperlinkAttributes`      | **Required.** The mark's stored attributes. Prefer `attrs.href` over `link.href` (the DOM property resolves against `document.baseURI` and would leak the host origin). |
| `validate?`     | `(url: string) => boolean` | The configured `validate` option, forwarded.                                                                                                                            |
| `isAllowedUri?` | `(uri: string) => boolean` | Composed XSS + `isAllowedUri` policy gate. **BYO popovers must call this before any `window.open`.**                                                                    |

Return `null` to opt out for this click (e.g. open a mobile bottom sheet); the extension hides the floating popover.

**`CreateHyperlinkOptions`** — passed to `popovers.createHyperlink` when `Mod-k` (or `editor.commands.openCreateHyperlinkPopover()`) fires.

| Field           | Type                           | Description                                                                                               |
| --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                       | The Tiptap editor instance.                                                                               |
| `extensionName` | `string`                       | The mark name (`'hyperlink'` by default). Pass it to commands when you've renamed the mark.               |
| `attributes`    | `Partial<HyperlinkAttributes>` | Pre-fill values forwarded from `openCreateHyperlinkPopover(attributes?)`. Empty when invoked via `Mod-k`. |
| `validate?`     | `(url: string) => boolean`     | The configured `validate` option, forwarded.                                                              |

Return `null` if the popover can't open (e.g. DOM construction fails); the command then returns `false`.

**`EditHyperlinkOptions`** — passed to `popovers.editHyperlink`, and to `openEditHyperlink(opts)` when called from outside a preview popover.

| Field           | Type                       | Description                                                                                                                                                                  |
| --------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                   | The Tiptap editor instance.                                                                                                                                                  |
| `link`          | `HTMLAnchorElement`        | The link being edited — anchors the popover.                                                                                                                                 |
| `nodePos?`      | `number`                   | Document position of the link mark. Lets edit/Back recover the anchor when ProseMirror replaces duplicate link DOM nodes.                                                    |
| `validate?`     | `(url: string) => boolean` | The configured `validate` option, forwarded — the edit form rejects the same URLs as `Mod-k`.                                                                                |
| `isAllowedUri?` | `(uri: string) => boolean` | Composed XSS + `isAllowedUri` policy gate, forwarded so Back re-opens the preview with the same navigation policy.                                                           |
| `onBack?`       | `() => void`               | Override the default Back behaviour. By default, Back re-opens the preview popover via `openPreviewHyperlink`. Pass an override only as an escape hatch (e.g. mobile sheet). |
| `markName?`     | `string`                   | Mark name to extend the range over. Defaults to `'hyperlink'`; override when you've renamed the mark.                                                                        |

### Openers

The three named openers open a popover from outside the click handler — keyboard shortcuts, an outer toolbar button, a React modal, or a Tiptap command.

| Opener                                     | Anchor                  | Slot                        |
| ------------------------------------------ | ----------------------- | --------------------------- |
| `openPreviewHyperlink(opts)`               | `opts.link` (anchor el) | `popovers.previewHyperlink` |
| `openEditHyperlink(opts)`                  | `opts.link` (anchor el) | `popovers.editHyperlink`    |
| `openCreateHyperlink(editor, attributes?)` | Current selection       | `popovers.createHyperlink`  |

Each opener reads its slot from `Hyperlink.configure({ popovers })`, falls back to the prebuilt factory if the slot is empty, builds the content, and mounts via the controller. A factory returning `null` opts out (typical for mobile, where a bottom sheet replaces the popover); the opener then no-ops.

`buildPreviewOptionsFromAnchor({ editor, link, validate?, markName? })` recovers a full `PreviewHyperlinkOptions` from a live `<a>` node — no hand-rolled `posAtDOM` → `mark.attrs` lookup — so `openPreviewHyperlink(buildPreviewOptionsFromAnchor({ editor, link }))` is the canonical edit-popover → preview handoff.

## Advanced

For replacing a prebuilt popover, building a popover that isn't anchored to a hyperlink, or observing popover state from outside the editor.

### Bring your own popover

Three minimal factories matching the option shapes above, runnable as written. A factory supplies content only — the popover shell keeps its per-surface ARIA semantics (`role="toolbar"` for preview; `role="dialog"` named "Add link" / "Edit link" for create and edit), so BYO popovers stay accessible without extra wiring.

<details>
<summary><b>Custom <code>previewHyperlink</code></b></summary>

```ts
import {
  getDefaultController,
  Hyperlink,
  isSafeHref,
  type PreviewHyperlinkOptions
} from '@docs.plus/extension-hyperlink'

function previewHyperlink(options: PreviewHyperlinkOptions): HTMLElement {
  const { editor, attrs } = options
  const root = document.createElement('div')

  // `attrs.href` is `string | null` and can predate the current policy —
  // gate it before rendering a navigable anchor.
  const href = isSafeHref(attrs.href) ? attrs.href : ''

  const link = document.createElement('a')
  link.href = href
  link.textContent = attrs.href ?? ''
  link.target = '_blank'
  link.rel = 'noopener noreferrer'

  const remove = document.createElement('button')
  remove.textContent = 'Remove'
  remove.addEventListener('click', () => {
    getDefaultController().close()
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
  getDefaultController,
  Hyperlink,
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

    // Delegate to the canonical command — it normalizes the protocol
    // and runs the URL gate. Returns `false` when the gate rejects,
    // so the popover stays open and the user can re-prompt.
    const applied = editor.chain().setHyperlink({ href: url }).run()
    if (applied) getDefaultController().close()
  })

  return form
}

Hyperlink.configure({ popovers: { createHyperlink } })
```

</details>

<details>
<summary><b>Custom <code>editHyperlink</code></b></summary>

```ts
import {
  buildPreviewOptionsFromAnchor,
  getDefaultController,
  Hyperlink,
  openPreviewHyperlink,
  validateURL,
  type EditHyperlinkOptions
} from '@docs.plus/extension-hyperlink'

function editHyperlink(options: EditHyperlinkOptions): HTMLElement {
  const { editor, link, validate, onBack, markName = 'hyperlink' } = options
  const form = document.createElement('form')

  // Pre-fill from the live link — the prebuilt edit popover does the same.
  const textInput = document.createElement('input')
  textInput.type = 'text'
  textInput.value = link.innerText
  textInput.placeholder = 'Link text'

  const hrefInput = document.createElement('input')
  hrefInput.type = 'url'
  hrefInput.value = link.href
  hrefInput.placeholder = 'https://example.com'

  const back = document.createElement('button')
  back.type = 'button'
  back.textContent = 'Back'
  back.addEventListener('click', () => {
    // Back UX: honor `onBack` if the caller provided one (rare, escape
    // hatch); otherwise re-open the preview for the same link. Don't
    // close instead — that's a silent dismissal, not "back".
    if (onBack) return onBack()
    openPreviewHyperlink(buildPreviewOptionsFromAnchor({ editor, link, validate, markName }))
  })

  const apply = document.createElement('button')
  apply.type = 'submit'
  apply.textContent = 'Apply'

  form.append(textInput, hrefInput, back, apply)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const newText = textInput.value.trim()
    const newURL = hrefInput.value.trim()
    if (!newText || !validateURL(newURL, { customValidator: validate })) return

    // Extend across the full mark range so the edit applies to every
    // position the link covers, then delegate to the canonical command.
    // It returns `false` when the URL gate rejects — keep the popover
    // open in that case so the user can correct.
    const ok = editor
      .chain()
      .focus()
      .extendMarkRange(markName)
      .editHyperlink({ newURL, newText })
      .run()
    if (!ok) return

    getDefaultController().close()
  })

  queueMicrotask(() => textInput.focus())

  return form
}

Hyperlink.configure({ popovers: { editHyperlink } })
```

</details>

### Floating-popover primitive

`createPopover(options)` is the primitive every opener calls under the hood — Floating-UI placement, scroll-stickiness, outside-click dismissal, keyboard navigation, and registration with the [UI controller](#ui-controller). Reach for it directly when you want a popover that participates in the singleton lifecycle but isn't anchored to a hyperlink.

`PopoverOptions` is a discriminated union — exactly one of `referenceElement` or `coordinates` is required, enforced at compile time.

| Field              | Type                                         | Default                | Description                                                                                                 |
| ------------------ | -------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `referenceElement` | `HTMLElement`                                | —                      | Element-anchor variant. Mutually exclusive with `coordinates`.                                              |
| `coordinates`      | `{ getBoundingClientRect, contextElement? }` | —                      | Virtual-anchor variant (e.g. selection-anchored). `getBoundingClientRect` MUST recompute on every call.     |
| `content`          | `HTMLElement`                                | —                      | Popover content node.                                                                                       |
| `placement?`       | `Placement`                                  | `'bottom-start'`       | Floating-UI placement. Auto-flips to fit the viewport.                                                      |
| `offset?`          | `number`                                     | `DEFAULT_OFFSET` (`8`) | Distance in px between the anchor and the popover.                                                          |
| `showArrow?`       | `boolean`                                    | `false`                | Render an arrow pointing at the anchor.                                                                     |
| `className?`       | `string`                                     | `''`                   | Extra class on the popover root (in addition to `.floating-popover`).                                       |
| `zIndex?`          | `number`                                     | `9999`                 | Stacking context for the popover.                                                                           |
| `role?`            | `string`                                     | —                      | ARIA role on the popover root. ARIA has no popover role — pass the content's role (`toolbar`, `dialog`, …). |
| `onShow?`          | `() => void`                                 | —                      | Fires after the popover's first paint and `.visible` class is applied.                                      |
| `onHide?`          | `() => void`                                 | —                      | Fires when the popover is dismissed (outside click, programmatic `hide()`, or controller replacement).      |

Returns a `Popover`:

| Member                           | Description                                                   |
| -------------------------------- | ------------------------------------------------------------- |
| `element`                        | The popover root (`.floating-popover` div).                   |
| `show()`                         | Mount and reveal. Idempotent.                                 |
| `hide()`                         | Dismiss without destroying. Re-callable via `show()`.         |
| `destroy()`                      | Tear down for good — removes from DOM and stops `autoUpdate`. |
| `isVisible()`                    | `true` between `show()` and `hide()`/`destroy()`.             |
| `setContent(el)`                 | Swap the content node in place without re-positioning.        |
| `updateReference(ref?, coords?)` | Re-anchor to a different element or virtual reference.        |

`createPopover` adopts the new instance into the controller automatically, so showing a second popover tears down the first.

### UI controller

`getDefaultController()` returns the singleton that owns the floating-popover lifecycle. Subscribe to state changes from outer toolbars, devtools panels, or E2E harnesses.

`ControllerState` is a discriminated union:

```ts
type PopoverKind = 'preview' | 'edit' | 'create' | (string & {})

type ControllerState =
  | { kind: 'idle' }
  | {
      kind: 'mounted'
      popoverKind: PopoverKind
      element: HTMLElement // popover root — for focus rings, observers, scroll-freezes
      referenceElement: HTMLElement | null // null for virtual-coords popovers (e.g. selection-anchored create)
    }
```

`PopoverController`:

| Member                           | Description                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adopt(popover, kind, metadata)` | Take ownership of a `Popover`, destroying the previous owner. Returns an unregister function. Used internally by openers; consumers rarely call it.                                   |
| `close()`                        | Dismiss the active popover (no-op when idle).                                                                                                                                         |
| `reposition(ref?, coords?)`      | Re-anchor the active popover after the underlying mark moves (external edit, doc rewrite).                                                                                            |
| `getState()`                     | One-shot read of `ControllerState`.                                                                                                                                                   |
| `subscribe(listener)`            | Register a state-change listener; returns an unsubscribe function. It does **not** fire on subscribe — call `listener(controller.getState())` yourself if you need the initial state. |

## URL handling

Every write path canonicalizes hrefs before storing them:

- **Bare domains** get `https://` prepended: `google.com` → `https://google.com`.
- **Explicit schemes** pass through as typed: `http://`, `ftp://`, `whatsapp://`, `mailto:`.
- **Protocol-relative URLs** stay as-is: `//example.com`.

The create popover, markdown input rule, autolink, and paste all produce the same `href` for the same input.

Validation rejects scheme-prefixed typos with no real host: `https://googlecom` fails; `http://localhost`, `https://127.0.0.1`, and any registered custom scheme pass.

`normalizeHref(raw, defaultProtocol?)` returns the canonical href the editor would store. Use it in custom popovers to mirror the canonicalization.

### Markdown

The mark ships its own markdown wiring: `markdownTokenName: 'link'` plus `parseMarkdown` / `renderMarkdown` hooks, so `[label](https://example.com)` round-trips when the host editor loads a Markdown extension (e.g. `@tiptap/markdown`). The hooks are inert otherwise — no extra setup, no extra bytes at runtime. Imported hrefs go through the same `normalizeHref` + `isSafeHref` pipeline as every other write boundary, so a markdown `javascript:` link lands as an empty `href`.

### Scheme classification

`getSpecialUrlInfo(href)` classifies a URL against the 50+ scheme catalog and returns `{ type, title, category } | null`. The extension ships **no** icon catalog — `type` is a string-literal `SpecialUrlType` you map to your own renderer:

```ts
import { getSpecialUrlInfo, type SpecialUrlType } from '@docs.plus/extension-hyperlink'
import * as Icons from './icons'

const TYPE_TO_ICON: Partial<Record<SpecialUrlType, () => string>> = {
  email: Icons.Mail,
  whatsapp: Icons.Chat
  // …one entry per `type` you want a fallback icon for
}

const info = getSpecialUrlInfo(href)
if (info) renderIcon(TYPE_TO_ICON[info.type])
```

`Partial<Record<SpecialUrlType, …>>` gives autocomplete and typo-protection without forcing exhaustiveness — domain-only types (`meet`, web `github`, …) can be omitted because the favicon path wins for plain `https://` URLs.

## Security

Dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`) are blocked at every entry point. The gate tests a control-stripped copy of the href, so embedded tab / newline / control characters (`java\tscript:`, which browsers resolve as `javascript:`) can't smuggle a scheme past it.

- **Parse** — `parseHTML` strips matching `<a>` tags on document load and paste.
- **Write** — input rule, paste rule, paste handler, autolink, and `setHyperlink` / `toggleHyperlink` / `editHyperlink` all route through the shared `isSafeHref` gate composed with the user's `isAllowedUri` policy.
- **Serialize** — `renderHTML` re-checks `isSafeHref` and emits an empty `href` if a hostile mark ever lands in the doc (legacy migration, raw `addMark`, Yjs replay).
- **Navigate** — primary click, middle-click (`auxclick`), touch, and the preview "Open" button short-circuit `window.open(…)` for unsafe hrefs and pass `'noopener,noreferrer'` so opened tabs cannot read `window.opener` or leak Referer.

On the read side, the click handlers prefer the stored mark attribute over the DOM `link.href` property — a relative href injected via `setContent` won't resolve against the host page's origin.

`isSafeHref(href)` and `DANGEROUS_SCHEME_RE` are exported for custom popovers that need the same check; prefer `isSafeHref` (returns a TS type guard).

`SAFE_WINDOW_FEATURES` is the `'noopener,noreferrer'` string the extension passes to every `window.open(href, '_blank', …)` call. BYO popovers and custom click-handlers should pin the same constant — future tightening then propagates from one place.

## TypeScript

Definitions are bundled. Full public surface:

- **Extension** — `Hyperlink` (default export) + `HyperlinkOptions`, `HyperlinkAttributes`, `IsAllowedUriContext`, `LinkProtocolOptions`. `HyperlinkAttributes` is generic — `HyperlinkAttributes<{ ariaLabel: string }>` extends the built-in `href` / `target` / `rel` / `class` / `title` / `image` keys with your own typed fields without losing the open-ended `Record<string, unknown>` index signature.
- **Openers** — `openPreviewHyperlink`, `openEditHyperlink`, `openCreateHyperlink`, `buildPreviewOptionsFromAnchor`. See [Openers](#openers).
- **Popover factories** — `previewHyperlinkPopover`, `createHyperlinkPopover`, `editHyperlinkPopover`. Option types `PreviewHyperlinkOptions`, `CreateHyperlinkOptions`, `EditHyperlinkOptions` are documented under [Popover-factory option shapes](#popover-factory-option-shapes).
- **Floating-popover primitive** — `createPopover`, `DEFAULT_OFFSET`, types `Popover` / `PopoverOptions`. See [Floating-popover primitive](#floating-popover-primitive).
- **Tooltip primitive** — `attachTooltip(target, label)` / `hideTooltip()`, re-exported from the bundled `@docs.plus/floating-tooltip`. The same hover/focus tooltip the prebuilt popovers put on their icon buttons — attach it to BYO popover buttons for parity.
- **UI controller** — `getDefaultController()`, types `PopoverController` / `PopoverKind` / `ControllerState` / `AdoptMetadata` / `VirtualCoordinates`. See [UI controller](#ui-controller).
- **URL utilities** — `normalizeHref`, `getSpecialUrlInfo`, `validateURL`, `isSafeHref`, `DANGEROUS_SCHEME_RE`, `SAFE_WINDOW_FEATURES`; types `SpecialUrlInfo`, `SpecialUrlType`, `LinkifyMatchLike`.
- **DOM helpers** — `copyToClipboard(text, callback?)`, `createHTMLElement(tag, props?)`, and the SVG icon factories `Copy`, `LinkOff`, `Pencil` the prebuilt preview popover renders — reuse them in BYO popovers for visual parity.
- **Linkify re-export** — `registerCustomProtocol` (passes through to [linkifyjs](https://linkify.js.org)).

## Family

Sibling packages and recommended pairings (e.g. with hypermultimedia): [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md).

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
