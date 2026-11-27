import type { Editor } from '@tiptap/core'

import { markRangeAt } from './markRangeAt'

/** `expectedHref` guards a stale `nodePos` (see `markRangeAt`). */
export function removeHyperlinkAtPos(deps: {
  editor: Editor
  nodePos: number
  expectedHref: string | undefined
  markName?: string
  focus?: boolean
}): boolean {
  const { editor, nodePos, expectedHref, markName = 'hyperlink', focus = false } = deps
  if (editor.isDestroyed) return false
  const range = markRangeAt(editor, { nodePos, markName, expectedHref })
  if (!range) return false
  // Mobile refocus is owned by store `close({ refocus })`; desktop passes `focus: true`.
  const chain = focus ? editor.chain().focus() : editor.chain()
  return chain.setTextSelection(range).unsetHyperlink().run()
}
