<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/floating-tooltip` are documented here.

Versioning follows [Semantic Versioning](https://semver.org/) and commits follow [Conventional Commits](https://conventionalcommits.org/). The package launches at `2.0.0` to match the docs.plus extension family line it was hoisted from.

---

## [2.0.0] — 2026-06-12

### Added

- Initial release. The shared tooltip bubble (`attachTooltip`, `hideTooltip`) hoisted from `@docs.plus/extension-hypermultimedia@2.0.0`'s media toolbar so multiple Tiptap extensions share one hover/focus tooltip.

### Changed

- Emitted class names are `floating-tooltip` / `visible` (were `media-toolbar__tooltip` / `media-toolbar__tooltip--visible`), matching the engine's `.floating-popover` + `visible` convention. The package still ships no CSS; consumers own the skin.
