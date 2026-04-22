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
| `defaultProtocol`      | `string`                                  | `'https'`                                 | Scheme used by `normalizeHref` when promoting bare domains (`example.com` → `${defaultProtocol}://example.com`).                                                                                                                                 |
| `isAllowedUri`         | `(uri, ctx) => boolean`                   | —                                         | Optional URI policy hook. Runs AFTER the built-in `isSafeHref` gate (so dangerous schemes are always blocked) and BEFORE the mark is written. `ctx` mirrors `extension-link`.                                                                    |
| `shouldAutoLink`       | `(uri) => boolean`                        | —                                         | Optional per-link autolink veto. Called for every candidate the autolink plugin and paste rules detect; return `false` to skip autolinking that specific URI.                                                                                    |
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
  HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
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
3. **Bring your own popover** — each popover is a factory that returns an `HTMLElement`. The extension handles positioning, outside-click dismissal, keyboard navigation, and cleanup.

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
  link.rel = 'noreferrer'

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

Popover content can control the floating toolbar via `hideCurrentToolbar()` and `updateCurrentToolbarPosition(ref)`, both exported from the package.

## Styling

The prebuilt popovers ship with a small, framework-agnostic stylesheet. Import it once:

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

Stable class names for consumers who want to write their own rules:

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

Validation also rejects scheme-prefixed typos with no real host. `https://googlecom` fails; `http://localhost`, `https://127.0.0.1`, and any registered custom scheme pass.

For custom popovers, `normalizeHref(raw, defaultProtocol?)` is exported — pass the user's input string and it returns the canonical href the editor would have stored. (linkifyjs match objects are normalized internally; the `normalizeLinkifyHref` helper stays module-private.)

## Security

Dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`) are blocked everywhere a link enters or leaves the editor:

- `parseHTML` strips matching `<a>` tags on document load and paste.
- Every write boundary (input rule, paste rule, paste handler, `setHyperlink` / `toggleHyperlink` / `editHyperlink`, autolink) routes through the shared `isSafeHref` gate composed with the user's `isAllowedUri` policy.
- `renderHTML` re-checks `isSafeHref` on serialize — a hostile mark that ever lands in the doc (legacy migration, raw `addMark`, Yjs replay) is emitted with an empty `href` instead of round-tripping the dangerous URL.
- Click handlers (primary, middle, touch) and the preview "Open" button short-circuit `window.open(…)` for unsafe hrefs and pass `'noopener,noreferrer'` features so opened tabs cannot read `window.opener` or leak Referer.

On the read side, both click handlers prefer the stored mark attribute over the DOM `link.href` property — so a relative href injected via `setContent` won't resolve against the host page's origin.

`isSafeHref(href)` and `DANGEROUS_SCHEME_RE` are exported for custom popovers that need the same check; prefer `isSafeHref` (returns a TS type guard).

`SAFE_WINDOW_FEATURES` is also exported — it's the `'noopener,noreferrer'` features string the extension passes to every `window.open(href, '_blank', …)` call. BYO popovers and custom click-handlers should pin the same constant so a future tightening (e.g. adding `nofollow`) flows everywhere from one place:

```ts
import { isSafeHref, SAFE_WINDOW_FEATURES } from '@docs.plus/extension-hyperlink'

if (isSafeHref(href)) {
  window.open(href, '_blank', SAFE_WINDOW_FEATURES)
}
```

## TypeScript

Definitions are bundled. Public types: `HyperlinkOptions`, `HyperlinkAttributes`, `IsAllowedUriContext`, `PreviewHyperlinkOptions`, `CreateHyperlinkOptions`, `EditHyperlinkPopoverOptions` (formerly `EditHyperlinkModalOptions`, kept as a deprecated alias), `LinkProtocolOptions`, `FloatingToolbarOptions`, `FloatingToolbarInstance`, `LinkifyMatchLike`. Public utility predicates: `isSafeHref`, `validateURL`, `DANGEROUS_SCHEME_RE`. Public constant: `SAFE_WINDOW_FEATURES`.

## Testing

Cypress runs against the built `dist/` output in a tiny `Bun.serve` playground — the same bytes an npm consumer installs.

```sh
bun run test             # build + run Cypress headless
bun run test:open        # build + open the Cypress runner
bun run playground       # just the playground at http://127.0.0.1:5173
bun run docs:screenshots # regenerate README hero PNGs in docs/screenshots/
```

Append `?popover=custom` to the playground URL to swap in minimal BYO factories — that's how `custom-popover.cy.ts` exercises the public contract.

| Spec                   | Covers                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `create.cy.ts`         | `Mod+K`, Apply state, href canonicalization, host validation, dismiss. |
| `preview-edit.cy.ts`   | Click → preview → edit/copy/remove, Back, Escape lifecycle.            |
| `autolink.cy.ts`       | Autolink, paste, and `mailto:` all produce the same `href`.            |
| `xss-guards.cy.ts`     | `javascript:` / `data:` / `vbscript:` blocked at every entry point.    |
| `styling.cy.ts`        | `styles.css` loaded, `--hl-*` tokens resolve, `light-dark()` branch.   |
| `custom-popover.cy.ts` | BYO factory contract — options, mount lifecycle, exports.              |

The suite also runs from the repo root via `bun run test:all`, alongside the Jest and webapp Cypress suites.

## Community

Questions, ideas, or help with this extension? Chat with the docs.plus community on [Discord](https://discord.gg/25JPG38J59).

## Credits

Inspired by Tiptap's [@tiptap/extension-link](https://github.com/ueberdosis/tiptap/tree/main/packages/extension-link). Part of [docs.plus](https://github.com/docs-plus/docs.plus).

## License

MIT
