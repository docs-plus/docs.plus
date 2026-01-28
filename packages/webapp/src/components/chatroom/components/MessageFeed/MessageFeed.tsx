import React, { useRef } from 'react'
import { twMerge } from 'tailwind-merge'

import { MessageFeedProvider } from './MessageFeedContext'
import { MessageFeedError } from './components/OverLayers/MessageFeedError'
import { PinnedMessages } from './components/PinnedMessages'
import { MessageFeedLoading } from './components/OverLayers/MessageFeedLoading'
import { MessageList } from '../MessageList'
import { ScrollToBottom } from './components'

interface Props {
  className?: string
  children?: React.ReactNode
  showScrollToBottom?: boolean
}

const MessageFeed = ({ className, children, showScrollToBottom = true }: Props) => {
  const messageContainerRef = useRef<HTMLDivElement | null>(null)

  return (
    <MessageFeedProvider messageContainerRef={messageContainerRef}>
      {showScrollToBottom && <ScrollToBottom />}

      <MessageFeedError>
        <MessageFeedLoading>
          <div
            ref={messageContainerRef}
            className={twMerge(
              'message-feed scrollbar-custom scrollbar-thin relative h-full overflow-y-auto',
              className
            )}>
            {children}
          </div>
        </MessageFeedLoading>
      </MessageFeedError>
    </MessageFeedProvider>
  )
}

export default MessageFeed

MessageFeed.PinnedMessages = PinnedMessages
MessageFeed.MessageList = MessageList
MessageFeed.ScrollToBottom = ScrollToBottom
