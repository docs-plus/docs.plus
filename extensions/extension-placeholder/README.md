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

Tiptap placeholder extension that shows hint text in empty nodes.

Tiptap's built-in Placeholder rescans the whole document (`doc.descendants`) on every transaction. This one decorates only the empty node at the cursor plus its empty ancestor wrappers — O(depth), not O(document) — and drops in for the built-in, with a few [deliberate differences](#differences-from-the-built-in-placeholder).

## Install

```sh
bun add @docs.plus/extension-placeholder
```

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x).

## Quickstart

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@docs.plus/extension-placeholder'

const editor = new Editor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: 'Write something …'
    })
  ]
})
```

The hint stays invisible until you add CSS — see [Styling](#styling).

## Options

| Option                 | Type                          | Default               | Description                                                                                                                |
| ---------------------- | ----------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `placeholder`          | `string \| (props) => string` | `'Write something …'` | Hint text, or a function returning it per node. The function receives `{ editor, node, pos, hasAnchor, parentName, doc }`. |
| `emptyNodeClass`       | `string`                      | `'is-empty'`          | Class on the empty node at the cursor (and on empty ancestor wrappers).                                                    |
| `emptyEditorClass`     | `string`                      | `'is-editor-empty'`   | Class added when the whole document is empty.                                                                              |
| `showOnlyWhenEditable` | `boolean`                     | `true`                | Hide the placeholder while the editor is read-only.                                                                        |

`showOnlyWhenEditable` is evaluated at render time, so `editor.setEditable()` updates the placeholder immediately.

## Styling

The package ships no CSS — the resolved hint text lands in the node's `data-placeholder` attribute. Add a rule that renders it:

```css
.ProseMirror [data-placeholder]::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  float: left;
  height: 0;
  pointer-events: none;
}
```

Target `[data-placeholder]` rather than `.is-empty`: empty ancestor wrappers (list items, blockquotes) carry the empty class without the attribute.

The `::before` hint is invisible to screen readers — label the editable element yourself, with `aria-placeholder` or `aria-label`.

## Differences from the built-in Placeholder

- The `showOnlyCurrent`, `includeChildren`, and `dataAttribute` options are ignored — the attribute is always `data-placeholder`, and the behavior is inherently current-node-only.
- A `placeholder` function returning `''` suppresses the empty classes entirely.
- Empty ancestor wrappers also receive the empty class.
- `hasAnchor` is always `true`.

## Migrating from `@tiptap/extension-placeholder`

| Built-in option    | This package                               |
| ------------------ | ------------------------------------------ |
| `showOnlyCurrent`  | Always current-node-only (no option)       |
| `includeChildren`  | Empty ancestors always get the empty class |
| `dataAttribute`    | Always `data-placeholder`                  |
| Full-document scan | O(depth) at cursor only                    |

Drop the built-in extension and add this one with the same `placeholder` string or function.

## TypeScript

Exports: `Placeholder`, `PlaceholderOptions`, `PlaceholderRenderProps` (function-form `placeholder` callback).

## Family

Sibling packages: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md).

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
