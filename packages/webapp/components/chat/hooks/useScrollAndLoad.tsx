import { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore } from '@stores'

const SCROLL_TIMEOUT_DELAY = 100

// If the type of messages is different, adjust the Map type accordingly.
export const useScrollAndLoad = (
  initialMessagesLoaded: boolean,
  messageContainerRef: any,
  msgLength: number
) => {
  const [loading, setLoading] = useState<boolean>(msgLength === 0 ? false : true)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const {
    headingId: channelId,
    documentId: workspaceId,
    userPickingEmoji
  } = useChatStore((state) => state.chatRoom)

  const messagesByChannel = useChatStore((state: any) => state.messagesByChannel)
  const messages = messagesByChannel.get(channelId)

  const scrollToBottom = useCallback(
    (options: ScrollIntoViewOptions = {}) => {
      if (userPickingEmoji) return
      if (messagesEndRef.current) {
        if (options.behavior === 'smooth') {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'end' })
        } else {
          messagesEndRef.current.scrollIntoView(false)
        }
      }
    },
    [messagesEndRef]
  )

  const checkIfScrolledToBottom = () => {
    const container = messageContainerRef.current
    if (!container && !loading) return

    const { scrollTop, scrollHeight, clientHeight } = container

    // Check if the container is scrollable (content is taller than the visible area)
    const isScrollable = scrollHeight > clientHeight

    // Calculate the distance to the bottom of the scroll
    // Include a small threshold (e.g., 5px) to account for fractional pixels in calculations
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight <= 100

    // Update loading state based on whether it's scrolled to bottom and is scrollable
    if (isScrollable && isScrolledToBottom) {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Check if the user is close to the bottom of the message list.
    const isUserCloseToBottom = () => {
      if (!messageContainerRef.current) return false

      const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current
      const distanceToBottom = scrollHeight - scrollTop - clientHeight

      // Consider the user close to the bottom if they are within 100px of the bottom.
      return distanceToBottom < 200
    }

    // Decide whether to scroll to the bottom based on loading state and user's position.
    const handleScrollToBottom = () => {
      if (loading) {
        // If still loading, just scroll to bottom without smooth behavior.
        scrollToBottom()
      } else if (isUserCloseToBottom()) {
        // If not loading and user is close to the bottom, scroll smoothly.
        scrollToBottom({ behavior: 'smooth', block: 'end', inline: 'end' })
      }
    }

    // Use a timer to defer scrolling until the new messages are rendered.
    const timer = setTimeout(handleScrollToBottom, 100)

    return () => clearTimeout(timer)
  }, [messages, initialMessagesLoaded, loading, channelId])

  useEffect(() => {
    const checkScrollPosition = async () => {
      const container = messageContainerRef.current
      if (!container) return

      setLoading(true)

      const { scrollTop, scrollHeight, clientHeight } = container

      container.addEventListener('scroll', checkIfScrolledToBottom)

      // If the user is scrolled to the top of the container, load more messages.
      if (
        scrollTop === 0 &&
        scrollHeight >= clientHeight - 20 &&
        scrollHeight <= clientHeight + 20 &&
        !initialMessagesLoaded
      ) {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(checkScrollPosition, SCROLL_TIMEOUT_DELAY)

    return () => {
      const container = messageContainerRef.current
      if (container) {
        container.removeEventListener('scroll', checkIfScrolledToBottom)
      }
      clearTimeout(timeoutId)
    }
  }, [messageContainerRef?.current?.children, initialMessagesLoaded])

  return { loading, messageContainerRef, messagesEndRef }
}
