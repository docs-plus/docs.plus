# Migrating from the built-in Placeholder

Part of the [`@docs.plus/extension-placeholder` README](../README.md).

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

Class-based CSS keeps working, with one change: the extension now adds the empty class to an empty list item or blockquote as well. Add `[data-placeholder]` to the selector to reach only the textblock that holds the hint. See [Styling](./guide.md#styling).

Full breaking-change list: [CHANGELOG.md](../CHANGELOG.md).
