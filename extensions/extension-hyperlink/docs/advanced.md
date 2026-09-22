# Advanced

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

Cross-popover primitives and lifecycle APIs live here. Use them to build a popover that is not anchored to a hyperlink, or to observe popover state from outside the editor.

## Floating-popover primitive

`createPopover(options)` is the primitive every opener calls: Floating-UI placement, scroll-stickiness, outside-click dismissal, keyboard navigation, and registration with the [UI controller](#ui-controller). Call it directly for a popover that joins the same lifecycle without a hyperlink anchor.

The shell owns dismissal and focus. Escape hides the popover, and the shell binds it on the popover root, so focus must sit inside. An outside `mousedown` or `touchstart` hides it too. The listeners arm 50 ms after `show()`, so a click inside that 50 ms window does not dismiss the popover. Tab and Shift-Tab cycle focus across the controls inside the popover.

`PopoverOptions` is a discriminated union — exactly one of `referenceElement` or `coordinates` is required, and the compiler enforces it.

| Field                   | Type                                         | Default                | Description                                                                                                                                                                    |
| ----------------------- | -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `referenceElement`      | `HTMLElement`                                | none                   | Element-anchor variant. Mutually exclusive with `coordinates`.                                                                                                                 |
| `coordinates`           | `{ getBoundingClientRect, contextElement? }` | none                   | Virtual-anchor variant, for example a selection anchor. `getBoundingClientRect` MUST recompute on every call.                                                                  |
| `content`               | `HTMLElement`                                | none                   | Popover content node.                                                                                                                                                          |
| `placement?`            | `Placement`                                  | `'bottom-start'`       | Floating-UI placement. The popover auto-flips to fit the viewport.                                                                                                             |
| `offset?`               | `number`                                     | `DEFAULT_OFFSET` (`8`) | Distance in px between the anchor and the popover.                                                                                                                             |
| `showArrow?`            | `boolean`                                    | `false`                | Renders an arrow pointing at the anchor.                                                                                                                                       |
| `className?`            | `string`                                     | `''`                   | Extra class on the popover root, next to `.floating-popover`.                                                                                                                  |
| `zIndex?`               | `number`                                     | `9999`                 | Stacking context for the popover.                                                                                                                                              |
| `role?`                 | `string`                                     | `undefined`            | ARIA role on the popover root. ARIA has no popover role, so pass the content's role (`toolbar`, `dialog`, …).                                                                  |
| `ariaLabel?`            | `string`                                     | `undefined`            | Accessible name set as `aria-label` on the popover root. Same ARIA axis as `role`, so your content inherits it (the prebuilt forms pass "Add link" / "Edit link").             |
| `ignoreOutsideClickOn?` | `HTMLElement \| HTMLElement[]`               | `undefined`            | Nodes that never light-dismiss the popover, such as a toggle trigger. Without a list, the `HTMLElement` `referenceElement` is ignored instead.                                 |
| `crossAxisShift?`       | `boolean`                                    | `true`                 | With `false`, `shift` moves the popover on the main axis only, so an end-aligned menu stays pinned to the anchor's end edge.                                                   |
| `onShow?`               | `() => void`                                 | `undefined`            | Fires synchronously at the end of `show()`, after the popover mounts and before the `.visible` entrance frame. Defer focus and measurement work to it (see the create opener). |
| `onHide?`               | `() => void`                                 | `undefined`            | Fires when the popover is dismissed: outside click, programmatic `hide()`, or controller replacement.                                                                          |

Returns a `Popover`:

| Member                           | Description                                                          |
| -------------------------------- | -------------------------------------------------------------------- |
| `element`                        | The popover root (`.floating-popover` div).                          |
| `show()`                         | Mounts and reveals. Idempotent, and a no-op once closed.             |
| `hide()`                         | Dismisses. Terminal once shown — build a new popover to reopen.      |
| `destroy()`                      | Tears down permanently: removes from the DOM and stops `autoUpdate`. |
| `isVisible()`                    | `true` between `show()` and `hide()` or `destroy()`.                 |
| `setContent(el)`                 | Swaps the content node in place without re-positioning.              |
| `updateReference(ref?, coords?)` | Re-anchors to a different element or virtual reference.              |

`createPopover` adopts the new instance into the controller at the end of the call, before any `show()`. Creating a second popover therefore tears the first one down, even when you never show the second.

## UI controller

`getDefaultController()` returns the owner of the floating-popover lifecycle. Subscribe to state changes from an outer toolbar, a devtools panel, or an E2E harness.

`ControllerState` is a discriminated union:

```ts
type PopoverKind = 'preview' | 'edit' | 'create' | (string & {})

type ControllerState =
  | { kind: 'idle' }
  | {
      kind: 'mounted'
      popoverKind: PopoverKind
      element: HTMLElement // popover root — for focus rings, observers, scroll-freezes
      referenceElement: HTMLElement | null // null for virtual-coords popovers
    }
```

`referenceElement` holds the anchor node for the preview popover only. Create and edit both anchor to virtual coordinates, so both report `null`.

`PopoverController`:

| Member                           | Description                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adopt(popover, kind, metadata)` | Takes ownership of a `Popover` and destroys the previous owner. Returns an unregister function. The openers call it; consumers rarely do.                                                   |
| `close()`                        | Dismisses the active popover, and does nothing when idle.                                                                                                                                   |
| `reposition(ref?, coords?)`      | Re-anchors the active popover after the underlying mark moves, such as an external edit or a document rewrite.                                                                              |
| `getState()`                     | One-shot read of `ControllerState`.                                                                                                                                                         |
| `subscribe(listener)`            | Registers a state-change listener and returns an unsubscribe function. The listener does **not** fire on subscribe — call `listener(controller.getState())` yourself for the initial state. |

One controller serves one bundle. See [Caveats](./api.md#caveats) for what that means next to another docs.plus extension.

## Tooltip primitive

`attachTooltip(target, label)` puts a hover and focus tooltip on your own button. The prebuilt popovers use the same tooltip. The bubble appears 400 ms after the pointer enters, and on keyboard focus only when the button matches `:focus-visible`.

`attachTooltip` returns a detach function, and it binds six listeners per call. Call the detach function when your popover re-renders in place, or the listeners stack on every render.

`hideTooltip()` hides the shared bubble. The bubble is per bundle, so attach and hide from the same package. Otherwise `hideTooltip()` leaves the other package's bubble on screen.
