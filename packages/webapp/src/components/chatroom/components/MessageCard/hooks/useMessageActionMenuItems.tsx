import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { DeleteMessageConfirmationDialog } from '@components/chatroom/components/MessageCard/components/common/DeleteMessageConfirmationDialog'
import { calculateEmojiPickerPosition } from '@components/chatroom/components/MessageCard/helpers'
import { useBookmarkMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useBookmarkMessageHandler'
import { useCopyMessageLinkHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageLinkHandler'
import { useCopyMessageToDocHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageToDocHandler'
import { useEditMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useEditMessageHandler'
import { usePinMessageHandler } from '@components/chatroom/components/MessageCard/hooks/usePinMessageHandler'
import { useReplyInMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInMessageHandler'
import { useReplyInThreadHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInThreadHandler'
import type { ContextMenuRowVariant } from '@components/ui/ContextMenu'
import { Icons } from '@icons'
import { useAuthStore, useChatStore } from '@stores'
import { TMsgRow } from '@types'
import { hasMetadataProperty } from '@utils/metadata'
import React, { useMemo } from 'react'

export type MessageActionMenuItem = {
  title: string
  icon: React.ReactNode
  onClickFn: (e?: React.MouseEvent) => void
  display: boolean
  variant?: ContextMenuRowVariant
  separatorBefore?: boolean
  className?: string
}

type Options = {
  iconSize?: number
  includeReaction?: boolean
}

export const useMessageActionMenuItems = (
  message: TMsgRow,
  { iconSize = 18, includeReaction = false }: Options = {}
) => {
  const { openDialog } = useChatroomContext()
  const { profile } = useAuthStore()
  const { openEmojiPicker } = useChatStore()
  const { replyInMessageHandler } = useReplyInMessageHandler()
  const { copyMessageToDocHandler } = useCopyMessageToDocHandler()
  const { bookmarkMessageHandler } = useBookmarkMessageHandler()
  const { replyInThreadHandler } = useReplyInThreadHandler()
  const { editMessageHandler } = useEditMessageHandler()
  const { pinMessageHandler } = usePinMessageHandler()
  const { copyMessageLinkHandler, copied: linkCopied } = useCopyMessageLinkHandler()

  const isOwner = message.user_id === profile?.id
  const isPinned = hasMetadataProperty(message.metadata, 'pinned')

  const items = useMemo(() => {
    const list: MessageActionMenuItem[] = [
      {
        title: 'Reply',
        icon: <Icons.reply size={iconSize} />,
        onClickFn: () => replyInMessageHandler(message),
        display: true
      }
    ]

    if (includeReaction) {
      list.push({
        title: 'Add reaction',
        icon: <Icons.emoji size={iconSize} />,
        onClickFn: (e?: React.MouseEvent) => {
          if (!e?.target) return
          const coordinates = (e.target as HTMLElement).getBoundingClientRect()
          const pickerOpenPosition = calculateEmojiPickerPosition(coordinates)
          openEmojiPicker(
            {
              top: pickerOpenPosition?.top || 0,
              left: pickerOpenPosition?.left || 0
            },
            'reactToMessage',
            message
          )
        },
        display: true
      })
    }

    list.push({
      title: linkCopied ? 'Copied!' : 'Copy Link',
      icon: linkCopied ? (
        <Icons.check size={iconSize} className="text-success" />
      ) : (
        <Icons.link size={iconSize} />
      ),
      onClickFn: () => copyMessageLinkHandler(message),
      display: true,
      className: linkCopied ? 'text-success' : undefined
    })

    list.push(
      {
        title: 'Bookmark',
        icon:
          message.is_bookmarked || message.bookmark_id ? (
            <Icons.bookmarkMinus size={iconSize} />
          ) : (
            <Icons.bookmarkPlus size={iconSize} />
          ),
        onClickFn: () => bookmarkMessageHandler(message),
        display: true,
        separatorBefore: true
      },
      {
        title: 'Copy to Doc',
        icon: <Icons.fileOpen size={iconSize} />,
        onClickFn: () => copyMessageToDocHandler(message),
        display: true
      },
      {
        title: 'Reply in Thread',
        icon: <Icons.thread size={iconSize} />,
        onClickFn: () => replyInThreadHandler(message),
        display: true,
        variant: 'primary'
      },
      {
        title: isPinned ? 'Unpin' : 'Pin',
        icon: isPinned ? <Icons.pinOff size={iconSize} /> : <Icons.pin size={iconSize} />,
        onClickFn: () => pinMessageHandler(message),
        display: false
      },
      {
        title: 'Edit',
        icon: <Icons.edit size={iconSize} />,
        onClickFn: () => editMessageHandler(message),
        display: isOwner,
        separatorBefore: true
      },
      {
        title: 'Delete',
        icon: <Icons.trash size={iconSize} />,
        onClickFn: () => {
          openDialog(<DeleteMessageConfirmationDialog message={message} />, { size: 'sm' })
        },
        display: isOwner,
        variant: 'danger',
        // Divider before Delete when Edit is hidden (non-owner); Edit owns separatorBefore when owner
        separatorBefore: !isOwner
      }
    )

    return list
  }, [
    bookmarkMessageHandler,
    copyMessageLinkHandler,
    copyMessageToDocHandler,
    editMessageHandler,
    iconSize,
    includeReaction,
    isOwner,
    isPinned,
    linkCopied,
    pinMessageHandler,
    message,
    openDialog,
    openEmojiPicker,
    replyInMessageHandler,
    replyInThreadHandler
  ])

  return items
}
