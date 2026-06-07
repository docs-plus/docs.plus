import { useCloseOnResize } from '@hooks/useCloseOnResize'
import { useChatStore } from '@stores'
import { useCallback } from 'react'
import { createPortal } from 'react-dom'

import { useEmojiPanelContext } from './context/EmojiPanelContext'
import { Picker } from './Picker'

/**
 * Host-agnostic dispatcher: forwards the tapped emoji to the `onSelect`
 * callback provided by the parent mount. Desktop variant additionally owns
 * its portal positioning via leaf selectors on `emojiPicker`.
 */
export const EmojiSelector = () => {
  const { variant, onSelect } = useEmojiPanelContext()
  const desktopTop = useChatStore((s) => (variant === 'desktop' ? s.emojiPicker.position?.top : 0))
  const desktopLeft = useChatStore((s) =>
    variant === 'desktop' ? s.emojiPicker.position?.left : 0
  )
  const desktopOpen = useChatStore((s) => (variant === 'desktop' ? s.emojiPicker.isOpen : false))

  const emojiSelectHandler = useCallback(
    (emoji: { native: string }) => onSelect(emoji.native),
    [onSelect]
  )

  useCloseOnResize()

  if (variant === 'desktop') {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          top: `${desktopTop || 0}px`,
          left: `${desktopLeft || 0}px`,
          visibility: desktopOpen ? 'visible' : 'hidden',
          zIndex: 999
        }}>
        <Picker emojiSelectHandler={emojiSelectHandler} />
      </div>,
      document.body
    )
  }

  return <Picker emojiSelectHandler={emojiSelectHandler} />
}
