import { useEffect, useState, useRef, useCallback } from 'react'
import debounce from 'lodash/debounce'
import { markReadMessages } from '@api'
import { useChatStore } from '@stores'
import { useMessageFeedContext } from '../components/MessageFeed/MessageFeedContext'

export const useCheckReadMessage = ({ channelId, messages }: any) => {
  const { messageContainerRef } = useMessageFeedContext()
  const [visibleCount, setVisibleCount] = useState<string[]>([])
  const dCheckVisibility = useRef<any>(null)
  const setWorkspaceChannelSetting = useChatStore((state: any) => state.setWorkspaceChannelSetting)
  const { channels } = useChatStore((state) => state.workspaceSettings)
  const activeCahnnel = channels.get(channelId)
  // const channelSettings = useChatStore.getState().workspaceSettings.channels.get(channelId)
  const { lastReadMessageTimestamp } = activeCahnnel || { lastReadMessageTimestamp: 0 }

  const checkVisibility = useCallback(() => {
    const container = messageContainerRef.current
    if (!container) return

    const visibleMessageIndexes: any = []
    const containerStyles = window.getComputedStyle(container)
    const paddingTop = parseInt(containerStyles.paddingTop, 10)
    const paddingBottom = parseInt(containerStyles.paddingBottom, 10)

    const messageElements: HTMLElement[] = Array.from(container.querySelectorAll('.msg_card'))

    // if the last message has readedAt, then all the messages are readed, so no need to check
    // @ts-ignore
    // if (messageElements.at(-1)?.readedAt) return

    messageElements.forEach((child) => {
      const childMarginTop = parseInt(window.getComputedStyle(child).marginTop, 10)
      const childMarginBottom = parseInt(window.getComputedStyle(child).marginBottom, 10)

      const childTop = child.offsetTop - paddingTop - childMarginTop
      const childBottom = childTop + child.offsetHeight + childMarginBottom
      const viewportTop = container.scrollTop
      const viewportBottom = viewportTop + container.clientHeight - paddingBottom

      if (childBottom > viewportTop && childTop < viewportBottom) {
        //@ts-ignore
        const lasReaded = new Date(lastReadMessageTimestamp).getTime()
        //@ts-ignore
        const msgCreatedAt = new Date(child?.createdAt || 0).getTime()

        if (lasReaded < msgCreatedAt) {
          //@ts-ignore
          visibleMessageIndexes.push({ id: child.msgId, createdAt: child.createdAt })
        }
      }
    })

    setVisibleCount(visibleMessageIndexes)
  }, [messageContainerRef.current])

  useEffect(() => {
    // run for the first time
    checkVisibility()
  }, [checkVisibility])

  useEffect(() => {
    const current = messageContainerRef.current

    if (!current) return

    const { scrollTop, scrollHeight, clientHeight } = current

    // Calculate the distance to the bottom of the scroll
    // Include a small threshold (e.g., 5px) to account for fractional pixels in calculations
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight <= 100

    if (isScrolledToBottom) {
      checkVisibility() // Call checkVisibility immediately
    }
  }, [messages, messageContainerRef.current])

  useEffect(() => {
    const current = messageContainerRef.current
    if (!current) return

    dCheckVisibility.current = debounce(checkVisibility, 700)
    current.addEventListener('scroll', dCheckVisibility.current)
    return () => {
      current.removeEventListener('scroll', dCheckVisibility.current)
      dCheckVisibility.current.cancel()
    }
  }, [messageContainerRef.current])

  useEffect(() => {
    // if (!visibleCount.length) return

    const lastMessage = visibleCount.at(-1) as any
    const channelSettings = useChatStore.getState().workspaceSettings.channels.get(channelId)
    const { lastReadMessageTimestamp } = channelSettings || { lastReadMessageTimestamp: 0 }

    if (!lastMessage) return
    const lastReadTimestamp = new Date(lastReadMessageTimestamp || 0).getTime()
    const lastVisibleTimestamp = new Date(lastMessage?.createdAt).getTime()

    if (lastReadTimestamp >= lastVisibleTimestamp) return

    setWorkspaceChannelSetting(channelId, 'lastReadMessageTimestamp', lastMessage.createdAt)

    if (lastMessage.id === 'fake_id') return

    markReadMessages({ channelId, lastMessage: lastMessage.id }).then()
  }, [visibleCount, channelId])
}
