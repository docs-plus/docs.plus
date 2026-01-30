import { Editor } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'

import handleCornerClampsMove from './handleCornerClampsMove'
import handleSideClampsMove from './handleSideClampsMove'
import { ClampType,MediaGripperInfo } from './types'

function createClamp(extraClass: ClampType): HTMLDivElement {
  const clamp = document.createElement('div')
  clamp.classList.add('media-resize-clamp', extraClass)
  return clamp
}

function createClamps() {
  return {
    rotate: createClamp(ClampType.Rotate),
    sides: [
      createClamp(ClampType.Left),
      createClamp(ClampType.Right),
      createClamp(ClampType.Top),
      createClamp(ClampType.Bottom)
    ],
    corners: {
      topRight: createClamp(ClampType.TopRight),
      topLeft: createClamp(ClampType.TopLeft),
      bottomRight: createClamp(ClampType.BottomRight),
      bottomLeft: createClamp(ClampType.BottomLeft)
    }
  }
}

export function extractImageNode(nodeNames: string[], doc: ProseMirrorNode): MediaGripperInfo[] {
  const result: MediaGripperInfo[] = []
  doc.descendants((node, pos) => {
    if (nodeNames.includes(node.type.name)) {
      const { size: nodeSize, childCount } = node.content
      result.push({
        from: pos,
        to: pos + nodeSize,
        nodeSize,
        childCount,
        keyId: node.attrs.keyId
      })
    }
  })
  return result
}

export const createMediaResizeGripper = (
  mediaInfo: MediaGripperInfo,
  editor: Editor
): HTMLDivElement => {
  const gripper = document.createElement('div')
  gripper.classList.add('hypermultimedia__resize-gripper')

  const clamps = createClamps()
  gripper.append(/*clamps.rotate,*/ ...clamps.sides, ...Object.values(clamps.corners))

  // Set up side clamps
  clamps.sides.forEach((clamp) => {
    handleSideClampsMove(clamp, gripper, editor, mediaInfo)
  })

  // Set up corner clamps with aspect ratio support
  Object.entries(clamps.corners).forEach(([corner, clampElement]) => {
    handleCornerClampsMove(
      clampElement,
      corner as keyof typeof clamps.corners,
      gripper,
      editor,
      mediaInfo
    )
  })

  return gripper
}
