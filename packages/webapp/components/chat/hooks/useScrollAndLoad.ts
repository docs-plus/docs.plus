import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

import { useAuthStore, useChatStore } from '@stores'
import { useChannel } from '../context/ChannelProvider'
import { TChannelSettings } from '@types'

// Constants
const CLOSE_TO_BOTTOM_THRESHOLD = 100
const HIGHLIGHT_DURATION_MS = 4000
const MESSAGE_RETRY_MAX = 5
const MESSAGE_RETRY_INTERVAL_MS = 300
const SCROLL_TIMEOUT_MS = 300

export const useScrollAndLoad = (
  isChannelDataLoaded: boolean,
  isDbSubscriptionReady: boolean,
  messageContainerRef: React.RefObject<HTMLDivElement | null>,
  isLoadingOlderMessages = false
) => {
  // Basic state
  const [isReadyToDisplayMessages, setIsReadyToDisplayMessages] = useState(false)
  const [highlightedMessageExists, setHighlightedMessageExists] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const prevMessagesCountRef = useRef<number>(0)

  // Channel data
  const { channelId } = useChannel()
  const user = useAuthStore((state) => state.profile)
  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )
  const { userPickingEmoji, lastReadMessageId } = channelSettings ?? {}
  const messagesByChannel = useChatStore((state) => state.messagesByChannel)
  const messages = messagesByChannel.get(channelId)

  // Helper functions
  const isUserCloseToBottom = useCallback(() => {
    if (!messageContainerRef.current) return false
    const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current
    return scrollHeight - scrollTop - clientHeight < CLOSE_TO_BOTTOM_THRESHOLD
  }, [messageContainerRef])

  const getFetchMessageId = useCallback(() => {
    return (
      useChatStore.getState().chatRoom.fetchMsgsFromId ||
      new URLSearchParams(location.search).get('msg_id')
    )
  }, [])

  // Scroll functions
  const scrollToBottom = useCallback(
    (options: ScrollIntoViewOptions = {}) => {
      if (userPickingEmoji || !messageContainerRef.current) return
      const container = messageContainerRef.current

      const onScrollComplete = () => {
        setIsReadyToDisplayMessages(true)
        container.removeEventListener('scrollend', onScrollComplete)
      }

      container.addEventListener('scrollend', onScrollComplete)

      // Fallback timer in case scrollend doesn't fire
      setTimeout(() => {
        setIsReadyToDisplayMessages(true)
        container.removeEventListener('scrollend', onScrollComplete)
      }, SCROLL_TIMEOUT_MS)

      // Handle smooth scroll to messagesEndRef if it exists
      if (options.behavior === 'smooth' && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        return
      }

      // Try to scroll to lastReadMessageId if it exists
      if (lastReadMessageId) {
        const messageElements = Array.from(container.childNodes)
        const targetElement = messageElements.find(
          (element: any) => element.msgId === lastReadMessageId
        ) as HTMLElement | null

        if (targetElement) {
          targetElement.scrollIntoView({ block: 'center' })
          return
        }
      }

      // Fallback: scroll to bottom
      container.scrollTo({
        top: container.scrollHeight,
        behavior: options.behavior || 'auto'
      })
    },
    [userPickingEmoji, lastReadMessageId, messageContainerRef, messagesEndRef]
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

  // Scroll to specific message
  const scrollToMessage = useCallback(() => {
    const fetchMsgsFromId = getFetchMessageId()
    if (!messageContainerRef.current || !fetchMsgsFromId) return
    const container = messageContainerRef.current

    // Try to find and scroll to target message
    const attemptScroll = () => {
      return Array.from(container.childNodes).some((element) => {
        const typedElement = element as HTMLElement & { msgId?: string }
        if (typedElement.msgId === fetchMsgsFromId) {
          typedElement.scrollIntoView({ block: 'center', behavior: 'smooth' })
          highlightMessage(typedElement)
          return true
        }
        return false
      })
    }

    // First attempt
    const targetFound = attemptScroll()

    if (targetFound) {
      setIsReadyToDisplayMessages(true)
      return
    }

    // Setup retry mechanism for when message isn't loaded yet
    let retryCount = 0

    // Use MutationObserver to detect when new messages are added
    const observer = new MutationObserver(() => {
      if (attemptScroll()) {
        observer.disconnect()
      }
    })

    observer.observe(container, { childList: true, subtree: true })

    // Timed retries as fallback
    const retryScroll = () => {
      if (retryCount < MESSAGE_RETRY_MAX) {
        retryCount++
        if (attemptScroll()) {
          observer.disconnect()
        } else {
          setTimeout(retryScroll, MESSAGE_RETRY_INTERVAL_MS)
        }
      } else {
        // Max retries reached, clean up
        observer.disconnect()
        setIsReadyToDisplayMessages(true)
        setHighlightedMessageExists(false)
        // clear the fetchMsgsFromId
        useChatStore.getState().updateChatRoom('fetchMsgsFromId', undefined)
      }
    }

    setTimeout(retryScroll, MESSAGE_RETRY_INTERVAL_MS)
  }, [messageContainerRef, highlightMessage, getFetchMessageId])

  // Initial setup and highlighting
  useEffect(() => {
    if (!isDbSubscriptionReady || !isChannelDataLoaded) return

    const fetchMsgsFromId = getFetchMessageId()

    if (fetchMsgsFromId && !isReadyToDisplayMessages) {
      setIsReadyToDisplayMessages(true)
      scrollToMessage()
      setHighlightedMessageExists(true)
      return
    }

    if (!isReadyToDisplayMessages) {
      setIsReadyToDisplayMessages(true)
      scrollToBottom()
      return
    }
  }, [
    isChannelDataLoaded,
    isDbSubscriptionReady,
    isReadyToDisplayMessages,
    getFetchMessageId,
    scrollToMessage,
    scrollToBottom
  ])

  // Handle auto-scrolling for new messages
  useEffect(() => {
    if (!isDbSubscriptionReady || !isChannelDataLoaded || !isReadyToDisplayMessages) return

    const container = messageContainerRef.current
    if (!container) return

    // Check if new messages arrived
    const currentMessagesCount = messages ? messages.size : 0
    if (currentMessagesCount <= prevMessagesCountRef.current) {
      prevMessagesCountRef.current = currentMessagesCount
      return
    }

    prevMessagesCountRef.current = currentMessagesCount

    // Skip auto-scrolling if we're loading older messages
    if (isLoadingOlderMessages) {
      return
    }

    // Determine if we should auto-scroll
    const lastMessageElement = container.children[container.children.length - 1] as HTMLElement & {
      msgId?: string
    }
    const lastInsertedMessageId = lastMessageElement?.msgId
    const isCurrentUserMessage = lastInsertedMessageId
      ? messages?.get(lastInsertedMessageId)?.user_id === user?.id
      : false

    if ((isUserCloseToBottom() || isCurrentUserMessage) && !highlightedMessageExists) {
      scrollToBottom({ behavior: 'smooth' })
    }
  }, [
    isChannelDataLoaded,
    isDbSubscriptionReady,
    isReadyToDisplayMessages,
    messages,
    messageContainerRef,
    user,
    isUserCloseToBottom,
    highlightedMessageExists,
    scrollToBottom,
    isLoadingOlderMessages
  ])

  return { isReadyToDisplayMessages, messageContainerRef, messagesEndRef }
}
