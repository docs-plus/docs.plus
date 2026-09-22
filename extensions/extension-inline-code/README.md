# @docs.plus/extension-inline-code

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-inline-code.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-inline-code)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-inline-code.svg)](https://npmcharts.com/compare/@docs.plus/extension-inline-code)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-inline-code.svg)](https://www.npmjs.com/package/@docs.plus/extension-inline-code)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/2EmAjmgZ8)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-inline-code/assets/preview-dark.png">
    <img alt="Inline code mark rendered as a monospace span inside a paragraph" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-inline-code/assets/preview-light.png">
  </picture>
</p>

Tiptap mark for inline code (`` `code` ``).

It takes the place of `@tiptap/extension-code` and StarterKit's `code` mark, with the same `<code>` tag and the same `Mod-e` key.

## Why use it

- **No stray space when you leave a code span.** `@tiptap/extension-code` inserts a space when `ArrowRight` exits a code span. This mark inserts no character into the document.
- **The character before the opening backtick stays plain.** Typing `` x`x` `` marks the content alone. A rule that captures that character in its match can delete or wrongly mark it.
- **No code span across a hard break or a mention.** The input rule declines a match that spans a non-text inline node. `@tiptap/extension-code` has no such check, so its rule converts the match.
- **Code spans keep their backticks in Markdown.** The mark claims the `codespan` token, so a code span survives export and import once the host loads `@tiptap/markdown`. A mark without Markdown hooks exports the text with no backticks.

## Install

```sh
npm install @docs.plus/extension-inline-code
```

Or use `pnpm add @docs.plus/extension-inline-code`, `yarn add @docs.plus/extension-inline-code`, or `bun add @docs.plus/extension-inline-code`.

Requires **`@tiptap/core` ^3.31.3** and **`@tiptap/pm` ^3.31.3** (Tiptap 3.x).

This package imports no React, Vue, or Next.js code. Use it from a plain page, Vite, React, Vue, Svelte, Next.js, Nuxt, or SvelteKit. Create the editor in the browser.

React Native has no DOM. Load the editor in a web view.

Installs with no runtime dependencies.

Also requires an engine with RegExp lookbehind: Chrome 62+, Firefox 78+, Safari and iOS Safari 16.4+.

Upgrading from `@tiptap/extension-code`? See [Migrating from `@tiptap/extension-code`](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/docs/migration.md).

## Quickstart

The host page needs one mount point: `<div id="editor"></div>`. The snippet also imports `@tiptap/starter-kit`. Add it with `npm install @tiptap/starter-kit` when your app has none yet.

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { InlineCode } from '@docs.plus/extension-inline-code'

const editor = new Editor({
  extensions: [
    // StarterKit's `code` mark claims the same `<code>` tag and the same
    // `Mod-e` key. Turn it off, or the document carries two code marks.
    StarterKit.configure({ code: false }),
    InlineCode
  ]
})
```

The snippet passes no `element`, so attach the editor to the mount point, then load a sample line:

```ts
editor.mount(document.querySelector('#editor')!)
editor.commands.setContent('<p>Call <code>render()</code> first.</p>')
```

The package ships no CSS, so the span inherits no styling of its own. Add this rule to see the span. [Styling](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/docs/guide.md#styling) has more rules.

```css
.ProseMirror :not(pre) > code {
  background: #f3f4f6;
  border-radius: 4px;
  padding: 0.15em 0.3em;
  font-size: 0.9em;
}
```

You should see one paragraph, with `render()` on a light grey background. Type text between single backticks, and the backticks go away. Select a word and press `Mod-e` (Cmd on macOS, Ctrl elsewhere) to toggle the mark. Pasted backtick text converts the same way.

## Caveats

- **Keep `StarterKit.configure({ code: false })`.** Otherwise two marks render `<code>`, and `Mod-e` over an existing `code` span stays `code`.
- **Stored JSON with a `code` mark does not load.** Once `code` is off, that JSON throws a `RangeError`, and the editor keeps an empty paragraph. Rename the mark first — see [Migrating from `@tiptap/extension-code`](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/docs/migration.md).
- **`excludes: '_'` strips every other mark.** Applying inline code drops bold, italic and links from the selection, so code text never stacks other marks. Apply inline code first, then the surrounding formatting outside the span.
- **`ArrowRight` clears the stored mark only at the document end.** At the end of a paragraph in the middle of a document the key does nothing, so the next character stays code. Press `Mod-e`, or run `toggleInlineCode()`.

The full list, with the reason for each, is in [Caveats](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/docs/api.md#caveats).

## Common tasks

### Add a toolbar button

```ts
editor.chain().focus().toggleInlineCode().run()
```

Read the active state with `editor.isActive('inlineCode')`. Gate the button with `editor.can().toggleInlineCode()`. The three commands are listed in [Commands](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/docs/api.md#commands).

### Style the mark with a class

To target the mark by class instead, set one through `HTMLAttributes` and drop the `:not(pre)` selector:

```ts
InlineCode.configure({ HTMLAttributes: { class: 'inline-code' } })
```

```css
.inline-code {
  background: #f3f4f6;
  border-radius: 4px;
  padding: 0.15em 0.3em;
}
```

### Export and import Markdown

A code span survives Markdown export and import, once the host loads `@tiptap/markdown`. The package does not load `@tiptap/markdown` itself. Add `Markdown` next to `InlineCode`, then read and write Markdown:

```ts
editor.commands.setContent('Call `render()` first.', { contentType: 'markdown' })
editor.getMarkdown() // 'Call `render()` first.'
```

The full setup is in [Markdown](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/docs/guide.md#markdown).

## Documentation

| Guide                                                                                                                                          | What it covers                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [API reference](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/docs/api.md)                                 | Options, commands, keyboard shortcuts, the full caveats list, and TypeScript exports             |
| [Guide](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/docs/guide.md)                                       | Styling, input and paste rules, a custom delimiter, and Markdown                                 |
| [Migrating from `@tiptap/extension-code`](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/docs/migration.md) | Moving from `@tiptap/extension-code`: five steps, a stored-JSON rename, and behavior differences |
| [Changelog](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/CHANGELOG.md)                                    | Every release and its breaking changes                                                           |

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
