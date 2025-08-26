import React from 'react'
import { twMerge } from 'tailwind-merge'

import {
  CopyToDocAction,
  DeleteAction,
  EditAction,
  MoreActionsDropdown,
  ReadStatusDisplay,
  QuickActions,
  EmojiReactionButton,
  ReplyButton,
  BookmarkButton,
  ReplyInThreadButton,
  CopyLinkAction
} from './components'

interface Props {
  className?: string
  children?: React.ReactNode
}

const MessageActions = ({ className, children }: Props) => {
  return (
    <div
      className={twMerge(
        'message-actions absolute -top-4 right-2 hidden group-hover/msgcard:block',
        className
      )}>
      {children}
    </div>
  )
}

export default MessageActions

// QuickActions
MessageActions.QuickActions = QuickActions
MessageActions.EmojiReaction = EmojiReactionButton
MessageActions.Reply = ReplyButton
MessageActions.Bookmark = BookmarkButton
MessageActions.ReplyInThread = ReplyInThreadButton
MessageActions.CopyLink = CopyLinkAction

// MoreActionsDropdown
MessageActions.MoreActions = MoreActionsDropdown
MessageActions.CopyToDoc = CopyToDocAction
MessageActions.Delete = DeleteAction
MessageActions.Edit = EditAction
MessageActions.ReadStatus = ReadStatusDisplay
