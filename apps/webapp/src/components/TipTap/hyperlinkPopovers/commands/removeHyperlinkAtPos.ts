import type { Editor } from '@tiptap/core'
import { getMarkRange } from '@tiptap/core'

/**
 * Unset hyperlink at doc position when preview adapter returned null (no selection placed).
 * `expectedHref` is the raw stored href read at open time. A stale `nodePos` that now lands
 * on another link then finds no range, so the call does nothing.
 */
export function removeHyperlinkAtPos(deps: {
  editor: Editor
  nodePos: number
  expectedHref?: string
}): boolean {
  const { editor, nodePos, expectedHref } = deps
  if (editor.isDestroyed) return false
  const markType = editor.schema.marks.hyperlink
  if (!markType) return false
  const attrs = expectedHref === undefined ? undefined : { href: expectedHref }
  const range = getMarkRange(editor.state.doc.resolve(nodePos), markType, attrs)
  if (!range) return false
  // Refocus after remove is owned by store `close({ refocus })` when the keyboard was open at open.
  return editor.chain().setTextSelection(range).unsetHyperlink().run()
}
