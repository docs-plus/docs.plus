import { fetchMessagesPaginated } from '@api'
import { useChatStore } from '@stores'
import { groupedMessages } from '@utils/index'
import { useCallback, useEffect, useState } from 'react'
import { RefObject } from 'react'

import { useChatroomContext } from '../ChatroomContext'

const PAGE_SIZE = 20

export const useInfiniteLoadMessages = (messageContainerRef: RefObject<HTMLDivElement | null>) => {
  const { channelId, isChannelDataLoaded, isDbSubscriptionReady } = useChatroomContext()

  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [loadingMoreDirection, setLoadingMoreDirection] = useState<'older' | 'newer' | null>(null)
  const [isLoadingNewer, setIsLoadingNewer] = useState<boolean>(false)
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean>(true)
  const [hasMoreRecent, setHasMoreRecent] = useState<boolean>(true)

  const replaceMessages = useChatStore((state: any) => state.replaceMessages)
  const { isReadyToDisplayMessages } = useChatStore((state) => state.chatRoom)

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
      !isReadyToDisplayMessages
    )
      return

    setIsLoadingMore(true)
    // Store the first visible element and its position
    const currentTopElement = messageContainerRef.current?.querySelector(
      '.msg_card:not(:has(> .badge:first-child))'
    ) as HTMLElement | null
    const initialScrollTop = messageContainerRef.current?.scrollTop || 0
    const initialScrollHeight = messageContainerRef.current?.scrollHeight || 0

    // Find the oldest message by created_at timestamp
    let cursorTimestamp: string | null = null
    // Make sure cursorTimestamp is a string
    // @ts-ignore
    if (currentTopElement?.createdAt) {
      // @ts-ignore
      cursorTimestamp = String(currentTopElement?.createdAt)
    } else {
      console.warn('[chat]: no createdAt found for [top element]', currentTopElement)
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

      // Update hasMoreOlder based on pagination_cursors
      setHasMoreOlder(response.pagination_cursors.has_more_older)

      // If there are no messages, stop loading more
      if (!response?.messages || response.messages.length === 0) {
        setIsLoadingMore(false)
        return
      }

      if (response.messages.length > 0) {
        // Convert pageMessages.messages to a Map
        const newMessagesMap: any = new Map(
          // @ts-ignore
          groupedMessages(response.messages.reverse()).map((message: any) => [message.id, message])
        )

        const storedMessages = [...(useChatStore.getState().messagesByChannel.get(channelId) || [])]

        if (storedMessages.length === 0) {
          console.error('[chat]: no messages in the store')
          return
        }

        // Merge the new messages with the existing ones
        const updatedMessages: Map<string, any> = new Map([...newMessagesMap, ...storedMessages])

        // Update messages in the store
        replaceMessages(channelId, updatedMessages)

        // Adjust scroll position after DOM update to maintain same view
        adjustScrollPositionAfterLoad(initialScrollTop, initialScrollHeight)
      }
    } catch (error) {
      console.error('Error loading older messages:', error)
    } finally {
      setIsLoadingMore(false)
      setLoadingMoreDirection(null)
    }
  }, [
    messageContainerRef.current,
    isLoadingMore,
    hasMoreOlder,
    channelId,
    adjustScrollPositionAfterLoad,
    loadingMoreDirection,
    isReadyToDisplayMessages
  ])

  const loadNewerMessages = useCallback(async () => {
    const msgContainer = messageContainerRef.current
    // Comprehensive early returns to prevent race conditions
    if (!msgContainer || isLoadingNewer || !hasMoreRecent || loadingMoreDirection === 'older')
      return

    setIsLoadingNewer(true)
    setIsLoadingMore(true)

    const msgCards = msgContainer.querySelectorAll('.msg_card')
    const currentBottomElement = msgCards[msgCards.length - 1] as HTMLElement
    let cursorTimestamp: string | null = null

    // Make sure cursorTimestamp is a string
    // @ts-ignore
    if (currentBottomElement?.createdAt) {
      // @ts-ignore
      cursorTimestamp = String(currentBottomElement?.createdAt)
    } else {
      console.error('[chat]: no createdAt found for currentBottomElement', { currentBottomElement })
    }

    try {
      const response = await fetchMessagesPaginated({
        input_channel_id: channelId,
        limit_count: PAGE_SIZE,
        cursor_timestamp: cursorTimestamp,
        direction: 'newer'
      })

      // Update hasMoreRecent based on pagination_cursors
      // @ts-ignore
      setHasMoreRecent(response.pagination_cursors.has_more_newer)

      // If there are no messages, stop loading more
      if (!response?.messages || response.messages.length === 0) {
        setIsLoadingNewer(false)
        setIsLoadingMore(false)
        return
      }

      if (response.messages.length > 0) {
        // Convert pageMessages.messages to a Map
        const newMessagesMap: any = new Map(
          // @ts-ignore
          groupedMessages(response.messages).map((message: any) => [message.id, message])
        )

        const storedMessages = [...(useChatStore.getState().messagesByChannel.get(channelId) || [])]

        if (storedMessages.length === 0) {
          console.error('[chat]: no messages in the store')
          return
        }

        // Merge the new messages with the existing ones
        const updatedMessages: Map<string, any> = new Map([...storedMessages, ...newMessagesMap])

        // Update messages in the store
        replaceMessages(channelId, updatedMessages)
      }
    } catch (error) {
      console.error('Error loading newer messages:', error)
    } finally {
      setIsLoadingNewer(false)
      setIsLoadingMore(false)
      setLoadingMoreDirection(null)
    }
  }, [messageContainerRef.current, isLoadingNewer, hasMoreRecent, channelId])

  // Intersection Observer for efficient scroll detection
  const attachIntersectionObserver = useCallback(() => {
    const topSentinel = document.querySelector('#top-sentinel')
    const bottomSentinel = document.querySelector('#bottom-sentinel')
    const messageContainer = document.querySelector('.message-feed')

    if (!topSentinel || !bottomSentinel || !messageContainer) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Early return if any loading is happening
          if (isLoadingMore || isLoadingNewer) return

          if (entry.isIntersecting) {
            if (
              entry.target.id === 'top-sentinel' &&
              hasMoreOlder &&
              loadingMoreDirection !== 'older'
            ) {
              setLoadingMoreDirection('older')
              loadOlderMessages()
            } else if (
              entry.target.id === 'bottom-sentinel' &&
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
        rootMargin: '100px', // Trigger 50px before reaching sentinel
        threshold: 0
      }
    )

    observer.observe(topSentinel)
    observer.observe(bottomSentinel)

    return () => {
      observer.disconnect()
    }
  }, [
    isLoadingMore,
    isLoadingNewer,
    hasMoreOlder,
    hasMoreRecent,
    loadingMoreDirection,
    loadOlderMessages,
    loadNewerMessages
  ])

  useEffect(() => {
    if (!isReadyToDisplayMessages || !isChannelDataLoaded || !isDbSubscriptionReady) return

    const cleanup = attachIntersectionObserver()
    return cleanup
  }, [
    attachIntersectionObserver,
    channelId,
    isReadyToDisplayMessages,
    isChannelDataLoaded,
    isDbSubscriptionReady
  ])

  return {
    isLoadingMore,
    isLoadingNewer,
    hasMoreOlder,
    hasMoreRecent,
    loadOlderMessages, // Export functions for manual triggering
    loadNewerMessages,
    loadingMoreDirection,
    // Sentinel elements for Intersection Observer
    topSentinelId: 'top-sentinel',
    bottomSentinelId: 'bottom-sentinel'
  }
}
