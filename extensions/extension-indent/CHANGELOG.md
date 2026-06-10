# Changelog

All notable changes to `@docs.plus/extension-indent` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-06-10

First npm release since `0.1.1`. The major aligns the package with the docs.plus extension-family `2.x` line; the `0.2.0` milestone below never shipped, so everything since `0.1.1` lands here.

### Highlights

- Tab / Shift-Tab resolve list sink/lift and table-cell navigation before literal indent — in `0.1.1`, Tab always inserted `indentChars`.

### Breaking

- `allowedNodeTypes` is replaced by `allowedIndentContexts`, an explicit allowlist of `{ textblock, parent }` type-name pairs (default: `paragraph` under `doc` or `blockquote`). Map each old name to one pair per parent — `['paragraph']` → `[{ textblock: 'paragraph', parent: 'doc' }]` — and note that `[]` now disables literal indent instead of allowing it everywhere. Migration guide in the README.
- The `IndentContext` helper type (resolved textblock + parent at a position) is no longer exported from the package root; `IndentContextRule` and `IndentOptions` remain.
- `allowedIndentContexts` is required on the resolved `IndentOptions` type. `configure()` still accepts partials; the default allowlist is unchanged.

### Fixed

- Tab / Shift-Tab table-cell delegation never fired — `editor.can()` is now invoked, so `goToNextCell` / `goToPreviousCell` run when a table extension is present.
- Shift-Tab with the caret at the very start of an indented line now removes the line's leading indent. It was a no-op: the `removeLeading` branch checked the text _before_ the caret, which is always empty at line start.
- Outdent no longer deletes hard breaks (or other zero-width inline nodes) in place of indent characters — delete windows are verified against document text in both caret and multiline paths.
- Multiline operations clamp the first line to its textblock start — mid-word selection starts no longer inject indent mid-word, and select-all (`AllSelection`) indents eligible blocks.

### Internal

- Added a clean-room Cypress E2E suite (`@docs.plus/playground`, port 5175) running real keypresses against the built `dist/` — paragraph indent/outdent, reversibility, multiline position math, and the disabled-context gate. The Jest suite keeps ownership of the full `allowedIndentContexts` matrix.

## [0.2.0]

Internal milestone — never published to npm. Baseline before this changelog: literal indent/outdent gated by `allowedIndentContexts` (a `(textblock, parent)` allowlist), with Tab / Shift-Tab precedence delegating to list sink/lift and table-cell navigation before literal indent.
