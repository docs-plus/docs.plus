import { useCallback } from 'react'
import PubSub from 'pubsub-js'
import { CHAT_OPEN } from '@services/eventsHub'

interface OpenChatOptions {
  scrollTo?: boolean
  focusEditor?: boolean
}

/**
 * Hook to open chat room for a heading.
 */
const useOpenChat = () => {
  const openChat = useCallback((headingId: string, options: OpenChatOptions = {}) => {
    if (!headingId) return

    PubSub.publish(CHAT_OPEN, {
      headingId,
      scrollTo: options.scrollTo ?? false,
      focusEditor: options.focusEditor ?? true
    })
  }, [])

  return openChat
}

export default useOpenChat
