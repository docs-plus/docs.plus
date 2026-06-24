# @docs.plus/extension-indent

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-indent.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-indent)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-indent.svg)](https://npmcharts.com/compare/@docs.plus/extension-indent)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-indent.svg)](https://www.npmjs.com/package/@docs.plus/extension-indent)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/25JPG38J59)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-indent/assets/preview-dark.png">
    <img alt="Paragraph with two-space Tab indent at the start of the line" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-indent/assets/preview-light.png">
  </picture>
</p>

Tiptap extension for character-based indentation: Tab inserts `indentChars` (default two spaces) at the caret or at the start of each selected line, and Shift-Tab removes it.

Tab already belongs to lists (sink/lift), tables (cell navigation), and the browser (focus). This extension resolves the key in one predictable order — list, table, then literal indent — and runs literal indent only in contexts you allowlist via [`allowedIndentContexts`](#allowedindentcontexts): paragraphs under `doc` or `blockquote` by default, with headings, code blocks, and every other textblock excluded until you add a rule.

## Install

```sh
bun add @docs.plus/extension-indent
```

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x).

Optional: `@tiptap/extension-table` enables cell navigation on Tab; list extensions (`listItem` / `taskItem`) enable sink/lift before literal indent.

## Quickstart

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Indent } from '@docs.plus/extension-indent'

new Editor({
  extensions: [StarterKit, Indent.configure({ indentChars: '\t' })]
})
```

`Indent.configure({})` merges with the defaults in [Options](#options).

## Options

| Option                  | Type                           | Default                                | Description                                                                                        |
| ----------------------- | ------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `indentChars`           | `string`                       | `'  '` (two spaces)                    | Inserted or removed per step (often `'\t'`).                                                       |
| `enabled`               | `boolean`                      | `true`                                 | Disable behavior without removing the extension.                                                   |
| `allowedIndentContexts` | `Array<{ textblock, parent }>` | `paragraph` under `doc` / `blockquote` | Full allowlist for literal indent/outdent — see [`allowedIndentContexts`](#allowedindentcontexts). |

## Commands

```ts
editor.commands.indent()
editor.commands.outdent()
```

Both respect `enabled` and the same `allowedIndentContexts` rules as the keyboard path.

## Keyboard shortcuts

| Shortcut    | Action                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `Tab`       | `sinkListItem` (`listItem` / `taskItem`) → `goToNextCell` (when a table extension is loaded) → `indent()` |
| `Shift-Tab` | `liftListItem` → `goToPreviousCell` → `outdent()`                                                         |

The extension registers at priority `25`, below the Tiptap default of `100`, so other extensions' own Tab handlers win first. When none of the three steps applies, the handler returns `false` and the keypress falls through to other extensions and the browser default — Tab focus navigation keeps working.

## `allowedIndentContexts`

Literal `indent()` / `outdent()` run only when the innermost textblock at the caret (or at each line of a selection) and its **immediate parent** match one of the rules. Each rule is `{ textblock: string, parent: string }` (Tiptap / ProseMirror `NodeType.name`).

The list is a full allowlist, not a merge: passing `allowedIndentContexts` to `configure()` replaces the default array, so list every pair you need.

| You want                                       | Rules                                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Body + blockquote paragraphs (package default) | `{ textblock: 'paragraph', parent: 'doc' }` and `{ textblock: 'paragraph', parent: 'blockquote' }` |
| Body paragraphs only                           | Only `paragraph` + `doc`                                                                           |
| Blockquote paragraphs only                     | Only `paragraph` + `blockquote`                                                                    |
| List item paragraphs                           | `{ textblock: 'paragraph', parent: 'listItem' }` and/or `taskItem`                                 |
| Table cell paragraphs                          | `{ textblock: 'paragraph', parent: 'tableCell' }` (if your schema uses it)                         |
| Headings                                       | e.g. `{ textblock: 'heading', parent: 'doc' }` — type name is lowercase `heading`, not HTML `H1`   |

Pass `[]` to turn off literal indent/outdent everywhere — Tab still sinks lists and moves table cells.

### Migrating from 0.1.x

`allowedNodeTypes` (a flat list of type names matched against the node at the caret, where an empty list allowed every context) is gone. Map each name to one pair per parent you need:

```ts
// 0.1.x
Indent.configure({ allowedNodeTypes: ['paragraph'] })
// 2.x
Indent.configure({
  allowedIndentContexts: [{ textblock: 'paragraph', parent: 'doc' }]
})
```

`[]` now disables literal indent instead of allowing it everywhere.

## Multiline selections

Selected ranges split into visual lines using `doc.textBetween(from, to, '\n')`. Every line must match `allowedIndentContexts`; otherwise the command returns `false` and the document is unchanged. Lines indent and outdent at their starts, even when the selection begins or ends mid-line — select-all included.

## Outdent at the caret

With an empty selection, `outdent()` removes:

- the line's leading `indentChars` when the caret sits at the start of an indented line, or
- one `indentChars` immediately before the caret elsewhere — undoes a just-inserted tab without moving to column 0.

## TypeScript

Exports: `Indent` (default), `IndentOptions`, `IndentContextRule`. Configure with `Indent.configure({ indentChars, allowedIndentContexts })`.

## Family

Sibling packages: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md).

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
