# Migration

Part of the [`@docs.plus/extension-indent` README](../README.md).

- [Migrating from 0.1.x](#migrating-from-01x)
- [Upgrading within 2.x](#upgrading-within-2x)

## Migrating from 0.1.x

For a `0.1.x` reader, these changed: the Tiptap version, the context option, the `indentCSS` export and the build files.

**Tiptap 3 is required.** `0.1.x` asked for `@tiptap/core` and `@tiptap/pm` `^2.11.5`. `2.x` needs Tiptap 3, at the range in [Install](../README.md#install). Upgrade the host first.

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

The `0.1.x` default was `['paragraph', 'listItem', 'orderedList']`. So list items took a literal indent on Tab when you never passed the option. In `2.x`, Tab in a list item sinks the item, and Shift-Tab lifts it. The first item of any list, nested or not, cannot sink. With no rule, Tab there moves focus out of the editor. Add `{ textblock: 'paragraph', parent: 'listItem' }` to give that item a literal indent. Shift-Tab still lifts the item, so remove the indent with `editor.commands.outdent()` from a toolbar button.

**`indentCSS` is gone.** `0.1.x` exported it as a `null` constant. Delete any `indentCSS` import. The package ships no CSS, so nothing replaces it.

**The UMD file and deep imports are gone.** `0.1.x` also shipped `dist/index.umd.js`. `2.x` ships ESM and CommonJS only. Its `exports` map opens only the package root and `package.json`, so import from `@docs.plus/extension-indent`.

The package root exports `Indent`, `IndentContextRule` and `IndentOptions`. `IndentContext` is internal, and `0.1.x` did not export it either.

In TypeScript, `IndentOptions` now lists `allowedIndentContexts` as a required field. `configure()` takes a partial object, so your calls still compile. Add the field only when you type a whole object as `IndentOptions`. The `2.x` default stays `paragraph` under `doc` and `paragraph` under `blockquote`.

Full breaking-change list: [CHANGELOG.md](../CHANGELOG.md).

## Upgrading within 2.x

No `2.x` release after `2.0.0` changes behaviour, options, commands or exports. Each upgrade needs only the Tiptap range below.

Pick one Tiptap version inside that range. Install every `@tiptap/*` package at exactly that version, `@tiptap/starter-kit` included, in one command. Tiptap packages pin each other exactly. For example, `@tiptap/starter-kit` `3.32.2` depends on `@tiptap/core` `3.32.2`, not on a range.

| Release | `@tiptap/core` and `@tiptap/pm` | Change                           |
| ------- | ------------------------------- | -------------------------------- |
| `2.0.0` | `^3.22.3`                       | First `2.x` release              |
| `2.1.0` | `^3.31.3`                       | Peer floor raised from `^3.22.3` |
| `2.2.0` | `^3.31.3`                       | None                             |
| `2.3.0` | `^3.32.2`                       | Peer floor raised from `^3.31.3` |

So from `2.2.0` to `2.3.0`, move every `@tiptap/*` package to one version, `3.32.2` or later. Bump this package in the same install. Your code needs no change:

```sh
npm install @tiptap/core@3.32.2 @tiptap/pm@3.32.2 @tiptap/starter-kit@3.32.2 @docs.plus/extension-indent@2.3.0
```

Add each other `@tiptap/*` package your app uses to that command, at the same version. With pnpm, Yarn or Bun, pass the same list to `pnpm add`, `yarn add` or `bun add`. Details: [CHANGELOG.md](../CHANGELOG.md).
