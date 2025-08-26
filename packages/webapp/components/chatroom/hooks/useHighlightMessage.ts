import { useCallback, useEffect, useRef, useState } from 'react'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useChatStore } from '@stores'

// Constants
const HIGHLIGHT_DURATION_MS = 4000
const MESSAGE_RETRY_MAX = 5
const SCROLL_TIMEOUT_MS = 300
const DEBOUNCE_DELAY = 100

// Types
type Prop = {
  messageContainerRef: React.RefObject<HTMLDivElement | null>
}

export const useHighlightMessage = ({ messageContainerRef }: Prop) => {
  const { isChannelDataLoaded, isDbSubscriptionReady } = useChatroomContext()
  const isReadyToDisplayMessages = useChatStore((state) => state.chatRoom.isReadyToDisplayMessages)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const observerRef = useRef<MutationObserver | undefined>(undefined)
  const [highlightedMessageExists, setHighlightedMessageExists] = useState(false)

  const updateChatRoom = useChatStore((state) => state.updateChatRoom)
  const getFetchMessageId = useCallback(() => {
    return (
      useChatStore.getState().chatRoom.fetchMsgsFromId ||
      new URLSearchParams(window.location.search).get('msg_id')
    )
  }, [])

  // Cleanup helper
  const cleanup = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = undefined
    }
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = undefined
    }
  }, [])

  const findMessageElement = useCallback(
    (container: HTMLElement, messageId: string): HTMLElement | null => {
      const messageElements = container.querySelectorAll('.msg_card')
      for (const element of messageElements) {
        const typedElement = element as HTMLElement & { msgId?: string }
        if (typedElement.msgId === messageId) {
          return typedElement
        }
      }
      return null
    },
    []
  )

  // Message highlight logic
  const highlightMessage = useCallback((element: HTMLElement) => {
    const chatBubble = element.querySelector('.chat-bubble')
    if (!chatBubble) return

    chatBubble.classList.add('border-ping-glow')

    setTimeout(() => {
      chatBubble.classList.remove('border-ping-glow')
      setHighlightedMessageExists(false)
    }, HIGHLIGHT_DURATION_MS)
  }, [])

  // Simple scroll completion handler - separated from scroll logic
  const handleScrollComplete = useCallback(() => {
    cleanup()
    updateChatRoom('isReadyToDisplayMessages', true)
  }, [cleanup, updateChatRoom])

  // Simplified scroll to specific message
  const scrollToMessage = useCallback(() => {
    const fetchMsgsFromId = getFetchMessageId()
    if (!messageContainerRef.current || !fetchMsgsFromId) return

    const container = messageContainerRef.current
    cleanup()

    const attemptScroll = (): boolean => {
      const targetElement = findMessageElement(container, fetchMsgsFromId)
      if (targetElement) {
        targetElement.scrollIntoView({ block: 'center', behavior: 'smooth' })
        highlightMessage(targetElement)

        // Set up scroll completion
        const onScrollEnd = () => {
          container.removeEventListener('scrollend', onScrollEnd)
          handleScrollComplete()
        }
        container.addEventListener('scrollend', onScrollEnd)

        scrollTimeoutRef.current = setTimeout(() => {
          container.removeEventListener('scrollend', onScrollEnd)
          handleScrollComplete()
        }, SCROLL_TIMEOUT_MS)

        return true
      }
      return false
    }

    // Try immediate scroll first
    if (attemptScroll()) return

    // Set up observer for delayed messages
    let retryCount = 0
    observerRef.current = new MutationObserver(() => {
      if (attemptScroll() || retryCount++ >= MESSAGE_RETRY_MAX) {
        observerRef.current?.disconnect()
        if (retryCount >= MESSAGE_RETRY_MAX) {
          // Fallback to bottom scroll
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'instant'
          })
          setHighlightedMessageExists(false)
          useChatStore.getState().updateChatRoom('fetchMsgsFromId', undefined)
        }
      }
    })

    observerRef.current.observe(container, { childList: true, subtree: true })
  }, [
    getFetchMessageId,
    findMessageElement,
    highlightMessage,
    cleanup,
    handleScrollComplete,
    messageContainerRef
  ])

  useEffect(() => {
    if (!isDbSubscriptionReady || !isChannelDataLoaded || isReadyToDisplayMessages) return
    const fetchMsgsFromId = getFetchMessageId()
    if (!fetchMsgsFromId) return

    const scrollTimer = setTimeout(() => {
      setHighlightedMessageExists(true)
      scrollToMessage()
    }, DEBOUNCE_DELAY)

    return () => clearTimeout(scrollTimer)
  }, [isDbSubscriptionReady, isChannelDataLoaded, isReadyToDisplayMessages])

  return { highlightedMessageExists }
}
