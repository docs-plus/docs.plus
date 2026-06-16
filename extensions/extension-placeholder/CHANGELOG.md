# Changelog

All notable changes to `@docs.plus/extension-placeholder` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-06-16

### Highlights

- **First npm publish** — versioned `2.0.0` to align with the docs.plus extension-family shared major.
- **O(1) cursor-based decoration** — decorates only the empty node at the cursor plus empty ancestor wrappers; no full-document `doc.descendants` scan on every keystroke.
- **Runtime editable toggle** — `editor.setEditable()` refreshes the placeholder immediately when `showOnlyWhenEditable` is on.
- **Clean-room Cypress suite** — twelve specs against built `dist/` on port 5177 (empty doc, cursor tracking, undo, full-doc paste, gap cursor).

### Changed

- `apply()` skips recomputation for meta-only transactions (neither doc nor selection changed).

### Fixed

- `editor.setEditable()` refreshes the placeholder at runtime. With `showOnlyWhenEditable: true`, toggling read-only left a stale placeholder (or failed to restore it on re-enable): the editability gate lived in the plugin's `apply`, which `setEditable` does not re-run. The gate moved to `props.decorations`, which `view.updateState` re-runs.

### Documentation

- Documented the differences from the built-in Placeholder, pointed the CSS example at `.ProseMirror [data-placeholder]::before`, and added a screen-reader labeling note.

### Internal

- Added a clean-room Cypress E2E suite (`@docs.plus/playground`, port 5177) against the built `dist/`: empty-document lifecycle, cursor tracking, ancestor propagation, the editable toggle, option resolution, `isNodeEmpty` semantics, external edits, undo/redo, full-document paste, horizontal rule and gap cursor, per-node-type `placeholder` functions, and real-keystroke Backspace.
- Replaced a cast with `?? null` in `props.decorations`.
- Added a `typecheck` script; corrected "TipTap" to "Tiptap" in the package description.

## [0.1.0]

Pre-changelog baseline, never published to npm. O(1) cursor-based placeholder decoration — decorates only the empty node at the cursor and its empty ancestor wrappers instead of scanning with Tiptap's built-in `doc.descendants`.
