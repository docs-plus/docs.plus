import { getMarkRange } from '@tiptap/core'
import type { MarkType } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'

/**
 * The link around a collapsed caret, or `null`. The caret must sit strictly inside one link:
 * at either edge, Mod-K must still open the create form. Two touching links count as an edge.
 */
export const linkAtSelection = (
  state: EditorState,
  markType: MarkType
): { from: number; to: number; href: string } | null => {
  const { selection } = state
  if (!selection.empty) return null
  const { $from } = selection
  const before = $from.nodeBefore && markType.isInSet($from.nodeBefore.marks)
  const after = $from.nodeAfter && markType.isInSet($from.nodeAfter.marks)
  if (!before || !after || !before.eq(after)) return null
  const href = after.attrs.href
  if (typeof href !== 'string' || !href) return null
  const range = getMarkRange($from, markType, after.attrs)
  if (!range) return null
  return { from: range.from, to: range.to, href }
}
