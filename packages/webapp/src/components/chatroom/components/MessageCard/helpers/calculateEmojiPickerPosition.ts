/**
 * Calculates the optimal position for the emoji picker panel based on element bounds
 * and viewport constraints to ensure it stays within the visible area.
 *
 * @param elementRect - The bounding client rectangle of the trigger element
 * @returns Position object with top and left coordinates, or undefined if no elementRect
 */
export const calculateEmojiPickerPosition = (elementRect: DOMRect) => {
  const emojiPickerElement = document.querySelector('em-emoji-picker') as HTMLElement
  if (!emojiPickerElement) return undefined

  const { clientHeight, clientWidth } = emojiPickerElement

  // we need to pick up these dynamic values from the DOM
  const emojiButtonWidth = 24
  const chatEditorHeight = 153

  let newTop = elementRect.y || elementRect.top
  let newLeft = elementRect.x || elementRect.left

  // Adjust for right and bottom edges
  if (newLeft + clientWidth + emojiButtonWidth > window.innerWidth) {
    newLeft = newLeft - clientWidth
  }
  if (newTop + clientHeight + chatEditorHeight > window.innerHeight) {
    newTop = newTop - clientHeight
  }

  // Adjust for top and left edges
  newTop = Math.max(0, newTop)
  newLeft = Math.max(0, newLeft)

  return {
    top: newTop,
    left: newLeft
  }
}
