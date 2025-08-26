import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useAuthStore, useChatStore } from '@stores'
import { useCallback, useEffect, useMemo, useRef } from 'react'

// Constants
const CLOSE_TO_BOTTOM_THRESHOLD = 100

type Prop = {
  isLoadingOlderMessages: boolean
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  highlightedMessageExists: boolean
}
export const useAutoScrollForNewMessages = ({
  isLoadingOlderMessages,
  messageContainerRef,
  highlightedMessageExists
}: Prop) => {
  const { channelId, isChannelDataLoaded, isDbSubscriptionReady } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)
  const isReadyToDisplayMessages = useChatStore((state) => state.chatRoom.isReadyToDisplayMessages)

  const prevMessagesCountRef = useRef<number>(0)
  const messagesByChannel = useChatStore((state) => state.messagesByChannel)
  const messages = useMemo(() => messagesByChannel.get(channelId), [messagesByChannel, channelId])

  const isUserCloseToBottom = useCallback(() => {
    const messageListContainer = messageContainerRef.current // .message-list
    if (!messageListContainer) return false

    // Get the last message element from .message-list
    const lastMessageElement = messageListContainer.children[
      messageListContainer.children.length - 1
    ] as HTMLElement
    if (!lastMessageElement) return false

    // Find the viewport (.message-feed)
    const messageFeedViewport = messageListContainer.closest('.message-feed') as HTMLElement
    if (!messageFeedViewport) return false

    // Get bounding rectangles
    const lastMessageRect = lastMessageElement.getBoundingClientRect()
    const viewportRect = messageFeedViewport.getBoundingClientRect()

    // Check if last message bottom is within viewport (with threshold)
    const isLastMessageInViewport =
      lastMessageRect.bottom <= viewportRect.bottom + CLOSE_TO_BOTTOM_THRESHOLD

    return isLastMessageInViewport
  }, [messageContainerRef])

  // Handle auto-scrolling for new messages
  useEffect(() => {
    if (!isDbSubscriptionReady || !isChannelDataLoaded || !isReadyToDisplayMessages) return

    const container = document.querySelector('.message-list') as HTMLElement

    if (!container) return

    // Check if new messages arrived
    const currentMessagesCount = messages ? messages.size : 0
    if (currentMessagesCount <= prevMessagesCountRef.current) {
      prevMessagesCountRef.current = currentMessagesCount
      return
    }

    prevMessagesCountRef.current = currentMessagesCount

    // Skip auto-scrolling if we're loading older messages
    if (isLoadingOlderMessages) return

    // Determine if we should auto-scroll
    const messageCards = container.querySelectorAll('.msg_card')
    const lastMessageElement = messageCards[messageCards.length - 1] as HTMLElement & {
      msgId?: string
    }

    const lastInsertedMessageId = lastMessageElement?.msgId
    const isCurrentUserMessage = lastInsertedMessageId
      ? messages?.get(lastInsertedMessageId)?.user_id === user?.id
      : false

    // Check if this is initial load (first batch of messages)
    const isInitialLoad = prevMessagesCountRef.current === 0 && currentMessagesCount > 0

    // Auto-scroll conditions:
    // 1. User sent the message - always scroll
    // 2. Initial load - always scroll to bottom
    // 3. User is close to bottom AND no highlighted message - scroll for others' messages
    if (
      isCurrentUserMessage ||
      isInitialLoad ||
      (isUserCloseToBottom() && !highlightedMessageExists)
    ) {
      lastMessageElement.scrollIntoView({
        block: 'end',
        behavior: lastInsertedMessageId === 'fake_id' ? 'smooth' : 'instant'
      })
    }
  }, [
    isChannelDataLoaded,
    isDbSubscriptionReady,
    isReadyToDisplayMessages,
    messages,
    messageContainerRef,
    user,
    isLoadingOlderMessages,
    highlightedMessageExists,
    isUserCloseToBottom
  ])
}
