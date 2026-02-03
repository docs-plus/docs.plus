import { Editor } from '@tiptap/core'

import { hideCurrentToolbar } from '../../utils/floating-toolbar'
import { Corner, MediaGripperInfo, ResizeState } from './types'
import {
  calculateAspectRatioDimensions,
  DEFAULT_CONSTRAINTS,
  getPointerPosition,
  meetsConstraints,
  resetGripperPosition,
  setupKeyboardListeners,
  updateNodeDimensions
} from './utils'

export default function handleCornerClampsMove(
  clamp: HTMLElement,
  corner: Corner,
  gripper: HTMLElement,
  editor: Editor,
  mediaInfo: MediaGripperInfo
): void {
  const keyboardListener = setupKeyboardListeners()

  function handleDown(e: MouseEvent | TouchEvent) {
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
      aspectRatio: gripper.offsetWidth / gripper.offsetHeight,
      isShiftPressed: keyboardListener.isShiftPressed()
    }

    function handleMove(ev: MouseEvent | TouchEvent) {
      const { x: moveX, y: moveY } = getPointerPosition(ev)
      const deltaX = moveX - resizeState.initialX
      const deltaY = moveY - resizeState.initialY

      // Update shift key state
      resizeState.isShiftPressed = keyboardListener.isShiftPressed()

      let newWidth: number
      let newHeight: number
      let newTop = resizeState.initialTop
      let newLeft = resizeState.initialLeft

      if (resizeState.isShiftPressed && resizeState.aspectRatio) {
        // Maintain aspect ratio when shift is pressed
        const dimensions = calculateAspectRatioDimensions(
          deltaX,
          deltaY,
          resizeState.initialWidth,
          resizeState.initialHeight,
          resizeState.aspectRatio,
          corner
        )
        newWidth = dimensions.width
        newHeight = dimensions.height

        // Adjust position based on corner and aspect ratio constraints
        switch (corner) {
          case 'topRight':
            newTop = resizeState.initialTop + (resizeState.initialHeight - newHeight)
            break
          case 'bottomLeft':
            newLeft = resizeState.initialLeft + (resizeState.initialWidth - newWidth)
            break
          case 'topLeft':
            newTop = resizeState.initialTop + (resizeState.initialHeight - newHeight)
            newLeft = resizeState.initialLeft + (resizeState.initialWidth - newWidth)
            break
          case 'bottomRight':
            // No position adjustment needed
            break
        }
      } else {
        // Free resize without aspect ratio constraints
        switch (corner) {
          case 'topRight':
            newWidth = resizeState.initialWidth + deltaX
            newHeight = resizeState.initialHeight - deltaY
            newTop = resizeState.initialTop + deltaY
            break
          case 'bottomLeft':
            newWidth = resizeState.initialWidth - deltaX
            newHeight = resizeState.initialHeight + deltaY
            newLeft = resizeState.initialLeft + deltaX
            break
          case 'topLeft':
            newWidth = resizeState.initialWidth - deltaX
            newHeight = resizeState.initialHeight - deltaY
            newTop = resizeState.initialTop + deltaY
            newLeft = resizeState.initialLeft + deltaX
            break
          case 'bottomRight':
            newWidth = resizeState.initialWidth + deltaX
            newHeight = resizeState.initialHeight + deltaY
            break
        }
      }

      // Apply changes only if they meet constraints
      if (meetsConstraints(newWidth, newHeight, DEFAULT_CONSTRAINTS)) {
        gripper.style.width = `${newWidth}px`
        gripper.style.height = `${newHeight}px`
        gripper.style.top = `${newTop}px`
        gripper.style.left = `${newLeft}px`
      }
    }

    function handleUp() {
      // Cleanup and finalize resize
      const finalWidth = gripper.offsetWidth
      const finalHeight = gripper.offsetHeight

      // Reset gripper position
      resetGripperPosition(gripper, resizeState.initialLeft, resizeState.initialTop)

      // Update ProseMirror node
      if (mediaInfo.from !== undefined) {
        updateNodeDimensions(editor, mediaInfo.from, finalWidth, finalHeight)
      }

      editor.commands.blur()

      // Remove event listeners
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleUp)
    }

    // Add event listeners
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    document.addEventListener('touchmove', handleMove)
    document.addEventListener('touchend', handleUp)
  }

  // Add initial event listeners
  clamp.addEventListener('mousedown', handleDown)
  clamp.addEventListener('touchstart', handleDown)

  // Cleanup keyboard listeners when component is destroyed
  // Note: In a real implementation, you'd want to call keyboardListener.cleanup()
  // when the component is unmounted or the editor is destroyed
}
