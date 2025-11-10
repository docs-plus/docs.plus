import React from 'react'
import { ReplyReference, MessageBody, CommentReference } from './components'
import { twMerge } from 'tailwind-merge'

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
