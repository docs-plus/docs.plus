import { useChatStore } from '@stores'
import { useCallback, useEffect } from 'react'

export const useCloseOnResize = () => {
  const {
    emojiPicker: { isOpen },
    closeEmojiPicker
  } = useChatStore()

  const handleResize = useCallback(() => {
    if (isOpen) {
      closeEmojiPicker()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen, handleResize])
}
