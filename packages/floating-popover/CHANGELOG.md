<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/floating-popover` are documented here.

Versioning follows [Semantic Versioning](https://semver.org/) and commits follow [Conventional Commits](https://conventionalcommits.org/). The package launches at `2.0.0` to match the docs.plus extension family line it was hoisted from.

---

## [Unreleased]

### Added

- `PopoverKind` gains the `'hovercard'` literal, for the extension-hyperlink link hovercard.
- `createPopover` takes an optional `onRemove` callback. It runs once, after the popover root has left the DOM: at the end of the exit fade, or at once on `destroy()`. `onHide` still runs as the hide starts.
- `focusables(root)` returns the controls that Tab visits in a popover, in DOM order. An opener can use it to choose the first focus.

### Changed

- `createPopover` reads its Tab cycle on each Tab, so a control that renders after `show()` joins the cycle. One `keydown` listener on the root, bound in `show()`, replaces one listener per control.

### Fixed

- The Tab cycle skips a control that cannot take focus: one that is disabled, inside `[inert]`, not rendered, or at `tabindex="-1"`. Before, Tab onto a disabled Apply button left focus where it was.
- `createPopover` no longer light-dismisses when the pointer is on the toggle
  trigger (`referenceElement`, or `ignoreOutsideClickOn` when the position
  reference is a larger surface). Re-clicking the trigger can toggle closed.
- Optional `crossAxisShift: false` keeps end-aligned placements pinned to the
  reference’s end edge (toolbar overflow no longer slides left under `shift`).
- `hide()` and `destroy()` are terminal once the popover has been shown:
  `show()` no longer reopens a closed popover. Hiding releases ownership and nothing
  re-adopted, so a re-shown popover stayed on screen while the controller
  believed it was idle. `close()` could not reach it. The next `adopt()` did
  not evict it (two popovers at once). Subscribers were never told it had
  remounted. It survived `editor.destroy()` with `autoUpdate` observers
  still bound. `show()` after `destroy()` also re-appended the removed root.
  Build a new popover to reopen.

### Internal

- `@floating-ui/dom` moves from `^1.7.6` to `^1.8.0`.
- The package no longer has its own `lint` and `lint:fix` scripts. The root lint gate checks it.

## [2.0.0] — 2026-06-12

### Added

- Initial release. The single-popover lifecycle engine (`createPopoverController`, `getDefaultController`, `createPopover`, `DEFAULT_OFFSET`) hoisted verbatim from `@docs.plus/extension-hyperlink@2.0.0` so multiple Tiptap extensions can share one floating surface at a time.

### Changed

- The popover shell no longer hardcodes `role="toolbar"`. ARIA has no popover role, so the surface must carry its content's role. Pass the new optional `PopoverOptions.role` (`toolbar`, `dialog`, …). When omitted, the shell renders without a `role` attribute.

### Fixed

- `createPopover` keyboard-navigation listeners are now removed on every content swap and on `destroy()` (previously leaked across `setContent` calls).
