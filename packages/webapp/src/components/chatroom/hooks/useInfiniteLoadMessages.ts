import { fetchMessagesPaginated } from '@api'
import { useChatStore } from '@stores'
import { useCallback, useEffect, useState } from 'react'
import { RefObject } from 'react'

import { useChatroomContext } from '../ChatroomContext'

const PAGE_SIZE = 20

type Args = {
  messageContainerRef: RefObject<HTMLDivElement | null>
  topSentinelRef: RefObject<HTMLDivElement | null>
  bottomSentinelRef: RefObject<HTMLDivElement | null>
}

// Pulls the cursor timestamp directly from the store map's first/last
// entry. Avoids the previous DOM round-trip (querying `.msg_card` and
// reading a stamped `.createdAt`) which (a) couples pagination to
// render order and (b) under virtualisation finds the last *rendered*
// row, not the last loaded one.
const readCursor = (channelId: string, direction: 'older' | 'newer'): string | null => {
  const messages = useChatStore.getState().messagesByChannel.get(channelId)
  if (!messages || messages.size === 0) return null
  const values = Array.from(messages.values())
  const row = direction === 'older' ? values[0] : values[values.length - 1]
  return row?.created_at ? String(row.created_at) : null
}

export const useInfiniteLoadMessages = ({
  messageContainerRef,
  topSentinelRef,
  bottomSentinelRef
}: Args) => {
  const { channelId, isChannelDataLoaded, isDbSubscriptionReady } = useChatroomContext()

  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [loadingMoreDirection, setLoadingMoreDirection] = useState<'older' | 'newer' | null>(null)
  const [isLoadingNewer, setIsLoadingNewer] = useState<boolean>(false)
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean>(true)
  const [hasMoreRecent, setHasMoreRecent] = useState<boolean>(true)

  const replaceMessages = useChatStore((state) => state.replaceMessages)
  const isInitialScrollSettled = useChatStore((state) => state.chatRoom.isInitialScrollSettled)

  // Reset pagination state when channel changes
  useEffect(() => {
    setHasMoreOlder(true)
    setHasMoreRecent(true)
  }, [channelId])

  // Smooth scroll position adjustment after loading messages
  const adjustScrollPositionAfterLoad = useCallback(
    (initialScrollTop: number, initialScrollHeight: number) => {
      const container = messageContainerRef.current
      if (!container) return

      // Temporarily disable smooth scrolling to prevent glitches
      const originalScrollBehavior = container.style.scrollBehavior
      container.style.scrollBehavior = 'auto'

      // Use ResizeObserver to detect when DOM changes are complete
      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight
          const heightDifference = newScrollHeight - initialScrollHeight

          // Calculate and apply the new scroll position
          if (heightDifference > 0) {
            container.scrollTop = initialScrollTop + heightDifference
          }

          // Restore original scroll behavior
          container.style.scrollBehavior = originalScrollBehavior

          // Clean up observer
          resizeObserver.disconnect()
        })
      })

      // Start observing the container for size changes
      resizeObserver.observe(container)

      // Fallback cleanup after 500ms in case ResizeObserver doesn't fire
      setTimeout(() => {
        container.style.scrollBehavior = originalScrollBehavior
        resizeObserver.disconnect()
      }, 500)
    },
    [messageContainerRef]
  )

  const loadOlderMessages = useCallback(async () => {
    const msgContainer = messageContainerRef.current
    // Comprehensive early returns to prevent race conditions
    if (
      !msgContainer ||
      isLoadingMore ||
      !hasMoreOlder ||
      loadingMoreDirection === 'newer' ||
      !isInitialScrollSettled
    )
      return

    setIsLoadingMore(true)
    const initialScrollTop = msgContainer.scrollTop
    const initialScrollHeight = msgContainer.scrollHeight

    const cursorTimestamp = readCursor(channelId, 'older')
    if (!cursorTimestamp) {
      console.warn('[chat]: no cursor for older pagination — store is empty')
      setIsLoadingMore(false)
      setLoadingMoreDirection(null)
      return
    }

    try {
      const response = await fetchMessagesPaginated({
        input_channel_id: channelId,
        limit_count: PAGE_SIZE,
        cursor_timestamp: cursorTimestamp,
        direction: 'older'
      })

      setHasMoreOlder(response.pagination_cursors.has_more_older)

      if (!response?.messages || response.messages.length === 0) {
        setIsLoadingMore(false)
        return
      }

      const newMessagesMap = new Map(
        [...response.messages].reverse().map((message: any) => [message.id, message])
      )
      const storedMessages = [...(useChatStore.getState().messagesByChannel.get(channelId) || [])]

      if (storedMessages.length === 0) {
        console.error('[chat]: no messages in the store')
        return
      }

      const updatedMessages: Map<string, any> = new Map([...newMessagesMap, ...storedMessages])
      replaceMessages(channelId, updatedMessages)
      adjustScrollPositionAfterLoad(initialScrollTop, initialScrollHeight)
    } catch (error) {
      console.error('Error loading older messages:', error)
    } finally {
      setIsLoadingMore(false)
      setLoadingMoreDirection(null)
    }
  }, [
    messageContainerRef,
    isLoadingMore,
    hasMoreOlder,
    channelId,
    adjustScrollPositionAfterLoad,
    loadingMoreDirection,
    isInitialScrollSettled,
    replaceMessages
  ])

  const loadNewerMessages = useCallback(async () => {
    const msgContainer = messageContainerRef.current
    if (!msgContainer || isLoadingNewer || !hasMoreRecent || loadingMoreDirection === 'older')
      return

    setIsLoadingNewer(true)
    setIsLoadingMore(true)

    const cursorTimestamp = readCursor(channelId, 'newer')
    if (!cursorTimestamp) {
      console.error('[chat]: no cursor for newer pagination — store is empty')
      setIsLoadingNewer(false)
      setIsLoadingMore(false)
      return
    }

    try {
      const response = await fetchMessagesPaginated({
        input_channel_id: channelId,
        limit_count: PAGE_SIZE,
        cursor_timestamp: cursorTimestamp,
        direction: 'newer'
      })

      setHasMoreRecent(response.pagination_cursors.has_more_newer)

      if (!response?.messages || response.messages.length === 0) {
        setIsLoadingNewer(false)
        setIsLoadingMore(false)
        return
      }

      const newMessagesMap = new Map(response.messages.map((message: any) => [message.id, message]))
      const storedMessages = [...(useChatStore.getState().messagesByChannel.get(channelId) || [])]

      if (storedMessages.length === 0) {
        console.error('[chat]: no messages in the store')
        return
      }

      const updatedMessages: Map<string, any> = new Map([...storedMessages, ...newMessagesMap])
      replaceMessages(channelId, updatedMessages)
    } catch (error) {
      console.error('Error loading newer messages:', error)
    } finally {
      setIsLoadingNewer(false)
      setIsLoadingMore(false)
      setLoadingMoreDirection(null)
    }
  }, [
    messageContainerRef,
    isLoadingNewer,
    hasMoreRecent,
    channelId,
    loadingMoreDirection,
    replaceMessages
  ])

  // Intersection Observer for efficient scroll detection
  const attachIntersectionObserver = useCallback(() => {
    const topSentinel = topSentinelRef.current
    const bottomSentinel = bottomSentinelRef.current
    const messageContainer = messageContainerRef.current

    if (!topSentinel || !bottomSentinel || !messageContainer) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (isLoadingMore || isLoadingNewer) return

          if (entry.isIntersecting) {
            if (entry.target === topSentinel && hasMoreOlder && loadingMoreDirection !== 'older') {
              setLoadingMoreDirection('older')
              loadOlderMessages()
            } else if (
              entry.target === bottomSentinel &&
              hasMoreRecent &&
              loadingMoreDirection !== 'newer'
            ) {
              setLoadingMoreDirection('newer')
              loadNewerMessages()
            }
          }
        })
      },
      {
        root: messageContainer,
        rootMargin: '100px',
        threshold: 0
      }
    )

    observer.observe(topSentinel)
    observer.observe(bottomSentinel)

    return () => {
      observer.disconnect()
    }
  }, [
    topSentinelRef,
    bottomSentinelRef,
    messageContainerRef,
    isLoadingMore,
    isLoadingNewer,
    hasMoreOlder,
    hasMoreRecent,
    loadingMoreDirection,
    loadOlderMessages,
    loadNewerMessages
  ])

  useEffect(() => {
    if (!isInitialScrollSettled || !isChannelDataLoaded || !isDbSubscriptionReady) return

    const cleanup = attachIntersectionObserver()
    return cleanup
  }, [
    attachIntersectionObserver,
    channelId,
    isInitialScrollSettled,
    isChannelDataLoaded,
    isDbSubscriptionReady
  ])

  return {
    isLoadingMore,
    isLoadingNewer,
    hasMoreOlder,
    hasMoreRecent,
    loadOlderMessages,
    loadNewerMessages,
    loadingMoreDirection
  }
}
