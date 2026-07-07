import type { Editor } from '@tiptap/core'

import { HIDE_RESIZE_GRIPPER_META } from '../extensions/decorationHelpers'

export const applyNodeAttributes = (
  editor: Editor,
  nodePos: number,
  attributes: Record<string, string | number | null>
): void => {
  const { state, dispatch } = editor.view
  const transaction = state.tr
  const node = transaction.doc.nodeAt(nodePos)

  if (!node) return

  Object.entries(attributes).forEach(([key, value]) => {
    transaction.setNodeAttribute(nodePos, key, value)
  })
  transaction.setMeta(HIDE_RESIZE_GRIPPER_META, true)
  dispatch(transaction)
}

/** Commit caption text without the hide-gripper meta — typing must not tear down the shell. */
export const setMediaCaption = (editor: Editor, nodePos: number, caption: string | null): void => {
  if (!editor.isEditable) return
  const { state, dispatch } = editor.view
  if (!state.doc.nodeAt(nodePos)) return
  dispatch(state.tr.setNodeAttribute(nodePos, 'caption', caption))
}
