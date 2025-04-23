import { useState, useEffect, MutableRefObject, useMemo } from 'react'
import { groupedMessages } from '@utils/index'
import { useChatStore } from '@stores'
import { fetchMessagesPaginated } from '@api'
import { useChannel } from '../context/ChannelProvider'
import { TChannelSettings } from '@types'

const PAGE_SIZE = 20

const adjustScrollPositionAfterLoadingMessages = (
  messageContainerRef: MutableRefObject<HTMLElement | null>,
  markedElement: HTMLElement | null
) => {
  if (!messageContainerRef.current || !markedElement) return

  // Store the previous scroll position and element position
  const prevScrollHeight = messageContainerRef.current.scrollHeight
  const prevOffsetTop = markedElement.offsetTop

  // Wait for the DOM to update with new content
  setTimeout(() => {
    if (!messageContainerRef.current) return

    // Calculate the difference after new messages were added
    const newScrollHeight = messageContainerRef.current.scrollHeight
    const newOffsetTop = markedElement.offsetTop
    const scrollDiff = newOffsetTop - prevOffsetTop

    // Adjust the scroll position to maintain the relative position
    messageContainerRef.current.scrollTop = messageContainerRef.current.scrollTop + scrollDiff
  }, 0)
}

export const useInfiniteLoadMessages = (
  messageContainerRef: MutableRefObject<HTMLElement | null>
) => {
  const { channelId } = useChannel()

  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [loadingMoreDirection, setLoadingMoreDirection] = useState<'older' | 'newer' | null>(null)
  const [isLoadingNewer, setIsLoadingNewer] = useState<boolean>(false)
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean>(true)
  const [hasMoreRecent, setHasMoreRecent] = useState<boolean>(true)

  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )

  const replaceMessages = useChatStore((state: any) => state.replaceMessages)
  const messagesByChannel = useChatStore((state: any) => state.messagesByChannel)
  const setWorkspaceChannelSetting = useChatStore((state: any) => state.setWorkspaceChannelSetting)

  const messages = messagesByChannel.get(channelId)

  // Reset pagination state when channel changes
  useEffect(() => {
    setHasMoreOlder(true)
    setHasMoreRecent(true)
  }, [channelId])

  // Interface for message type
  interface MessageType {
    id: string
    created_at: string | number
    [key: string]: any
  }

  const loadOlderMessages = async () => {
    const msgContainer = messageContainerRef.current
    if (!msgContainer || isLoadingMore || !hasMoreOlder) return
    setIsLoadingMore(true)
    // Store the first visible element and its position
    const currentTopElement = messageContainerRef.current?.querySelector(
      '.msg_card'
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
      console.error('[chat]: no createdAt found for currentTopElement', currentTopElement)
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

        // Merge the new messages with the existing ones
        const updatedMessages: Map<string, any> = new Map([...newMessagesMap, ...messages])

        // Update messages in the store
        replaceMessages(channelId, updatedMessages)

        // Adjust scroll position after DOM update to maintain same view
        setTimeout(() => {
          if (!messageContainerRef.current) return

          // Get the new scroll height and the same original element
          const newScrollHeight = messageContainerRef.current.scrollHeight
          const heightDifference = newScrollHeight - initialScrollHeight

          // Set scroll position to keep the same content in view
          messageContainerRef.current.scrollTop = initialScrollTop + heightDifference
        }, 0)
      }
    } catch (error) {
      console.error('Error loading older messages:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const loadNewerMessages = async () => {
    const msgContainer = messageContainerRef.current
    if (!msgContainer || isLoadingNewer || !hasMoreRecent) return
    setIsLoadingNewer(true)
    setIsLoadingMore(true)

    const currentBottomElement = msgContainer.lastChild as HTMLElement
    let cursorTimestamp: string | null = null
    // Make sure cursorTimestamp is a string
    // @ts-ignore
    if (currentBottomElement?.createdAt) {
      // @ts-ignore
      cursorTimestamp = String(currentBottomElement?.createdAt)
    } else {
      console.error('[chat]: no createdAt found for currentBottomElement', currentBottomElement)
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

        // Merge the new messages with the existing ones
        const updatedMessages: Map<string, any> = new Map([...messages, ...newMessagesMap])

        // Update messages in the store
        replaceMessages(channelId, updatedMessages)
      }
    } catch (error) {
      console.error('Error loading newer messages:', error)
    } finally {
      setIsLoadingNewer(false)
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    const currentRef = messageContainerRef.current

    const handleScroll = () => {
      const current = messageContainerRef.current

      if (current) {
        // Check if scrolled to top (load older messages)
        const isAtTop = current.scrollTop === 0
        if (isAtTop && !isLoadingMore && hasMoreOlder) {
          setLoadingMoreDirection('older')
          loadOlderMessages()
        }

        // Check if scrolled to bottom (load newer messages)
        const isAtBottom =
          Math.abs(current.scrollHeight - current.scrollTop - current.clientHeight) <= 5

        if (isAtBottom && !isLoadingNewer && hasMoreRecent) {
          setLoadingMoreDirection('newer')
          loadNewerMessages()
        }
      }
    }

    currentRef?.addEventListener('scroll', handleScroll)

    return () => {
      currentRef?.removeEventListener('scroll', handleScroll)
    }
  }, [
    messageContainerRef.current,
    messages,
    isLoadingMore,
    isLoadingNewer,
    hasMoreOlder,
    hasMoreRecent
  ])

  return {
    isLoadingMore,
    isLoadingNewer,
    hasMoreOlder,
    hasMoreRecent,
    loadOlderMessages, // Export functions for manual triggering
    loadNewerMessages,
    loadingMoreDirection
  }
}
