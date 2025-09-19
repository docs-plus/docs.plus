import { useCallback, useEffect, useMemo } from 'react'
import { useChatStore } from '@stores'
import { useChatroomContext } from '../ChatroomContext'
import type { Virtualizer } from '@tanstack/react-virtual'
import { TChannelSettings } from '@types'

interface UseScrollAndLoadReturn {
  isReadyToDisplayMessages: boolean
  messageContainerRef: React.RefObject<HTMLDivElement | null>
}

interface UseScrollAndLoadArgs {
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  virtualizerRef: React.MutableRefObject<Virtualizer<HTMLDivElement, HTMLElement> | null>
}

export const useScrollAndLoad = ({
  messageContainerRef,
  virtualizerRef
}: UseScrollAndLoadArgs): UseScrollAndLoadReturn => {
  const { channelId, isChannelDataLoaded, isDbSubscriptionReady } = useChatroomContext()

  const isReadyToDisplayMessages = useChatStore((state) => state.chatRoom.isReadyToDisplayMessages)
  const updateChatRoom = useChatStore((state) => state.updateChatRoom)
  const messageCount = useChatStore((state) => state.messagesByChannel.get(channelId)?.size ?? 0)

  const { channels } = useChatStore((state) => state.workspaceSettings)

  // Memoized selectors
  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )

  const getMessagesArray = useCallback(() => {
    const channelMessages = useChatStore.getState().messagesByChannel.get(channelId)
    return channelMessages ? Array.from(channelMessages.values()) : []
  }, [channelId])

  const { userPickingEmoji, lastReadMessageId, lastReadMessageTimestamp } = channelSettings ?? {}

  const getFetchMessageId = useCallback(() => {
    return (
      useChatStore.getState().chatRoom.fetchMsgsFromId ||
      new URLSearchParams(window.location.search).get('msg_id')
    )
  }, [])

  const waitForScrollSettled = useCallback(
    (onSettled: () => void) => {
      const container = messageContainerRef.current
      if (!container) {
        onSettled()
        return () => {}
      }

      let rafId: number | null = null
      let timeoutId: number | null = null
      let stableFrames = 0
      let previousTop = container.scrollTop
      let resolved = false

      const finish = () => {
        if (resolved) return
        resolved = true
        if (rafId !== null) cancelAnimationFrame(rafId)
        if (timeoutId !== null) window.clearTimeout(timeoutId)
        onSettled()
      }

      const detectStability = () => {
        if (resolved) return
        const currentTop = container.scrollTop

        if (Math.abs(currentTop - previousTop) <= 1) {
          stableFrames += 1
        } else {
          stableFrames = 0
          previousTop = currentTop
        }

        if (stableFrames >= 5) {
          finish()
          return
        }

        rafId = requestAnimationFrame(detectStability)
      }

      rafId = requestAnimationFrame(detectStability)
      timeoutId = window.setTimeout(finish, 700)

      return () => {
        resolved = true
        if (rafId !== null) cancelAnimationFrame(rafId)
        if (timeoutId !== null) window.clearTimeout(timeoutId)
      }
    },
    [messageContainerRef]
  )

  const scrollToLastMessage = useCallback(
    (behavior: 'auto' | 'smooth', onSettled: () => void) => {
      const virtualizer = virtualizerRef.current
      if (!virtualizer || messageCount === 0) {
        onSettled()
        return undefined
      }

      const fetchMsgsFromId = getFetchMessageId()
      if (fetchMsgsFromId) {
        onSettled()
        return undefined
      }

      const scheduleScroll = (
        targetIndex: number,
        options: { align: 'start' | 'center' | 'end'; behavior: 'auto' | 'smooth' },
        delayMs: number
      ) => {
        let cancelled = false
        let stopWatching: (() => void) | null = null

        const timeoutId = window.setTimeout(() => {
          if (cancelled) return
          virtualizer.scrollToIndex(targetIndex, options)
          stopWatching = waitForScrollSettled(() => {
            if (!cancelled) onSettled()
          })
        }, delayMs)

        return () => {
          cancelled = true
          window.clearTimeout(timeoutId)
          if (stopWatching) stopWatching()
        }
      }

      if (lastReadMessageId) {
        const messagesArray = getMessagesArray()
        const targetIndex = messagesArray.findIndex((message) => message.id === lastReadMessageId)
        if (targetIndex < 0) {
          onSettled()
          return undefined
        }

        return scheduleScroll(targetIndex, { align: 'center', behavior: 'auto' }, 500)
      }

      const virtualizerBehavior = behavior ?? 'auto'
      return scheduleScroll(messageCount - 1, { align: 'end', behavior: virtualizerBehavior }, 100)
    },
    [
      virtualizerRef,
      messageCount,
      getFetchMessageId,
      waitForScrollSettled,
      lastReadMessageId,
      getMessagesArray
    ]
  )

  useEffect(() => {
    updateChatRoom('isReadyToDisplayMessages', false)
  }, [channelId, updateChatRoom])

  useEffect(() => {
    if (!isDbSubscriptionReady || !isChannelDataLoaded) return
    if (messageCount === 0) return
    if (isReadyToDisplayMessages) return

    let cancelScroll: (() => void) | undefined
    let cancelled = false
    let hasResolved = false

    const markReady = () => {
      if (cancelled || hasResolved) return
      hasResolved = true
      updateChatRoom('isReadyToDisplayMessages', true)
    }

    const frameId = requestAnimationFrame(() => {
      cancelScroll = scrollToLastMessage('auto', markReady)
      if (!cancelScroll) {
        markReady()
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
      if (cancelScroll) cancelScroll()
    }
  }, [
    isDbSubscriptionReady,
    isChannelDataLoaded,
    messageCount,
    isReadyToDisplayMessages,
    scrollToLastMessage,
    updateChatRoom
  ])

  return {
    isReadyToDisplayMessages: isReadyToDisplayMessages ?? false,
    messageContainerRef
  }
}
