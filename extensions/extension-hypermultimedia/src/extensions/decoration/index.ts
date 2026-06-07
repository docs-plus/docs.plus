import { Editor } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import { collectMediaGripperInfo, createMediaResizeGripper } from './media-resize-gripper'
import { MediaGripperInfo } from './types'

/** One widget-decoration gripper per resizable media node, keyed for stable reuse across maps. */
export function buildOptimizedDecorations(
  nodeNames: string[],
  doc: ProseMirrorNode,
  editor: Editor
): DecorationSet {
  const contentWrappers = collectMediaGripperInfo(nodeNames, doc)

  const decorations = contentWrappers.map((gripperInfo: MediaGripperInfo) => {
    const gripper = createMediaResizeGripper(gripperInfo, editor)
    const options = {
      side: -1,
      key: gripperInfo.keyId || `gripper-${gripperInfo.from}`
    }
    return Decoration.widget(gripperInfo.from, gripper, options)
  })

  return DecorationSet.create(doc, decorations)
}

export type { MediaGripperInfo } from './types'
