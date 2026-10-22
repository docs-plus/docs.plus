# Changelog

All notable changes to `@docs.plus/extension-mermaid` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
