# API reference

Part of the [`@docs.plus/extension-indent` README](../README.md).

## Options

Pass any of the three options to `Indent.configure({ … })`. Every key you leave out keeps the default below.

| Option                  | Type                  | Default                                                                                         | Description                                                                                                                      |
| ----------------------- | --------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `indentChars`           | `string`              | `'  '`                                                                                          | The command inserts or removes this text per step. Two spaces by default, often `'\t'`. An empty string turns both commands off. |
| `enabled`               | `boolean`             | `true`                                                                                          | Set to `false` to turn both commands off and leave Tab unclaimed, without removing the extension.                                |
| `allowedIndentContexts` | `IndentContextRule[]` | `[{ textblock: 'paragraph', parent: 'doc' }, { textblock: 'paragraph', parent: 'blockquote' }]` | Full allowlist for literal indent and outdent. See [below](#allowedindentcontexts).                                              |

### `allowedIndentContexts`

The option sets where literal indent applies. `indent()` and `outdent()` run only when the innermost textblock at the caret and its **immediate parent** both match one rule. For a selection, the same check runs at every covered line.

Each rule is `{ textblock: string, parent: string }`. Both values are Tiptap / ProseMirror `NodeType.name` strings. So they are lowercase type names such as `paragraph` and `heading`, never HTML tags such as `H1`. `Object.keys(editor.schema.nodes)` prints every type name in the running schema.

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

**List item paragraphs.** Tab in a list item sinks the list item. `@tiptap/extension-list` binds Tab at the Tiptap default priority `100`, and this extension registers at `25`. A rule here takes effect only where sink and lift do not apply. The first item of a list has nothing to sink into, so Tab falls through to literal indent there. Under the default `nested: false`, `TaskItem` binds no Tab, and `sinkListItem('taskItem')` cannot run. So Tab in a task item always falls through to literal indent. Both `listItem` and `taskItem` hold the paragraph directly, so each needs its own rule:

```ts
Indent.configure({
  allowedIndentContexts: [
    { textblock: 'paragraph', parent: 'doc' },
    { textblock: 'paragraph', parent: 'listItem' },
    { textblock: 'paragraph', parent: 'taskItem' }
  ]
})
```

**Table cell paragraphs.** Tab in a table cell never falls through to literal indent. `@tiptap/extension-table` binds Tab at priority `100`, and it adds a row when no next cell exists. This extension's own handler also runs `goToNextCell` before `indent()`. So a `tableCell` rule takes effect through the commands, not through Tab. A header cell is a different node type, and `insertTable` adds a header row by default. So the top row needs a `tableHeader` rule:

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

Any non-empty selection indents at each line start, and it never replaces the selected text. See [Multiline selections](./guide.md#multiline-selections).

`editor.can()` runs the context gate without dispatching a transaction. Use it for the disabled state of a toolbar button:

```ts
const canIndent = editor.can().indent()
const canOutdent = editor.can().outdent()
```

Both commands return `true` only when they change the document. They return `false` in these cases:

- `enabled` is `false`, or `indentChars` is an empty string.
- The caret sits in a context no rule allows.
- A selection covers at least one line in a context no rule allows. The command rejects the whole run and leaves the document unchanged. See [Multiline selections](./guide.md#multiline-selections).
- A selection covers no line at all. A `NodeSelection` on a leaf block, such as a horizontal rule, lands here.
- `outdent()` finds no `indentChars` to remove. See [Outdent at the caret](./guide.md#outdent-at-the-caret) for the caret rules.

## Keyboard shortcuts

The extension binds two keys on the editor document.

| Shortcut    | Context    | Action            |
| ----------- | ---------- | ----------------- |
| `Tab`       | `document` | Runs `indent()`.  |
| `Shift-Tab` | `document` | Runs `outdent()`. |

Two separate orders decide what Tab does, and both matter.

**Between extensions.** The extension registers at priority `25`, below the Tiptap default `100`. Tiptap sorts extensions by descending priority, so `@tiptap/extension-list` and `@tiptap/extension-table` claim Tab first. A handler that returns `false` lets the key fall through. So this extension sees Tab only when list and table return `false`.

**Inside this extension's handler.** The handler runs a list sink, then a table move, then `indent()`. In the setup these docs describe, list and table already claimed Tab, so the first two do nothing. They cover a host that removes or overrides those Tab bindings.

When all three return `false`, the handler returns `false`, and the key falls through to other extensions and to the browser default. Tab focus navigation keeps working.

### Lists and tables

Two optional packages change what Tab does before literal indent. `@tiptap/extension-table` adds cell navigation. `@tiptap/extension-list` binds Tab sink for `listItem`, and for `taskItem` only when `TaskItem` runs `nested: true`. It always binds Shift-Tab lift. `@tiptap/starter-kit` already ships `listItem`.

## Caveats

Literal indent is text, not a node attribute, and Tab is a shared key. Both facts explain every caveat below.

- Two leading spaces can disappear on screen. The browser paints a whitespace run as one space, unless `white-space` on the editor element keeps the run. `@tiptap/core` injects that rule by default. So the indent collapses only when you pass `injectCSS: false` or override the rule. See [Styling](./guide.md#styling).
- Headings, code blocks and every textblock outside the default allowlist ignore Tab. In those textblocks Tab moves focus out of the editor, because the handler returns `false`. Add one rule for each textblock and parent you need.
- `configure({ allowedIndentContexts })` replaces the default allowlist instead of merging into it. Passing one rule drops both defaults, so list every rule you keep.
- Tab in a table cell never inserts an indent, whatever your allowlist holds. `@tiptap/extension-table` binds Tab at priority `100` and claims the key first. Call `editor.commands.indent()` from a toolbar button instead.
- `CodeBlock` with `enableTabIndentation: true` inserts its own spaces, not `indentChars`. It binds Tab at priority `100`, and it sizes the indent from its own `tabSize`. To use `indentChars` there, keep the option `false` and add a `codeBlock` rule. For a top-level code block, that rule is `{ textblock: 'codeBlock', parent: 'doc' }`.
- `indentChars: ''` is not a full off switch. Both commands return `false` on an empty string, but the Tab handler still runs the list sink and the table move. Use `enabled: false` to leave Tab unclaimed.
- `editor.getHTML()` writes the indent out, and `setContent(savedHtml)` drops it on load. HTML parsing collapses a whitespace run unless you pass `parseOptions`. See [Persistence](./guide.md#persistence).

## TypeScript

Three named exports, and nothing else:

- **Extension** — `Indent`. Its registered name is `'indent'`. `editor.extensionManager` looks it up under that name, and a preset excludes it by that name.
- **Types** — `IndentOptions` (the resolved option object) and `IndentContextRule` (`{ textblock: string; parent: string }`).

`indent` and `outdent` are declared on the Tiptap `Commands` interface. So `editor.commands.indent()` and `editor.chain().indent()` type-check after the import.

`IndentContext` is not exported from the package root.
