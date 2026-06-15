# @docs.plus/floating-tooltip

Framework-agnostic hover/focus tooltip for Tiptap / ProseMirror extension toolbars, built on [`@floating-ui/dom`](https://floating-ui.com/). Hoisted from `@docs.plus/extension-hypermultimedia` so multiple extensions ship the same tooltip behavior. The bubble/timer singleton is per consuming bundle — no cross-package singleton, same convention as the popover controller — so a host loading both extensions has one bubble per bundle; pair `attachTooltip` and `hideTooltip` from the same package.

## Status

Internal monorepo package — `private`, never published to npm. The consuming extensions (`@docs.plus/extension-hyperlink`, `@docs.plus/extension-hypermultimedia`) declare it as a workspace `devDependency` and **bundle** it into their published `dist`, so npm consumers get it inlined, not as a separate dependency. There is no `bun add` for it.

## Public surface

- `attachTooltip(target, label)` — show `label` above `target` after a short hover/focus delay. Activation (`pointerdown`, plus `click` for keyboard Enter/Space) hides the bubble so it never lingers over a popover the press opened. Returns a detach function for surfaces that re-render in place.
- `hideTooltip()` — hide the shared bubble and cancel any pending show.

Deliberately built on raw `@floating-ui/dom` rather than `@docs.plus/floating-popover`'s `createPopover`: the popover engine self-adopts into the one-popover-at-a-time controller, so showing a tooltip would dismiss an open menu or dialog. Tooltips must never enter that controller.

## Styling

This package emits class names only (`.floating-tooltip`, visibility via the `visible` class). Consumers own the stylesheet — the two extensions ship one lockstep skin written as identical `light-dark()` literals, never per-package tokens: both bundles style this one global class, and cascade order would otherwise pick one bundle's tokens for every bubble.
