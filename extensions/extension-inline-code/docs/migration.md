# Migrating from `@tiptap/extension-code`

Part of the [`@docs.plus/extension-inline-code` README](../README.md).

Five steps, and one of them touches stored content.

1. Turn StarterKit's `code` mark off: `StarterKit.configure({ code: false })`. Run `npm uninstall @tiptap/extension-code` if the host installed it on its own.
2. Rename the commands: `setCode` → `setInlineCode`, `toggleCode` → `toggleInlineCode`, `unsetCode` → `unsetInlineCode`.
3. Rename the state reads: `isActive('code')` → `isActive('inlineCode')`. The rendered HTML is the same `<code>` tag either way.
4. Change the import. `@tiptap/extension-code` ships `Code` as a default export; this package exports named symbols only. Write `import { InlineCode } from '@docs.plus/extension-inline-code'`.
5. Rename the mark in stored ProseMirror JSON: `"type": "code"` becomes `"type": "inlineCode"`.

Step 5 is not optional. Once `code` is off, loading JSON that still carries a `code` mark throws `RangeError: There is no mark type code in this schema`. Tiptap then logs `Invalid content`, and the editor keeps an empty paragraph. Stored HTML needs no migration: `<p><code>render()</code></p>` parses straight to `inlineCode`.

Run this over every stored document once, before the host loads it:

```ts
type StoredNode = { marks?: { type: string }[]; content?: StoredNode[] }

function renameCodeMark<T extends StoredNode>(node: T): T {
  const next = { ...node }
  if (next.marks) {
    next.marks = next.marks.map((m) => (m.type === 'code' ? { ...m, type: 'inlineCode' } : m))
  }
  if (next.content) next.content = next.content.map(renameCodeMark)
  return next
}
```

## Behavior differences

| Behavior                               | `@tiptap/extension-code`                     | `@docs.plus/extension-inline-code`                  |
| -------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| `priority`                             | declares none, so it sorts at `100`          | `101`                                               |
| `parseHTML`                            | every `<code>` tag                           | a `<code>` tag whose parent is not `PRE`            |
| `ArrowRight` at the end of a textblock | `exitable: true` — exits and inserts a space | exits only at the document end, and inserts nothing |
| Input-rule prefix                      | an in-match capture                          | a lookbehind                                        |
| Input rule over a non-text inline node | no inline-leaf guard, so the match converts  | declines the match                                  |
| Exports                                | named symbols plus `Code` as default         | named symbols only                                  |

## The unpublished `0.x` line

docs.plus kept the `0.x` line inside the monorepo and never published it. If you used it there, drop `Mod-Shift-c`: `Mod-e` is the only toggle key.

Full breaking-change list: [CHANGELOG](../CHANGELOG.md).
