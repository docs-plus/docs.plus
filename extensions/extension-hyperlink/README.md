# @docs.plus/extension-hyperlink

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-hyperlink.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-hyperlink)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-hyperlink.svg)](https://npmcharts.com/compare/@docs.plus/extension-hyperlink)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-hyperlink.svg)](https://www.npmjs.com/package/@docs.plus/extension-hyperlink)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/2EmAjmgZ8)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/preview-dark.png">
    <img alt="Preview popover on a link — copy, edit, and remove actions" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-hyperlink/assets/preview-light.png">
  </picture>
</p>

Tiptap hyperlink mark with optional prebuilt popovers for creating, previewing, and editing links.

It replaces the `@tiptap/extension-link` mark that StarterKit v3 bundles.

## Why use it

- **Autolink covers more than web URLs.** As you type, bare domains get `https://`, emails become `mailto:`, and E.164 phones become `tel:`. App schemes from a catalog of 47, such as `whatsapp://`, autolink too.
- **The link UI is included.** Prebuilt create, preview, and edit popovers ship with the package. `Mod-k` opens the create-link form with no configuration. `@tiptap/extension-link` binds no keyboard shortcut.
- **Every boundary checks the scheme.** `isSafeHref` blocks `javascript:`, `data:`, `vbscript:`, `file:`, and `blob:` on parse, import, write, serialize, and navigation. An embedded tab or newline cannot hide a scheme from the gate.
- **Your `@tiptap/extension-link` configuration ports over.** `isAllowedUri` takes the same `(uri, ctx)` shape as `@tiptap/extension-link`, so an existing policy works unchanged. `setLink`, `unsetLink`, and `toggleLink` stay as aliases. `[label](url)` round-trips with `@tiptap/markdown`.

## Install

```sh
npm install @docs.plus/extension-hyperlink
```

Or use `pnpm add @docs.plus/extension-hyperlink`, `yarn add @docs.plus/extension-hyperlink`, or `bun add @docs.plus/extension-hyperlink`.

Requires **`@tiptap/core` ^3.31.3** and **`@tiptap/pm` ^3.31.3** (Tiptap 3.x).

This package imports no React, Vue, or Next.js code. Use it from a plain page, Vite, React, Vue, Svelte, Next.js, Nuxt, or SvelteKit. Create the editor in the browser.

React Native has no DOM. Load the editor in a web view.

Installs two runtime dependencies, `@floating-ui/dom` and `linkifyjs`. The popover engine and the tooltip ship inside `dist`, so they add no third package.

Upgrading from `1.x`? Option names, command names, and CSS class names all changed — see [Migrating from 1.x](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/migration.md#migrating-from-1x).

## Quickstart

The host page needs one mount point: `<div id="editor"></div>`. The snippet also imports `@tiptap/starter-kit`. Add it with `npm install @tiptap/starter-kit` when your app has none yet.

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

The `styles.css` import is optional. The snippet also styles no document link — see [Popovers](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/popovers.md) and [Style document links](#style-document-links).

You should see a paragraph with one link. Click the link to open the preview popover, with copy, edit, and remove actions. Type `example.org` and a space, and the text becomes a link. Select a word and press `Mod-k` (Cmd on macOS, Ctrl elsewhere) to open the create-link form.

## Caveats

- **`StarterKit.configure({ link: false })` is required, not stylistic.** StarterKit v3 bundles `@tiptap/extension-link` by default. The two marks collide on the `setLink` / `unsetLink` / `toggleLink` command names and on the `a[href]` parse rule. Your `extensions` array order then decides each contest, with no warning. If the upstream mark wins, this package's `isSafeHref` gate never runs on parsed or pasted HTML, and its popovers never attach.
- **A click on a link needs `popovers.previewHyperlink`.** The three openers fall back to the prebuilt factory when a slot is `null`. The click handler does not: leave `previewHyperlink` at `null` and a click on a link opens no popover.
- **`linkOnPaste: false` does not stop every paste from linking.** The linkify paste rule stays registered, so a pasted bare URL still becomes a link. To stop that path too, set `shouldAutoLink: () => false`, which every autolink path consults.
- **`HTMLAttributes.target` reaches the DOM.** `HTMLAttributes: { target: '_blank' }` does emit `<a target="_blank">`. A browser-driven `target="_blank"` navigation skips the click gate. Leave `target` at `null` and let the click handler open the link.

The full list, with the reason for each, is in [Caveats](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/api.md#caveats).

## Common tasks

### Set a link from your own button

Every command lands on `editor.commands` and on `editor.chain()`. On `editor.commands`, each returns `boolean`, and `false` marks a no-op.

```ts
editor.chain().focus().setHyperlink({ href: 'https://example.com' }).run()
editor.getAttributes('hyperlink').href // read the current href
```

`setHyperlink` returns `false` when `href` is empty, when the [composed gate](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/api.md#validate-vs-isalloweduri) rejects it, or when the schema cannot apply the mark there. See [Commands](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/api.md#commands) for the full list.

### Open the create-link form

`Mod-k` calls this command. Call it from your own toolbar button too:

```ts
editor.commands.openCreateHyperlinkPopover()
```

`openCreateHyperlinkPopover` opens UI, so `editor.can().openCreateHyperlinkPopover()` reports availability without mounting anything. With nothing selected, the prebuilt form inserts the typed URL as its own link text.

### Style document links

The `styles.css` stylesheet skins the popovers only. The mark renders a plain `<a>` with no class, so style your document links yourself:

```ts
Hyperlink.configure({ HTMLAttributes: { class: 'my-link' } })
```

```css
a.my-link {
  color: #2563eb;
  text-decoration: underline;
}
```

For theme tokens, dark mode, and class names, see [Styling](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/styling.md).

## Gallery

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

## Documentation

| Guide                                                                                                                   | What it covers                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [API reference](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/api.md)            | Options, commands, keyboard shortcuts, the full caveats list, server bundles, and TypeScript exports |
| [Popovers](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/popovers.md)            | The three popover slots, factory option shapes, openers, and custom popovers                         |
| [Styling](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/styling.md)              | The stylesheet, `--hl-*` theme tokens, dark mode, and class names                                    |
| [URL handling](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/url-handling.md)    | Href normalization, scheme classification, and Markdown round-trip                                   |
| [Security](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/security.md)            | The dangerous-scheme gate at each boundary, and the exported safety helpers                          |
| [Advanced](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/advanced.md)            | The floating-popover primitive, the UI controller, and the tooltip primitive                         |
| [Migrating from 1.x](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/migration.md) | Renamed options, commands, CSS classes, and popover APIs                                             |
| [Changelog](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/CHANGELOG.md)               | Every release and its breaking changes                                                               |

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
