import { Editor } from '@tiptap/core'

import { hideCurrentToolbar } from '../../utils/floating-toolbar'
import { MediaGripperInfo, ResizeState } from './types'
import {
  DEFAULT_CONSTRAINTS,
  getPointerPosition,
  meetsConstraints,
  resetGripperPosition,
  updateNodeDimensions} from './utils'

export default function handleSideClampsMove(
  clamp: HTMLElement,
  gripper: HTMLElement,
  editor: Editor,
  mediaInfo: MediaGripperInfo
): void {
  function handleStart(e: MouseEvent | TouchEvent) {
    e.preventDefault()

    // Hide toolbar during resize and remember if it was visible
    hideCurrentToolbar()

    const { x, y } = getPointerPosition(e)

    const resizeState: ResizeState = {
      initialX: x,
      initialY: y,
      initialWidth: gripper.offsetWidth,
      initialHeight: gripper.offsetHeight,
      initialTop: gripper.offsetTop,
      initialLeft: gripper.offsetLeft,
      isShiftPressed: false // Side clamps don't use aspect ratio
    }

    function handleMove(e: MouseEvent | TouchEvent) {
      const { x, y } = getPointerPosition(e)
      const deltaX = x - resizeState.initialX
      const deltaY = y - resizeState.initialY

      let newWidth = resizeState.initialWidth
      let newHeight = resizeState.initialHeight
      let newTop = resizeState.initialTop
      let newLeft = resizeState.initialLeft

      // Determine which side clamp is being used and calculate new dimensions
      if (clamp.classList.contains('media-resize-clamp--left')) {
        newWidth = resizeState.initialWidth - deltaX
        newLeft = resizeState.initialLeft + deltaX
      } else if (clamp.classList.contains('media-resize-clamp--right')) {
        newWidth = resizeState.initialWidth + deltaX
      } else if (clamp.classList.contains('media-resize-clamp--top')) {
        newHeight = resizeState.initialHeight - deltaY
        newTop = resizeState.initialTop + deltaY
      } else if (clamp.classList.contains('media-resize-clamp--bottom')) {
        newHeight = resizeState.initialHeight + deltaY
      }

      // Apply changes only if they meet constraints
      if (meetsConstraints(newWidth, newHeight, DEFAULT_CONSTRAINTS)) {
        gripper.style.width = `${newWidth}px`
        gripper.style.height = `${newHeight}px`
        gripper.style.top = `${newTop}px`
        gripper.style.left = `${newLeft}px`
      }
    }

    function handleEnd() {
      // Cleanup and finalize resize
      const finalWidth = gripper.offsetWidth
      const finalHeight = gripper.offsetHeight

      // Reset gripper position
      resetGripperPosition(gripper, resizeState.initialLeft, resizeState.initialTop)

      // Update ProseMirror node
      if (mediaInfo.from !== undefined) {
        updateNodeDimensions(editor, mediaInfo.from, finalWidth, finalHeight)
      }

      // Update DOM element directly for immediate visual feedback
      const domAtPos = editor.view.nodeDOM(mediaInfo.from) as HTMLElement | null
      if (domAtPos) {
        domAtPos.style.width = `${finalWidth}px`
        domAtPos.style.height = `${finalHeight}px`
      }

      // Remove event listeners
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }

    // Add event listeners
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove)
    document.addEventListener('touchend', handleEnd)
  }

  // Add initial event listeners
  clamp.addEventListener('mousedown', handleStart)
  clamp.addEventListener('touchstart', handleStart)
}
