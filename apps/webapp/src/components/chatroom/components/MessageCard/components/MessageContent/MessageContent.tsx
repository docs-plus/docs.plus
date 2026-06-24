import React from 'react'
import { twMerge } from 'tailwind-merge'

import { useMessageCardContext } from '../../MessageCardContext'
import { CommentReference, MessageBody, ReplyReference } from './components'

interface Props {
  className?: string
  children?: React.ReactNode
}

const MessageContent = ({ className, children }: Props) => {
  const { messageLayout, messageDisplayType, hasMedia } = useMessageCardContext()

  return (
    <div
      className={twMerge(
        'message-content',
        hasMedia && 'message-content--has-media',
        messageLayout === 'media-only' && 'message-content--media-only',
        messageLayout === 'media-with-caption' && 'message-content--media-caption',
        messageDisplayType !== 'text' && `message-content--type-${messageDisplayType}`,
        className
      )}
      data-message-type={messageDisplayType}
      data-message-layout={messageLayout}>
      {children}
    </div>
  )
}

export default MessageContent

MessageContent.ReplyReference = ReplyReference
MessageContent.CommentReference = CommentReference
MessageContent.MessageBody = MessageBody
