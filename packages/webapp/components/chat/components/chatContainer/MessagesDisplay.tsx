import React, { useState, useEffect, useRef } from 'react'
import MessageCard from './MessageCard'
import { format, isSameDay, parseISO } from 'date-fns'
import { useChatStore, useStore } from '@stores'
import { useCheckReadMessage, useMentionClick } from '../../hooks'
import { useChannel } from '../../context/ChannelProvider'
import { DocsPlus } from '@icons'

interface MessagesDisplayProps {
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  toggleEmojiPicker: any
  selectedEmoji: any // Update the type based on your emoji implementation
  isLoadingMore: boolean
  loadingMoreDirection: 'older' | 'newer' | null
}

const isNewDay = (currentMessageDate: string, previousMessageDate: string) => {
  return !isSameDay(parseISO(currentMessageDate), parseISO(previousMessageDate))
}

const DateChip: React.FC<{ date: string; isScrollingUp: boolean }> = ({ date, isScrollingUp }) => (
  <div
    className="date_chip relative z-10 my-2 flex w-full justify-center pt-2"
    style={{ position: isScrollingUp ? 'sticky' : 'relative', top: isScrollingUp ? 0 : undefined }}>
    <div className="badge bg-base-100 relative z-10">{format(parseISO(date), 'MMMM do, yyyy')}</div>
  </div>
)

const NoMessagesDisplay = () => (
  <div className="flex h-full items-center justify-center">
    <div className="badge badge-neutral">No messages yet!</div>
  </div>
)

const LoadingSpinner = () => (
  <div className="mt-4 flex justify-center pt-2">
    <span className="loading loading-spinner text-primary"></span>
  </div>
)

const SystemNotifyChip = ({ message }: any) => {
  const cardRef = useRef<any>(null)
  const {
    settings: { metadata: docMetadata }
  } = useStore((state) => state)

  const handleMentionClick = useMentionClick()

  useEffect(() => {
    // we need for check message readed or not
    // Attach the message.id to the cardRef directly
    if (cardRef.current) {
      cardRef.current.msgId = message.id
      cardRef.current.readedAt = message.readed_at
      cardRef.current.createdAt = message.created_at
    }
  }, [message])

  if (message.metadata?.type === 'user_join_workspace') {
    return (
      <div
        className="msg_card chat my-4 flex justify-center pb-1"
        ref={cardRef}
        onClick={handleMentionClick}>
        <div className="badge bg-bg-chatBubble-owner py-3">
          <span
            className="mention text-primary cursor-pointer !p-0 font-semibold"
            data-type="mention"
            data-id={message.user_id}
            data-label={message?.user_details?.username}>
            @{message?.user_details?.username}
          </span>

          <span>joined</span>

          <span className="bg-bg-chatBubble-owner flex items-center gap-1 py-0.5">
            <DocsPlus size={12} className="mb-1" />
            <span className="font-medium underline">{docMetadata.title}</span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="msg_card chat my-4 flex justify-center pb-1" ref={cardRef}>
      <div className="badge bg-bg-chatBubble-owner border-none">{message.content}</div>
    </div>
  )
}

const generateMessageElements = (
  channelId: string,
  messages: Map<string, any>,
  isScrollingUp: boolean,
  messagesEndRef: React.RefObject<HTMLDivElement | null>,
  toggleEmojiPicker: any,
  selectedEmoji: string,
  displaySystemNotifyChip: boolean
) => {
  const messagesArray = Array.from(messages.values())
  const channelSettings = useChatStore.getState().workspaceSettings.channels.get(channelId)
  const { lastReadMessageId, totalMsgSincLastRead } = channelSettings || {
    lastReadMessageId: '',
    totalMsgSincLastRead: 0
  }

  return messagesArray.flatMap((message, index, array) => {
    const elements = []

    if (lastReadMessageId === message.id && (totalMsgSincLastRead ?? 0) >= 6) {
      elements.push(
        <div key={index + '2'} className="divider my-2 w-full p-4">
          Unread messages
        </div>
      )
    }

    if (index === 0 || isNewDay(message.created_at, array[index - 1]?.created_at)) {
      elements.push(
        <DateChip
          key={message.created_at}
          date={message.created_at}
          isScrollingUp={isScrollingUp}
        />
      )
    }

    if (message.type === 'notification') {
      if (!displaySystemNotifyChip) return

      elements.push(<SystemNotifyChip key={message.id} message={message} />)
    } else {
      elements.push(
        <MessageCard
          key={message.id}
          data={message}
          ref={index === array.length - 1 ? messagesEndRef : null}
          toggleEmojiPicker={toggleEmojiPicker}
          selectedEmoji={selectedEmoji}
        />
      )
    }

    return elements
  })
}

export const MessagesDisplay: React.FC<MessagesDisplayProps> = ({
  messageContainerRef,
  messagesEndRef,
  toggleEmojiPicker,
  selectedEmoji,
  isLoadingMore,
  loadingMoreDirection
}) => {
  const {
    channelId,
    settings: { displaySystemNotifyChip = true }
  } = useChannel()

  const [isScrollingUp, setIsScrollingUp] = useState(false)
  const lastScrollTop = useRef(0)
  const messages = useChatStore((state: any) => state.messagesByChannel.get(channelId))

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollTop = messageContainerRef.current?.scrollTop || 0
      // Set the state based on the scroll direction
      setIsScrollingUp(currentScrollTop < lastScrollTop.current)
      // Update the last scroll position
      lastScrollTop.current = currentScrollTop
    }

    const currentRef = messageContainerRef.current
    // Add the scroll event listener
    currentRef?.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      // Clean up the event listener
      currentRef?.removeEventListener('scroll', handleScroll)
    }
  }, [messageContainerRef.current, messages])

  // mark as read message
  useCheckReadMessage({ messageContainerRef, channelId, messages })

  if (!messages || messages.size === 0) {
    return <NoMessagesDisplay />
  }

  return (
    <>
      <div
        className="msg_wrapper relative flex w-full grow flex-col overflow-y-auto px-4 pt-1"
        ref={messageContainerRef}>
        {isLoadingMore && loadingMoreDirection === 'older' && <LoadingSpinner />}
        {generateMessageElements(
          channelId,
          messages,
          isScrollingUp,
          messagesEndRef,
          toggleEmojiPicker,
          selectedEmoji,
          displaySystemNotifyChip
        )}
        {isLoadingMore && loadingMoreDirection === 'newer' && <LoadingSpinner />}
      </div>
    </>
  )
}
