/* eslint-disable no-use-before-define */
// @ts-nocheck
import { useState, useEffect, MutableRefObject } from 'react'
import { groupedMessages } from '@utils/groupMessages'
import { useChatStore } from '@stores'
import { fetchMessagesPaginated } from '@api'

const PAGE_SIZE = 20
const START_PAGE = 2

export const useInfiniteLoadMessages = (
  messageContainerRef: MutableRefObject<HTMLElement | null>
) => {
  const [currentPage, setCurrentPage] = useState<number>(START_PAGE)
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)

  const { headingId: channelId } = useChatStore((state) => state.chatRoom)
  const replaceMessages = useChatStore((state: any) => state.replaceMessages)
  const messagesByChannel = useChatStore((state: any) => state.messagesByChannel)
  const messages = messagesByChannel.get(channelId)

  const loadMoreMessages = async () => {
    const msgContainer = messageContainerRef.current
    if (!hasMoreMessages || !msgContainer) return
    setIsLoadingMore(true)

    // select first ".MessageCard" from msgContainer
    const firstVisibleMessage = msgContainer.childNodes[1] as HTMLElement | null
    const prevTop = firstVisibleMessage ? firstVisibleMessage?.offsetTop : 0

    const pageMessages = await fetchMessagesPaginated({
      input_channel_id: channelId,
      page: currentPage,
      page_size: PAGE_SIZE
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
      setCurrentPage(currentPage + 1)

      // Adjust the scroll position
      requestAnimationFrame(() => {
        if (msgContainer && firstVisibleMessage) {
          // stop scrolling
          const date_chip = msgContainer.querySelector('.date_chip') as HTMLElement
          const currentTop = firstVisibleMessage.offsetTop + date_chip.offsetHeight
          msgContainer.scrollTop += currentTop - prevTop

          setIsLoadingMore(false)
        }
      })
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
