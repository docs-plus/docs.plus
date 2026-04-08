# @docs.plus/extension-indent

Tiptap extension that adds **line-prefix** indent and outdent: each step inserts or removes a configured string (`indentChars`, default two spaces) at line starts when the caret (or each line of a multi-line selection) sits in an allowed **textblock + parent** context (see `allowedIndentContexts` below).

By default, only **`paragraph`** under **`doc`** or **`blockquote`** is allowed. Any other textblock (e.g. `heading`, `codeBlock`) is excluded until you add an explicit rule. **Tab / Shift-Tab** still run first through list and table behavior when those extensions are present (see [Keyboard](#keyboard) below).

## Requirements

Peer dependencies (your app should already include them):

- `@tiptap/core` ^3.20.4
- `@tiptap/pm` ^3.20.4

Optional: `@tiptap/extension-table` for cell navigation on Tab; list extensions (`listItem` / `taskItem`) for sink/lift before literal indent.

## Installation

In this monorepo, from the root:

```bash
bun install
```

Published installs use the same package name; align TipTap versions with the peer range above.

## Usage

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Indent } from '@docs.plus/extension-indent'

new Editor({
  extensions: [StarterKit, Indent.configure({ indentChars: '\t' })]
})
```

`Indent.configure({})` merges with extension defaults (see [Options](#options)).

### `allowedIndentContexts`

Literal `indent()` / `outdent()` only run when the innermost textblock at the caret/line and its **immediate parent** match one of the rules. Each rule is `{ textblock: string, parent: string }` (TipTap / ProseMirror `NodeType.name`).

The list is a **full** allowlist: TipTap merges `configure({ … })` into defaults — if you pass `allowedIndentContexts`, it **replaces** the default array; list every `(textblock, parent)` pair you need.

| You want                                       | Add / use rules like                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Body + blockquote paragraphs (package default) | `{ textblock: 'paragraph', parent: 'doc' }` and `{ textblock: 'paragraph', parent: 'blockquote' }` |
| Body paragraphs only                           | Only `paragraph` + `doc`                                                                           |
| Blockquote paragraphs only                     | Only `paragraph` + `blockquote`                                                                    |
| List item paragraphs                           | `{ textblock: 'paragraph', parent: 'listItem' }` and/or `taskItem`                                 |
| Table cell paragraphs                          | `{ textblock: 'paragraph', parent: 'tableCell' }` (if your schema uses it)                         |
| Headings                                       | e.g. `{ textblock: 'heading', parent: 'doc' }` — type name is lowercase `heading`, not HTML `H1`   |

Pass **`[]`** to turn off **literal** indent/outdent everywhere (Tab can still sink/lift lists or move table cells).

**Migration:** older releases used `allowedParentTypes` (parent names for **`paragraph`** only). Replace each parent `p` with `{ textblock: 'paragraph', parent: p }`. If you used `allowedNodeTypes`, same migration.

### Options

| Option                  | Type                           | Default                       | Description                                                            |
| ----------------------- | ------------------------------ | ----------------------------- | ---------------------------------------------------------------------- |
| `indentChars`           | `string`                       | `'  '`                        | Inserted or removed per step (often `'\t'` or two spaces).             |
| `enabled`               | `boolean`                      | `true`                        | Disable behavior without removing the extension.                       |
| `allowedIndentContexts` | `Array<{ textblock, parent }>` | body + blockquote `paragraph` | Full allowlist of textblock + parent pairs for literal indent/outdent. |

### Keyboard

| Key           | Order of handling                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| **Tab**       | `sinkListItem` (`listItem` / `taskItem`) → `goToNextCell` (if table extension is loaded) → `indent()` |
| **Shift-Tab** | `liftListItem` → `goToPreviousCell` → `outdent()`                                                     |

The extension registers with **priority `25`** so delegated commands run first when applicable.

### Commands

```ts
editor.commands.indent()
editor.commands.outdent()
```

These respect `enabled` and the same `allowedIndentContexts` rules as the keyboard path.

### Multiline selections

Selected ranges are split into **visual lines** using `doc.textBetween(from, to, '\n')` (a single newline between blocks). **Every** line must match `allowedIndentContexts`; otherwise the command returns `false` and the document is unchanged.

### Empty selection: outdent

**Outdent** can remove:

- leading `indentChars` at the **start of the current line**, or
- a trailing prefix of `indentChars` **immediately before the caret** (e.g. undo a tab just inserted without moving to column 0).

## Testing

From `packages/extension-indent`:

```bash
bun run test
```

Jest + jsdom; config in `jest.config.cjs` (Jest stack from the monorepo root per workspace rules). Fixtures typically use `StarterKit` like a real app.

End-to-end coverage lives in `packages/webapp/cypress/e2e/editor/indent/` against the production editor stack.

## Development

```bash
bun install
bun run build
bun run dev
bun run lint
```

## License

MIT
