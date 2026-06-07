import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

/**
 * Move a document section (from..to) to targetPos within a single transaction.
 *
 * Transaction ordering matters for correct ProseMirror mapping:
 * - Moving UP: insert at target first, then delete mapped source
 * - Moving DOWN: delete source first, then insert at mapped target
 *
 * All steps are in one transaction = single undo step.
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
