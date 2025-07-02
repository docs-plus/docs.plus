import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Editor } from '@tiptap/core'
import { createMediaResizeGripper, extractImageNode } from './media-resize-gripper'
import { MediaGripperInfo } from './types'

/**
 * Optimized decoration builder for media resize grippers
 * @param nodeNames - Array of node type names to create grippers for
 * @param doc - ProseMirror document
 * @param editor - TipTap editor instance
 * @returns DecorationSet with resize grippers
 */
export function buildOptimizedDecorations(
  nodeNames: string[],
  doc: ProseMirrorNode,
  editor: Editor
): DecorationSet {
  const contentWrappers = extractImageNode(nodeNames, doc)

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

// Legacy function for backward compatibility
export function buildDecorations(
  nodeNames: string[],
  doc: any,
  editorView: any,
  editor: any
): DecorationSet {
  return buildOptimizedDecorations(nodeNames, doc, editor)
}

// Re-export types for external use
export type { MediaGripperInfo } from './types'
