import { closeToolbarPopover } from './menu'
import { resolveMediaActions } from './registry'
import { renderMediaToolbar } from './renderToolbar'
import type { MediaActionContext, MediaToolbarFactory } from './types'

/** Default desktop toolbar: resolve actions for the node, render the in-place bar. */
export const createMediaToolbar: MediaToolbarFactory = ({ target, editor, nodeType, nodePos }) => {
  const node = editor.state.doc.nodeAt(nodePos)
  if (!node || node.type.name !== nodeType) return null

  const ctx: MediaActionContext = {
    editor,
    nodeType,
    nodePos,
    attrs: node.attrs,
    wrapper: target,
    close: closeToolbarPopover
  }

  return renderMediaToolbar(ctx, resolveMediaActions(editor, nodeType))
}
