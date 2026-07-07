# Changelog

All notable changes to `@docs.plus/extension-indent` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-06-16

First npm release since `0.1.1`. The major aligns the package with the docs.plus extension-family `2.x` line; the `0.2.0` milestone below never shipped, so everything since `0.1.1` lands here.

### Highlights

- **Tab / Shift-Tab precedence** — list sink/lift and table-cell navigation run before literal indent; `0.1.1` always inserted `indentChars` on Tab.
- **`allowedIndentContexts` allowlist** — literal indent applies only in explicit `{ textblock, parent }` pairs (default: `paragraph` under `doc` or `blockquote`).
- **Multiline-safe position math** — select-all and mid-word selections clamp to textblock boundaries; outdent no longer eats hard breaks.
- **Jest matrix + clean-room Cypress** — `allowedIndentContexts` behavior table in Jest; real keypresses against built `dist/` on port 5175.

### Breaking

- `allowedNodeTypes` is replaced by `allowedIndentContexts`, an explicit allowlist of `{ textblock, parent }` type-name pairs (default: `paragraph` under `doc` or `blockquote`). Map each old name to one pair per parent — `['paragraph']` → `[{ textblock: 'paragraph', parent: 'doc' }]` — and note that `[]` now disables literal indent instead of allowing it everywhere. Migration guide in the README.
- The `IndentContext` helper type (resolved textblock + parent at a position) is no longer exported from the package root; `IndentContextRule` and `IndentOptions` remain.
- `allowedIndentContexts` is required on the resolved `IndentOptions` type. `configure()` still accepts partials; the default allowlist is unchanged.

### Migrating from 0.1.x

Map each `allowedNodeTypes` name to one `{ textblock, parent }` pair per parent you need:

```ts
// 0.1.x
Indent.configure({ allowedNodeTypes: ['paragraph'] })
// 2.x
Indent.configure({
  allowedIndentContexts: [{ textblock: 'paragraph', parent: 'doc' }]
})
```

`[]` now disables literal indent instead of allowing it everywhere.

If you imported the `IndentContext` helper type, remove the import or define the shape locally — `IndentContextRule` and `IndentOptions` remain exported:

```ts
// 0.1.x
import type { IndentContext } from '@docs.plus/extension-indent'
// 2.x
type IndentContext = { textblockName: string; parentName: string }
```

No action is needed for `allowedIndentContexts` becoming required on the resolved `IndentOptions` type — `configure()` still accepts partials and the default allowlist is unchanged.

### Fixed

- Tab / Shift-Tab table-cell delegation never fired — `editor.can()` is now invoked, so `goToNextCell` / `goToPreviousCell` run when a table extension is present.
- Shift-Tab with the caret at the very start of an indented line now removes the line's leading indent. It was a no-op: the `removeLeading` branch checked the text _before_ the caret, which is always empty at line start.
- Outdent no longer deletes hard breaks (or other zero-width inline nodes) in place of indent characters — delete windows are verified against document text in both caret and multiline paths.
- Multiline operations clamp the first line to its textblock start — mid-word selection starts no longer inject indent mid-word, and select-all (`AllSelection`) indents eligible blocks.

### Internal

- The published manifest no longer declares `engines` — the monorepo's Node floor gated engine-strict consumer installs even though the shipped bundle is plain browser-targeted ESM/CJS.
- Added a clean-room Cypress E2E suite (`@docs.plus/playground`, port 5175) running real keypresses against the built `dist/` — paragraph indent/outdent, reversibility, multiline position math, and the disabled-context gate. The Jest suite keeps ownership of the full `allowedIndentContexts` matrix.

## [0.2.0]

Internal milestone — never published to npm. Baseline before this changelog: literal indent/outdent gated by `allowedIndentContexts` (a `(textblock, parent)` allowlist), with Tab / Shift-Tab precedence delegating to list sink/lift and table-cell navigation before literal indent.
