<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/floating-popover` are documented here.

Versioning follows [Semantic Versioning](https://semver.org/) and commits follow [Conventional Commits](https://conventionalcommits.org/). The package launches at `2.0.0` to match the docs.plus extension family line it was hoisted from.

---

## [Unreleased]

### Fixed

- `createPopover` no longer light-dismisses when the pointer is on the toggle
  trigger (`referenceElement`, or `ignoreOutsideClickOn` when the position
  reference is a larger surface). Re-clicking the trigger can toggle closed.
- Optional `crossAxisShift: false` keeps end-aligned placements pinned to the
  reference’s end edge (toolbar overflow no longer slides left under `shift`).

## [2.0.0] — 2026-06-12

### Added

- Initial release. The single-popover lifecycle engine (`createPopoverController`, `getDefaultController`, `createPopover`, `DEFAULT_OFFSET`) hoisted verbatim from `@docs.plus/extension-hyperlink@2.0.0` so multiple Tiptap extensions can share one floating surface at a time.

### Changed

- The popover shell no longer hardcodes `role="toolbar"`. ARIA has no popover role, so the surface must carry its content's role — pass the new optional `PopoverOptions.role` (`toolbar`, `dialog`, …); when omitted, the shell renders without a `role` attribute.

### Fixed

- `createPopover` keyboard-navigation listeners are now removed on every content swap and on `destroy()` (previously leaked across `setContent` calls).
