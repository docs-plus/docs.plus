import type { PreviewHyperlinkOptions } from '../hyperlink'
import previewHyperlinkPopover from '../popovers/previewHyperlinkPopover'
import { getHyperlinkOptions } from './getHyperlinkOptions'
import { openPreviewPopover } from './openPreviewPopover'
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

  setActivePopoverOwner(editor, openPreviewPopover(opts.link, content))
  return true
}
