import { Editor } from '@tiptap/core'
import { PointerPosition, ResizeConstraints } from './types'

export const DEFAULT_CONSTRAINTS: ResizeConstraints = {
  minWidth: 160,
  minHeight: 80
}

/**
 * Extract pointer position from mouse or touch event
 */
export function getPointerPosition(e: MouseEvent | TouchEvent): PointerPosition {
  if (e.type.startsWith('touch') && 'touches' in e && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const mouseEvent = e as MouseEvent
  return { x: mouseEvent.clientX, y: mouseEvent.clientY }
}

/**
 * Calculate dimensions while maintaining aspect ratio
 */
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

  // Determine which dimension should drive the calculation based on which delta is larger
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (absX > absY) {
    // Width-driven calculation
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
    // Height-driven calculation
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

/**
 * Check if dimensions meet minimum constraints
 */
export function meetsConstraints(
  width: number,
  height: number,
  constraints: ResizeConstraints = DEFAULT_CONSTRAINTS
): boolean {
  return width >= constraints.minWidth && height >= constraints.minHeight
}

/**
 * Update ProseMirror node with new dimensions
 */
export function updateNodeDimensions(
  editor: Editor,
  nodePos: number,
  width: number,
  height: number
): void {
  const { state, dispatch } = editor.view
  const { tr } = state

  const nodeAtPos = state.doc.nodeAt(nodePos)
  if (nodeAtPos) {
    tr.setNodeMarkup(nodePos, null, {
      ...nodeAtPos.attrs,
      width,
      height
    })

    tr.setMeta('resizeMedia', true)
    tr.setMeta('addToHistory', true)
    dispatch(tr)
  }
}

/**
 * Reset gripper position to initial values
 */
export function resetGripperPosition(
  gripper: HTMLElement,
  initialLeft: number,
  initialTop: number
): void {
  gripper.style.left = `${initialLeft}px`
  gripper.style.top = `${initialTop}px`
}

/**
 * Add keyboard event listeners for detecting shift key
 */
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
