import type { Editor } from '@tiptap/core'
import { getMarkRange } from '@tiptap/core'

import type { ApplyHyperlinkArgs } from '../types'

interface ApplyEditDeps {
  editor: Editor
  /** Defaults to `'hyperlink'` (the schema mark name; locked by every stored Yjs doc). */
  markName?: string
  /** Optional explicit mark position for surfaces that do not move selection before opening. */
  nodePos?: number
}

/** Apply an edit result. Falls through to `editHyperlinkHref` when no text is provided so the rendered link text isn't touched needlessly. Smaller-than-`EditHyperlinkOptions` deps shape so this is reusable from `LinkPreviewSheet` (which only carries an editor). */
export function applyEdit(deps: ApplyEditDeps, { href, text }: ApplyHyperlinkArgs): boolean {
  if (deps.editor.isDestroyed) return false
  const markName = deps.markName ?? 'hyperlink'
  const chain = deps.editor.chain().focus()
  if (typeof deps.nodePos === 'number') {
    const markType = deps.editor.schema.marks[markName]
    if (!markType) return false
    const range = getMarkRange(deps.editor.state.doc.resolve(deps.nodePos), markType)
    if (!range) return false
    chain.setTextSelection(range)
  }
  chain.extendMarkRange(markName)

  if (typeof text === 'string' && text.length > 0) {
    chain.editHyperlink({ newURL: href, newText: text })
  } else {
    chain.editHyperlinkHref(href)
  }

  return chain.run()
}
