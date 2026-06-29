import { Editor } from '@tiptap/core'

import {
  resolveSoundCloudExtensionOptions,
  resolveSoundCloudLayoutMinHeight
} from '../../nodes/soundcloud/embedOptions'
import { resolveSpotifyLayoutMinHeight } from '../../nodes/spotify/embedOptions'
import { fitDimensionsToBounds, getEditorContentWidth } from '../../utils/fitImageDimensions'
import { PointerPosition, ResizeConstraints } from './types'

export const DEFAULT_CONSTRAINTS: ResizeConstraints = {
  minWidth: 160,
  minHeight: 80
}

export function getPointerPosition(e: MouseEvent | TouchEvent | PointerEvent): PointerPosition {
  if (e instanceof PointerEvent) {
    return { x: e.clientX, y: e.clientY }
  }
  if (e.type.startsWith('touch') && 'touches' in e && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const mouseEvent = e as MouseEvent
  return { x: mouseEvent.clientX, y: mouseEvent.clientY }
}

/** Aspect-locked resize: the larger pointer delta drives the axis the other follows. */
export function calculateAspectRatioDimensions(
  deltaX: number,
  deltaY: number,
  initialWidth: number,
  initialHeight: number,
  aspectRatio: number,
  corner: string
): { width: number; height: number } {
  let newWidth: number
  let newHeight: number
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (absX > absY) {
    switch (corner) {
      case 'topRight':
      case 'bottomRight':
        newWidth = initialWidth + deltaX
        break
      case 'topLeft':
      case 'bottomLeft':
        newWidth = initialWidth - deltaX
        break
      default:
        newWidth = initialWidth + deltaX
    }
    newHeight = newWidth / aspectRatio
  } else {
    switch (corner) {
      case 'topRight':
      case 'topLeft':
        newHeight = initialHeight - deltaY
        break
      case 'bottomRight':
      case 'bottomLeft':
        newHeight = initialHeight + deltaY
        break
      default:
        newHeight = initialHeight + deltaY
    }
    newWidth = newHeight * aspectRatio
  }

  return { width: newWidth, height: newHeight }
}

export function resolveResizeConstraints(editor: Editor): ResizeConstraints {
  const maxWidth = getEditorContentWidth(editor)
  return {
    ...DEFAULT_CONSTRAINTS,
    ...(maxWidth > 0 ? { maxWidth } : {})
  }
}

export function resolveMediaNodeConstraints(
  editor: Editor,
  node?: { type: { name: string }; attrs: Record<string, unknown> } | null
): ResizeConstraints {
  const base = resolveResizeConstraints(editor)
  if (!node) return base

  if (node.type.name === 'soundcloud') {
    const options = resolveSoundCloudExtensionOptions(editor)
    const minHeight = resolveSoundCloudLayoutMinHeight(node.attrs, options)
    return { ...base, minHeight: Math.max(base.minHeight, minHeight) }
  }

  if (node.type.name === 'spotify') {
    const minHeight = resolveSpotifyLayoutMinHeight(node.attrs)
    return { ...base, minHeight: Math.max(base.minHeight, minHeight) }
  }

  return base
}

export function clampDimensionsToConstraints(
  width: number,
  height: number,
  constraints: ResizeConstraints
): { width: number; height: number } {
  const maxWidth = constraints.maxWidth ?? Number.POSITIVE_INFINITY
  const maxHeight = constraints.maxHeight ?? Number.POSITIVE_INFINITY
  const fitted = fitDimensionsToBounds(width, height, { maxWidth, maxHeight })
  return {
    width: Math.max(constraints.minWidth, fitted.width),
    height: Math.max(constraints.minHeight, fitted.height)
  }
}

export function updateNodeDimensions(
  editor: Editor,
  nodePos: number,
  width: number,
  height: number
): void {
  const { state, dispatch } = editor.view
  const { tr } = state

  // A stale position must never throw (nodeAt RangeErrors past doc end) or resize a
  // foreign node — resizable media nodes are the ones carrying keyId + width attrs.
  if (nodePos < 0 || nodePos > state.doc.content.size) return
  const nodeAtPos = state.doc.nodeAt(nodePos)
  if (!nodeAtPos || !('keyId' in nodeAtPos.attrs) || !('width' in nodeAtPos.attrs)) return

  const clamped = clampDimensionsToConstraints(
    width,
    height,
    resolveMediaNodeConstraints(editor, nodeAtPos)
  )
  tr.setNodeMarkup(nodePos, null, {
    ...nodeAtPos.attrs,
    width: clamped.width,
    height: clamped.height
  })

  tr.setMeta('resizeMedia', true)
  tr.setMeta('addToHistory', true)
  dispatch(tr)
}

/** Style pixels are the source of truth: the gripper may be detached/`display:none` post-rebuild. */
export function readGripperDimensions(gripper: HTMLElement): {
  width: number
  height: number
} {
  const fromStyle = (axis: 'width' | 'height') => parseFloat(gripper.style[axis])
  return {
    width: fromStyle('width') || gripper.offsetWidth,
    height: fromStyle('height') || gripper.offsetHeight
  }
}

export function resetGripperPosition(
  gripper: HTMLElement,
  initialLeft: number,
  initialTop: number
): void {
  gripper.style.left = `${initialLeft}px`
  gripper.style.top = `${initialTop}px`
}

/** Drag-scoped Shift tracking; caller must `cleanup()` on drag end to avoid leaking listeners. */
export function setupKeyboardListeners(): {
  isShiftPressed: () => boolean
  cleanup: () => void
} {
  let shiftPressed = false

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') {
      shiftPressed = true
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') {
      shiftPressed = false
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)

  return {
    isShiftPressed: () => shiftPressed,
    cleanup: () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }
}
