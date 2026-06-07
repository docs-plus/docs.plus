import type { Editor } from '@tiptap/core'

import { HYPERLINK_MARK_NAME } from '../constants'
import { createPopover, getDefaultController } from '../floating-popover'
import type { CreateHyperlinkOptions, HyperlinkAttributes } from '../hyperlink'
import createHyperlinkPopover from '../popovers/createHyperlinkPopover'
import { getHyperlinkOptions } from './getHyperlinkOptions'

const INPUT_FOCUS_DELAY_MS = 100
const OFFSCREEN_COORD_PX = -9999

/**
 * Open the create-hyperlink popover anchored to the current selection.
 * Returns `false` when the host opted out (factory returned `null`).
 */
export function openCreateHyperlink(
  editor: Editor,
  attributes: Partial<HyperlinkAttributes>
): boolean {
  const options = getHyperlinkOptions(editor, 'openCreateHyperlink')
  const factory = options.popovers.createHyperlink ?? createHyperlinkPopover

  const popoverOptions: CreateHyperlinkOptions = {
    editor,
    validate: options.validate,
    extensionName: HYPERLINK_MARK_NAME,
    attributes
  }

  const content = factory(popoverOptions)
  if (!content) return false

  const { from, to } = editor.state.selection

  // `popover` is forward-referenced inside the coords callback so the
  // stale-anchor guard below can call `popover.hide()` once the
  // controller has handed it back to us.
  const popover = createPopover({
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
          queueMicrotask(() => popover.hide())
          return { x: OFFSCREEN_COORD_PX, y: OFFSCREEN_COORD_PX, width: 0, height: 0 }
        }
      },
      contextElement: editor.view.dom
    },
    content,
    placement: 'bottom',
    showArrow: true
  })

  getDefaultController().adopt(popover, 'create', {
    element: popover.element,
    referenceElement: null
  })
  popover.show()

  const input = content.querySelector('input')
  if (input) setTimeout(() => input.focus(), INPUT_FOCUS_DELAY_MS)
  return true
}
