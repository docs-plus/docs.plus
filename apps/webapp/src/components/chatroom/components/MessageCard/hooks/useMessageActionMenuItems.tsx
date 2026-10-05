import { DeleteMessageConfirmationDialog } from '@components/chatroom/components/MessageCard/components/common/DeleteMessageConfirmationDialog'
import { useBookmarkMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useBookmarkMessageHandler'
import { useCopyMessageLinkHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageLinkHandler'
import { useCopyMessageToDocHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageToDocHandler'
import { useDownloadMessageMediaHandler } from '@components/chatroom/components/MessageCard/hooks/useDownloadMessageMediaHandler'
import { useEditMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useEditMessageHandler'
import { usePinMessageHandler } from '@components/chatroom/components/MessageCard/hooks/usePinMessageHandler'
import { useReplyInMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInMessageHandler'
import { useReplyInThreadHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInThreadHandler'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import { isMessageBookmarked } from '@components/chatroom/utils/messagePresentation'
import { openMessageReactionAt } from '@components/chatroom/utils/messageReaction'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import { TMsgRow } from '@types'
import { hasMetadataProperty } from '@utils/metadata'
import { openReportMail } from '@utils/reportContent'
import { useMemo } from 'react'

import { MESSAGE_MENU_ICON_SIZE, type MessageActionMenuItem } from './messageActionMenu'

type Options = {
  includeReaction?: boolean
}

export const useMessageActionMenuItems = (
  message: TMsgRow,
  { includeReaction = false }: Options = {}
) => {
  const openDialog = useStore((s) => s.openDialog)
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
  const isBookmarked = isMessageBookmarked(message)
  const attachmentCount = parseMessageMedias(message.medias).length

  const items = useMemo(() => {
    const list: MessageActionMenuItem[] = [
      {
        id: 'reply',
        title: 'Reply',
        icon: <Icons.reply size={MESSAGE_MENU_ICON_SIZE} />,
        onClickFn: () => replyInMessageHandler(message),
        display: true
      }
    ]

    if (includeReaction) {
      list.push({
        id: 'add-reaction',
        title: 'Add reaction',
        icon: <Icons.emoji size={MESSAGE_MENU_ICON_SIZE} />,
        onClickFn: (e?: React.MouseEvent) => {
          if (!e?.target) return
          openMessageReactionAt(message, (e.target as HTMLElement).getBoundingClientRect())
        },
        display: true
      })
    }

    list.push({
      id: 'copy-link',
      title: 'Copy link',
      icon: <Icons.link size={MESSAGE_MENU_ICON_SIZE} />,
      onClickFn: () => copyMessageLinkHandler(message),
      display: true
    })

    if (attachmentCount > 0) {
      list.push({
        id: 'download',
        title: attachmentCount > 1 ? `Download all (${attachmentCount})` : 'Download',
        icon: <Icons.download size={MESSAGE_MENU_ICON_SIZE} />,
        onClickFn: () => downloadMessageMediaHandler(message),
        display: true
      })
    }

    list.push(
      {
        id: 'bookmark',
        title: isBookmarked ? 'Remove bookmark' : 'Bookmark',
        icon: isBookmarked ? (
          <Icons.bookmarkMinus size={MESSAGE_MENU_ICON_SIZE} />
        ) : (
          <Icons.bookmarkPlus size={MESSAGE_MENU_ICON_SIZE} />
        ),
        onClickFn: () => bookmarkMessageHandler(message),
        display: true,
        separatorBefore: true
      },
      {
        id: 'copy-to-doc',
        title: 'Copy to doc',
        icon: <Icons.fileOpen size={MESSAGE_MENU_ICON_SIZE} />,
        onClickFn: () => copyMessageToDocHandler(message),
        display: true
      },
      {
        id: 'reply-in-thread',
        title: 'Reply in thread',
        icon: <Icons.thread size={MESSAGE_MENU_ICON_SIZE} />,
        onClickFn: () => replyInThreadHandler(message),
        display: true
      },
      {
        id: 'pin',
        title: isPinned ? 'Unpin' : 'Pin',
        icon: isPinned ? (
          <Icons.pinOff size={MESSAGE_MENU_ICON_SIZE} />
        ) : (
          <Icons.pin size={MESSAGE_MENU_ICON_SIZE} />
        ),
        onClickFn: () => pinMessageHandler(message),
        display: false
      },
      {
        id: 'edit',
        title: 'Edit',
        icon: <Icons.edit size={MESSAGE_MENU_ICON_SIZE} />,
        onClickFn: () => editMessageHandler(message),
        display: isOwner,
        separatorBefore: true
      },
      {
        id: 'delete',
        title: 'Delete',
        icon: <Icons.trash size={MESSAGE_MENU_ICON_SIZE} />,
        onClickFn: () => {
          openDialog(<DeleteMessageConfirmationDialog message={message} />, { size: 'sm' })
        },
        display: isOwner,
        variant: 'danger'
      },
      {
        // Hidden from the message menu. Document report in Settings stays the route.
        id: 'report',
        title: 'Report',
        icon: <Icons.alert size={MESSAGE_MENU_ICON_SIZE} />,
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
    includeReaction,
    isBookmarked,
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
