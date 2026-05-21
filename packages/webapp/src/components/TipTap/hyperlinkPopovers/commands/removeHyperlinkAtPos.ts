import type { Editor } from '@tiptap/core'
import { getMarkRange } from '@tiptap/core'

/** Unset hyperlink at doc position when preview adapter returned null (no selection placed). */
export function removeHyperlinkAtPos(deps: { editor: Editor; nodePos: number }): boolean {
  const { editor, nodePos } = deps
  if (editor.isDestroyed) return false
  const markType = editor.schema.marks.hyperlink
  if (!markType) return false
  const range = getMarkRange(editor.state.doc.resolve(nodePos), markType)
  if (!range) return false
  // No leading `.focus()`: preview already blurred the editor; refocus is
  // owned by store `close({ refocus: true })` to avoid an iOS keyboard flicker.
  return editor.chain().setTextSelection(range).unsetHyperlink().run()
}
