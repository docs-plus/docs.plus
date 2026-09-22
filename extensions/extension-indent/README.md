# @docs.plus/extension-indent

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-indent.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-indent)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-indent.svg)](https://npmcharts.com/compare/@docs.plus/extension-indent)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-indent.svg)](https://www.npmjs.com/package/@docs.plus/extension-indent)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/2EmAjmgZ8)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-indent/assets/preview-dark.png">
    <img alt="Paragraph with two-space Tab indent at the start of the line" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-indent/assets/preview-light.png">
  </picture>
</p>

Tiptap extension for literal indent: Tab inserts an indent string at the caret or at each selected line start, and Shift-Tab removes it.

## Why use it

- **Lists and tables keep Tab.** The extension registers at priority `25`, below the Tiptap default `100`. So `@tiptap/extension-list` sinks list items and `@tiptap/extension-table` moves between cells first.
- **Keyboard users can still leave the editor.** When nothing claims Tab, the key falls through to the browser default. Tab focus navigation keeps working.
- **You choose where indent applies.** The default allowlist holds two rules: paragraphs under `doc`, and paragraphs under `blockquote`. Headings, code blocks and every other textblock stay excluded until you add a rule.
- **Selections indent line by line.** Any non-empty selection indents at each line start, and it never replaces the selected text.

## Install

```sh
npm install @docs.plus/extension-indent
```

Or use `pnpm add @docs.plus/extension-indent`, `yarn add @docs.plus/extension-indent`, or `bun add @docs.plus/extension-indent`.

Requires **`@tiptap/core` ^3.31.3** and **`@tiptap/pm` ^3.31.3** (Tiptap 3.x).

This package imports no React, Vue, or Next.js code. Use it from a plain page, Vite, React, Vue, Svelte, Next.js, Nuxt, or SvelteKit. Create the editor in the browser.

React Native has no DOM. Load the editor in a web view.

Installs with no runtime dependencies.

Coming from `0.1.x`? Read [Migrating from 0.1.x](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/docs/migration.md#migrating-from-01x) first — `2.0.0` renames one option.

## Quickstart

The host page needs one mount point: `<div id="editor"></div>`. The snippet also imports `@tiptap/starter-kit`. Add it with `npm install @tiptap/starter-kit` when your app has none yet.

The editor below indents body paragraphs, blockquote paragraphs and headings.

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Indent } from '@docs.plus/extension-indent'

const editor = new Editor({
  // Your page must already hold this element, or the editor never mounts.
  element: document.querySelector('#editor'),
  content: '<p>Press Tab at the start of this line.</p>',
  extensions: [
    StarterKit,
    Indent.configure({
      // This array replaces the default allowlist, so list every rule you keep.
      allowedIndentContexts: [
        { textblock: 'paragraph', parent: 'doc' },
        { textblock: 'paragraph', parent: 'blockquote' },
        { textblock: 'heading', parent: 'doc' }
      ]
    })
  ]
})
```

The snippet keeps `indentChars` at the two-space default, and it needs no CSS. See [Styling](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/docs/guide.md#styling) for the two cases that do. In React, pass the same `extensions` array to `useEditor` from `@tiptap/react`.

You should see one paragraph that asks you to press Tab. Click before its first word and press Tab: the text moves two spaces to the right. Press Shift-Tab to move it back.

## Caveats

- **Tab in a table cell never inserts an indent, whatever your allowlist holds.** Call `editor.commands.indent()` from a toolbar button instead.
- **`configure({ allowedIndentContexts })` replaces the default allowlist instead of merging into it.** Passing one rule drops both defaults, so list every rule you keep.
- **Headings, code blocks and every textblock outside the default allowlist ignore Tab.** In those textblocks Tab moves focus out of the editor, because the handler returns `false`. Add one rule for each textblock and parent you need.
- **`editor.getHTML()` writes the indent out, and `setContent(savedHtml)` drops it on load.** See [Keep the indent in saved HTML](#keep-the-indent-in-saved-html).

The full list, with the reason for each, is in [Caveats](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/docs/api.md#caveats).

## Common tasks

### Add toolbar buttons

Both commands run the same `enabled`, `indentChars` and context gate as the Tab key.

```ts
editor.chain().focus().indent().run()
editor.chain().focus().outdent().run()
```

`editor.can()` runs the context gate without dispatching a transaction. Use it for the disabled state of a toolbar button:

```ts
const canIndent = editor.can().indent()
const canOutdent = editor.can().outdent()
```

See [Commands](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/docs/api.md#commands) for the cases where both return `false`.

### Keep the indent in saved HTML

HTML parsing collapses a whitespace run and strips the leading one. Pass `parseOptions` to keep it:

```ts
editor.commands.setContent(savedHtml, { parseOptions: { preserveWhitespace: true } })
```

`editor.getJSON()` round-trips the indent with no extra option. See [Persistence](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/docs/guide.md#persistence).

### Indent with a tab character

`indentChars` sets the text each step inserts or removes. Two spaces is the default, and `'\t'` is a common choice:

```ts
Indent.configure({ indentChars: '\t' })
```

## Documentation

| Guide                                                                                                                  | What it covers                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [API reference](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/docs/api.md)              | Options, `allowedIndentContexts` recipes, commands, keyboard shortcuts and Tab order, the full caveats list, TypeScript |
| [Guide](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/docs/guide.md)                    | Styling, multiline selections, outdent at the caret, persistence                                                        |
| [Migrating from 0.1.x](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/docs/migration.md) | `allowedNodeTypes` to `allowedIndentContexts`, the changed defaults                                                     |
| [Changelog](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/CHANGELOG.md)                 | Every release and its breaking changes                                                                                  |

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
