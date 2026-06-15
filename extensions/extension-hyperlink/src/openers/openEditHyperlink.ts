import { hideTooltip } from '@docs.plus/floating-tooltip'

import { createPopover, getDefaultController } from '../floating-popover'
import type { EditHyperlinkOptions } from '../hyperlink'
import editHyperlinkPopover from '../popovers/editHyperlinkPopover'
import { getHyperlinkOptions } from './getHyperlinkOptions'
import { findLiveEquivalentAnchor } from './liveAnchor'
import { setActivePopoverOwner } from './popoverOwnership'

const OFFSCREEN_COORD_PX = -9999

/**
 * Open the edit popover anchored to a hyperlink. The prebuilt popover's
 * Back button closes over `opts`, so no extra wiring is needed to
 * return to the preview.
 */
export function openEditHyperlink(opts: EditHyperlinkOptions): void {
  const { editor } = opts
  const { popovers } = getHyperlinkOptions(editor, 'openEditHyperlink')
  const factory = popovers.editHyperlink ?? editHyperlinkPopover
  const content = factory(opts)
  if (!content) return
  let referenceLink = findLiveEquivalentAnchor(editor, opts.link, opts.nodePos)
  let hideQueued = false
  const popover = createPopover({
    coordinates: {
      getBoundingClientRect: () => {
        referenceLink = referenceLink
          ? findLiveEquivalentAnchor(editor, referenceLink, opts.nodePos)
          : null
        if (!referenceLink) {
          if (!hideQueued) {
            hideQueued = true
            queueMicrotask(() => popover.hide())
          }
          return { x: OFFSCREEN_COORD_PX, y: OFFSCREEN_COORD_PX, width: 0, height: 0 }
        }
        const rect = referenceLink.getBoundingClientRect()
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
      },
      contextElement: editor.view.dom
    },
    content,
    placement: 'bottom',
    showArrow: true,
    role: 'dialog',
    ariaLabel: 'Edit link',
    // No prebuilt icon buttons here, but BYO content can attach tooltips —
    // the orphan guard is a property of the surface, not of its content.
    onHide: hideTooltip
  })
  getDefaultController().adopt(popover, 'edit', {
    element: popover.element,
    referenceElement: null
  })
  setActivePopoverOwner(editor, popover)
  popover.show()
}
