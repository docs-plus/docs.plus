import { Editor } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import { collectMediaGripperInfo, createMediaResizeGripper } from './media-resize-gripper'

/** One widget-decoration gripper per resizable media node, keyed for stable reuse across maps. */
export function buildOptimizedDecorations(
  nodeNames: string[],
  doc: ProseMirrorNode,
  editor: Editor
): DecorationSet {
  const contentWrappers = collectMediaGripperInfo(nodeNames, doc)

  const decorations = contentWrappers.map((gripperInfo) => {
    const options = {
      side: -1,
      key: gripperInfo.keyId || `gripper-${gripperInfo.from}`
    }
    // Lazy `toDOM`: prosemirror-view only reuses a keyed widget whose previous
    // `toDOM` has no parentNode, so an eagerly built element rebuilds every
    // gripper — 9 elements and 8 listeners per node — on every decoration pass.
    return Decoration.widget(
      gripperInfo.from,
      () => createMediaResizeGripper(gripperInfo, editor),
      options
    )
  })

  return DecorationSet.create(doc, decorations)
}
