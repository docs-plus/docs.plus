import type { Editor } from '@tiptap/core'

import { markRangeAt } from './markRangeAt'

/** `expectedHref` guards a stale `nodePos` (see `markRangeAt`). */
export function removeHyperlinkAtPos(deps: {
  editor: Editor
  nodePos: number
  expectedHref: string | undefined
}): boolean {
  const { editor, nodePos, expectedHref } = deps
  if (editor.isDestroyed) return false
  const range = markRangeAt(editor, { nodePos, markName: 'hyperlink', expectedHref })
  if (!range) return false
  // Refocus after remove is owned by store `close({ refocus })` when the keyboard was open at open.
  return editor.chain().setTextSelection(range).unsetHyperlink().run()
}
