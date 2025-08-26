import { useCallback } from 'react'
import { TMsgRow } from '@types'

export const useEmojiPicker = () => {
  const openEmojiPicker = useCallback((event: React.MouseEvent, message: TMsgRow) => {
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
