import { closeMessageReaction } from '@components/chatroom/utils/messageReaction'
import { useChatStore } from '@stores'
import { useCallback, useEffect } from 'react'

export const useCloseOnResize = () => {
  const isOpen = useChatStore((state) => state.emojiPicker.isOpen)

  const handleResize = useCallback(() => {
    if (isOpen) {
      closeMessageReaction()
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
