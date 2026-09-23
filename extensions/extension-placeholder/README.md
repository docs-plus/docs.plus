# @docs.plus/extension-placeholder

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-placeholder.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-placeholder)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-placeholder.svg)](https://npmcharts.com/compare/@docs.plus/extension-placeholder)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-placeholder.svg)](https://www.npmjs.com/package/@docs.plus/extension-placeholder)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/2EmAjmgZ8)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-placeholder/assets/preview-dark.png">
    <img alt="Empty editor showing placeholder hint text in the first paragraph" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-placeholder/assets/preview-light.png">
  </picture>
</p>

Tiptap placeholder extension that shows hint text in the empty textblock at the cursor.

A textblock is a node that holds inline text, such as a paragraph or a heading.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/docs-plus/docs.plus/tree/main/extensions/extension-placeholder/examples/vanilla?file=main.ts)

## Why use it

- **Cost tracks cursor depth, not document length.** Tiptap's built-in Placeholder scans every top-level block with `doc.descendants` on every editor update. This package walks up from the cursor instead.
- **Migration starts with one import swap.** Four of the built-in's seven options keep their names and defaults. The callback form also receives `parentName` and `doc`.
- **Nested blocks work with no extra option.** An empty paragraph inside a list item or blockquote gets the hint. The built-in needs `includeChildren` for that.
- **Metadata-only transactions skip the rebuild.** An awareness ping in a collaborative editor keeps the previous decoration set. The built-in re-evaluates the `placeholder` callback on every editor update.

## Install

```sh
npm install @docs.plus/extension-placeholder
```

Or use `pnpm add @docs.plus/extension-placeholder`, `yarn add @docs.plus/extension-placeholder`, or `bun add @docs.plus/extension-placeholder`.

Requires **`@tiptap/core` ^3.31.3** and **`@tiptap/pm` ^3.31.3** (Tiptap 3.x).

This package imports no React, Vue, or Next.js code. Use it from a plain page, Vite, React, Vue, Svelte, Next.js, Nuxt, or SvelteKit. Create the editor in the browser.

React Native has no DOM. Load the editor in a web view.

Installs with no runtime dependencies.

To move from Tiptap's built-in Placeholder, see [Migrating from the built-in Placeholder](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/docs/migration.md#migrating-from-the-built-in-placeholder).

## Quickstart

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/docs-plus/docs.plus/tree/main/extensions/extension-placeholder/examples/vanilla?file=main.ts)

Run this Quickstart in your browser first, with nothing to install. The app lives in [`examples/vanilla`](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-placeholder/examples/vanilla).

Register `Placeholder` in the extensions array and set the hint text. The host page needs one mount point: `<div id="editor"></div>`. The snippet also imports `@tiptap/starter-kit`. Add it with `npm install @tiptap/starter-kit` when your app has none yet.

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@docs.plus/extension-placeholder'

const editor = new Editor({
  element: document.querySelector('#editor')!,
  extensions: [
    StarterKit,
    // StarterKit does not include a placeholder extension.
    // If your array already holds Tiptap's built-in Placeholder, remove it.
    // Register one placeholder extension, never both.
    Placeholder.configure({
      placeholder: 'Write something …'
    })
  ]
})
```

The package ships no CSS, so add this rule to your page to render the hint:

```css
.ProseMirror [data-placeholder]::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  float: left;
  height: 0;
  pointer-events: none;
}
```

You should see the hint `Write something …` in the empty editor as soon as the page loads. Click in the editor and type a character, and the hint disappears. Press Enter, and the hint moves to the new empty paragraph.

## Caveats

- **Nothing renders without CSS.** The package ships no stylesheet, and the extension writes the hint text into a `data-placeholder` attribute. Add the rule in [Quickstart](#quickstart).
- **Two placeholder extensions collide.** This extension and Tiptap's built-in both register the name `placeholder`. Tiptap logs the warning `[tiptap warn]: Duplicate extension names found: ['placeholder']. This can lead to issues.`, and both plugins decorate the document.
- **`showOnlyCurrent`, `includeChildren` and `dataAttribute` do not exist.** TypeScript rejects them in a `.configure({ … })` literal. A plain JavaScript host gets no error, and the extension ignores the key. The option map in [Migrating from the built-in Placeholder](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/docs/migration.md#migrating-from-the-built-in-placeholder) gives the replacement for each one.
- **The callback runs only on a document or selection change.** Hint text from outside the document, i18n text for example, does not refresh on its own. Force a rebuild with `editor.view.dispatch(editor.state.tr.setSelection(editor.state.selection))`.

The full list, with the reason for each, is in [Caveats](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/docs/api.md#caveats).

## Common tasks

### Set a hint per textblock type

A string sets one hint for every empty textblock. A callback sets the hint per textblock:

```ts
Placeholder.configure({
  placeholder: ({ node, parentName }) => {
    if (node.type.name === 'heading') return "What's the title?"
    if (parentName === 'listItem') return 'List item'
    if (parentName === 'blockquote') return 'Quote'
    return 'Can you add some further context?'
  }
})
```

An empty paragraph inside a list item reports `node.type.name === 'paragraph'` and `parentName === 'listItem'`. The callback receives four more fields, listed in [`placeholder`](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/docs/api.md#placeholder).

### Show the hint only in an empty document

Swap the selector of the Quickstart rule for the selector below:

```css
.ProseMirror .is-editor-empty[data-placeholder]::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  float: left;
  height: 0;
  pointer-events: none;
}
```

### Hide the hint when the editor has no focus

The extension has no focus option. To hide the hint while the editor has no focus, add this rule:

```css
.ProseMirror:not(:focus-within) [data-placeholder]::before {
  content: none;
}
```

## Documentation

| Guide                                                                                                                                          | What it covers                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [API reference](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/docs/api.md)                                 | Options, the `placeholder` callback, the full caveats list, and TypeScript exports                                      |
| [Guide](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/docs/guide.md)                                       | How it works, Styling and class names, and collaborative editing                                                        |
| [Migrating from the built-in Placeholder](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/docs/migration.md) | Moving from Tiptap's built-in Placeholder: option map and behavior differences                                          |
| [Changelog](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/CHANGELOG.md)                                    | Every release and its breaking changes                                                                                  |
| [For AI coding agents](https://cdn.jsdelivr.net/npm/@docs.plus/extension-placeholder/README.md)                                                | This README as plain Markdown for your agent. The docs are also on [Context7](https://context7.com/docs-plus/docs.plus) |

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
