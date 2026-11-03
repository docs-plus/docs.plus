import type { Editor, Range } from '@tiptap/core'
import { getMarkRange } from '@tiptap/core'

/**
 * `expectedHref` is the raw stored href read at open time, so a stale `nodePos` that lands on
 * another link finds nothing. `undefined` skips that check.
 */
export function markRangeAt(
  editor: Editor,
  {
    nodePos,
    markName,
    expectedHref
  }: { nodePos: number; markName: string; expectedHref: string | undefined }
): Range | null {
  const markType = editor.schema.marks[markName]
  if (!markType) return null
  const attrs = expectedHref === undefined ? undefined : { href: expectedHref }
  return getMarkRange(editor.state.doc.resolve(nodePos), markType, attrs) ?? null
}
