# Changelog

All notable changes to `@docs.plus/extension-mermaid` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The `Mermaid` extension. It draws a `codeBlock` with `language: 'mermaid'` as a live SVG diagram under its source, rendered by [Pele](https://pele.run). The `insertMermaid` command inserts an example diagram. Import the stylesheet `@docs.plus/extension-mermaid/styles.css` for the fold control, the head and the actions.
- The default `limits` are 10000 characters and 250 edges, measured on a real iPhone and a real Android phone ([#522](https://github.com/docs-plus/docs.plus/issues/522)). Each is the highest size where every test source drew within 200 ms at p99 on both phones. The Android phone took 1096.8 ms at 15000 characters, and both phones were over 200 ms at 500 edges. An earlier laptop estimate with a 6x CPU slowdown gave 15000 and 500, and the phones proved it too high. The numbers are in `docs/pele.md`.
- A diagram over the character, edge or output limit says which limit it hit, with the count where it is known and a next step. Pele's other fixed limits (nesting depth, block-diagram space blocks, Gantt scheduling work, requirement styles) keep Pele's own text, which names the cause. The sentence is in `MermaidError.message`, and the built-in view shows it as body text in `.mermaid-diagram__advice`.
- `styles.css` prints a ready diagram as the picture and any other block as its source, with the head and zoom hidden. Setting a `--pele-*` variable inline on the frame at runtime recolours the diagram in place, with no redraw.
