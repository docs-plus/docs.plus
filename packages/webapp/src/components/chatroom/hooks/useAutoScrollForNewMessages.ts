import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useAuthStore, useChatStore } from '@stores'
import type { Virtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef } from 'react'

const CLOSE_TO_BOTTOM_THRESHOLD = 100

type Props = {
  isLoadingOlderMessages: boolean
  highlightedMessageExists: boolean
  virtualizerRef: React.MutableRefObject<Virtualizer<HTMLDivElement, HTMLElement> | null>
  loadingMoreDirection: 'older' | 'newer' | null
}

export const useAutoScrollForNewMessages = ({
  isLoadingOlderMessages,
  highlightedMessageExists,
  virtualizerRef,
  loadingMoreDirection
}: Props) => {
  const { channelId, isChannelDataLoaded, isDbSubscriptionReady } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)
  const isReadyToDisplayMessages = useChatStore((state) => state.chatRoom.isReadyToDisplayMessages)
  const messagesByChannel = useChatStore((state) => state.messagesByChannel)

  const prevCountRef = useRef(0)
  const prevLastMessageIdRef = useRef<string | null>(null)
  const skipNextAutoScrollRef = useRef(true)

  const messages = useMemo(() => {
    const map = messagesByChannel.get(channelId)
    return map ? Array.from(map.values()) : []
  }, [messagesByChannel, channelId])

  useEffect(() => {
    prevCountRef.current = 0
    prevLastMessageIdRef.current = null
    skipNextAutoScrollRef.current = true
  }, [channelId])

  useEffect(() => {
    if (!isReadyToDisplayMessages) {
      skipNextAutoScrollRef.current = true
    }
  }, [isReadyToDisplayMessages])

  useEffect(() => {
    const virtualizer = virtualizerRef.current

    if (
      !virtualizer ||
      !isDbSubscriptionReady ||
      !isChannelDataLoaded ||
      !isReadyToDisplayMessages
    ) {
      return
    }

    const currentCount = messages.length
    const previousCount = prevCountRef.current

    const lastMessage = messages[currentCount - 1]
    const lastMessageId = lastMessage?.id ?? null

    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false
      prevCountRef.current = currentCount
      prevLastMessageIdRef.current = lastMessageId
      return
    }

    if (currentCount === 0 || isLoadingOlderMessages || loadingMoreDirection === 'older') {
      prevCountRef.current = currentCount
      prevLastMessageIdRef.current = lastMessageId
      return
    }

    if (lastMessageId && lastMessageId === prevLastMessageIdRef.current) {
      prevCountRef.current = currentCount
      return
    }

    const scrollElement = virtualizer.scrollElement as HTMLElement | Window | null
    const viewportHeight =
      scrollElement && 'clientHeight' in scrollElement ? scrollElement.clientHeight : 0
    const scrollOffset =
      scrollElement && 'scrollTop' in scrollElement
        ? scrollElement.scrollTop
        : (virtualizer.scrollOffset ?? 0)
    const viewportBottom = scrollOffset + viewportHeight
    const totalSize = virtualizer.getTotalSize()
    const distanceToBottom = Math.max(totalSize - viewportBottom, 0)
    const isNearBottom = distanceToBottom <= CLOSE_TO_BOTTOM_THRESHOLD

    const shouldScroll =
      lastMessage?.user_id === user?.id ||
      previousCount === 0 ||
      (isNearBottom && !highlightedMessageExists)

    if (shouldScroll) {
      virtualizer.scrollToIndex(currentCount - 1, {
        align: 'end',
        behavior: 'smooth'
      })
    }

    prevCountRef.current = currentCount
    prevLastMessageIdRef.current = lastMessageId
  }, [
    isChannelDataLoaded,
    isDbSubscriptionReady,
    isReadyToDisplayMessages,
    messages,
    isLoadingOlderMessages,
    highlightedMessageExists,
    user,
    virtualizerRef,
    loadingMoreDirection
  ])
}
