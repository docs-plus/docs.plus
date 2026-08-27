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

Lists, tables and the browser all claim Tab. This extension registers at priority `25`, below the Tiptap default `100`, so it sees Tab last. Its own handler then runs a list sink, a table move, and literal indent, in that order. Literal indent runs only in contexts you allowlist through [`allowedIndentContexts`](#allowedindentcontexts). The default allowlist holds two rules: paragraphs under `doc`, and paragraphs under `blockquote`. Headings, code blocks and every other textblock stay excluded until you add a rule.

## Install

```sh
bun add @docs.plus/extension-indent
```

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x).

Installs with no runtime dependencies.

Two optional packages change what Tab does before literal indent. `@tiptap/extension-table` adds cell navigation. `@tiptap/extension-list` binds Tab sink for `listItem`, and for `taskItem` only when `TaskItem` runs `nested: true`. It always binds Shift-Tab lift. `@tiptap/starter-kit` already ships `listItem`.

Coming from `0.1.x`? Read [Migrating from 0.1.x](#migrating-from-01x) first — `2.0.0` renames one option.

## Quickstart

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

The snippet keeps `indentChars` at the two-space default, and it needs no CSS — see [Styling](#styling) for the two cases that do. In React, pass the same `extensions` array to `useEditor` from `@tiptap/react`.

## Options

Pass any of the three options to `Indent.configure({ … })`. Every key you leave out keeps the default below.

| Option                  | Type                  | Default                                                                                         | Description                                                                                                                      |
| ----------------------- | --------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `indentChars`           | `string`              | `'  '`                                                                                          | The command inserts or removes this text per step. Two spaces by default, often `'\t'`. An empty string turns both commands off. |
| `enabled`               | `boolean`             | `true`                                                                                          | Set to `false` to turn both commands off and leave Tab unclaimed, without removing the extension.                                |
| `allowedIndentContexts` | `IndentContextRule[]` | `[{ textblock: 'paragraph', parent: 'doc' }, { textblock: 'paragraph', parent: 'blockquote' }]` | Full allowlist for literal indent and outdent. See [below](#allowedindentcontexts).                                              |

### `allowedIndentContexts`

The option sets where literal indent applies. `indent()` and `outdent()` run only when the innermost textblock at the caret and its **immediate parent** both match one rule. For a selection, the same check runs at every covered line.

Each rule is `{ textblock: string, parent: string }`. Both values are Tiptap / ProseMirror `NodeType.name` strings, so they are lowercase type names such as `paragraph` and `heading`, never HTML tags such as `H1`. `Object.keys(editor.schema.nodes)` prints every type name in the running schema.

The option is a full allowlist, not a merge. Passing `allowedIndentContexts` to `configure()` replaces the default allowlist, so list every rule you keep.

| You want                                                         | Rules                                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Body and blockquote paragraphs (package default)                 | `{ textblock: 'paragraph', parent: 'doc' }` and `{ textblock: 'paragraph', parent: 'blockquote' }`        |
| Body paragraphs only                                             | `{ textblock: 'paragraph', parent: 'doc' }`                                                               |
| Blockquote paragraphs only                                       | `{ textblock: 'paragraph', parent: 'blockquote' }`                                                        |
| Headings                                                         | `{ textblock: 'heading', parent: 'doc' }`                                                                 |
| List item paragraphs                                             | `{ textblock: 'paragraph', parent: 'listItem' }`                                                          |
| Table cell and header-cell paragraphs, through the commands only | `{ textblock: 'paragraph', parent: 'tableCell' }` and `{ textblock: 'paragraph', parent: 'tableHeader' }` |

**Headings.** A heading is its own textblock type, so the default allowlist skips it. Add one rule for each parent you need:

```ts
Indent.configure({
  allowedIndentContexts: [
    { textblock: 'paragraph', parent: 'doc' },
    { textblock: 'paragraph', parent: 'blockquote' },
    { textblock: 'heading', parent: 'doc' }
  ]
})
```

**List item paragraphs.** Tab in a list item sinks the list item, because `@tiptap/extension-list` binds Tab at the Tiptap default priority `100`, and this extension registers at `25`. A rule here takes effect only where sink and lift do not apply. The first item of a list has nothing to sink into, so Tab falls through to literal indent there. Under the default `nested: false`, `TaskItem` binds no Tab, and `sinkListItem('taskItem')` cannot run, so Tab in a task item always falls through to literal indent. Both `listItem` and `taskItem` hold the paragraph directly, so each needs its own rule:

```ts
Indent.configure({
  allowedIndentContexts: [
    { textblock: 'paragraph', parent: 'doc' },
    { textblock: 'paragraph', parent: 'listItem' },
    { textblock: 'paragraph', parent: 'taskItem' }
  ]
})
```

**Table cell paragraphs.** Tab in a table cell never falls through to literal indent. `@tiptap/extension-table` binds Tab at priority `100`, and it adds a row when no next cell exists. This extension's own handler also runs `goToNextCell` before `indent()`. So a `tableCell` rule takes effect through the commands, not through Tab. A header cell is a different node type, and `insertTable` adds a header row by default, so the top row needs a `tableHeader` rule:

```ts
Indent.configure({
  allowedIndentContexts: [
    { textblock: 'paragraph', parent: 'doc' },
    { textblock: 'paragraph', parent: 'tableCell' },
    { textblock: 'paragraph', parent: 'tableHeader' }
  ]
})

// Wire this to a toolbar button, not to Tab.
editor.chain().focus().indent().run()
```

**Turn literal indent off.** Pass an empty array. Tab still sinks lists and moves table cells:

```ts
Indent.configure({ allowedIndentContexts: [] })
```

## Commands

The extension registers `indent()` and `outdent()` on `editor.commands`. Both run the same `enabled`, `indentChars` and context gate as the Tab key. This extension's own handler runs the list sink and the table move before `indent()`, so a toolbar button covers contexts Tab does not.

```ts
editor.chain().focus().indent().run()
editor.chain().focus().outdent().run()
```

Any non-empty selection indents at each line start, and it never replaces the selected text. See [Multiline selections](#multiline-selections).

`editor.can()` runs the context gate without dispatching a transaction. Use it for the disabled state of a toolbar button:

```ts
const canIndent = editor.can().indent()
const canOutdent = editor.can().outdent()
```

Both commands return `true` only when they change the document. They return `false` in these cases:

- `enabled` is `false`, or `indentChars` is an empty string.
- The caret sits in a context no rule allows.
- A selection covers at least one line in a context no rule allows. The command rejects the whole run and leaves the document unchanged. See [Multiline selections](#multiline-selections).
- A selection covers no line at all. A `NodeSelection` on a leaf block, such as a horizontal rule, lands here.
- `outdent()` finds no `indentChars` to remove. See [Outdent at the caret](#outdent-at-the-caret) for the caret rules.

## Keyboard shortcuts

The extension binds two keys on the editor document.

| Shortcut    | Context    | Action            |
| ----------- | ---------- | ----------------- |
| `Tab`       | `document` | Runs `indent()`.  |
| `Shift-Tab` | `document` | Runs `outdent()`. |

Two separate orders decide what Tab does, and both matter.

**Between extensions.** The extension registers at priority `25`, below the Tiptap default `100`. Tiptap sorts extensions by descending priority, so `@tiptap/extension-list` and `@tiptap/extension-table` claim Tab first. A handler that returns `false` lets the key fall through, so this extension sees Tab only when list and table return `false`.

**Inside this extension's handler.** The handler runs a list sink, then a table move, then `indent()`. In the setup this README documents, list and table already claimed Tab, so the first two do nothing. They cover a host that removes or overrides those Tab bindings.

When all three return `false`, the handler returns `false`, and the key falls through to other extensions and to the browser default. Tab focus navigation keeps working.

## Caveats

Literal indent is text, not a node attribute, and Tab is a shared key. Both facts explain every caveat below.

- Two leading spaces can disappear on screen. The browser paints a whitespace run as one space, unless `white-space` on the editor element keeps the run. `@tiptap/core` injects that rule by default, so the indent collapses only when you pass `injectCSS: false` or override the rule. See [Styling](#styling).
- Headings, code blocks and every textblock outside the default allowlist ignore Tab. In those textblocks Tab moves focus out of the editor, because the handler returns `false`. Add one rule for each textblock and parent you need.
- `configure({ allowedIndentContexts })` replaces the default allowlist instead of merging into it. Passing one rule drops both defaults, so list every rule you keep.
- Tab in a table cell never inserts an indent, whatever your allowlist holds. `@tiptap/extension-table` binds Tab at priority `100` and claims the key first. Call `editor.commands.indent()` from a toolbar button instead.
- `CodeBlock` with `enableTabIndentation: true` inserts its own spaces, not `indentChars`. It binds Tab at priority `100`, and it sizes the indent from its own `tabSize`. To use `indentChars` there, keep the option `false` and add a `codeBlock` rule, such as `{ textblock: 'codeBlock', parent: 'doc' }` for a top-level code block.
- `indentChars: ''` is not a full off switch. Both commands return `false` on an empty string, but the Tab handler still runs the list sink and the table move. Use `enabled: false` to leave Tab unclaimed.
- `editor.getHTML()` writes the indent out, and `setContent(savedHtml)` drops it on load. HTML parsing collapses a whitespace run unless you pass `parseOptions`. See [Persistence](#persistence).

## Styling

The package ships no CSS. The default editor needs none either, because `@tiptap/core` injects `.ProseMirror { white-space: pre-wrap; white-space: break-spaces; }` while `injectCSS` stays `true`, so the editor keeps every space the command inserts.

Two cases need a host rule:

- The host passes `injectCSS: false` to the `Editor` constructor.
- A host stylesheet overrides `white-space` on `.ProseMirror`. Tiptap appends its `<style>` tag to `<head>`, so a host rule wins through a later stylesheet or a stronger selector.

Add this rule in either case:

```css
.ProseMirror {
  white-space: pre-wrap;
}
```

`white-space: break-spaces` keeps the run as well.

When the indent still collapses, read the computed `white-space` on the editor element. ProseMirror logs a console warning when that value is `normal`, `nowrap` or `pre-line`.

## Multiline selections

Every non-empty textblock the selection covers counts as one line. An empty textblock is not a line. The command skips a textblock the selection only touches at a boundary. The selection touches a boundary when the caret lands on the textblock's first position.

Lines indent and outdent at their starts, even when the selection begins or ends mid-line. The same rule covers a select-all.

`indent()` and `outdent()` apply the context gate the same way: every covered line must match `allowedIndentContexts`, or the command returns `false` and leaves the document unchanged.

They differ after that gate. `indent()` prefixes every line. `outdent()` removes `indentChars` only from the lines whose text starts with it, and leaves the rest alone. `outdent()` returns `false` only when no covered line carries an indent.

```ts
// Before, with the two-space default:
//   '  AA'
//   'BB'
editor.chain().focus().outdent().run()
// After: 'AA' and 'BB'. The second line was already flush, so it did not move.
```

A table `CellSelection` works too. It exposes only its head cell on `from` and `to`, so both commands walk `selection.ranges` instead. `indent()` over a selected cell rectangle indents every cell in it, under the same allowlist.

## Outdent at the caret

With an empty selection, `outdent()` removes one of two things:

- one `indentChars` immediately before the caret. This undoes a fresh Tab without moving the caret to column 0.
- the line's leading `indentChars`, when the caret sits at the start of an indented line.

The two cases never overlap, because the caret is either at the line start or after some text. When neither applies, the command returns `false` and changes nothing.

`outdent()` checks the document text before it deletes. So it never removes a zero-width inline node, such as a hard break, in place of indent characters.

## Persistence

Literal indent is characters in the text, not a node attribute, so it survives wherever the text survives.

`editor.getJSON()` round-trips it with no extra option. A paragraph holding `'  Hi'` serializes to `{"type":"text","text":"  Hi"}` and reloads as `'  Hi'`.

`editor.getHTML()` does not. HTML parsing collapses a whitespace run and strips the leading one, so `setContent(savedHtml)` returns the paragraph unindented. Pass `parseOptions` to keep it:

```ts
editor.commands.setContent(savedHtml, { parseOptions: { preserveWhitespace: true } })
```

The constructor loads content the same way, and `parseOptions` is a top-level field there:

```ts
const editor = new Editor({
  extensions: [StarterKit, Indent],
  content: savedHtml,
  parseOptions: { preserveWhitespace: true }
})
```

Both `true` and `'full'` keep the whitespace run. `'full'` also keeps newlines, which literal indent does not need.

## Migrating from 0.1.x

One thing changed for a `0.1.x` reader: the context option.

**`allowedIndentContexts` replaces `allowedNodeTypes`.** `0.1.x` matched a flat list of type names against the node at the caret, and an empty list allowed every context. Map each name to one `{ textblock, parent }` rule for each parent you need:

```ts
// 0.1.x
Indent.configure({ allowedNodeTypes: ['paragraph'] })
// 2.x
Indent.configure({
  allowedIndentContexts: [{ textblock: 'paragraph', parent: 'doc' }]
})
```

`[]` now disables literal indent instead of allowing it everywhere.

The `0.1.x` default was `['paragraph', 'listItem', 'orderedList']`, so list items took a literal indent on Tab when you never passed the option. In `2.x`, Tab in a list item sinks the list item. Add `{ textblock: 'paragraph', parent: 'listItem' }` only when you want literal indent there as well.

The package root exports `Indent`, `IndentContextRule` and `IndentOptions`. `IndentContext` is internal, and `0.1.x` did not export it either.

`allowedIndentContexts` is required on the resolved `IndentOptions` type. You need no action: `configure()` still accepts partials, and the default allowlist is unchanged.

Full breaking-change list: [CHANGELOG.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/CHANGELOG.md).

## TypeScript

Three named exports, and nothing else:

- **Extension** — `Indent`. Its registered name is `'indent'`. `editor.extensionManager` looks it up under that name, and a preset excludes it by that name.
- **Types** — `IndentOptions` (the resolved option object) and `IndentContextRule` (`{ textblock: string; parent: string }`).

`indent` and `outdent` are declared on the Tiptap `Commands` interface, so `editor.commands.indent()` and `editor.chain().indent()` type-check after the import.

`IndentContext` is not exported from the package root.

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-indent/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
