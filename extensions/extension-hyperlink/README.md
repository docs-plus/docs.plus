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

Beyond the mark itself, the package covers the link behavior hosts usually hand-roll. Autolink runs as you type: bare domains → `https://`, emails → `mailto:`, E.164 phones → `tel:`. The package also covers markdown round-trip, a catalog of 47 app schemes plus 16 domain matches, and a dangerous-scheme gate at every write boundary. `Mod-k` opens the prebuilt create form with no configuration, and the preview popover needs its own slot. Import `styles.css` to make the prebuilt forms look right, or bring your own UI and skip the import.

## Install

```sh
bun add @docs.plus/extension-hyperlink
```

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x).

Installs two runtime dependencies, `@floating-ui/dom` and `linkifyjs`. The popover engine and the tooltip ship inside `dist`, so they add no third package.

The Quickstart also imports `@tiptap/starter-kit`. Add it with `bun add @tiptap/starter-kit` when your app has none yet.

Module scope touches no browser API, so a server bundle can import the package. [`createPopover`](#floating-popover-primitive), [the three openers](#openers), the three prebuilt popover factories, `attachTooltip`, `createHTMLElement`, and `copyToClipboard` read `document` or `navigator`, so call them in the browser only.

Upgrading from `1.x`? Option names, command names, and CSS class names all changed — see [Migrating from 1.x](#migrating-from-1x).

## Quickstart

The host page needs one mount point: `<div id="editor"></div>`.

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
  element: document.querySelector('#editor'),
  content: '<p>Try <a href="https://example.com">this link</a>.</p>',
  extensions: [
    // Disable StarterKit's bundled link mark — see Caveats.
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

The `styles.css` import is optional. `popovers.previewHyperlink` is not: without it, a click on a link opens nothing. The snippet also styles no document link — see [Popovers](#popovers) and [Styling](#styling).

## Options

Every key below goes into `Hyperlink.configure({ … })`.

| Option                 | Type                                                                                                                                                                                                                                                                 | Default                                                                  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autolink`             | `boolean`                                                                                                                                                                                                                                                            | `true`                                                                   | Converts URLs to links as you type. It also sets the mark's `inclusive()`, so `false` stops a character typed at the right edge from joining the link.                                                                                                                                                                                                                                                                                                                             |
| `openOnClick`          | `boolean`                                                                                                                                                                                                                                                            | `true`                                                                   | Gates the whole click plugin. Primary click opens the preview popover. With no `popovers.previewHyperlink`, a read-only editor opens the link in a new tab, and an editable editor opens no popover. `false` removes every pointer handler the package binds, including the click guard and the middle-click gate.                                                                                                                                                                 |
| `linkOnPaste`          | `boolean`                                                                                                                                                                                                                                                            | `true`                                                                   | Wraps a non-empty selection in a link when the clipboard holds exactly one URL. It gates that path only — a pasted bare URL still autolinks at `false`. See [Caveats](#caveats).                                                                                                                                                                                                                                                                                                   |
| `protocols`            | `Array<LinkProtocolOptions \| string>`                                                                                                                                                                                                                               | `[]`                                                                     | Extra schemes registered with [linkifyjs](https://linkify.js.org), which is what makes paste detect them. Each scheme registers once per process. The built-in catalog is separate and registers nothing with linkifyjs. See [URL handling](#url-handling).                                                                                                                                                                                                                        |
| `HTMLAttributes`       | `Partial<HyperlinkAttributes>`                                                                                                                                                                                                                                       | `{ target: null, rel: 'noopener noreferrer nofollow', class: null }`     | Attributes merged onto every rendered `<a>`. A `null` value renders nothing, so the default anchor carries `rel` only. A `target` set here does reach the DOM — see [Caveats](#caveats).                                                                                                                                                                                                                                                                                           |
| `popovers`             | `{ previewHyperlink?: ((options: PreviewHyperlinkOptions) => HTMLElement \| null) \| null; editHyperlink?: ((options: EditHyperlinkOptions) => HTMLElement \| null) \| null; createHyperlink?: ((options: CreateHyperlinkOptions) => HTMLElement \| null) \| null }` | `{ previewHyperlink: null, editHyperlink: null, createHyperlink: null }` | One factory per popover slot. The three openers fall back to the prebuilt factory when a slot is `null`. The click handler does not: leave `previewHyperlink` at `null` and a click on a link opens no popover. A factory that returns `null` opts out of that popover. See [Popovers](#popovers).                                                                                                                                                                                 |
| `validate`             | `(url: string) => boolean`                                                                                                                                                                                                                                           | `undefined`                                                              | URL gate at every write boundary, after `isSafeHref`. Return `false` to reject. See [`validate` vs `isAllowedUri`](#validate-vs-isalloweduri).                                                                                                                                                                                                                                                                                                                                     |
| `defaultProtocol`      | `string`                                                                                                                                                                                                                                                             | `'https'`                                                                | Scheme used when promoting bare domains (`example.com` → `${defaultProtocol}://example.com`). See [URL handling](#url-handling).                                                                                                                                                                                                                                                                                                                                                   |
| `isAllowedUri`         | `(uri: string, ctx: IsAllowedUriContext) => boolean`                                                                                                                                                                                                                 | `undefined`                                                              | URL gate, Tiptap-canon shape. Same write boundaries as `validate`; `ctx` carries `{ defaultValidate, protocols, defaultProtocol }`. See [`validate` vs `isAllowedUri`](#validate-vs-isalloweduri).                                                                                                                                                                                                                                                                                 |
| `shouldAutoLink`       | `(uri: string) => boolean`                                                                                                                                                                                                                                           | `undefined`                                                              | Per-URI autolink veto. The autolink plugin, the paste handler, and the linkify paste rule all consult it. An explicit `setHyperlink` write skips it, because that is user intent.                                                                                                                                                                                                                                                                                                  |
| `enableClickSelection` | `boolean`                                                                                                                                                                                                                                                            | `false`                                                                  | With `true`, a click inside a link in an editable editor selects the whole mark range. That expansion also needs a collapsed selection. Every other case places the caret at the clicked position, and keeps a non-empty selection only when it overlaps the link. A read-only editor is one of those cases. All paths need a mounted preview popover, so with an empty `popovers.previewHyperlink` slot the package writes no selection at all. Mirrors `@tiptap/extension-link`. |
| `exitable`             | `boolean`                                                                                                                                                                                                                                                            | `false`                                                                  | With `true`, ArrowRight at the end of a hyperlink mark leaves the mark, so the next typed character is plain text.                                                                                                                                                                                                                                                                                                                                                                 |

These option shapes need an example:

```ts
Hyperlink.configure({
  protocols: ['ftp', { scheme: 'tel', optionalSlashes: true }],
  isAllowedUri: (uri, ctx) => ctx.defaultValidate(uri) && !uri.includes('blocked.example'),
  shouldAutoLink: (uri) => !uri.startsWith('@')
})
```

`LinkProtocolOptions` is `{ scheme: string; optionalSlashes?: boolean }`.

### `validate` vs `isAllowedUri`

Both are URL gates. Both run at every write boundary — set, edit, paste, input rule, autolink — after the built-in `isSafeHref` gate. Only the signature differs.

- **`validate(url)`** — predates `isAllowedUri`. Use it for a plain URL-to-boolean check, such as "only http(s)" or "block this domain".
- **`isAllowedUri(uri, ctx)`** — Tiptap-canon shape, drop-in compatible with `@tiptap/extension-link` policies. Use it when you port an existing policy, or when you want `ctx.defaultValidate(uri)` to reuse the safety check.

Pick one. Setting both works, because they compose and a URL must pass both, but that is rarely the intent.

`isSafeHref` plus your `validate` and `isAllowedUri` hooks form the composed gate. The rest of this README uses that name.

`validateURL(url, { customValidator })` is a different tool. It is the form-level shape check the prebuilt popovers run before they call a command. It runs `isSafeHref` first, then the shape check, then your `customValidator`.

## Commands

Every command below lands on `editor.commands` and on `editor.chain()`. On `editor.commands`, each returns `boolean`, and `false` marks a no-op.

| Command                                                | Description                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setHyperlink({ href, target?, title?, image? })`      | Writes the hyperlink mark over the current selection. Returns `false` when `href` is empty, when the composed gate rejects it, or when the schema cannot apply the mark there.                                                            |
| `unsetHyperlink()`                                     | Removes the mark from the current selection, and extends an empty selection across the whole mark first.                                                                                                                                  |
| `toggleHyperlink({ href, target?, title?, image? })`   | Removes the mark when one is active at the selection, and writes it otherwise. Same gates as `setHyperlink`.                                                                                                                              |
| `setLink` / `unsetLink` / `toggleLink`                 | Aliases that share the canonical implementations, so a policy change reaches both names. They collide with StarterKit's bundled link mark — see [Caveats](#caveats).                                                                      |
| `editHyperlink({ newURL?, newText?, title?, image? })` | Updates any combination of href, inner text, `title`, and `image` on the link at the current selection.                                                                                                                                   |
| `editHyperlinkHref(url)`                               | Shorthand for an href-only edit. Same gates as `editHyperlink`.                                                                                                                                                                           |
| `editHyperlinkText(text)`                              | Shorthand for a text-only edit.                                                                                                                                                                                                           |
| `openCreateHyperlinkPopover(attributes?)`              | Opens the create-link form anchored to the current selection. The command uses `popovers.createHyperlink` when that slot holds a factory, and the prebuilt form otherwise. Returns `false` only when a configured factory returns `null`. |

`editHyperlink` returns `false` (no-op) on four paths, checked in this order:

1. `newURL` fails the shape check, for example `https://googlecom`.
2. The schema carries no mark under that name.
3. No hyperlink mark covers the selection, or the mark at that position cannot be read.
4. The composed gate rejects `newURL`.

The prebuilt edit form closes on path 3, because there is nothing left to edit. It shows an inline error on the other paths and stays open.

`openCreateHyperlinkPopover` opens UI, so `editor.can().openCreateHyperlinkPopover()` reports availability without mounting anything. With nothing selected, the prebuilt form inserts the typed URL as its own link text.

```ts
editor.chain().focus().setHyperlink({ href: 'https://example.com' }).run()
editor.getAttributes('hyperlink').href // read the current href
```

## Keyboard shortcuts

| Shortcut            | Context            | Action                                                                                                                                                        |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Mod-k`             | `document`         | Opens the create-link form anchored to the current selection.                                                                                                 |
| `ArrowRight`        | `document`         | With `exitable: true`, leaves the hyperlink mark at its right edge, so the next character is plain text.                                                      |
| `Escape`            | `popover`          | Hides the popover. Focus stays where it is.                                                                                                                   |
| `Tab` / `Shift-Tab` | `popover`          | Moves focus to the next or previous control inside the popover, and wraps at both ends.                                                                       |
| `Escape`            | `create-link form` | Hides the popover and returns focus to the editor from the URL field. From the Apply button the shell handler hides the popover and leaves focus where it is. |
| `Escape`            | `edit-link form`   | Hides the popover and returns focus to the editor from any control.                                                                                           |

The shell binds `Escape` on the popover root, and `Tab` on each control inside it. Both keys therefore need focus inside the popover. The preview popover takes no focus when it opens, so dismiss it with an outside click.

The mark runs at `priority: 1000`, above the Tiptap default `100`. `@tiptap/extension-link` binds no keyboard shortcut, so `Mod-k` is never contested. The two marks do collide on commands and on the `a[href]` parse rule — see [Caveats](#caveats).

## Caveats

- **`StarterKit.configure({ link: false })` is required, not stylistic.** StarterKit v3 bundles `@tiptap/extension-link` by default. Both marks sit at `priority: 1000`, and Tiptap merges every `addCommands()` into one flat map. `setLink` / `unsetLink` / `toggleLink` then resolve to whichever mark comes later in your `extensions` array, with no warning. Both marks also claim the `a[href]` parse rule, and ProseMirror applies only the first match: one mark takes every anchor and the other never parses. If the upstream mark wins, this package's [`isSafeHref`](#security) gate never runs on parsed or pasted HTML, and its popovers never attach.
- **`linkOnPaste: false` does not stop every paste from linking.** The option gates the paste-over-selection plugin alone. The linkify paste rule stays registered, so a pasted bare URL still becomes a link. To stop that path too, set `shouldAutoLink: () => false`, which every autolink path consults.
- **The markdown `[text](url)` input rule is always on.** No option turns it off, so typing a literal `[a](b)` writes a link. Remove it afterwards with `editor.commands.unsetHyperlink()`. See [Markdown](#markdown).
- **`HTMLAttributes.target` reaches the DOM.** The mark attribute `target` carries `rendered: false`, so a stored `_blank` never renders. The option object is merged separately in `renderHTML`, so `HTMLAttributes: { target: '_blank' }` does emit `<a target="_blank">`. A browser-driven `target="_blank"` navigation skips the click gate, which is the risk the mark-level `rendered: false` exists to block. Leave `target` at `null` and let the click handler open the link.
- **The mark name is fixed at `hyperlink`.** Stored documents and the markdown wiring both key on it. `openPreviewHyperlink`, `openEditHyperlink`, and `openCreateHyperlink` throw when no extension answers to that name. Do not rename the mark.
- **[`getDefaultController()`](#ui-controller) owns one controller per bundle, not one per page.** A host that also loads `@docs.plus/extension-hypermultimedia` gets two controllers. Opening a popover in one package does not dismiss the popover of the other. Close the other popover yourself when you open one.

## Styling

The prebuilt popovers ship a stylesheet — import it once when you use them:

```ts
import '@docs.plus/extension-hyperlink/styles.css'
```

The package's JavaScript never imports this file. Skip the import with a fully custom UI, and no CSS from this package reaches your bundle.

The stylesheet skins the popovers only. The mark renders a plain `<a>` with no class, so style your document links yourself:

```ts
Hyperlink.configure({ HTMLAttributes: { class: 'my-link' } })
```

```css
a.my-link {
  color: #2563eb;
  text-decoration: underline;
}
```

### Theming

Every visual token is a `--hl-*` custom property. Colors use [`light-dark()`](https://developer.mozilla.org/docs/Web/CSS/color_value/light-dark), so the popover follows the nearest ancestor's `color-scheme`, or the OS preference when none is set.

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
    0 20px 25px -5px light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.5)),
    0 8px 10px -6px light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.4));
  --hl-radius: 10px;
  --hl-radius-sm: 8px;
  --hl-font:
    ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --hl-font-size: 14px;
  --hl-transition: 120ms ease-out;
}
```

</details>

JavaScript positions the popover shell; the stylesheet does not. The shell gets `position: fixed` and an inline `z-index: 9999`. The three prebuilt popovers pin that value and expose no option for it. `createPopover({ zIndex })` sets the stacking of a popover you build yourself — see [Floating-popover primitive](#floating-popover-primitive).

If your app has a light/dark toggle, set `color-scheme` on the theme root and the popover follows along:

```css
html[data-theme='light'] {
  color-scheme: light;
}
html[data-theme='dark'] {
  color-scheme: dark;
}
```

> **Bundler note.** Some CSS minifiers (lightningcss, for one) down-level `light-dark()` into a `@media (prefers-color-scheme: dark)` block, which pins colors to the OS preference. Re-declare the tokens on each branch when that happens — the attribute selector wins over the media query:
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

| Class                        | Element                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `.floating-popover`          | Popover container (adds `.visible` after mount).                             |
| `.floating-popover-arrow`    | Arrow pointing at the anchor (adds `-top` / `-bottom` / `-left` / `-right`). |
| `.floating-popover-content`  | Content wrapper inside the popover.                                          |
| `.floating-tooltip`          | Tooltip on popover icon buttons (adds `.visible`).                           |
| `.hyperlink-create-popover`  | Create-link form root.                                                       |
| `.hyperlink-preview-popover` | Preview toolbar root.                                                        |
| `.hyperlink-edit-popover`    | Edit-link form root.                                                         |
| `.inputs-wrapper`            | Input group container (adds `.error` on validation).                         |
| `.text-wrapper`              | Edit-form text input row (adds `.error`).                                    |
| `.href-wrapper`              | Edit-form URL input row (adds `.error`).                                     |
| `.buttons-wrapper`           | Button group container.                                                      |
| `.back-button`               | Edit-form back action.                                                       |
| `.apply-button`              | Edit-form apply action.                                                      |
| `.copy`                      | Preview-toolbar copy icon button.                                            |
| `.edit`                      | Preview-toolbar edit icon button.                                            |
| `.remove`                    | Preview-toolbar remove icon button.                                          |
| `.search-icon`               | Leading icon inside an input group.                                          |
| `.error-message`             | Validation error text (shown with `.show`).                                  |

The bundled `@docs.plus/floating-tooltip` ships the tooltips on the prebuilt popovers' icon buttons. It appends one bubble per bundle to the body, and shows it on hover and on keyboard focus. `styles.css` skins that bubble with a fixed literal block, and the block stays in lockstep with extension-hypermultimedia. See [Tooltip primitive](#tooltip-primitive) to attach the same labels to your own buttons.

## Popovers

Three slots cover the whole link lifecycle: preview on click, create on `Mod-k`, and edit from preview.

### Gallery

Prebuilt create, preview, and edit popovers (`styles.css` + `popovers` config). Each screenshot has a light and a dark version, and follows your system preference.

<details>
<summary><strong>Create</strong> — Mod+K</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/create-dark.png">
    <img alt="Create-link popover with URL field and Apply button" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/create-light.png">
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
    <img alt="Edit-link popover with URL and text fields and Apply button" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/edit-light.png">
  </picture>
</p>

</details>

Three ways to use them:

- **Use the prebuilt popovers** — slot the three factories into `Hyperlink.configure({ popovers })`, as in [Quickstart](#quickstart). The shell handles positioning, dismissal, focus, and cleanup.
- **Open them from outside the editor** — call [the openers](#openers) from a toolbar button or a React component.
- **Replace one or all of them** — pass your own factory into the matching slot. See [Bring your own popover](#bring-your-own-popover). For a popover that is not anchored to a hyperlink, or to observe popover state from outside, see [Advanced](#advanced).

### Popover-factory option shapes

Every factory takes one `options` argument. The shape depends on the slot.

**`PreviewHyperlinkOptions`** — passed to `popovers.previewHyperlink` on every link click.

| Field           | Type                       | Description                                                                                                                                                             |
| --------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                   | The Tiptap editor instance. Reach the `EditorView` through `editor.view` when you need it.                                                                              |
| `link`          | `HTMLAnchorElement`        | The clicked `<a>` node. It anchors the popover, so the popover follows the link on scroll.                                                                              |
| `nodePos`       | `number`                   | Document position of the link mark. Pair it with `editor.state.doc.nodeAt(nodePos)` to read the mark.                                                                   |
| `attrs`         | `HyperlinkAttributes`      | **Required.** The mark's stored attributes. Prefer `attrs.href` over `link.href` (the DOM property resolves against `document.baseURI` and would leak the host origin). |
| `validate?`     | `(url: string) => boolean` | The configured `validate` option, forwarded.                                                                                                                            |
| `isAllowedUri?` | `(uri: string) => boolean` | The composed gate. **Your popover must call this before any navigation, including a rendered `<a href>` and any `window.open`.**                                        |

Return `null` to opt out for this click, for example to open a mobile bottom sheet. The package then mounts no popover.

**`CreateHyperlinkOptions`** — passed to `popovers.createHyperlink` when `Mod-k` or `editor.commands.openCreateHyperlinkPopover()` fires.

| Field           | Type                           | Description                                                                                                    |
| --------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                       | The Tiptap editor instance.                                                                                    |
| `extensionName` | `string`                       | The mark name, always `'hyperlink'`. Pass it straight to commands so your factory names the mark in one place. |
| `attributes`    | `Partial<HyperlinkAttributes>` | Pre-fill values forwarded from `openCreateHyperlinkPopover(attributes?)`. Empty when `Mod-k` fires.            |
| `validate?`     | `(url: string) => boolean`     | The configured `validate` option, forwarded.                                                                   |

Return `null` when the popover cannot open, for example when DOM construction fails. The command then returns `false`.

**`EditHyperlinkOptions`** — passed to `popovers.editHyperlink`, and to `openEditHyperlink(opts)` when you call it from outside a preview popover.

| Field           | Type                       | Description                                                                                                                                   |
| --------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                   | The Tiptap editor instance.                                                                                                                   |
| `link`          | `HTMLAnchorElement`        | The link being edited. It anchors the popover.                                                                                                |
| `nodePos?`      | `number`                   | Document position of the link mark. It lets edit and Back recover the anchor when ProseMirror replaces duplicate link DOM nodes.              |
| `validate?`     | `(url: string) => boolean` | The configured `validate` option, forwarded — the edit form rejects the same URLs as `Mod-k`.                                                 |
| `isAllowedUri?` | `(uri: string) => boolean` | The composed gate, forwarded so Back re-opens the preview under the same navigation policy.                                                   |
| `onBack?`       | `() => void`               | Overrides the default Back behavior. By default, Back re-opens the preview popover through `openPreviewHyperlink`. Use it as an escape hatch. |
| `markName?`     | `string`                   | Mark name to extend the range over, always `'hyperlink'`. It exists so your factory passes one name through to `extendMarkRange`.             |

### Openers

The three named openers open a popover from outside the click handler. Call them from a keyboard shortcut, an outer toolbar button, a React modal, or a Tiptap command.

| Opener                                     | Anchor                    | Slot                        | Returns                                                  |
| ------------------------------------------ | ------------------------- | --------------------------- | -------------------------------------------------------- |
| `openPreviewHyperlink(opts)`               | `opts.link` (anchor node) | `popovers.previewHyperlink` | `boolean` — `false` when the factory returns `null`.     |
| `openEditHyperlink(opts)`                  | `opts.link` (anchor node) | `popovers.editHyperlink`    | `void` — the opt-out is not observable at the call site. |
| `openCreateHyperlink(editor, attributes?)` | Current selection         | `popovers.createHyperlink`  | `boolean` — `false` when the factory returns `null`.     |

Each opener reads its slot from `Hyperlink.configure({ popovers })`. Each opener falls back to the prebuilt factory when the slot is empty. It then builds the content and mounts through the controller. A factory that returns `null` opts out, which is the usual mobile path, and the opener then does nothing. Read the return value when your host routes to a bottom sheet.

`buildPreviewOptionsFromAnchor({ editor, link, nodePos?, validate?, isAllowedUri?, markName? })` rebuilds a full `PreviewHyperlinkOptions` from a live `<a>` node, with no hand-rolled `posAtDOM` → `mark.attrs` lookup. `openPreviewHyperlink(buildPreviewOptionsFromAnchor({ editor, link }))` is the canonical edit-to-preview handoff.

### Bring your own popover

Three minimal factories that match the option shapes above. A factory supplies content only. The shell keeps its per-popover ARIA semantics: `role="toolbar"` for preview, and `role="dialog"` named "Add link" or "Edit link" for create and edit. Your popovers therefore stay accessible with no extra wiring. The shell also owns dismissal and focus — see [Floating-popover primitive](#floating-popover-primitive). The create and edit examples call `validateURL(url, { customValidator: validate })` for the form-level shape check — see [`validate` vs `isAllowedUri`](#validate-vs-isalloweduri).

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
  const { editor, attrs, isAllowedUri } = options
  const root = document.createElement('div')

  // A rendered `<a target="_blank">` navigates on click, so it is a navigation
  // sink like `window.open`. Gate it on the composed gate, and fall back to
  // `isSafeHref` when the factory runs outside the click handler.
  const isOpenable = isAllowedUri ?? isSafeHref
  // `attrs.href` is `string | null` and can predate the current policy.
  const raw = attrs.href ?? ''
  const href = isOpenable(raw) ? raw : ''

  const link = document.createElement('a')
  link.href = href
  link.textContent = attrs.href ?? ''
  link.target = '_blank'
  link.rel = 'noopener noreferrer'

  // `title` and `image` are mark-only metadata: the package stores them
  // and renders neither. Read them here to show a link card. `isSafeHref`
  // runs on `image`, and it rejects `data:`, so an inline favicon is dropped.
  if (attrs.title) link.textContent = attrs.title
  if (isSafeHref(attrs.image)) {
    const favicon = document.createElement('img')
    favicon.src = attrs.image
    favicon.width = 16
    favicon.height = 16
    root.append(favicon)
  }

  const remove = document.createElement('button')
  remove.textContent = 'Remove'
  remove.addEventListener('click', () => {
    getDefaultController().close()
    editor.chain().focus().unsetHyperlink().run()
  })

  root.append(link, remove)
  return root
}

const HyperlinkWithPreview = Hyperlink.configure({ popovers: { previewHyperlink } })
```

`configure` returns a new extension instance. Pass `HyperlinkWithPreview` into `new Editor({ extensions: [...] })`. Drop the value and a click on a link opens no popover.

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
    // and runs the composed gate. Returns `false` when the gate rejects,
    // so the popover stays open and the user can re-prompt.
    const chain = editor.chain().setHyperlink({ href: url })
    // `setHyperlink` writes a mark and never inserts text. With an empty
    // selection the mark reaches `storedMarks` only and nothing appears,
    // so give the link its own text. The prebuilt form does the same.
    if (editor.state.selection.empty) chain.insertContent({ type: 'text', text: url })
    if (chain.run()) getDefaultController().close()
  })

  return form
}

const HyperlinkWithCreateForm = Hyperlink.configure({ popovers: { createHyperlink } })
```

Pass `HyperlinkWithCreateForm` into `new Editor({ extensions: [...] })`. Drop the value and `Mod-k` opens the prebuilt form instead.

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
  const { editor, link, validate, isAllowedUri, onBack, markName = 'hyperlink' } = options
  const form = document.createElement('form')

  // Pre-fill from the live link, reading the raw `href` attribute — the DOM
  // `link.href` property resolves relative hrefs against `document.baseURI`,
  // so an untouched Apply would rewrite them. The prebuilt form does the same.
  const textInput = document.createElement('input')
  textInput.type = 'text'
  textInput.value = link.innerText
  textInput.placeholder = 'Link text'

  const hrefInput = document.createElement('input')
  hrefInput.type = 'url'
  hrefInput.value = link.getAttribute('href') ?? ''
  hrefInput.placeholder = 'https://example.com'

  const back = document.createElement('button')
  back.type = 'button'
  back.textContent = 'Back'
  back.addEventListener('click', () => {
    // Back UX: honor `onBack` when the caller provided one (rare, escape
    // hatch); otherwise re-open the preview for the same link. Do not
    // close instead — that is a silent dismissal, not Back.
    if (onBack) return onBack()
    openPreviewHyperlink(
      buildPreviewOptionsFromAnchor({ editor, link, validate, isAllowedUri, markName })
    )
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
    // It returns `false` when the composed gate rejects — keep the
    // popover open in that case so the user can correct.
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

const HyperlinkWithEditForm = Hyperlink.configure({ popovers: { editHyperlink } })
```

Pass `HyperlinkWithEditForm` into `new Editor({ extensions: [...] })`. Drop the value and the preview Edit button opens the prebuilt form instead.

</details>

## URL handling

Every write boundary canonicalizes the href before storing it:

- **Bare domains** get `https://` in front: `google.com` → `https://google.com`.
- **Explicit schemes** pass through as typed: `http://`, `ftp://`, `whatsapp://`, `mailto:`.
- **Protocol-relative URLs** stay as they are: `//example.com`.
- **Bare E.164 phones** become `tel:`, and bare emails become `mailto:`.

For any URL linkifyjs detects, the create form, the [markdown input rule](#markdown), autolink, and paste all produce the same `href`. Paste detection is linkifyjs-only. A catalog app scheme such as `whatsapp://…` therefore autolinks as you type, but stays plain text when pasted. Register the scheme through `protocols` and paste detects it too.

Validation rejects a scheme-prefixed typo with no real host: `https://googlecom` fails. `http://localhost`, `https://127.0.0.1`, and any registered custom scheme pass.

`normalizeHref(raw, defaultProtocol?)` returns the canonical href the editor would store. Call it in your own popover to mirror the same canonicalization.

### Scheme classification

`getSpecialUrlInfo(href)` classifies a URL against the built-in catalog and returns `{ type, title, category } | null`. The catalog holds 47 schemes and 16 domains, matched on two different paths. A scheme matches by prefix, so `zoommtg:`, `vscode:`, and `spotify:` hit on the first characters. A domain matches by host suffix after `www.` is stripped, so `github.com` also covers `api.github.com`.

The package ships **no** icon catalog. `type` is a string-literal `SpecialUrlType` that you map to your own renderer:

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

`Partial<Record<SpecialUrlType, …>>` gives autocomplete and typo-protection without forcing exhaustiveness. Leave out domain-only types such as `meet` or web `github`, because the favicon path wins for a plain `https://` URL.

## Markdown

The mark ships its own markdown wiring: `markdownTokenName: 'link'` plus `parseMarkdown` and `renderMarkdown` hooks. `[label](https://example.com)` therefore round-trips when the host editor also loads a Markdown extension, such as `@tiptap/markdown`. The hooks stay inert otherwise, so they need no setup and run no code until a Markdown extension calls them.

Both directions are write boundaries. An imported href runs through `normalizeHref` and `isSafeHref`, so a markdown `javascript:` link lands with an empty `href`. On export, an unsafe href blanks the same way. `renderMarkdown` also percent-encodes `)` and whitespace, because the marked.js href grammar stops at both.

Typing `[text](url)` in the editor fires an input rule that writes the mark directly. That rule is always registered and carries no option — see [Caveats](#caveats).

## Advanced

Cross-popover primitives and lifecycle APIs live here. Use them to build a popover that is not anchored to a hyperlink, or to observe popover state from outside the editor.

### Floating-popover primitive

`createPopover(options)` is the primitive every opener calls: Floating-UI placement, scroll-stickiness, outside-click dismissal, keyboard navigation, and registration with the [UI controller](#ui-controller). Call it directly for a popover that joins the same lifecycle without a hyperlink anchor.

The shell owns dismissal and focus. Escape hides the popover, and the shell binds it on the popover root, so focus must sit inside. An outside `mousedown` or `touchstart` hides it too, but the listeners arm 50 ms after `show()`, so a click inside that 50 ms window does not dismiss the popover. Tab and Shift-Tab cycle focus across the controls inside the popover.

`PopoverOptions` is a discriminated union — exactly one of `referenceElement` or `coordinates` is required, and the compiler enforces it.

| Field                   | Type                                         | Default                | Description                                                                                                                                                                    |
| ----------------------- | -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `referenceElement`      | `HTMLElement`                                | none                   | Element-anchor variant. Mutually exclusive with `coordinates`.                                                                                                                 |
| `coordinates`           | `{ getBoundingClientRect, contextElement? }` | none                   | Virtual-anchor variant, for example a selection anchor. `getBoundingClientRect` MUST recompute on every call.                                                                  |
| `content`               | `HTMLElement`                                | none                   | Popover content node.                                                                                                                                                          |
| `placement?`            | `Placement`                                  | `'bottom-start'`       | Floating-UI placement. The popover auto-flips to fit the viewport.                                                                                                             |
| `offset?`               | `number`                                     | `DEFAULT_OFFSET` (`8`) | Distance in px between the anchor and the popover.                                                                                                                             |
| `showArrow?`            | `boolean`                                    | `false`                | Renders an arrow pointing at the anchor.                                                                                                                                       |
| `className?`            | `string`                                     | `''`                   | Extra class on the popover root, next to `.floating-popover`.                                                                                                                  |
| `zIndex?`               | `number`                                     | `9999`                 | Stacking context for the popover.                                                                                                                                              |
| `role?`                 | `string`                                     | `undefined`            | ARIA role on the popover root. ARIA has no popover role, so pass the content's role (`toolbar`, `dialog`, …).                                                                  |
| `ariaLabel?`            | `string`                                     | `undefined`            | Accessible name set as `aria-label` on the popover root. Same ARIA axis as `role`, so your content inherits it (the prebuilt forms pass "Add link" / "Edit link").             |
| `ignoreOutsideClickOn?` | `HTMLElement \| HTMLElement[]`               | `undefined`            | Nodes that never light-dismiss the popover, such as a toggle trigger. Without a list, the `HTMLElement` `referenceElement` is ignored instead.                                 |
| `crossAxisShift?`       | `boolean`                                    | `true`                 | With `false`, `shift` moves the popover on the main axis only, so an end-aligned menu stays pinned to the anchor's end edge.                                                   |
| `onShow?`               | `() => void`                                 | `undefined`            | Fires synchronously at the end of `show()`, after the popover mounts and before the `.visible` entrance frame. Defer focus and measurement work to it (see the create opener). |
| `onHide?`               | `() => void`                                 | `undefined`            | Fires when the popover is dismissed: outside click, programmatic `hide()`, or controller replacement.                                                                          |

Returns a `Popover`:

| Member                           | Description                                                          |
| -------------------------------- | -------------------------------------------------------------------- |
| `element`                        | The popover root (`.floating-popover` div).                          |
| `show()`                         | Mounts and reveals. Idempotent, and a no-op once closed.             |
| `hide()`                         | Dismisses. Terminal once shown — build a new popover to reopen.      |
| `destroy()`                      | Tears down permanently: removes from the DOM and stops `autoUpdate`. |
| `isVisible()`                    | `true` between `show()` and `hide()` or `destroy()`.                 |
| `setContent(el)`                 | Swaps the content node in place without re-positioning.              |
| `updateReference(ref?, coords?)` | Re-anchors to a different element or virtual reference.              |

`createPopover` adopts the new instance into the controller at the end of the call, before any `show()`. Creating a second popover therefore tears the first one down, even when you never show the second.

### UI controller

`getDefaultController()` returns the owner of the floating-popover lifecycle. Subscribe to state changes from an outer toolbar, a devtools panel, or an E2E harness.

`ControllerState` is a discriminated union:

```ts
type PopoverKind = 'preview' | 'edit' | 'create' | (string & {})

type ControllerState =
  | { kind: 'idle' }
  | {
      kind: 'mounted'
      popoverKind: PopoverKind
      element: HTMLElement // popover root — for focus rings, observers, scroll-freezes
      referenceElement: HTMLElement | null // null for virtual-coords popovers
    }
```

`referenceElement` holds the anchor node for the preview popover only. Create and edit both anchor to virtual coordinates, so both report `null`.

`PopoverController`:

| Member                           | Description                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adopt(popover, kind, metadata)` | Takes ownership of a `Popover` and destroys the previous owner. Returns an unregister function. The openers call it; consumers rarely do.                                                   |
| `close()`                        | Dismisses the active popover, and does nothing when idle.                                                                                                                                   |
| `reposition(ref?, coords?)`      | Re-anchors the active popover after the underlying mark moves, such as an external edit or a document rewrite.                                                                              |
| `getState()`                     | One-shot read of `ControllerState`.                                                                                                                                                         |
| `subscribe(listener)`            | Registers a state-change listener and returns an unsubscribe function. The listener does **not** fire on subscribe — call `listener(controller.getState())` yourself for the initial state. |

One controller serves one bundle. See [Caveats](#caveats) for what that means next to another docs.plus extension.

### Tooltip primitive

`attachTooltip(target, label)` puts a hover and focus tooltip on your own button. The prebuilt popovers use the same tooltip. The bubble appears 400 ms after the pointer enters, and on keyboard focus only when the button matches `:focus-visible`.

`attachTooltip` returns a detach function, and it binds six listeners per call. Call the detach function when your popover re-renders in place, or the listeners stack on every render.

`hideTooltip()` hides the shared bubble. The bubble is per bundle, so attach and hide from the same package. Otherwise `hideTooltip()` leaves the other package's bubble on screen.

## Security

`isSafeHref` blocks the dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`) at every boundary below. The gate tests a control-stripped copy of the href. An embedded tab, newline, or control character therefore cannot hide a scheme from the gate, and the gate catches `java\tscript:` even though browsers resolve it as `javascript:`.

- **Parse** — `parseHTML` drops the mark on any `<a href>` whose scheme is blocked, on document load and on paste. The text survives; only the link goes.
- **Import** — `parseMarkdown` normalizes the href and stores an empty string when the scheme is blocked. Both import paths apply the `isSafeHref` floor alone, so a tightened `isAllowedUri` never strips marks from existing documents.
- **Write** — the input rule, paste rule, paste handler, autolink, `setHyperlink`, `toggleHyperlink`, and `editHyperlink` all route through the composed gate.
- **Serialize** — `renderHTML` re-checks `isSafeHref` and emits an empty `href` when a hostile mark reaches it through a legacy migration, a raw `addMark`, or Yjs replay. `renderMarkdown` blanks the same way.
- **Navigate** — primary click, middle-click (`auxclick`), touch, and the preview popover's href link all gate `window.open(…)` on the composed gate. They also pass `'noopener,noreferrer'`, so an opened tab cannot read `window.opener` or leak the Referer.

On the read side, the click handlers prefer the stored mark attribute over the DOM `link.href` property. A relative href injected through `setContent` therefore does not resolve against the host page's origin.

`isSafeHref(href)` and `DANGEROUS_SCHEME_RE` are exported for a custom popover that needs the same check. Prefer `isSafeHref`, because it returns a TypeScript type guard.

`SAFE_WINDOW_FEATURES` is the `'noopener,noreferrer'` string the package passes as the third argument of every `window.open` call. Pin the same constant in your own popovers and click handlers, so a future tightening propagates from one place.

## Migrating from 1.x

`2.0` redesigns the public surface. Option names, command names, CSS class names, the popover contract, and URL validation all changed.

**Options and commands.**

| `1.x`                                | `2.0`                           |
| ------------------------------------ | ------------------------------- |
| `autoHyperlink`                      | `autolink`                      |
| `hyperlinkOnPaste`                   | `linkOnPaste`                   |
| `editHyperLinkText`                  | `editHyperlinkText`             |
| `editHyperLinkHref`                  | `editHyperlinkHref`             |
| `tr.setMeta('preventAutoHyperlink')` | `tr.setMeta('preventAutolink')` |

The package augments the commands under the `hyperlink:` key, not `link:`. `setHyperlink()` with no arguments no longer opens UI — call `openCreateHyperlinkPopover()` instead.

**CSS class names.** camelCase became kebab-case, and the shell prefix changed from `.floating-toolbar` to `.floating-popover`.

| `1.x`                       | `2.0`                        |
| --------------------------- | ---------------------------- |
| `.floating-toolbar`         | `.floating-popover`          |
| `.floating-toolbar-arrow`   | `.floating-popover-arrow`    |
| `.floating-toolbar-content` | `.floating-popover-content`  |
| `.hyperlinkCreatePopover`   | `.hyperlink-create-popover`  |
| `.hyperlinkPreviewPopover`  | `.hyperlink-preview-popover` |
| `.hyperlinkEditPopover`     | `.hyperlink-edit-popover`    |
| `.buttonsWrapper`           | `.buttons-wrapper`           |
| `.inputsWrapper`            | `.inputs-wrapper`            |
| `.textWrapper`              | `.text-wrapper`              |
| `.hrefWrapper`              | `.href-wrapper`              |
| `.backButton`               | `.back-button`               |
| `.btn_applyModal`           | `.apply-button`              |

**Popover API.** The v1 split between "popover" and "floating-toolbar" is gone.

| `1.x`                                     | `2.0`                                                      |
| ----------------------------------------- | ---------------------------------------------------------- |
| `createFloatingToolbar(opts)`             | `createPopover(opts)`, same shape minus `surface`          |
| `hideCurrentToolbar()`                    | `getDefaultController().close()`                           |
| `updateCurrentToolbarPosition(ref?)`      | `getDefaultController().reposition(ref?)`                  |
| `FloatingToolbarOptions` / `…Instance`    | `PopoverOptions` / `Popover`                               |
| `HyperlinkUIController`                   | `PopoverController`                                        |
| `SurfaceKind`                             | `PopoverKind`                                              |
| `EditHyperlinkPopoverOptions` / `…Modal…` | `EditHyperlinkOptions`                                     |
| `state.surface`                           | `state.popoverKind`, plus `element` and `referenceElement` |

Slot factories return `HTMLElement | null` instead of `void`, and `PreviewHyperlinkOptions.attrs` is now required. The stylesheet no longer auto-injects — add `import '@docs.plus/extension-hyperlink/styles.css'` at app bootstrap when you use the prebuilt popovers.

**Behavior differences.** Audit any fixture or seeded content that relied on the old behavior.

- The package rejects `javascript:`, `data:`, and `vbscript:` URLs at load, paste, input rule, click, and popover open, and drops stored ones.
- `validateURL` requires a plausible host for a web scheme, so `https://googlecom` no longer autolinks.
- `localhost:3000` and `mydomain.com:8080` now read as host:port, and canonicalize to `https://localhost:3000` and `https://mydomain.com:8080`.
- `SpecialUrlIcon` is gone, along with `SpecialUrlInfo.icon`. Map `SpecialUrlInfo.type` to your own renderer — see [Scheme classification](#scheme-classification).
- Two `SpecialUrlInfo.type` values were renamed: `'tv'` → `'apple-tv'`, and `'appstore'` → `'app-store'`.

The full breaking-change list, with a one-shot rename script, is in the [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/CHANGELOG.md#migrating-from-1x-to-20).

## TypeScript

The package bundles the type definitions. The complete public surface, grouped by role:

- **Extension** — `Hyperlink`, also the default export. Types `HyperlinkOptions`, `HyperlinkAttributes`, `HyperlinkStorage`, `HyperlinkPublicCommands`, `SetHyperlinkAttributes`, `EditHyperlinkAttributes`, `IsAllowedUriContext`, `LinkProtocolOptions`. `HyperlinkAttributes` is generic. `HyperlinkAttributes<{ ariaLabel: string }>` extends the built-in `href` / `target` / `rel` / `class` / `title` / `image` keys with your own typed fields. The default parameter is `Record<string, unknown>`, so the unparameterized type stays open; supplying your own `Extra` replaces it and closes the type.
- **Popover factories** — `previewHyperlinkPopover`, `createHyperlinkPopover`, `editHyperlinkPopover`. Types `PreviewHyperlinkOptions`, `CreateHyperlinkOptions`, `EditHyperlinkOptions`, documented under [Popover-factory option shapes](#popover-factory-option-shapes).
- **Openers** — `openPreviewHyperlink`, `openEditHyperlink`, `openCreateHyperlink`, `buildPreviewOptionsFromAnchor`. Type `BuildPreviewOptionsFromAnchorArgs`. See [Openers](#openers).
- **Floating-popover primitive** — `createPopover`, `DEFAULT_OFFSET`. Types `Popover`, `PopoverOptions`. See [Floating-popover primitive](#floating-popover-primitive).
- **UI controller** — `getDefaultController`. Types `PopoverController`, `PopoverKind`, `ControllerState`, `AdoptMetadata`, `VirtualCoordinates`. See [UI controller](#ui-controller).
- **Tooltip primitive** — `attachTooltip`, `hideTooltip`, re-exported from the bundled `@docs.plus/floating-tooltip`. See [Tooltip primitive](#tooltip-primitive).
- **URL utilities** — `normalizeHref`, `getSpecialUrlInfo`, `validateURL`, `isSafeHref`, `DANGEROUS_SCHEME_RE`, `SAFE_WINDOW_FEATURES`. Types `SpecialUrlInfo`, `SpecialUrlType`, `LinkifyMatchLike`, `ValidateURLOptions`.
- **DOM helpers** — `copyToClipboard(text, callback?)` writes `text` to the clipboard and reports success through `callback`. `createHTMLElement(tag, props?)` builds one element and assigns `props` onto it. The SVG icon factories `Copy`, `LinkOff`, `Pencil` take `IconProps`. The prebuilt preview toolbar renders those three icons; reuse them for visual parity.
- **Linkify re-export** — `registerCustomProtocol`, passed through from [linkifyjs](https://linkify.js.org).

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
