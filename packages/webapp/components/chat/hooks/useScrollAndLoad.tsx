import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuthStore, useChatStore } from '@stores'
import { useChannel } from '../context/ChannelProvider'

const SCROLL_TIMEOUT_DELAY = 500
const CLOSE_TO_BOTTOM_THRESHOLD = 100

export const useScrollAndLoad = (
  initialMessagesLoaded: boolean,
  messageContainerRef: React.RefObject<HTMLDivElement>,
  msgLength: number
) => {
  const { channelId } = useChannel()
  const user = useAuthStore((state) => state.profile)
  const [loading, setLoading] = useState(msgLength === 0 ? false : true)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) ?? {}
  )
  const { userPickingEmoji, lastReadMessageId } = channelSettings || {}
  const messagesByChannel = useChatStore((state: any) => state.messagesByChannel)
  const messages = messagesByChannel.get(channelId)

  const isUserCloseToBottom = useCallback(() => {
    if (!messageContainerRef.current) return false
    const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current
    return scrollHeight - scrollTop - clientHeight < CLOSE_TO_BOTTOM_THRESHOLD
  }, [messageContainerRef])

  const scrollToBottom = useCallback(
    (options: ScrollIntoViewOptions = {}) => {
      if (userPickingEmoji || !messageContainerRef.current) return

      const container = messageContainerRef.current as any
      if (options.behavior === 'smooth' && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
      } else {
        container.childNodes.forEach((element: any) => {
          if (element.msgId === lastReadMessageId) {
            element.scrollIntoView({ block: 'center' })
            // setLoading(false)
            return
          }
        })
        container.lastChild?.scrollIntoView(false)
      }
    },
    [userPickingEmoji, lastReadMessageId, messageContainerRef]
  )

  const handleScrollToBottom = useCallback(() => {
    if (initialMessagesLoaded) return

    const container = messageContainerRef.current as any
    if (!container) return

    const lastInsertedMessageId = container.children[container.children.length - 1]?.msgId
    const comingMessageBelongsToCurrentUser =
      messages.get(lastInsertedMessageId)?.user_id === user?.id

    if (loading) {
      scrollToBottom()
    } else if (isUserCloseToBottom() || comingMessageBelongsToCurrentUser) {
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

  const checkIfScrolledToBottom = useCallback(() => {
    const container = messageContainerRef.current
    if (!container || !loading) return

    const { scrollTop, scrollHeight, clientHeight } = container
    if (scrollHeight - scrollTop - clientHeight <= CLOSE_TO_BOTTOM_THRESHOLD) {
      setLoading(false)
    }
  }, [loading, messageContainerRef])

  useEffect(() => {
    const timer = setTimeout(handleScrollToBottom, SCROLL_TIMEOUT_DELAY)
    return () => clearTimeout(timer)
  }, [messages, handleScrollToBottom])

  useEffect(() => {
    const container = messageContainerRef.current
    if (!container) return

    const checkScrollPosition = () => {
      setLoading(false)
      container.addEventListener('scroll', checkIfScrolledToBottom)
      checkIfScrolledToBottom()

      if (container.scrollTop === 0 && !initialMessagesLoaded) {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(checkScrollPosition, SCROLL_TIMEOUT_DELAY)

    return () => {
      container.removeEventListener('scroll', checkIfScrolledToBottom)
      clearTimeout(timeoutId)
    }
  }, [messageContainerRef, initialMessagesLoaded, checkIfScrolledToBottom])

  return { loading, messageContainerRef, messagesEndRef }
}
