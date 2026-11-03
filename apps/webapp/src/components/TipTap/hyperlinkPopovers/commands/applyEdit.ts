import type { Editor } from '@tiptap/core'

import type { ApplyHyperlinkArgs, ApplyHyperlinkCommandOpts } from '../types'
import { markRangeAt } from './markRangeAt'

interface ApplyEditDeps {
  editor: Editor
  /** Schema mark name; locked by every stored Yjs doc. */
  markName?: string
  /** For surfaces that do not move selection before opening. */
  nodePos?: number
  /** Guards a stale `nodePos` (see `markRangeAt`). */
  expectedHref: string | undefined
}

/** No text → `editHyperlinkHref` so the rendered link text is not rewritten. */
export function applyEdit(
  deps: ApplyEditDeps,
  { href, text }: ApplyHyperlinkArgs,
  commandOpts?: ApplyHyperlinkCommandOpts
): boolean {
  if (deps.editor.isDestroyed) return false
  const focus = commandOpts?.focus !== false
  const markName = deps.markName ?? 'hyperlink'
  const chain = focus ? deps.editor.chain().focus() : deps.editor.chain()
  if (typeof deps.nodePos === 'number') {
    const range = markRangeAt(deps.editor, {
      nodePos: deps.nodePos,
      markName,
      expectedHref: deps.expectedHref
    })
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
