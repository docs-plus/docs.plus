import React from 'react'
import { twMerge } from 'tailwind-merge'

import {
  BookmarkButton,
  CopyLinkAction,
  CopyToDocAction,
  DeleteAction,
  EditAction,
  EmojiReactionButton,
  GroupAuth,
  QuickActions,
  ReadStatusDisplay,
  ReplyButton,
  ReplyInThreadButton} from './components'
import { HoverMenuActions } from './HoverMenuActions'

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
MessageActions.CopyToDoc = CopyToDocAction
MessageActions.Delete = DeleteAction
MessageActions.Edit = EditAction
MessageActions.ReadStatus = ReadStatusDisplay

// GroupAuth
MessageActions.GroupAuth = GroupAuth

// HoverMenuActions
MessageActions.HoverMenu = HoverMenuActions
