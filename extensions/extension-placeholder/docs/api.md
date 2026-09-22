# API reference

Part of the [`@docs.plus/extension-placeholder` README](../README.md).

## Options

`.configure({ … })` accepts these four options and nothing else.

| Option                 | Type                                                    | Default               | Description                                                                                                             |
| ---------------------- | ------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `placeholder`          | `((props: PlaceholderRenderProps) => string) \| string` | `'Write something …'` | Hint text, or a callback that returns it per textblock. See [`placeholder`](#placeholder).                              |
| `emptyNodeClass`       | `string`                                                | `'is-empty'`          | Class the extension adds to the empty textblock at the cursor, and to every empty ancestor wrapper above it.            |
| `emptyEditorClass`     | `string`                                                | `'is-editor-empty'`   | Extra class next to `emptyNodeClass` while the whole document is empty. The extension never adds it to the editor root. |
| `showOnlyWhenEditable` | `boolean`                                               | `true`                | Hides the hint and both classes while the editor is read-only.                                                          |

The extension reads `showOnlyWhenEditable` at render time. `editor.setEditable()` therefore updates the hint and both classes at once, without a transaction.

### `placeholder`

A string sets one hint for every empty textblock. A callback sets the hint per textblock, and receives one object:

- `node` — the empty textblock at the cursor.
- `parentName` — type name of the parent node, for example `doc`, `listItem` or `blockquote`.
- `pos` — position of `node` inside `doc`.
- `doc` — the document the extension builds the decoration from.
- `hasAnchor` — always `true`, because the extension decorates only the empty textblock at the cursor. See the `hasAnchor` note in [Migrating from the built-in Placeholder](./migration.md#migrating-from-the-built-in-placeholder).
- `editor` — the editor instance.

The callback runs inside the plugin's `init()` and `apply()`. During `apply()` it runs before the editor commits the transaction, so resolve `pos` against the supplied `doc`, never `editor.state.doc`.

To change the hint after the editor exists, use the callback form and read the new text inside it. Then force a rebuild with the dispatch in [Caveats](#caveats).

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

`node` names the empty textblock and `parentName` names its parent, so the two answer different questions. An empty paragraph inside a list item reports `node.type.name === 'paragraph'` and `parentName === 'listItem'`.

A callback that returns `''` emits no decoration — see [Caveats](#caveats).

## Caveats

The extension adds at most one `data-placeholder` decoration per state, and it treats a node as empty only when `isNodeEmpty(node)` from `@tiptap/core` returns true.

- **Nothing renders without CSS.** The package ships no stylesheet, and the extension writes the hint text into a `data-placeholder` attribute. Add the rule in [Styling](./guide.md#styling).
- **Two placeholder extensions collide.** This extension and Tiptap's built-in both register the name `placeholder`. Tiptap logs the warning `[tiptap warn]: Duplicate extension names found: ['placeholder']. This can lead to issues.`, and both plugins decorate the document.
- **A single space counts as content.** The check is `isNodeEmpty(node)` with the default `ignoreWhitespace: false`. A paragraph holding one space, or one hard break, shows no hint.
- **`showOnlyCurrent`, `includeChildren` and `dataAttribute` do not exist.** TypeScript rejects them in a `.configure({ … })` literal. A plain JavaScript host gets no error, and the extension ignores the key. The option map in [Migrating from the built-in Placeholder](./migration.md#migrating-from-the-built-in-placeholder) gives the replacement for each one.
- **An empty hint removes the classes too.** A `placeholder` string or callback that resolves to `''` emits no decoration, so `emptyNodeClass` and `emptyEditorClass` disappear as well. Return a placeholder string of one space to keep the classes without visible text.
- **A selection at document depth hides the hint.** ⌘A or Ctrl+A produces an `AllSelection` whose anchor sits at that depth. A node selection on a top-level node does the same. The hint returns when the selection moves back into a textblock.
- **The hint stays after blur.** Nothing in the extension reads `editor.isFocused`, so the decoration survives a blur. Hide it with a CSS rule — see [Styling](./guide.md#styling).
- **Do not rely on the hint for accessibility.** It is generated content on a `::before` pseudo-element, outside the document. Set `aria-label` or `aria-placeholder` on the editable element yourself.
- **The callback runs only on a document or selection change.** The extension rebuilds when a transaction changes the document or sets the selection. Hint text from outside the document, i18n text for example, does not refresh on its own. Force a rebuild with `editor.view.dispatch(editor.state.tr.setSelection(editor.state.selection))`. The same rule keeps the hint stable under [Collaborative editing](./guide.md#collaborative-editing).

## TypeScript

`dist/index.d.ts` exports three symbols, and the options in [Options](#options) are the whole API.

Extension:

- `Placeholder` — `Extension<PlaceholderOptions, any>`, registered under the name `placeholder`.

Types:

- `PlaceholderOptions` — the four option fields.
- `PlaceholderRenderProps` — the argument the callback form of `placeholder` receives.

Nothing else exists, so this reference skips four sections:

- No `addCommands`. `editor.commands` gains nothing, so there is no Commands section.
- No `addKeyboardShortcuts` and no keydown handler. The extension binds no keys, so there is no Keyboard shortcuts section.
- No `addStorage`. `editor.storage.placeholder` holds the empty object Tiptap creates for every extension.
- No option and no attribute holds a URL, and the source calls no `window.open`, so there is no Security section.
