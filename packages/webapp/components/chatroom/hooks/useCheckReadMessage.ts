import { useEffect, useState, useRef, useCallback } from 'react'
import debounce from 'lodash/debounce'
import { markReadMessages } from '@api'
import { useChatStore } from '@stores'
import { useMessageFeedContext } from '../components/MessageFeed/MessageFeedContext'

interface Message {
  id: string
  createdAt: string
}

interface VisibleMessage {
  createdAt: string
  id: string
}

interface UseCheckReadMessageProps {
  channelId: string
  messages: Message[]
}

export const useCheckReadMessage = ({ channelId, messages }: UseCheckReadMessageProps) => {
  const { messageContainerRef } = useMessageFeedContext()
  const [visibleMessages, setVisibleMessages] = useState<VisibleMessage[]>([])
  const debouncedCheckRef = useRef<ReturnType<typeof debounce> | null>(null)

  const setWorkspaceChannelSetting = useChatStore((state) => state.setWorkspaceChannelSetting)
  const { channels } = useChatStore((state) => state.workspaceSettings)
  const activeChannel = channels.get(channelId)
  const { lastReadMessageTimestamp = 0 } = activeChannel || {}

  const checkVisibility = useCallback(() => {
    const container = messageContainerRef.current
    if (!container) return

    const visibleMessageList: VisibleMessage[] = []
    const containerStyles = window.getComputedStyle(container)
    const paddingTop = parseInt(containerStyles.paddingTop, 10)
    const paddingBottom = parseInt(containerStyles.paddingBottom, 10)

    const messageElements = Array.from(
      container.querySelectorAll('.message-card.msg_card')
    ) as HTMLElement[]

    const lastReadTime = new Date(lastReadMessageTimestamp).getTime()

    messageElements.forEach((element) => {
      const marginTop = parseInt(window.getComputedStyle(element).marginTop, 10)
      const marginBottom = parseInt(window.getComputedStyle(element).marginBottom, 10)

      const elementTop = element.offsetTop - paddingTop - marginTop
      const elementBottom = elementTop + element.offsetHeight + marginBottom
      const viewportTop = container.scrollTop
      const viewportBottom = viewportTop + container.clientHeight - paddingBottom

      const isVisible = elementBottom > viewportTop && elementTop < viewportBottom

      if (isVisible) {
        //@ts-ignore
        const msgId = element.msgId
        //@ts-ignore
        const createdAt = element.createdAt

        if (msgId && createdAt) {
          const msgCreatedTime = new Date(createdAt).getTime()

          if (lastReadTime < msgCreatedTime) {
            visibleMessageList.push({ id: msgId, createdAt })
          }
        }
      }
    })

    setVisibleMessages(visibleMessageList)
  }, [lastReadMessageTimestamp])

  useEffect(() => {
    // run for the first time
    checkVisibility()
  }, [checkVisibility])

  useEffect(() => {
    const container = messageContainerRef.current
    if (!container) return

    // Calculate the distance to the bottom of the scroll
    // Include a small threshold (e.g., 100px) to account for fractional pixels in calculations
    const { scrollTop, scrollHeight, clientHeight } = container
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight <= 100

    if (isScrolledToBottom) {
      checkVisibility()
    }
  }, [messages, checkVisibility])

  useEffect(() => {
    const container = messageContainerRef.current
    if (!container) return

    debouncedCheckRef.current = debounce(checkVisibility, 700)
    container.addEventListener('scroll', debouncedCheckRef.current)

    return () => {
      if (debouncedCheckRef.current) {
        container.removeEventListener('scroll', debouncedCheckRef.current)
        debouncedCheckRef.current.cancel()
      }
    }
  }, [checkVisibility])

  useEffect(() => {
    if (!visibleMessages.length) return

    const lastMessage = visibleMessages.at(-1)
    if (!lastMessage) return

    const channelSettings = useChatStore.getState().workspaceSettings.channels.get(channelId)
    const currentLastRead = channelSettings?.lastReadMessageTimestamp || 0

    const lastReadTime = new Date(currentLastRead).getTime()
    const lastVisibleTime = new Date(lastMessage.createdAt).getTime()

    if (lastReadTime >= lastVisibleTime) return

    setWorkspaceChannelSetting(channelId, 'lastReadMessageTimestamp', lastMessage.createdAt)

    if (lastMessage.id !== 'fake_id') {
      markReadMessages({ channelId, lastMessage: lastMessage.id }).catch(console.error)
    }
  }, [visibleMessages, channelId, setWorkspaceChannelSetting])
}
