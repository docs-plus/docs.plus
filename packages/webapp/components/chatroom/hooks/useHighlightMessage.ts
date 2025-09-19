import { useCallback, useEffect, useState } from 'react'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useChatStore } from '@stores'
import type { Virtualizer } from '@tanstack/react-virtual'

// Constants
const HIGHLIGHT_DURATION_MS = 10000
const SCROLL_RETRY_MAX = 15

// Types
type Prop = {
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  virtualizerRef: React.MutableRefObject<Virtualizer<HTMLDivElement, HTMLElement> | null>
}

export const useHighlightMessage = ({ messageContainerRef, virtualizerRef }: Prop) => {
  const { channelId, isChannelDataLoaded, isDbSubscriptionReady } = useChatroomContext()
  const isReadyToDisplayMessages = useChatStore((state) => state.chatRoom.isReadyToDisplayMessages)
  const [highlightedMessageExists, setHighlightedMessageExists] = useState(false)

  const getFetchMessageId = useCallback(() => {
    return (
      useChatStore.getState().chatRoom.fetchMsgsFromId ||
      new URLSearchParams(window.location.search).get('msg_id')
    )
  }, [])

  // Cleanup helper
  const findMessageElement = useCallback(
    (messageId: string): HTMLElement | null => {
      const container = messageContainerRef.current
      if (!container) return null

      const virtualizer = virtualizerRef.current
      if (!virtualizer) return null

      const matchingItem = virtualizer
        .getVirtualItems()
        .find((item) => String(item.key) === String(messageId))

      if (matchingItem) {
        return container.querySelector(
          `[data-index="${matchingItem.index}"] .msg_card`
        ) as HTMLElement | null
      }

      return null
    },
    [messageContainerRef, virtualizerRef]
  )

  const getMessagesArray = useCallback(() => {
    const channelMessages = useChatStore.getState().messagesByChannel.get(channelId)
    return channelMessages ? Array.from(channelMessages.values()) : []
  }, [channelId])

  // Message highlight logic
  const highlightMessage = useCallback((element: HTMLElement) => {
    const chatBubble = element.querySelector('.chat-bubble') || element

    if (!chatBubble) return

    chatBubble.classList.add('border-ping-glow')

    setTimeout(() => {
      chatBubble.classList.remove('border-ping-glow')
      setHighlightedMessageExists(false)
      useChatStore.getState().updateChatRoom('fetchMsgsFromId', undefined)
    }, HIGHLIGHT_DURATION_MS)
  }, [])

  // Simple scroll completion handler - separated from scroll logic
  // Simplified scroll to specific message
  const scrollToMessage = useCallback(() => {
    const fetchMsgsFromId = getFetchMessageId()
    if (!messageContainerRef.current || !fetchMsgsFromId) return

    const messagesArray = getMessagesArray()
    const targetIndex = messagesArray.findIndex((message) => message.id === fetchMsgsFromId)

    if (targetIndex < 0) {
      setHighlightedMessageExists(false)
      useChatStore.getState().updateChatRoom('fetchMsgsFromId', undefined)
      return
    }

    const attemptScroll = (attempt = 0) => {
      const virtualizer = virtualizerRef.current

      if (virtualizer) {
        virtualizer.scrollToIndex(targetIndex, { align: 'center', behavior: 'auto' })
      } else {
        const fallbackElement = messageContainerRef.current?.querySelector(
          `[data-index="${targetIndex}"] .msg_card`
        ) as HTMLElement | null
        fallbackElement?.scrollIntoView({ block: 'center', behavior: 'auto' })
      }

      requestAnimationFrame(() => {
        const targetElement =
          findMessageElement(fetchMsgsFromId) ||
          (messageContainerRef.current?.querySelector(
            `[data-index="${targetIndex}"] .msg_card`
          ) as HTMLElement | null)

        if (targetElement) {
          setTimeout(() => {
            targetElement.scrollIntoView({ block: 'center', behavior: 'auto' })
            highlightMessage(targetElement)
          }, 50)
          return
        }

        if (attempt < SCROLL_RETRY_MAX) {
          attemptScroll(attempt + 1)
        } else {
          setHighlightedMessageExists(false)
          useChatStore.getState().updateChatRoom('fetchMsgsFromId', undefined)
        }
      })
    }

    attemptScroll()
  }, [
    getFetchMessageId,
    findMessageElement,
    highlightMessage,
    messageContainerRef,
    getMessagesArray,
    virtualizerRef
  ])

  useEffect(() => {
    if (!isDbSubscriptionReady || !isChannelDataLoaded || isReadyToDisplayMessages) return
    const fetchMsgsFromId = getFetchMessageId()
    if (!fetchMsgsFromId) return

    setHighlightedMessageExists(true)
    scrollToMessage()
  }, [
    isDbSubscriptionReady,
    isChannelDataLoaded,
    isReadyToDisplayMessages,
    scrollToMessage,
    getFetchMessageId
  ])

  return { highlightedMessageExists }
}
