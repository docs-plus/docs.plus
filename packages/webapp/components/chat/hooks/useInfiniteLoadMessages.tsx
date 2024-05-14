import { useState, useEffect, MutableRefObject } from 'react'
import { groupedMessages } from '@utils/index'
import { useChatStore } from '@stores'
import { fetchMessagesPaginated } from '@api'
import { useChannel } from '../context/ChannelProvider'

const PAGE_SIZE = 20

const adjustScrollPositionAfterLoadingMessages = (
  messageContainerRef: MutableRefObject<HTMLElement | null>,
  markedElement: HTMLElement | null
) => {
  if (!messageContainerRef.current || !markedElement) return

  const newOffsetTop = markedElement.offsetTop
  messageContainerRef.current.scrollTop += newOffsetTop
}

export const useInfiniteLoadMessages = (
  messageContainerRef: MutableRefObject<HTMLElement | null>
) => {
  const { channelId } = useChannel()

  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)

  const channelSettings = useChatStore((state: any) =>
    state.workspaceSettings.channels.get(channelId)
  )
  const { scrollPage: currentPage = 2, scrollPageOffset } = channelSettings || {}

  const replaceMessages = useChatStore((state: any) => state.replaceMessages)
  const messagesByChannel = useChatStore((state: any) => state.messagesByChannel)
  const setWorkspaceChannelSetting = useChatStore((state: any) => state.setWorkspaceChannelSetting)

  const messages = messagesByChannel.get(channelId)

  const loadMoreMessages = async () => {
    const msgContainer = messageContainerRef.current
    if (!hasMoreMessages || !msgContainer) return
    setIsLoadingMore(true)

    const currentTopElement = messageContainerRef.current?.firstChild as HTMLElement

    const pageMessages = await fetchMessagesPaginated({
      input_channel_id: channelId,
      page: currentPage,
      page_size: scrollPageOffset
    })

    // If there are no messages, stop loading more
    if (!pageMessages?.messages || pageMessages?.messages?.length == 0) {
      setIsLoadingMore(false)
      return
    }

    if (pageMessages?.messages && pageMessages?.messages?.length > 0) {
      // Convert pageMessages.messages to a Map
      const newMessagesMap: any = new Map(
        groupedMessages(pageMessages.messages.reverse()).map((message: any) => [
          message.id,
          message
        ])
      )

      // Merge the new messages with the existing ones
      const updatedMessages: Map<string, any> = new Map([...newMessagesMap, ...messages])

      replaceMessages(channelId, updatedMessages)
      setWorkspaceChannelSetting(channelId, 'scrollPage', currentPage + 1)
      setWorkspaceChannelSetting(channelId, 'scrollPageOffset', PAGE_SIZE)

      adjustScrollPositionAfterLoadingMessages(messageContainerRef, currentTopElement)
      setIsLoadingMore(false)
    } else {
      setHasMoreMessages(false)
    }
  }

  useEffect(() => {
    const currentRef = messageContainerRef.current

    const handleScroll = () => {
      const current = messageContainerRef.current

      if (current) {
        const isAtTop = current.scrollTop == 0
        if (isAtTop && current) {
          loadMoreMessages()
        }
      }
    }

    currentRef?.addEventListener('scroll', handleScroll)

    return () => {
      currentRef?.removeEventListener('scroll', handleScroll)
    }
  }, [messageContainerRef.current, messages])

  return { isLoadingMore }
}
