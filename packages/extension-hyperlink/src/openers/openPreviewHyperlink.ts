import type { Editor } from '@tiptap/core'

import { createPopover, getDefaultController } from '../floating-popover'
import type { PreviewHyperlinkOptions } from '../hyperlink'
import previewHyperlinkPopover from '../popovers/previewHyperlinkPopover'
import { getHyperlinkOptions } from './getHyperlinkOptions'

/**
 * Open the preview popover anchored to a hyperlink. Returns `false` when
 * the host opted out (factory returned `null`, e.g. mobile bottom sheets).
 * The click handler uses the return to gate caret placement — opting-out
 * hosts must never trigger `.focus()` (iOS Safari scrolls contenteditable
 * into view).
 */
export function openPreviewHyperlink(editor: Editor, opts: PreviewHyperlinkOptions): boolean {
  const { popovers } = getHyperlinkOptions(editor, 'openPreviewHyperlink')
  const factory = popovers.previewHyperlink ?? previewHyperlinkPopover
  const content = factory(opts)
  if (!content) return false

  const popover = createPopover({
    referenceElement: opts.link,
    content,
    placement: 'bottom',
    showArrow: true
  })
  getDefaultController().adopt(popover, 'preview', {
    element: popover.element,
    referenceElement: opts.link
  })
  popover.show()
  return true
}
