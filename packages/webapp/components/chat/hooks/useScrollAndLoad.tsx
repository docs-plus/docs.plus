import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuthStore, useChatStore } from '@stores'
import { useChannel } from '../context/ChannelProvider'

const SCROLL_TIMEOUT_DELAY = 100
const CLOSE_TO_BOTTOM_THRESHOLD = 100

export const useScrollAndLoad = (
  initialMessagesLoaded: boolean,
  messageContainerRef: React.RefObject<HTMLDivElement>,
  msgLength: number
) => {
  const { channelId } = useChannel()
  const user = useAuthStore((state) => state.profile)
  const [loading, setLoading] = useState<boolean>(msgLength === 0 ? false : true)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) ?? {}
  )
  const { userPickingEmoji, unreadMessage, lastReadMessageId } = channelSettings || {}
  const messagesByChannel = useChatStore((state: any) => state.messagesByChannel)
  const messages = messagesByChannel.get(channelId)

  // Check if the user is close to the bottom of the message list.
  const isUserCloseToBottom = useCallback((): boolean => {
    if (!messageContainerRef.current) return false
    const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current
    const distanceToBottom = scrollHeight - scrollTop - clientHeight
    // Consider the user close to the bottom if they are within 100px of the bottom.
    return distanceToBottom < CLOSE_TO_BOTTOM_THRESHOLD
  }, [messageContainerRef])

  // Scroll to the bottom of the message list, optionally with smooth behavior.
  const scrollToBottom = useCallback(
    (options: ScrollIntoViewOptions = {}) => {
      if (userPickingEmoji || !messageContainerRef.current) return

      const container = messageContainerRef.current
      if (options.behavior === 'smooth' && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
      } else {
        let findLastMsg = true
        container.childNodes.forEach((element: any) => {
          if (element.msgId === lastReadMessageId) {
            element.scrollIntoView({ block: 'center' })
            findLastMsg = false
            setLoading(false)
            return
          }
        })
        if (findLastMsg) {
          // @ts-ignore
          container.lastChild?.scrollIntoView(false)
        }
      }
    },
    [userPickingEmoji, lastReadMessageId, messageContainerRef]
  )

  // Decide whether to scroll to the bottom based on loading state and user's position.
  const handleScrollToBottom = useCallback(() => {
    if (initialMessagesLoaded) return

    const container = messageContainerRef.current
    if (!container) return

    // @ts-ignore
    const lastInsertedMessageId = container.children[container.children.length - 1]?.msgId
    const comingMessageBelongToCurrentUser =
      messages.get(lastInsertedMessageId)?.user_id === user?.id

    if (loading) {
      // If still loading, just scroll to bottom without smooth behavior.
      scrollToBottom()
    } else if (isUserCloseToBottom() || comingMessageBelongToCurrentUser) {
      // If not loading and user is close to the bottom, or the last message belongs to the current user, scroll smoothly.
      scrollToBottom({ behavior: 'smooth' })
    }
  }, [
    initialMessagesLoaded,
    isUserCloseToBottom,
    loading,
    messages,
    messageContainerRef,
    scrollToBottom,
    user
  ])

  // Check if the user is scrolled to the bottom of the message list.
  const checkIfScrolledToBottom = useCallback(() => {
    const container = messageContainerRef.current
    if (!container || !loading) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isScrollable = scrollHeight > clientHeight
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight <= CLOSE_TO_BOTTOM_THRESHOLD

    // Update loading state based on whether it's scrolled to bottom and is scrollable.
    if (isScrollable && isScrolledToBottom) {
      setLoading(false)
    }
  }, [loading, messageContainerRef])

  // Use an effect to handle automatic scrolling when messages or loading state change.
  useEffect(() => {
    const timer = setTimeout(handleScrollToBottom, SCROLL_TIMEOUT_DELAY)
    return () => clearTimeout(timer)
  }, [messages, handleScrollToBottom])

  // Use an effect to handle scroll position checking and loading more messages when needed.
  useEffect(() => {
    const checkScrollPosition = async () => {
      const container = messageContainerRef.current
      if (!container) return

      setLoading(true)

      container.addEventListener('scroll', checkIfScrolledToBottom)
      checkIfScrolledToBottom()

      // If the user is scrolled to the top of the container, load more messages.
      if (container.scrollTop === 0 && !initialMessagesLoaded) {
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
  }, [messageContainerRef, initialMessagesLoaded, checkIfScrolledToBottom])

  return { loading, messageContainerRef, messagesEndRef }
}
