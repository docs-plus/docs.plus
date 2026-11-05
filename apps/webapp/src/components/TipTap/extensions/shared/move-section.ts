import type { Fragment } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

/**
 * One transaction (one undo). Always delete first: inserting first briefly holds
 * two copies of every `toc-id`. Returns the start of the inserted content.
 */
export function moveSection(
  tr: Transaction,
  sectionFrom: number,
  sectionTo: number,
  targetPos: number,
  content: Fragment
): number {
  tr.delete(sectionFrom, sectionTo)
  const insertAt = tr.mapping.map(targetPos)
  tr.insert(insertAt, content)
  return insertAt
}
