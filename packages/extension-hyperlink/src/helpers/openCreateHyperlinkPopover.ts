import { Editor } from '@tiptap/core'

import type { CreateHyperlinkOptions, HyperlinkAttributes, HyperlinkOptions } from '../hyperlink'
import { createFloatingToolbar } from './floatingToolbar'

// Wait one frame for Floating-UI's first reposition before focus(),
// otherwise focus jumps the page to the unpositioned mount point.
const INPUT_FOCUS_DELAY_MS = 100

// Off-screen sentinel rect for the one-microtask gap between detecting
// a stale anchor and the queued `toolbar.hide()` landing.
const OFFSCREEN_COORD_PX = -9999

type OpenCreateHyperlinkPopoverArgs = {
  editor: Editor
  options: HyperlinkOptions
  extensionName: string
  attributes: Partial<HyperlinkAttributes>
}

/**
 * Open the create-hyperlink popover anchored to the current selection.
 *
 * Lives in its own helper because the side-effecting popover surface is
 * deliberately split out from the pure `setHyperlink` command (Tiptap
 * canon: commands stay pure; UI-opening is its own command). The
 * Mod-k shortcut and the public `openCreateHyperlinkPopover` command
 * both call this entry point so the popover behaves identically
 * whichever path the user takes.
 *
 * Returns `true` when the popover was successfully shown (Tiptap
 * convention for "command applied"), `false` when there is nothing to
 * open — either no `popovers.createHyperlink` factory was configured
 * or the factory itself returned `null` (host opted out, e.g. mobile
 * bottom sheet).
 */
export function openCreateHyperlinkPopover({
  editor,
  options,
  extensionName,
  attributes
}: OpenCreateHyperlinkPopoverArgs): boolean {
  const factory = options.popovers.createHyperlink
  if (!factory) return false

  const popoverOptions: CreateHyperlinkOptions = {
    editor,
    validate: options.validate,
    extensionName,
    attributes
  }

  const content = factory(popoverOptions)
  if (!content) return false

  // Capture the selection range ONCE at popover open. The coords
  // callback below recomputes viewport coords from these doc positions
  // on every reposition (mount, scroll, resize) so the popover stays
  // glued to the selection while the user scrolls.
  const { from, to } = editor.state.selection

  const toolbar = createFloatingToolbar({
    coordinates: {
      getBoundingClientRect: () => {
        // Remote collab ops (Yjs) can shrink the doc out from under us
        // and make `from`/`to` out-of-range — `coordsAtPos` throws.
        // Anchor is gone, so dismiss. `hide()` is microtask-deferred
        // because we're inside `computePosition`; the off-screen rect
        // bridges the gap so the popover doesn't flash before teardown.
        try {
          const start = editor.view.coordsAtPos(from)
          const end = editor.view.coordsAtPos(to)
          return {
            x: start.left,
            y: start.top,
            width: end.left - start.left,
            height: end.bottom - start.top
          }
        } catch {
          queueMicrotask(() => toolbar.hide())
          return {
            x: OFFSCREEN_COORD_PX,
            y: OFFSCREEN_COORD_PX,
            width: 0,
            height: 0
          }
        }
      },
      contextElement: editor.view.dom
    },
    content,
    placement: 'bottom',
    showArrow: true
  })

  toolbar.show()

  const input = content.querySelector('input')
  if (input) setTimeout(() => input.focus(), INPUT_FOCUS_DELAY_MS)

  return true
}
