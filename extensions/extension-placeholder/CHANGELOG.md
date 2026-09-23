# Changelog

All notable changes to `@docs.plus/extension-placeholder` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Documentation

- The README is a short start page: why to use it, install, a Quickstart
  that shows a result, the caveats that fail with no error, and common
  tasks. The full reference moved to `docs/` on GitHub (`api.md`, `guide.md`, `migration.md`).
- The install line leads with `npm install`. `pnpm`, `yarn` and `bun`
  follow on the next line.
- An **Open in StackBlitz** button runs the Quickstart in the browser.
  The app lives in `examples/vanilla`, and preflight fails when it drifts
  from the README.
- A "For AI coding agents" row points agents at this README as plain
  Markdown on jsDelivr.
- The Quickstart includes the CSS rule, so the hint shows on first run.

## [2.0.0] — 2026-08-11

### Highlights

- **First npm publish** — versioned `2.0.0` to align with the docs.plus extension-family shared major.
- **O(depth) cursor-based decoration** — decorates only the empty node at the cursor plus empty ancestor wrappers; no full-document `doc.descendants` scan on every keystroke.
- **Runtime editable toggle** — `editor.setEditable()` refreshes the placeholder immediately when `showOnlyWhenEditable` is on.
- **Clean-room Cypress suite** — twelve specs against built `dist/` on port 5177 (empty doc, cursor tracking, undo, full-doc paste, gap cursor).

### Changed

- `apply()` skips recomputation for meta-only transactions (neither doc nor selection changed).

### Fixed

- A non-text selection no longer puts `data-placeholder` on a wrapper node. `$anchor.parent` is a textblock only for a text selection. So a `NodeSelection` on an empty paragraph inside a blockquote or list item resolved to the wrapper and painted the placeholder on it. The guard now tests `node.type.isTextblock`.
- `editor.setEditable()` refreshes the placeholder at runtime. With `showOnlyWhenEditable: true`, toggling read-only left a stale placeholder (or failed to restore it on re-enable): the editability gate lived in the plugin's `apply`, which `setEditable` does not re-run. The gate moved to `props.decorations`, which `view.updateState` re-runs.

### Documentation

- Documented the differences from the built-in Placeholder, pointed the CSS example at `.ProseMirror [data-placeholder]::before`, and added a screen-reader labeling note.

### Internal

- The published manifest no longer declares `engines` — the monorepo's Node floor gated engine-strict consumer installs even though the shipped bundle is plain browser-targeted ESM/CJS.
- Added a clean-room Cypress E2E suite (`@docs.plus/playground`, port 5177) against the built `dist/`: empty-document lifecycle, cursor tracking, ancestor propagation, the editable toggle, option resolution, `isNodeEmpty` semantics, external edits, undo/redo, full-document paste, horizontal rule and gap cursor, per-node-type `placeholder` functions, and real-keystroke Backspace.
- Replaced a cast with `?? null` in `props.decorations`.
- Added a `typecheck` script; corrected "TipTap" to "Tiptap" in the package description.

## [0.1.0]

Pre-changelog baseline, never published to npm. O(depth) cursor-based placeholder decoration — decorates only the empty node at the cursor and its empty ancestor wrappers instead of scanning with Tiptap's built-in `doc.descendants`.
