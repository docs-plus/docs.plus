import type { Editor } from '@tiptap/core'
import { getMarkRange } from '@tiptap/core'

import { HYPERLINK_MARK_NAME } from '../constants'

/**
 * Link text from the document. The live <a> wins over a stale nodePos; the href match stops a neighbour's text.
 * DOM text is the last resort. Internal: keep the body equal to the webapp copy in `linkMarkUtils.ts`.
 */
export const getHyperlinkDisplayText = (
  editor: Editor,
  at: { nodePos?: number; link?: HTMLAnchorElement; href?: string | null; markName?: string }
): string => {
  const { link, markName = HYPERLINK_MARK_NAME } = at
  const fallback = () => link?.innerText ?? link?.textContent ?? ''
  const type = editor.schema.marks[markName]
  const { doc } = editor.state
  let live = -1
  try {
    if (link?.isConnected) live = editor.view.posAtDOM(link, 0)
  } catch {
    // An <a> outside this view gives -1, and live >= 0 handles that. This catch is only a guard.
  }
  const pos = live >= 0 ? live : at.nodePos
  if (!type || typeof pos !== 'number' || pos < 0 || pos > doc.content.size) return fallback()
  const href = at.href ?? link?.getAttribute('href')
  // href picks the mark; its full attrs then give the same range Apply edits.
  const $pos = doc.resolve(pos)
  const mark = [$pos.nodeAfter, $pos.nodeBefore]
    .flatMap((n) => n?.marks ?? [])
    .find((m) => m.type === type && (!href || m.attrs.href === href))
  const range = mark && getMarkRange($pos, type, mark.attrs)
  return range ? doc.textBetween(range.from, range.to, '') : fallback()
}
