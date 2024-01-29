import React, { useState, useEffect, useRef } from 'react'
import MessageCard from './MessageCard'
import { format, isSameDay, parseISO } from 'date-fns'
import { useChatStore } from '@stores'

interface MessagesDisplayProps {
  messageContainerRef: React.RefObject<HTMLDivElement>
  messagesEndRef: React.RefObject<HTMLDivElement>
  toggleEmojiPicker: any
  selectedEmoji: any // Update the type based on your emoji implementation
  isLoadingMore: boolean
}

const isNewDay = (currentMessageDate: string, previousMessageDate: string) => {
  return !isSameDay(parseISO(currentMessageDate), parseISO(previousMessageDate))
}

const DateChip: React.FC<{ date: string; isScrollingUp: boolean }> = ({ date, isScrollingUp }) => (
  <div
    className="date_chip relative z-10 my-2 flex w-full justify-center pt-2"
    style={{ position: isScrollingUp ? 'sticky' : 'relative', top: isScrollingUp ? 0 : undefined }}>
    <div className="badge relative z-10 bg-base-100">{format(parseISO(date), 'MMMM do, yyyy')}</div>
  </div>
)

const NoMessagesDisplay = () => (
  <div className="flex items-center justify-center">
    <div className="badge badge-neutral">No messages yet!</div>
  </div>
)

const LoadingSpinner = () => (
  <div className="flex justify-center pt-2">
    <span className="loading loading-spinner text-primary"></span>
  </div>
)

const SystemNotifyChip: React.FC<{ message: string }> = ({ message }) => (
  <div className="my-4 flex justify-center pb-1">
    <div className="badge badge-secondary">{message}</div>
  </div>
)

const generateMessageElements = (
  messages: Map<string, any>,
  isScrollingUp: boolean,
  messagesEndRef: React.RefObject<HTMLDivElement>,
  toggleEmojiPicker: any,
  selectedEmoji: string
) => {
  const messagesArray = Array.from(messages.values())
  return messagesArray.flatMap((message, index, array) => {
    const elements = []
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
      elements.push(<SystemNotifyChip key={message.id} message={message.content} />)
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
  isLoadingMore
}) => {
  const [isScrollingUp, setIsScrollingUp] = useState(false)
  const lastScrollTop = useRef(0)
  const { headingId: channelId } = useChatStore((state) => state.chatRoom)

  const messagesByChannel = useChatStore((state: any) => state.messagesByChannel)
  const messages = messagesByChannel.get(channelId) as Map<string, any>

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollTop = messageContainerRef.current?.scrollTop || 0
      setIsScrollingUp(currentScrollTop < lastScrollTop.current)
      lastScrollTop.current = currentScrollTop
    }

    const currentRef = messageContainerRef.current
    currentRef?.addEventListener('scroll', handleScroll, { passive: true })

    return () => currentRef?.removeEventListener('scroll', handleScroll)
  }, [messageContainerRef])

  if (!messages || messages.size === 0) {
    return <NoMessagesDisplay />
  }

  return (
    <div
      className="relative flex w-full h-full overflow-auto flex-col px-10 pt-1"
      ref={messageContainerRef}>
      {isLoadingMore && <LoadingSpinner />}
      {generateMessageElements(
        messages,
        isScrollingUp,
        messagesEndRef,
        toggleEmojiPicker,
        selectedEmoji
      )}
    </div>
  )
}
