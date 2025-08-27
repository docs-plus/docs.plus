import React from 'react'
import { MessageListProvider } from './MessageListContext'
import { twMerge } from 'tailwind-merge'
import { LoadingSpinner, MessageLoop } from './components'
import { MessagesEmptyState } from './components/MessagesEmptyState'
import { MessageCard } from '../MessageCard'
import { useMessageFeedContext } from '../MessageFeed/MessageFeedContext'
import { MessageListContextMenu } from './components/MessageListContextMenu'

type Props = {
  children: React.ReactNode
  className?: string
}

const MessageList = ({ children, className }: Props) => {
  const {
    messageContainerRef,
    topSentinelId,
    bottomSentinelId,
    isLoadingMore,
    loadingMoreDirection
  } = useMessageFeedContext()
  return (
    <MessageListProvider>
      <MessagesEmptyState>
        <div
          ref={messageContainerRef}
          className={twMerge(
            'message-list overflow-anchor-auto relative scroll-smooth',
            className
          )}>
          {/* Loading spinners - absolute positioned within container */}
          {isLoadingMore && (
            <LoadingSpinner position={loadingMoreDirection === 'older' ? 'top' : 'bottom'} />
          )}

          {/* Top sentinel for Intersection Observer */}
          <div id={topSentinelId} className="h-px w-full" />
          {children}
          {/* Bottom sentinel for Intersection Observer */}
          <div id={bottomSentinelId} className="h-px w-full" />
        </div>
      </MessagesEmptyState>
    </MessageListProvider>
  )
}

export default MessageList

MessageList.Loop = MessageLoop
MessageList.MessageCard = MessageCard
MessageList.ContextMenu = MessageListContextMenu

// <MessageList className="chat_msg_container">
//   <MessageList.Loop>
//     {(message, index, messages) => (
//       // Your MessageCard component
//       isMobile ? (
//         <MessageCard data={message} toggleEmojiPicker={toggleEmojiPicker} />
//       ) : (
//         <MessageCardDesktop message={message} toggleEmojiPicker={toggleEmojiPicker} />
//       )
//     )}
//   </MessageList.Loop>
// </MessageList>
