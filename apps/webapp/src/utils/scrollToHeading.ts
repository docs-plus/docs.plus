import { scrollElementInMobilePadEditor } from './scrollMobilePadEditor'

export type ScrollToHeadingOptions = {
  behavior?: ScrollBehavior
  /** Mobile pad helper only implements start|nearest; desktop uses native scrollIntoView. */
  block?: 'start' | 'nearest'
}

/** UniqueID also stamps `data-toc-id` on non-headings — keep scroll on heading nodes only. */
const HEADING_WITH_TOC_ID = ':is(h1,h2,h3,h4,h5,h6)[data-toc-id]'

function escapeAttr(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Pad DOM scroll only — never URL or CHAT_OPEN. Default block is nearest. */
export function scrollToHeading(headingId: string, options: ScrollToHeadingOptions = {}): void {
  const { behavior = 'smooth', block = 'nearest' } = options
  const headingSection = document.querySelector(
    `.ProseMirror ${HEADING_WITH_TOC_ID}[data-toc-id="${escapeAttr(headingId)}"]`
  )
  if (!headingSection) return
  if (!scrollElementInMobilePadEditor(headingSection, { behavior, block })) {
    headingSection.scrollIntoView({ behavior, block, inline: 'nearest' })
  }
}
