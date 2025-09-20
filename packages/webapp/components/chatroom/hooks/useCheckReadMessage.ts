import { useCallback, useEffect, useMemo, useRef } from 'react'
import debounce from 'lodash/debounce'
import { markReadMessages } from '@api'
import { useChatStore } from '@stores'
import { useMessageFeedContext } from '../components/MessageFeed/MessageFeedContext'
import type { Virtualizer } from '@tanstack/react-virtual'

interface UseCheckReadMessageProps {
  channelId: string
  messages: Map<string, any> | null
}

export const useCheckReadMessage = ({ channelId, messages }: UseCheckReadMessageProps) => {
  const { messageContainerRef, virtualizerRef } = useMessageFeedContext()
  const setWorkspaceChannelSetting = useChatStore((state) => state.setWorkspaceChannelSetting)
  const { channels } = useChatStore((state) => state.workspaceSettings)

  const channelSettings = channels.get(channelId)
  const lastReadMessageTimestamp = channelSettings?.lastReadMessageTimestamp ?? 0

  const lastReadTime = useMemo(
    () => new Date(lastReadMessageTimestamp).getTime(),
    [lastReadMessageTimestamp, channels]
  )

  const messagesArray = useMemo(() => (messages ? Array.from(messages.values()) : []), [messages])

  const resolveScrollElement = useCallback(
    (virtualizer: Virtualizer<HTMLDivElement, HTMLElement> | null): Element | Window | null => {
      if (!virtualizer) return messageContainerRef.current
      const element = virtualizer.scrollElement
      if (element && typeof element === 'object' && 'addEventListener' in element) {
        return element as Element | Window
      }
      return messageContainerRef.current
    },
    [messageContainerRef]
  )

  const checkVisibleMessages = useCallback(() => {
    const virtualizer = virtualizerRef.current
    if (!virtualizer || messagesArray.length === 0) return

    const scrollElement = resolveScrollElement(virtualizer)

    let viewportOffset = virtualizer.scrollOffset ?? 0
    let viewportHeight = 0

    if (scrollElement && 'scrollTop' in scrollElement && 'clientHeight' in scrollElement) {
      viewportOffset = (scrollElement as HTMLElement).scrollTop
      viewportHeight = (scrollElement as HTMLElement).clientHeight
    } else if (typeof window !== 'undefined' && scrollElement === window) {
      viewportOffset = window.scrollY
      viewportHeight = window.innerHeight
    } else if (messageContainerRef.current) {
      viewportHeight = messageContainerRef.current.clientHeight
    }

    if (viewportHeight === 0) return

    const viewportBottom = viewportOffset + viewportHeight
    const virtualItems = virtualizer.getVirtualItems()

    let newestVisibleMessage: { id: string; timestamp: string; message: any } | null = null

    for (const item of virtualItems) {
      const isVisible = item.end > viewportOffset && item.start < viewportBottom
      if (!isVisible) continue

      const message = messagesArray[item.index]
      if (!message) continue

      const messageId = message.id
      const messageTimestamp = message.created_at || message.createdAt
      if (!messageId || !messageTimestamp || messageId === 'fake_id') continue

      const messageTime = new Date(messageTimestamp).getTime()

      if (messageTime <= lastReadTime) continue

      if (!newestVisibleMessage) {
        newestVisibleMessage = { id: messageId, timestamp: messageTimestamp, message }
      } else {
        const currentNewestTime = new Date(newestVisibleMessage.timestamp).getTime()
        if (messageTime > currentNewestTime) {
          newestVisibleMessage = { id: messageId, timestamp: messageTimestamp, message }
        }
      }
    }

    if (!newestVisibleMessage) return

    setWorkspaceChannelSetting(
      channelId,
      'lastReadMessageTimestamp',
      newestVisibleMessage.timestamp
    )

    markReadMessages({ channelId, lastMessage: newestVisibleMessage.id }).catch(console.error)
  }, [
    channelId,
    lastReadTime,
    messagesArray,
    resolveScrollElement,
    setWorkspaceChannelSetting,
    virtualizerRef,
    messageContainerRef
  ])

  useEffect(() => {
    checkVisibleMessages()
  }, [checkVisibleMessages, messagesArray.length])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      checkVisibleMessages()
    }, 150)

    return () => window.clearTimeout(timeoutId)
  }, [checkVisibleMessages])

  useEffect(() => {
    const virtualizer = virtualizerRef.current
    const scrollElement = resolveScrollElement(virtualizer)
    if (!scrollElement) return

    const handler = debounce(checkVisibleMessages, 120)
    scrollElement.addEventListener('scroll', handler, { passive: true })

    return () => {
      handler.cancel()
      scrollElement.removeEventListener('scroll', handler)
    }
  }, [checkVisibleMessages, resolveScrollElement, virtualizerRef])
}
