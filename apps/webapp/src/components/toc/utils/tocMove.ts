import { isDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import type { Editor } from '@tiptap/core'
import type { TocDropTarget, TocTreeMovePlan, TocTreeMoveResult } from '@types'

import { addressForTarget, planTreeMove, treeMoveTransaction } from './planTreeMove'

/** The one lock rule for TOC moves: the durable pad lock, or an editor that is not editable. */
export const isTocMoveLocked = (editor: Editor): boolean =>
  isDocumentEditingLocked() || !editor.isEditable

/**
 * The editor seam for a TOC move. The drag and the Cypress hatch are its two adapters.
 * Reads the live document each call: a remote edit moves every position.
 */
export function planTocMove(
  editor: Editor | null | undefined,
  sourceId: string,
  target: TocDropTarget
): TocTreeMoveResult | null {
  if (!editor || editor.isDestroyed) return null
  const doc = editor.state.doc
  const address = addressForTarget(doc, target)
  if (!address) return null
  return planTreeMove(doc, sourceId, address, { locked: isTocMoveLocked(editor) })
}

export function commitTocMove(editor: Editor, plan: TocTreeMovePlan): void {
  editor.view.dispatch(treeMoveTransaction(editor.state, plan))
}
