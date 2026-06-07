# @docs.plus/floating-popover

Framework-agnostic single-popover lifecycle engine for Tiptap / ProseMirror extensions, built on [`@floating-ui/dom`](https://floating-ui.com/). Hoisted from `@docs.plus/extension-hyperlink` so multiple extensions share one floating surface at a time (a link popover and a media toolbar are mutually exclusive).

## Status

Internal monorepo package — `private`, never published to npm. The consuming extensions (`@docs.plus/extension-hyperlink`, `@docs.plus/extension-hypermultimedia`) declare it as a workspace `devDependency` and **bundle** it into their published `dist`, so npm consumers get it inlined, not as a separate dependency. There is no `bun add` for it.

## Public surface

- `createPopover(options)` — build a positioned popover (`{ referenceElement }` or virtual `{ coordinates }`). Emits the `.floating-popover*` class contract; ships no CSS of its own.
- `createPopoverController()` / `getDefaultController()` / `setDefaultController()` / `resetDefaultController()` — the singleton lifecycle owner. `adopt` takes ownership of a built popover (destroying the previous owner), `close` hides and idles, `reposition` re-anchors, `subscribe` observes `idle ↔ mounted` transitions.
- `DEFAULT_OFFSET` and the supporting types (`Popover`, `PopoverOptions`, `PopoverController`, `ControllerState`, `PopoverKind`, `VirtualCoordinates`, `AdoptMetadata`, `ManagedPopover`).

## Styling

This package emits class names only (`.floating-popover`, `.floating-popover-arrow`, `.floating-popover-content`, visibility via the `visible` class). Consumers own the stylesheet.
