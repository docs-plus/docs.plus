# Migrating from 0.1.x

Part of the [`@docs.plus/extension-indent` README](../README.md).

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

The `0.1.x` default was `['paragraph', 'listItem', 'orderedList']`. So list items took a literal indent on Tab when you never passed the option. In `2.x`, Tab in a list item sinks the list item. Add `{ textblock: 'paragraph', parent: 'listItem' }` only when you want literal indent there as well.

The package root exports `Indent`, `IndentContextRule` and `IndentOptions`. `IndentContext` is internal, and `0.1.x` did not export it either.

`allowedIndentContexts` is required on the resolved `IndentOptions` type. You need no action: `configure()` still accepts partials, and the default allowlist is unchanged.

Full breaking-change list: [CHANGELOG.md](../CHANGELOG.md).
