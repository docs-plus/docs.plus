import { hideTooltip } from '@docs.plus/floating-tooltip'

import { createPopover, getDefaultController } from '../floating-popover'
import type { PreviewHyperlinkOptions } from '../hyperlink'
import previewHyperlinkPopover from '../popovers/previewHyperlinkPopover'
import { getHyperlinkOptions } from './getHyperlinkOptions'
import { setActivePopoverOwner } from './popoverOwnership'

/**
 * Returns `false` when the host opted out (factory returned `null`, e.g. a
 * mobile bottom sheet). The click handler gates caret placement on it —
 * `.focus()` on an opting-out host makes iOS Safari scroll the editor.
 */
export function openPreviewHyperlink(opts: PreviewHyperlinkOptions): boolean {
  const { editor } = opts
  const { popovers } = getHyperlinkOptions(editor, 'openPreviewHyperlink')
  const factory = popovers.previewHyperlink ?? previewHyperlinkPopover
  const content = factory(opts)
  if (!content) return false

  const popover = createPopover({
    referenceElement: opts.link,
    content,
    placement: 'bottom',
    showArrow: true,
    role: 'toolbar',
    // Outside-click teardown removes the icon buttons without a mouseleave —
    // the shared tooltip must die with the surface or it lingers on screen.
    onHide: hideTooltip
  })
  getDefaultController().adopt(popover, 'preview', {
    element: popover.element,
    referenceElement: opts.link
  })
  setActivePopoverOwner(editor, popover)
  popover.show()
  return true
}
