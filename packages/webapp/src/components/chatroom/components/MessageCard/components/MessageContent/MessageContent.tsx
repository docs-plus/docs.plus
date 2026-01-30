import React from 'react'
import { twMerge } from 'tailwind-merge'

import { CommentReference,MessageBody, ReplyReference } from './components'

interface Props {
  className?: string
  children?: React.ReactNode
}

const MessageContent = ({ className, children }: Props) => {
  return <div className={twMerge('message-content', className)}>{children}</div>
}

export default MessageContent

MessageContent.ReplyReference = ReplyReference
MessageContent.CommentReference = CommentReference
MessageContent.MessageBody = MessageBody
