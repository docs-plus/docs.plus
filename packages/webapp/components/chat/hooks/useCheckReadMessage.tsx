import { useEffect, useState, useRef } from 'react'
import debounce from 'lodash/debounce'
import { markReadMessages } from '@api'
import { useChatStore } from '@stores'

export const useCheckReadMessage = ({ messageContainerRef, channelId, messages }: any) => {
  const [visibleCount, setVisibleCount] = useState<string[]>([])
  const dCheckVisibility = useRef<any>(null)
  const setWorkspaceChannelSetting = useChatStore((state: any) => state.setWorkspaceChannelSetting)

  const checkVisibility = () => {
    const container = messageContainerRef.current
    // console.log("checkVisibility function", container);
    if (!container) return

    const visibleMessageIndexes: any = []
    const containerStyles = window.getComputedStyle(container)
    const paddingTop = parseInt(containerStyles.paddingTop, 10)
    const paddingBottom = parseInt(containerStyles.paddingBottom, 10)

    const messageElements: HTMLElement[] = Array.from(container.querySelectorAll('.chat.msg_card'))
    // if the last message has readedAt, then all the messages are readed, so no need to check
    // @ts-ignore
    if (messageElements.at(-1)?.readedAt) return

    messageElements.forEach((child) => {
      const childMarginTop = parseInt(window.getComputedStyle(child).marginTop, 10)
      const childMarginBottom = parseInt(window.getComputedStyle(child).marginBottom, 10)

      const childTop = child.offsetTop - paddingTop - childMarginTop
      const childBottom = childTop + child.offsetHeight + childMarginBottom
      const viewportTop = container.scrollTop
      const viewportBottom = viewportTop + container.clientHeight - paddingBottom

      if (childBottom > viewportTop && childTop < viewportBottom) {
        //@ts-ignore
        if (!child.readedAt) {
          //@ts-ignore
          visibleMessageIndexes.push({ id: child.msgId, createAt: child.createdAt })
        }
      }
    })

    setVisibleCount(visibleMessageIndexes)
  }

  useEffect(() => {
    // run for the first time
    checkVisibility()
  }, [])

  useEffect(() => {
    const current = messageContainerRef.current

    if (!current) return

    const { scrollTop, scrollHeight, clientHeight } = current

    // Calculate the distance to the bottom of the scroll
    // Include a small threshold (e.g., 5px) to account for fractional pixels in calculations
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight <= 100

    // console.log("new message call", { scrollTop, isScrollable, isScrolledToBottom });
    if (isScrolledToBottom) {
      checkVisibility() // Call checkVisibility immediately
    }
  }, [messages, messageContainerRef.current])

  useEffect(() => {
    const current = messageContainerRef.current
    if (!current) return

    dCheckVisibility.current = debounce(checkVisibility, 600)
    current.addEventListener('scroll', dCheckVisibility.current)
    return () => {
      current.removeEventListener('scroll', dCheckVisibility.current)
      dCheckVisibility.current.cancel()
    }
  }, [messageContainerRef.current])

  useEffect(() => {
    const lastMessage = visibleCount.at(-1) as any
    const channelSettings = useChatStore.getState().workspaceSettings.channels.get(channelId)
    const { lastReadMessageTimestamp } = channelSettings || { lastReadMessageTimestamp: 0 }

    // check the creation of the last message
    if (!lastMessage) return
    const lastReadTimestamp = new Date(lastReadMessageTimestamp || 0).getTime()
    const lastVisibleTimestamp = new Date(lastMessage?.createAt).getTime()

    // check if the last read message is greater than the last visible message
    if (lastReadTimestamp >= lastVisibleTimestamp) return

    setWorkspaceChannelSetting(channelId, 'lastReadMessageTimestamp', lastMessage.createAt)

    if (lastMessage.id === 'fake_id') return
    markReadMessages({ channelId, lastMessage: lastMessage.id }).then()
  }, [visibleCount])
}
