import { useCallback } from 'react'
import { TMessageWithUser as TMsg } from '@api'

export const useEmojiPicker = () => {
  const openEmojiPicker = useCallback((event: React.MouseEvent, message: TMsg) => {
    const customEvent = new CustomEvent('toggelEmojiPicker', {
      detail: {
        clickEvent: event,
        message,
        type: 'react2Message'
      }
    })
    document.dispatchEvent(customEvent)
  }, [])

  return {
    openEmojiPicker
  }
}
