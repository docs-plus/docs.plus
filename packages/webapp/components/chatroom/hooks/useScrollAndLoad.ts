import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore, useChatStore } from '@stores'
import { TChannelSettings } from '@types'
import { useChatroomContext } from '../ChatroomContext'

// Constants
const SCROLL_TIMEOUT_MS = 300
const DEBOUNCE_DELAY = 100

// Types
interface ScrollOptions {
  behavior?: ScrollBehavior
  block?: ScrollLogicalPosition
}

interface UseScrollAndLoadReturn {
  isReadyToDisplayMessages: boolean
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
}

export const useScrollAndLoad = (
  messageContainerRef: React.RefObject<HTMLDivElement | null>
): UseScrollAndLoadReturn => {
  const { channelId, isChannelDataLoaded, isDbSubscriptionReady } = useChatroomContext()

  // Store selectors
  const isReadyToDisplayMessages = useChatStore((state) => state.chatRoom.isReadyToDisplayMessages)
  const updateChatRoom = useChatStore((state) => state.updateChatRoom)
  const user = useAuthStore((state) => state.profile)
  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const messagesByChannel = useChatStore((state) => state.messagesByChannel)

  // Context and refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const prevMessagesCountRef = useRef<number>(0)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const observerRef = useRef<MutationObserver | undefined>(undefined)

  // Memoized selectors
  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )

  const { userPickingEmoji, lastReadMessageId } = channelSettings ?? {}

  // Cleanup helper
  const cleanup = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = undefined
    }
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = undefined
    }
  }, [])

  const getFetchMessageId = useCallback(() => {
    return (
      useChatStore.getState().chatRoom.fetchMsgsFromId ||
      new URLSearchParams(window.location.search).get('msg_id')
    )
  }, [])

  const findMessageElement = useCallback(
    (container: HTMLElement, messageId: string): HTMLElement | null => {
      const messageElements = container.querySelectorAll('.msg_card')
      for (const element of messageElements) {
        const typedElement = element as HTMLElement & { msgId?: string }
        if (typedElement.msgId === messageId) {
          return typedElement
        }
      }
      return null
    },
    []
  )

  // Simple scroll completion handler - separated from scroll logic
  const handleScrollComplete = useCallback(() => {
    cleanup()
    updateChatRoom('isReadyToDisplayMessages', true)
  }, [cleanup, updateChatRoom])

  // Simplified scroll to bottom
  const scrollToBottom = useCallback(
    (smooth = false) => {
      if (userPickingEmoji || !messageContainerRef.current) return

      const container = messageContainerRef.current
      cleanup() // Clear any existing operations

      // Try to scroll to lastReadMessageId first, then fallback to bottom
      let targetElement: HTMLElement | null = null
      if (lastReadMessageId) {
        targetElement = findMessageElement(container, lastReadMessageId)
      }

      if (targetElement) {
        targetElement.scrollIntoView({
          block: 'center',
          behavior: smooth ? 'smooth' : 'auto'
        })
      } else {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        })
      }

      // Handle completion based on scroll type
      if (smooth) {
        // For smooth scroll, wait for completion
        const onScrollEnd = () => {
          container.removeEventListener('scrollend', onScrollEnd)
          handleScrollComplete()
        }
        container.addEventListener('scrollend', onScrollEnd)

        // Fallback timeout
        scrollTimeoutRef.current = setTimeout(() => {
          container.removeEventListener('scrollend', onScrollEnd)
          handleScrollComplete()
        }, SCROLL_TIMEOUT_MS)
      } else {
        // For instant scroll, complete immediately
        handleScrollComplete()
      }
    },
    [userPickingEmoji, lastReadMessageId, findMessageElement, cleanup, handleScrollComplete]
  )

  // Initial setup effect - handles first load and specific message scrolling
  useEffect(() => {
    if (!isDbSubscriptionReady || !isChannelDataLoaded || isReadyToDisplayMessages) return

    const fetchMsgsFromId = getFetchMessageId()
    updateChatRoom('isReadyToDisplayMessages', false)

    const scrollTimer = setTimeout(() => {
      if (!fetchMsgsFromId) {
        scrollToBottom()
      }
    }, DEBOUNCE_DELAY)

    return () => clearTimeout(scrollTimer)
  }, [
    isChannelDataLoaded,
    isDbSubscriptionReady,
    isReadyToDisplayMessages,
    getFetchMessageId,
    scrollToBottom,
    updateChatRoom
  ])

  // Channel change effect - reset state when switching channels
  useEffect(() => {
    updateChatRoom('isReadyToDisplayMessages', false)
  }, [channelId, updateChatRoom])

  // Cleanup effect
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    isReadyToDisplayMessages: isReadyToDisplayMessages ?? false,
    messageContainerRef,
    messagesEndRef
  }
}
