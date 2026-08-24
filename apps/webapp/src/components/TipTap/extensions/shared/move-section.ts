import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

/**
 * One transaction (one undo). Insert-then-delete when moving up;
 * delete-then-insert when moving down so ProseMirror mapping stays valid.
 */
export function moveSection(
  tr: Transaction,
  doc: PMNode,
  sectionFrom: number,
  sectionTo: number,
  targetPos: number
): Transaction {
  const slice = doc.slice(sectionFrom, sectionTo)

  if (targetPos < sectionFrom) {
    tr.insert(targetPos, slice.content)
    tr.delete(tr.mapping.map(sectionFrom), tr.mapping.map(sectionTo))
  } else {
    tr.delete(sectionFrom, sectionTo)
    tr.insert(tr.mapping.map(targetPos), slice.content)
  }

  return tr
}
