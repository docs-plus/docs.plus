export const calculateEmojiPickerPosition = (elementRect: DOMRect) => {
  const emojiPickerElement = document.querySelector('em-emoji-picker') as HTMLElement
  if (!emojiPickerElement) return undefined

  const { clientHeight, clientWidth } = emojiPickerElement

  const emojiButtonWidth = 24
  const chatEditorHeight = 153

  let newTop = elementRect.y || elementRect.top
  let newLeft = elementRect.x || elementRect.left

  if (newLeft + clientWidth + emojiButtonWidth > window.innerWidth) {
    newLeft = newLeft - clientWidth
  }
  if (newTop + clientHeight + chatEditorHeight > window.innerHeight) {
    newTop = newTop - clientHeight
  }

  newTop = Math.max(0, newTop)
  newLeft = Math.max(0, newLeft)

  return {
    top: newTop,
    left: newLeft
  }
}
