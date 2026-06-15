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
    // Visibility swap is delayed on hide so the 80ms exit fade stays visible;
    // motion-safe keeps both flips instant under reduced motion.
    return createPortal(
      <div
        className={
          desktopOpen
            ? 'visible opacity-100 motion-safe:[transition:opacity_120ms_ease-out]'
            : 'invisible opacity-0 motion-safe:[transition:opacity_80ms_ease-in,visibility_0s_80ms]'
        }
        style={{
          position: 'fixed',
          top: `${desktopTop || 0}px`,
          left: `${desktopLeft || 0}px`,
          zIndex: 999
        }}>
        <Picker emojiSelectHandler={emojiSelectHandler} />
      </div>,
      document.body
    )
  }

  return <Picker emojiSelectHandler={emojiSelectHandler} />
}
