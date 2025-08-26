import { useCallback, useEffect } from 'react'

const CLOSE_TO_BOTTOM_THRESHOLD = 70

export const useAutoScrollOnMessageContext = (messageMemory: any) => {
  const isUserCloseToBottom = useCallback(() => {
    const messageContainerRef = document.querySelector('.message-feed') as HTMLElement
    if (!messageContainerRef) return false

    const { scrollTop, scrollHeight, clientHeight } = messageContainerRef

    return scrollHeight - scrollTop - clientHeight <= CLOSE_TO_BOTTOM_THRESHOLD
  }, [])

  useEffect(() => {
    if (messageMemory && isUserCloseToBottom()) {
      const messageContainerRef = document.querySelector('.message-list') as HTMLElement
      if (messageContainerRef) {
        messageContainerRef.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    }
  }, [messageMemory, isUserCloseToBottom])
}
