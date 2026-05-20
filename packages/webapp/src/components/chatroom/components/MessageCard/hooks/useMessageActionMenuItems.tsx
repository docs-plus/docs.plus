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
  className: string
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
        display: true,
        className: ''
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
        display: true,
        className: ''
      })
    }

    list.push(
      {
        title: linkCopied ? 'Copied!' : 'Copy Link',
        icon: linkCopied ? (
          <Icons.check size={iconSize} className="text-success" />
        ) : (
          <Icons.link size={iconSize} />
        ),
        onClickFn: () => copyMessageLinkHandler(message),
        display: true,
        className: `border-b border-base-300 pb-1 mb-1 ${linkCopied ? 'text-success' : ''}`
      },
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
        className: ''
      },
      {
        title: 'Copy to Doc',
        icon: <Icons.fileOpen size={iconSize} />,
        onClickFn: () => copyMessageToDocHandler(message),
        display: true,
        className: ''
      },
      {
        title: 'Reply in Thread',
        icon: <Icons.thread size={iconSize} />,
        onClickFn: () => replyInThreadHandler(message),
        display: true,
        className: 'text-primary'
      },
      {
        title: isPinned ? 'Unpin' : 'Pin',
        icon: isPinned ? <Icons.pinOff size={iconSize} /> : <Icons.pin size={iconSize} />,
        onClickFn: () => pinMessageHandler(message),
        display: false,
        className: ''
      },
      {
        title: 'Edit',
        icon: <Icons.edit size={iconSize} />,
        onClickFn: () => editMessageHandler(message),
        display: isOwner,
        className: 'border-t pt-1 mt-1 border-base-300'
      },
      {
        title: 'Delete',
        icon: <Icons.trash size={iconSize} />,
        onClickFn: () => {
          openDialog(<DeleteMessageConfirmationDialog message={message} />, { size: 'sm' })
        },
        display: isOwner,
        className: 'text-error'
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
