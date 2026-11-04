import { hideTooltip } from '@docs.plus/floating-tooltip'

import { createPopover, getDefaultController, type Popover } from '../floating-popover'

/**
 * Shows `content` as the link preview under `referenceElement`. `openPreviewHyperlink` uses it,
 * and a host can call it for a link outside an editor. It adopts as kind `'preview'`,
 * so `focusPreviewFromKeyboard` works on it. The caller closes it.
 */
export function openPreviewPopover(referenceElement: HTMLElement, content: HTMLElement): Popover {
  const popover = createPopover({
    referenceElement,
    content,
    placement: 'bottom',
    showArrow: true,
    role: 'dialog',
    ariaLabel: 'Link preview',
    // Outside-click teardown removes the icon buttons without a mouseleave —
    // the shared tooltip must die with the surface or it lingers on screen.
    onHide: hideTooltip
  })
  getDefaultController().adopt(popover, 'preview', { element: popover.element, referenceElement })
  popover.show()
  return popover
}
