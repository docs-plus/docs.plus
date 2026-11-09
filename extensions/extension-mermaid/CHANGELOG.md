# Changelog

All notable changes to `@docs.plus/extension-mermaid` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Highlights

- **Your own code block.** `mermaidNodeView(editor)` draws diagrams inside your own `codeBlock` node view, such as one built with `CodeBlockLowlight.extend({ addNodeView })`.
- **Other code blocks pass through.** A code block that is not `mermaid` now goes to the next plugin's `nodeViews.codeBlock`.
- **A clear warning.** In development, `console.warn` fires once when another node view owns `codeBlock` and no diagram can draw. The page needs a global `process`, or the check stays off.
- **Upgrading from 2.2.0.** No export or option was removed. Most apps need no change. Two things behave differently. A plugin `nodeViews.codeBlock` that ranks below this one now gets every block that is not `mermaid`. Its `update` must return `false` when a block's language changes to or from `mermaid`, as [Keep your own code block view](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/guide.md#keep-your-own-code-block-view) shows. And an app with its own `addNodeView` on `codeBlock` can now see the development warning. To draw diagrams there, call `mermaidNodeView`.

### Added

- `mermaidNodeView(editor)` draws diagrams inside your own `codeBlock` node view. The guide has a recipe for `CodeBlockLowlight.extend({ addNodeView })` ([#628](https://github.com/docs-plus/docs.plus/issues/628)).
- In development, a warning appears once per editor when another node view owns `codeBlock`. In that case, no diagram can draw. The check needs a global `process` with `NODE_ENV` not set to `production`, the same check as Tiptap's own development warnings ([#629](https://github.com/docs-plus/docs.plus/issues/629)).

### Changed

- The `@tiptap/core` and `@tiptap/pm` peer floor is now `^3.32.2`. It was `^3.31.3`.
- `pele` stays pinned at `1.8.0`, though npm has newer versions. Pele `1.9.0` changes how labels draw, for example HTML tags inside a label. This package does not take that yet.

### Fixed

- A code block that is not `mermaid` now goes to the next plugin's `nodeViews.codeBlock`. Before, this view took every code block, so that plugin never drew one ([#627](https://github.com/docs-plus/docs.plus/issues/627)).

### Documentation

- The caveats give the node view order in Tiptap terms: `addNodeView` first, then priority, then the extension listed last. They also say that `can().insertMermaid()` does not check drawing. The API reference adds that with `editorProps.nodeViews`, `setEditable` and `setOptions` rebuild the blocks, so `MermaidFold.initial` is read again ([#630](https://github.com/docs-plus/docs.plus/issues/630)).
- The guide shows how a host can skip lowlight work for `mermaid` blocks ([#631](https://github.com/docs-plus/docs.plus/issues/631)).
- On npm, the docs.plus badge now opens the docs.plus repository. Before, a click opened the badge image.

### Internal

- The Cypress spec `node-view-owner.cy.ts` covers the hand-off, `mermaidNodeView` and the warning ([#627](https://github.com/docs-plus/docs.plus/issues/627), [#628](https://github.com/docs-plus/docs.plus/issues/628), [#629](https://github.com/docs-plus/docs.plus/issues/629)). The playground it drives uses `@tiptap/extension-code-block`, a new dev dependency.
- The package `author` field and the `LICENSE` copyright line now name Harvey Marzban.

## [2.2.0] — 2026-10-22

First npm release. The package joins the `@docs.plus/extension-*` family at `2.2.0`, in lockstep with the other five.

### Added

- The `Mermaid` extension. It draws a `codeBlock` with `language: 'mermaid'` as a live SVG diagram under its source, rendered by [Pele](https://pele.run). The `insertMermaid` command inserts an example diagram. Import the stylesheet `@docs.plus/extension-mermaid/styles.css` for the fold control, the head and the actions ([#523](https://github.com/docs-plus/docs.plus/issues/523), [#524](https://github.com/docs-plus/docs.plus/issues/524)).
- The default `limits` are 10000 characters and 250 edges, measured on a real iPhone and a real Android phone ([#522](https://github.com/docs-plus/docs.plus/issues/522)). Each is the highest size where every test source drew within 200 ms at p99 on both phones. The Android phone took 1096.8 ms at 15000 characters, and both phones were over 200 ms at 500 edges. An earlier laptop estimate with a 6x CPU slowdown gave 15000 and 500, and the phones proved it too high. The numbers are in `docs/pele.md`.
- A diagram over the character, edge or output limit says which limit it hit ([7547ee82e](https://github.com/docs-plus/docs.plus/commit/7547ee82e)). It gives the count where it is known, and a next step. Pele's other fixed limits (nesting depth, block-diagram space blocks, Gantt scheduling work, requirement styles) keep Pele's own text, which names the cause ([17b96cc3b](https://github.com/docs-plus/docs.plus/commit/17b96cc3b)). The sentence is in `MermaidError.message`, and the built-in view shows it as body text in `.mermaid-diagram__advice`.
- `styles.css` prints a ready diagram as the picture and any other block as its source, with the head and zoom hidden. Setting a `--pele-*` variable inline on the frame at runtime recolours the diagram in place, with no redraw ([7547ee82e](https://github.com/docs-plus/docs.plus/commit/7547ee82e)).
- The package has one runtime dependency, `pele` 1.8.0, pinned exactly. It loads Pele on demand and never bundles it.
- The peer ranges are `@tiptap/core` `^3.31.3` and `@tiptap/pm` `^3.31.3`.

### Documentation

- The README is a short start page with an **Open in StackBlitz** example. The app lives in `examples/vanilla`. The full reference is under `docs/`: `api.md`, `guide.md`, `pele.md` and `security.md` ([#526](https://github.com/docs-plus/docs.plus/issues/526)).

### Internal

- A clean-room playground and a Cypress suite cover the package ([#525](https://github.com/docs-plus/docs.plus/issues/525)). The quality pass and the ship gates ran before this release ([#530](https://github.com/docs-plus/docs.plus/issues/530)).
