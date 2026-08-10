# @docs.plus/extension-inline-code

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-inline-code.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-inline-code)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-inline-code.svg)](https://npmcharts.com/compare/@docs.plus/extension-inline-code)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-inline-code.svg)](https://www.npmjs.com/package/@docs.plus/extension-inline-code)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/25JPG38J59)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-inline-code/assets/preview-dark.png">
    <img alt="Inline code mark rendered as a monospace span inside a paragraph" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-inline-code/assets/preview-light.png">
  </picture>
</p>

Tiptap mark for inline code (`` `code` ``).

It mirrors Tiptap's built-in `Code` mark — backtick input and paste rules, `<code>` rendering, `Mod-e`, and Markdown round-trip through `@tiptap/markdown`. It also keeps code-mode entry and exit out of the document. A collapsed caret enters through a ProseMirror stored mark, never a placeholder character. `ArrowRight` at the document end exits without inserting a space.

## Install

```sh
bun add @docs.plus/extension-inline-code
```

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x). Also requires an engine with RegExp lookbehind — Chrome 62+, Firefox 78+, Safari and iOS Safari 16.4+ — because the backtick rules are module-scope regex literals.

The `0.x` line was monorepo-internal and never published. Upgrading from `@tiptap/extension-code`? See [Migrating](#migrating-from-tiptapextension-code) and the [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/CHANGELOG.md#migrating-from-tiptapextension-code-and-unpublished-0x).

## Quickstart

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { InlineCode } from '@docs.plus/extension-inline-code'

const editor = new Editor({
  extensions: [
    // Disable StarterKit's built-in `code` mark — see Caveats.
    StarterKit.configure({ code: false }),
    InlineCode
  ]
})
```

Type between single backticks (`` `like this` ``) to format text as inline code; pasted backtick text converts the same way.

## Options

| Option           | Type                  | Default | Description                                    |
| ---------------- | --------------------- | ------- | ---------------------------------------------- |
| `HTMLAttributes` | `Record<string, any>` | `{}`    | Attributes merged onto rendered `<code>` tags. |

```ts
InlineCode.configure({
  HTMLAttributes: { class: 'my-custom-class' }
})
```

## Commands

| Command              | Description      |
| -------------------- | ---------------- |
| `setInlineCode()`    | Apply the mark.  |
| `toggleInlineCode()` | Toggle the mark. |
| `unsetInlineCode()`  | Remove the mark. |

On a collapsed caret, `setInlineCode()` and `toggleInlineCode()` turning it on seed a stored mark, so the next character you type is code. No placeholder character enters the document. `unsetInlineCode()` and toggling off clear that stored mark, so the next character is plain.

## Keyboard shortcuts

| Shortcut     | Action                                                                      |
| ------------ | --------------------------------------------------------------------------- |
| `Mod-e`      | Toggle inline code.                                                         |
| `ArrowRight` | At the end of the document, leave code mode so the next character is plain. |

## Caveats

- `excludes: '_'` — applying inline code removes every other mark from the selection (bold, italic, links); code text never stacks other marks. Upstream `@tiptap/extension-code` parity.
- StarterKit's `code` mark claims the same `<code>` tag and `Mod-e`. InlineCode registers at priority 101 and wins backtick input, paste, and `Mod-e`. Because the marks exclude each other, `toggleInlineCode` over a `code` span **replaces** `code` with `inlineCode`. The result is visually identical (both render `<code>`), but `isActive('code')` flips to `isActive('inlineCode')`. Keep the schema to a single `<code>` mark with `StarterKit.configure({ code: false })`.
- `code: true` on the mark spec suppresses other extensions' input rules (typography, bold) inside code spans.
- `Mod-e` is the only toggle chord — `Mod-Shift-c` was removed in 2.0.0.

## Migrating from `@tiptap/extension-code`

1. `StarterKit.configure({ code: false })`.
2. Replace `toggleCode` / `setCode` with `toggleInlineCode` / `setInlineCode`.
3. Drop `Mod-Shift-c` from docs — only `Mod-e` remains.

## TypeScript

Exports (all named): `InlineCode`, `InlineCodeOptions`, `inputRegex`, `pasteRegex`. Commands: `setInlineCode`, `toggleInlineCode`, `unsetInlineCode`.

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
