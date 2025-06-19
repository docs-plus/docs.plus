import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Editor } from '@tiptap/core'
import handleSideMove from './handleSideClampsMove'
import handleCornerMove from './handleCornerClampsMove'
import { MediaGripperInfo } from './index'

enum ClampType {
  Left = 'media-resize-clamp--left',
  Right = 'media-resize-clamp--right',
  Top = 'media-resize-clamp--top',
  Bottom = 'media-resize-clamp--bottom',
  TopRight = 'media-resize-clamp--top-right',
  TopLeft = 'media-resize-clamp--top-left',
  BottomRight = 'media-resize-clamp--bottom-right',
  BottomLeft = 'media-resize-clamp--bottom-left',
  Rotate = 'media-resize-clamp--rotate'
}

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
      result.push({ from: pos, to: pos + nodeSize, nodeSize, childCount, keyId: node.attrs.keyId })
    }
  })
  return result
}

export const createMediaResizeGripper = (
  prob: MediaGripperInfo,
  editor: Editor
): HTMLDivElement => {
  const gripper = document.createElement('div')
  gripper.classList.add('hypermultimedia__resize-gripper')

  const clamps = createClamps()
  gripper.append(/*clamps.rotate,*/ ...clamps.sides, ...Object.values(clamps.corners))

  // handleRotateMove(clamps.rotate, gripper, editor, prob);
  ;[...clamps.sides].forEach((clamp) => {
    handleSideMove(clamp, gripper, editor, prob)
  })

  Object.entries(clamps.corners).forEach(([corner, clampElement]) => {
    handleCornerMove(clampElement, corner as keyof typeof clamps.corners, gripper, editor, prob)
  })

  return gripper
}
