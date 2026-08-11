# @docs.plus/extension-placeholder

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-placeholder.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-placeholder)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-placeholder.svg)](https://npmcharts.com/compare/@docs.plus/extension-placeholder)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-placeholder.svg)](https://www.npmjs.com/package/@docs.plus/extension-placeholder)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/25JPG38J59)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-placeholder/assets/preview-dark.png">
    <img alt="Empty editor showing placeholder hint text in the first paragraph" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-placeholder/assets/preview-light.png">
  </picture>
</p>

Tiptap placeholder extension that shows hint text in the empty textblock at the cursor.

A textblock is a node that holds inline text, such as a paragraph or a heading. Tiptap's built-in Placeholder scans every top-level block with `doc.descendants` on every editor update, and the whole tree when `includeChildren` is on. This package starts at the cursor and walks up, so the cost tracks the cursor depth, not the document length. It writes the hint text into a `data-placeholder` attribute on the empty textblock at the cursor. It also adds `emptyNodeClass` to every empty ancestor wrapper above that textblock. It accepts four of the built-in's seven options, and its callback form gains `parentName` and `doc`.

## Install

```sh
bun add @docs.plus/extension-placeholder
```

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x).

Installs with no runtime dependencies.

To move from Tiptap's built-in Placeholder, see [Migrating from the built-in Placeholder](#migrating-from-the-built-in-placeholder).

## Quickstart

Register `Placeholder` in the extensions array and set the hint text.

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

The snippet mounts the editor into `#editor`, so that element must exist on the page. The editor renders no hint yet, because the package ships no CSS — add the rule in [Styling](#styling).

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
- `hasAnchor` — always `true`, because the extension decorates only the empty textblock at the cursor. See the `hasAnchor` note in [Migrating from the built-in Placeholder](#migrating-from-the-built-in-placeholder).
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

- **Nothing renders without CSS.** The package ships no stylesheet, and the extension writes the hint text into a `data-placeholder` attribute. Add the rule in [Styling](#styling).
- **Two placeholder extensions collide.** This extension and Tiptap's built-in both register the name `placeholder`. Tiptap logs the warning `[tiptap warn]: Duplicate extension names found: ['placeholder']. This can lead to issues.`, and both plugins decorate the document.
- **A single space counts as content.** The check is `isNodeEmpty(node)` with the default `ignoreWhitespace: false`. A paragraph holding one space, or one hard break, shows no hint.
- **`showOnlyCurrent`, `includeChildren` and `dataAttribute` do not exist.** TypeScript rejects them in a `.configure({ … })` literal. A plain JavaScript host gets no error, and the extension ignores the key. The option map in [Migrating from the built-in Placeholder](#migrating-from-the-built-in-placeholder) gives the replacement for each one.
- **An empty hint removes the classes too.** A `placeholder` string or callback that resolves to `''` emits no decoration, so `emptyNodeClass` and `emptyEditorClass` disappear as well. Return a placeholder string of one space to keep the classes without visible text.
- **A selection at document depth hides the hint.** ⌘A or Ctrl+A produces an `AllSelection` whose anchor sits at that depth. A node selection on a top-level node does the same. The hint returns when the selection moves back into a textblock.
- **The hint stays after blur.** Nothing in the extension reads `editor.isFocused`, so the decoration survives a blur. Hide it with a CSS rule — see [Styling](#styling).
- **Do not rely on the hint for accessibility.** It is generated content on a `::before` pseudo-element, outside the document. Set `aria-label` or `aria-placeholder` on the editable element yourself.
- **The callback runs only on a document or selection change.** The extension rebuilds when a transaction changes the document or sets the selection. Hint text from outside the document, i18n text for example, does not refresh on its own. Force a rebuild with `editor.view.dispatch(editor.state.tr.setSelection(editor.state.selection))`. The same rule keeps the hint stable under [Collaborative editing](#collaborative-editing).

## Styling

The package ships no CSS.

The extension writes the resolved hint text into the `data-placeholder` attribute of the empty textblock at the cursor. Add this rule to render it:

```css
.ProseMirror [data-placeholder]::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  float: left;
  height: 0;
  pointer-events: none;
}
```

### Class names

| Name                                   | Where the extension adds it                                    | When                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-placeholder` (attribute)         | the empty textblock at the cursor only                         | the cursor sits in an empty textblock, the resolved hint text is not empty, and the editor is editable or `showOnlyWhenEditable` is `false` |
| `is-empty` (`emptyNodeClass`)          | that same textblock, and every empty ancestor wrapper above it | the same three conditions as `data-placeholder`                                                                                             |
| `is-editor-empty` (`emptyEditorClass`) | the same nodes as `is-empty`, next to it                       | the same three conditions, and the whole document is empty                                                                                  |

Target `[data-placeholder]`, not `.is-empty`. The extension adds the empty class to an empty list item or blockquote, but not the attribute. A `.is-empty::before { content: attr(data-placeholder) }` rule therefore paints an empty pseudo-element on those wrappers as well.

The extension never adds `is-editor-empty` to the editor root, because the ancestor walk stops below the document node. A `.ProseMirror.is-editor-empty` selector matches nothing.

To show the hint only while the document is fully empty, swap the selector of the rule above for the selector below:

```css
.ProseMirror .is-editor-empty[data-placeholder]::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  float: left;
  height: 0;
  pointer-events: none;
}
```

Select the empty ancestor wrappers on their own. This rule dims an empty blockquote or list item. Replace the declaration as needed:

```css
.ProseMirror blockquote.is-empty,
.ProseMirror li.is-empty {
  opacity: 0.6;
}
```

The extension has no focus option. To hide the hint while the editor has no focus, add this rule:

```css
.ProseMirror:not(:focus-within) [data-placeholder]::before {
  content: none;
}
```

## Collaborative editing

A remote edit that leaves the local selection alone keeps the hint, and moves it with the document.

The plugin rebuilds its decorations when a transaction changes the document or sets the selection. A Yjs update arrives as a document change, so the rebuild runs and the decoration follows the new position. A transaction that carries only metadata, such as an awareness ping, skips the rebuild and keeps the previous decoration set.

The decoration is local to one editor view. It never enters the document, so it never syncs to another client, and each client sees the hint at its own cursor.

The clean-room spec [cypress/e2e/external-edit.cy.ts](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/cypress/e2e/external-edit.cy.ts) covers both shapes: text inserted elsewhere, and a paragraph inserted before the empty textblock.

## Migrating from the built-in Placeholder

Tiptap 3.x ships the built-in Placeholder from `@tiptap/extensions`, subpath `./placeholder`. `@tiptap/extension-placeholder` is the older name for the same extension.

Swap the import and keep the same configuration. The options this package accepts carry the built-in's names and defaults.

```diff
- import { Placeholder } from '@tiptap/extensions'
+ import { Placeholder } from '@docs.plus/extension-placeholder'
```

Remove the built-in from the extensions array in the same change. Both register the name `placeholder`, so leaving both in place makes both decorate.

| Built-in option        | This package                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placeholder`          | Same name, same default `'Write something …'`. The callback also receives `parentName` and `doc`.                                                                                  |
| `emptyNodeClass`       | Same name, same default `'is-empty'`. The extension also adds it to every empty ancestor wrapper.                                                                                  |
| `emptyEditorClass`     | Same name, same default `'is-editor-empty'`. Unchanged: the built-in also adds it to the decorated nodes.                                                                          |
| `showOnlyWhenEditable` | Same name, same default `true`. Read at render time, so `editor.setEditable()` updates the hint and both classes at once.                                                          |
| `showOnlyCurrent`      | No option. The extension decorates only the empty textblock at the cursor.                                                                                                         |
| `includeChildren`      | No option needed. The extension adds `data-placeholder` to the empty textblock at the cursor inside a list item or blockquote too, and adds the empty class to its empty wrappers. |
| `dataAttribute`        | No option. The attribute is always `data-placeholder`.                                                                                                                             |

Five behavior differences remain after the swap:

- **Cost.** The built-in scans every top-level block with `doc.descendants` on every editor update, and the whole tree when `includeChildren` is on. This package walks from the cursor up to the first non-empty ancestor.
- **Rebuild timing.** The built-in re-evaluates the `placeholder` callback on every editor update. This package rebuilds only when a transaction changes the document or sets the selection.
- **Empty hint.** A resolved hint of `''` removes the decoration and both classes here. The built-in still emits the classes.
- **Document-depth selection.** ⌘A or Ctrl+A hides the hint here. The built-in keeps it.
- **`hasAnchor`.** Always `true` here, because the extension decorates only the empty textblock at the cursor. The built-in passes `false` when `showOnlyCurrent: false` decorates a node away from the cursor.

Class-based CSS keeps working, with one change: the extension now adds the empty class to an empty list item or blockquote as well. Add `[data-placeholder]` to the selector to reach only the textblock that holds the hint. See [Styling](#styling).

Full breaking-change list: [CHANGELOG.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/CHANGELOG.md).

## TypeScript

`dist/index.d.ts` exports three symbols, and the options in [Options](#options) are the whole API.

Extension:

- `Placeholder` — `Extension<PlaceholderOptions, any>`, registered under the name `placeholder`.

Types:

- `PlaceholderOptions` — the four option fields.
- `PlaceholderRenderProps` — the argument the callback form of `placeholder` receives.

Nothing else exists, so this README skips four sections:

- No `addCommands`. `editor.commands` gains nothing, so there is no Commands section.
- No `addKeyboardShortcuts` and no keydown handler. The extension binds no keys, so there is no Keyboard shortcuts section.
- No `addStorage`. `editor.storage.placeholder` holds the empty object Tiptap creates for every extension.
- No option and no attribute holds a URL, and the source calls no `window.open`, so there is no Security section.

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
