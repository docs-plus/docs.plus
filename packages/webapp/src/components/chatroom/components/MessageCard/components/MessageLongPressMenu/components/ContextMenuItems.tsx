import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { DeleteMessageConfirmationDialog } from '@components/chatroom/components/MessageCard/components/common/DeleteMessageConfirmationDialog'
import { useBookmarkMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useBookmarkMessageHandler'
import { useCopyMessageLinkHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageLinkHandler'
import { useCopyMessageToDocHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageToDocHandler'
import { useEditMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useEditMessageHandler'
import { usePinMessageHandler } from '@components/chatroom/components/MessageCard/hooks/usePinMessageHandler'
import { useReplyInMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInMessageHandler'
import { useReplyInThreadHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInThreadHandler'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { TMsgRow } from '@types'
import { hasMetadataProperty } from '@utils/metadata'
import { motion } from 'motion/react'
import React, { useMemo } from 'react'

import { useMessageLongPressMenu } from '../MessageLongPressMenu'

type Props = {
  message?: TMsgRow | null
  isInteractive?: boolean
}

export const LongPressMenuItems = ({ message, isInteractive = true }: Props) => {
  if (!message) return null

  const { hideMenu } = useMessageLongPressMenu()
  const { profile } = useAuthStore()

  const { replyInMessageHandler } = useReplyInMessageHandler()
  const { copyMessageToDocHandler } = useCopyMessageToDocHandler()
  const { bookmarkMessageHandler } = useBookmarkMessageHandler()
  const { replyInThreadHandler } = useReplyInThreadHandler()
  const { pinMessageHandler } = usePinMessageHandler()
  const { editMessageHandler } = useEditMessageHandler()
  const { openDialog } = useChatroomContext()
  const { copyMessageLinkHandler, copied: linkCopied } = useCopyMessageLinkHandler()

  const isOwner = useMemo(() => {
    return message?.user_id === profile?.id
  }, [message, profile])

  const isPinned = useMemo(() => {
    return hasMetadataProperty(message.metadata, 'pinned')
  }, [message])

  const messageButtonList = [
    {
      title: 'Reply',
      icon: <Icons.reply size={20} />,
      onClickFn: () => replyInMessageHandler(message),
      display: true, //settings.contextMenue?.reply ?? true,
      className: ''
    },
    {
      title: linkCopied ? 'Copied!' : 'Copy Link',
      icon: linkCopied ? (
        <Icons.check size={20} className="text-success" />
      ) : (
        <Icons.link size={20} />
      ),
      onClickFn: () => copyMessageLinkHandler(message),
      display: true, //settings.contextMenue?.copyLink ?? true,
      className: `border-b border-base-300 pb-1 mb-1 ${linkCopied ? 'text-success' : ''}`
    },
    {
      title: 'Bookmark',
      icon:
        message.is_bookmarked || message.bookmark_id ? (
          <Icons.bookmarkMinus size={20} />
        ) : (
          <Icons.bookmarkPlus size={20} />
        ),
      onClickFn: () => bookmarkMessageHandler(message),
      display: true, //settings.contextMenue?.bookmark ?? true,
      className: ''
    },
    {
      title: 'Copy to Doc',
      icon: <Icons.fileOpen size={20} />,
      onClickFn: () => copyMessageToDocHandler(message),
      display: true, //settings.contextMenue?.copyToDoc ?? true,
      className: ''
    },
    {
      title: 'Reply in Thread',
      icon: <Icons.thread size={20} />,
      onClickFn: () => replyInThreadHandler(message),
      display: true, //settings.contextMenue?.replyInThread ?? true,
      className: 'text-primary'
    },

    {
      title: 'Forward',
      icon: <Icons.forward size={20} />,
      onClickFn: () => {}, //openModal('forwardMessageModal', messageData),
      display: false, //settings.contextMenue?.forward ?? true,
      className: ''
    },
    {
      title: isPinned ? 'Unpin' : 'Pin',
      icon: isPinned ? <Icons.pinOff size={20} /> : <Icons.pin size={20} />,
      onClickFn: () => pinMessageHandler(message),
      display: false, //settings.contextMenue?.pin ?? true,
      className: ''
    },
    {
      title: 'Edit',
      icon: <Icons.edit size={20} />,
      onClickFn: () => editMessageHandler(message),
      display: isOwner, //true, //settings.contextMenue?.edite ?? true,
      className: 'border-t pt-1 mt-1 border-base-300'
    },
    {
      title: 'Delete',
      icon: <Icons.trash size={20} />,
      onClickFn: () => {
        openDialog(<DeleteMessageConfirmationDialog message={message} />, {
          size: 'sm'
        })
      },
      display: isOwner, //true, //settings.contextMenue?.delete ?? true,
      className: 'text-error'
    }
  ]

  return (
    <>
      {messageButtonList.map(
        (item) =>
          item.display && (
            <motion.li
              key={item.title}
              onTap={() => {
                if (!isInteractive) return
                item.onClickFn()
                hideMenu()
              }}
              whileTap={{
                scale: 0.98,
                backgroundColor: 'color-mix(in oklch, var(--color-base-content) 10%, transparent)',
                transition: { duration: 0.1 }
              }}
              className={`${item.className} ${!isInteractive ? 'pointer-events-none cursor-not-allowed opacity-60' : 'cursor-pointer select-none'} flex touch-manipulation items-center`}>
              <div className="flex w-full items-center gap-3">
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="font-medium">{item.title}</span>
              </div>
            </motion.li>
          )
      )}
    </>
  )
}
