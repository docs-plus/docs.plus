import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * Heading through the next same-or-higher top-level heading (or doc end).
 * Pass `startChildIndex` when known to skip the leading walk.
 */
export function computeSection(
  doc: PMNode,
  headingPos: number,
  headingLevel: number,
  startChildIndex?: number
): { from: number; to: number } {
  let startIdx: number
  let offset: number

  if (startChildIndex !== undefined) {
    startIdx = startChildIndex + 1
    offset = headingPos + doc.content.child(startChildIndex).nodeSize
  } else {
    startIdx = 0
    offset = 0
  }

  for (let i = startIdx; i < doc.content.childCount; i++) {
    const node = doc.content.child(i)
    const pos = offset
    offset += node.nodeSize
    if (pos <= headingPos) continue
    if (node.type.name === 'heading' && (node.attrs.level as number) <= headingLevel) {
      return { from: headingPos, to: pos }
    }
  }
  return { from: headingPos, to: doc.content.size }
}
