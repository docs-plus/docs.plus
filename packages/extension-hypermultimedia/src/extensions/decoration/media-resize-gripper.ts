import { Editor } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'

import { attachGripperDrag, computeCornerBox, computeSideBox } from './gripperDrag'
import { ClampType, Corner, MediaGripperInfo } from './types'

function createClamp(extraClass: ClampType): HTMLDivElement {
  const clamp = document.createElement('div')
  clamp.classList.add('media-resize-clamp', extraClass)
  return clamp
}

function createClamps() {
  return {
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

export function collectMediaGripperInfo(
  nodeNames: string[],
  doc: ProseMirrorNode
): MediaGripperInfo[] {
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
  if (mediaInfo.keyId) {
    gripper.dataset.mediaKeyId = mediaInfo.keyId
  }

  const clamps = createClamps()
  gripper.append(...clamps.sides, ...Object.values(clamps.corners))

  clamps.sides.forEach((clamp) => {
    attachGripperDrag({ clamp, gripper, editor, mediaInfo, computeBox: computeSideBox })
  })

  Object.entries(clamps.corners).forEach(([corner, clamp]) => {
    attachGripperDrag({
      clamp,
      gripper,
      editor,
      mediaInfo,
      computeBox: computeCornerBox(corner as Corner)
    })
  })

  return gripper
}
