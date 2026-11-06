import type { Node as PMNode } from '@tiptap/pm/model'

import { computeSection } from '../../shared'

/** A folded section: `headingEnd` is the caret spot at the heading's end, `to` the section end. */
interface FoldedSection {
  id: string
  headingEnd: number
  to: number
}

/** Folded sections whose hidden body holds `pos`, outermost first. */
export function foldedSectionsAt(
  doc: PMNode,
  pos: number,
  foldedIds: Set<string>
): FoldedSection[] {
  const found: FoldedSection[] = []
  if (foldedIds.size === 0) return found

  let offset = 0
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i)
    const nodePos = offset
    offset += child.nodeSize
    if (nodePos > pos) break
    if (child.type.name !== 'heading') continue

    const id = child.attrs['toc-id'] as string | undefined
    if (!id || !foldedIds.has(id) || pos < offset) continue

    const { to } = computeSection(doc, nodePos, child.attrs.level as number, i)
    if (pos < to) found.push({ id, headingEnd: offset - 1, to })
  }
  return found
}
