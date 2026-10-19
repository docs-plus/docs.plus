# Changelog

All notable changes to `@docs.plus/extension-mermaid` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The `Mermaid` extension. It draws a `codeBlock` with `language: 'mermaid'` as a live SVG diagram under its source, rendered by [Pele](https://pele.run). The `insertMermaid` command inserts an example diagram. Import the stylesheet `@docs.plus/extension-mermaid/styles.css` for the fold control, the head and the actions.
- A diagram over a limit says which limit it hit, with the count where it is known and a next step. The sentence is in `MermaidError.message`, and the built-in view shows it as body text in `.mermaid-diagram__advice`.
- `styles.css` prints a ready diagram as the picture and any other block as its source, with the head and zoom hidden. Setting a `--pele-*` variable inline on the frame at runtime recolours the diagram in place, with no redraw.
