import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { DeleteMessageConfirmationDialog } from '@components/chatroom/components/MessageCard/components/common/DeleteMessageConfirmationDialog'
import { calculateEmojiPickerPosition } from '@components/chatroom/components/MessageCard/helpers'
import { useBookmarkMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useBookmarkMessageHandler'
import { useCopyMessageLinkHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageLinkHandler'
import { useCopyMessageToDocHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageToDocHandler'
import { useDownloadMessageMediaHandler } from '@components/chatroom/components/MessageCard/hooks/useDownloadMessageMediaHandler'
import { useEditMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useEditMessageHandler'
import { usePinMessageHandler } from '@components/chatroom/components/MessageCard/hooks/usePinMessageHandler'
import { useReplyInMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInMessageHandler'
import { useReplyInThreadHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInThreadHandler'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import { openMessageReaction } from '@components/chatroom/utils/messageReaction'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { TMsgRow } from '@types'
import { hasMetadataProperty } from '@utils/metadata'
import { openReportMail } from '@utils/reportContent'
import { useMemo } from 'react'

import { type MessageActionMenuItem, messageActionTitle } from './messageActionMenu'

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
  const { replyInMessageHandler } = useReplyInMessageHandler()
  const { copyMessageToDocHandler } = useCopyMessageToDocHandler()
  const { bookmarkMessageHandler } = useBookmarkMessageHandler()
  const { replyInThreadHandler } = useReplyInThreadHandler()
  const { editMessageHandler } = useEditMessageHandler()
  const { pinMessageHandler } = usePinMessageHandler()
  const { copyMessageLinkHandler, copied: linkCopied, getMessageUrl } = useCopyMessageLinkHandler()
  const { downloadMessageMediaHandler } = useDownloadMessageMediaHandler()

  const isOwner = message.user_id === profile?.id
  const isPinned = hasMetadataProperty(message.metadata, 'pinned')
  const attachmentCount = parseMessageMedias(message.medias).length

  const items = useMemo(() => {
    const list: MessageActionMenuItem[] = [
      {
        id: 'reply',
        title: 'Reply',
        icon: <Icons.reply size={iconSize} />,
        onClickFn: () => replyInMessageHandler(message),
        display: true
      }
    ]

    if (includeReaction) {
      list.push({
        id: 'add-reaction',
        title: 'Add reaction',
        icon: <Icons.emoji size={iconSize} />,
        onClickFn: (e?: React.MouseEvent) => {
          if (!e?.target) return
          const coordinates = (e.target as HTMLElement).getBoundingClientRect()
          const pickerOpenPosition = calculateEmojiPickerPosition(coordinates)
          openMessageReaction(message, {
            top: pickerOpenPosition?.top || 0,
            left: pickerOpenPosition?.left || 0
          })
        },
        display: true
      })
    }

    list.push({
      id: 'copy-link',
      title: messageActionTitle.copyLink,
      icon: <Icons.link size={iconSize} />,
      onClickFn: () => copyMessageLinkHandler(message),
      display: true
    })

    if (attachmentCount > 0) {
      list.push({
        id: 'download',
        title: attachmentCount > 1 ? `Download all (${attachmentCount})` : 'Download',
        icon: <Icons.download size={iconSize} />,
        onClickFn: () => downloadMessageMediaHandler(message),
        display: true
      })
    }

    list.push(
      {
        id: 'bookmark',
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
        id: 'copy-to-doc',
        title: messageActionTitle.copyToDoc,
        icon: <Icons.fileOpen size={iconSize} />,
        onClickFn: () => copyMessageToDocHandler(message),
        display: true
      },
      {
        id: 'reply-in-thread',
        title: 'Reply in Thread',
        icon: <Icons.thread size={iconSize} />,
        onClickFn: () => replyInThreadHandler(message),
        display: true,
        variant: 'primary'
      },
      {
        id: 'pin',
        title: isPinned ? 'Unpin' : 'Pin',
        icon: isPinned ? <Icons.pinOff size={iconSize} /> : <Icons.pin size={iconSize} />,
        onClickFn: () => pinMessageHandler(message),
        display: false
      },
      {
        id: 'edit',
        title: messageActionTitle.edit,
        icon: <Icons.edit size={iconSize} />,
        onClickFn: () => editMessageHandler(message),
        display: isOwner,
        separatorBefore: true
      },
      {
        id: 'delete',
        title: messageActionTitle.delete,
        icon: <Icons.trash size={iconSize} />,
        onClickFn: () => {
          openDialog(<DeleteMessageConfirmationDialog message={message} />, { size: 'sm' })
        },
        display: isOwner,
        variant: 'danger',
        // Divider before Delete when Edit is hidden (non-owner); Edit owns separatorBefore when owner
        separatorBefore: !isOwner
      },
      {
        // Hidden from the message menu. Document report in Settings stays the route.
        id: 'report',
        title: 'Report',
        icon: <Icons.alert size={iconSize} />,
        onClickFn: () => openReportMail('message', getMessageUrl(message)),
        display: false,
        separatorBefore: true
      }
    )

    return list
  }, [
    attachmentCount,
    bookmarkMessageHandler,
    copyMessageLinkHandler,
    copyMessageToDocHandler,
    downloadMessageMediaHandler,
    editMessageHandler,
    getMessageUrl,
    iconSize,
    includeReaction,
    isOwner,
    isPinned,
    pinMessageHandler,
    message,
    openDialog,
    replyInMessageHandler,
    replyInThreadHandler
  ])

  return { items, linkCopied }
}
