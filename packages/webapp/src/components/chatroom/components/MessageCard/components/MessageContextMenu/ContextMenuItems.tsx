import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { DeleteMessageConfirmationDialog } from '@components/chatroom/components/MessageCard/components/common/DeleteMessageConfirmationDialog'
import { useBookmarkMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useBookmarkMessageHandler'
import { useCopyMessageLinkHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageLinkHandler'
import { useCopyMessageToDocHandler } from '@components/chatroom/components/MessageCard/hooks/useCopyMessageToDocHandler'
import { useEditMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useEditMessageHandler'
import { usePinMessageHandler } from '@components/chatroom/components/MessageCard/hooks/usePinMessageHandler'
import { useReplyInMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInMessageHandler'
import { useReplyInThreadHandler } from '@components/chatroom/components/MessageCard/hooks/useReplyInThreadHandler'
import { ReplyMD } from '@components/icons/Icons'
import { useContextMenuContext } from '@components/ui/ContextMenu'
import { useAuthStore, useChatStore } from '@stores'
import { TMsgRow } from '@types'
import { hasMetadataProperty } from '@utils/metadata'
import React, { useMemo } from 'react'
import { BsFillPinAngleFill, BsFillPinFill, BsForwardFill } from 'react-icons/bs'
import {
  MdBookmarkRemove,
  MdCheck,
  MdDeleteOutline,
  MdOutlineBookmarkAdd,
  MdOutlineComment,
  MdOutlineEdit,
  MdOutlineEmojiEmotions,
  MdOutlineFileOpen,
  MdOutlineLink
} from 'react-icons/md'

import { MenuItem } from '../../../../../ui/ContextMenu'
import { calculateEmojiPickerPosition } from '../../helpers'

type Props = {
  message?: TMsgRow | null
}

const ContextMenuItems = ({ message }: Props) => {
  if (!message) return null

  const { setIsOpen } = useContextMenuContext()
  const { profile } = useAuthStore()

  const { replyInMessageHandler } = useReplyInMessageHandler()
  const { openEmojiPicker } = useChatStore()
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
      icon: <ReplyMD size={20} />,
      onClickFn: () => replyInMessageHandler(message),
      display: true, //settings.contextMenue?.reply ?? true,
      className: ''
    },
    {
      title: 'Add reaction',
      icon: <MdOutlineEmojiEmotions size={20} />,
      onClickFn: (e: React.MouseEvent) => {
        if (e.target) {
          const coordinates = (e.target as HTMLElement).getBoundingClientRect()
          const pickerOpenPosition = calculateEmojiPickerPosition(coordinates)
          openEmojiPicker(
            {
              top: pickerOpenPosition?.top || 0,
              left: pickerOpenPosition?.left || 0
            },
            'react2Message',
            message
          )
        }
      },
      display: true, //settings.contextMenue?.reaction ?? true,
      className: ''
    },
    {
      title: linkCopied ? 'Copied!' : 'Copy Link',
      icon: linkCopied ? (
        <MdCheck size={20} className="text-success" />
      ) : (
        <MdOutlineLink size={20} />
      ),
      onClickFn: () => copyMessageLinkHandler(message),
      display: true, //settings.contextMenue?.copyLink ?? true,
      className: `border-b border-base-300 pb-1 mb-1 ${linkCopied ? 'text-success' : ''}`
    },
    {
      title: 'Bookmark',
      icon:
        message.is_bookmarked || message.bookmark_id ? (
          <MdBookmarkRemove size={20} />
        ) : (
          <MdOutlineBookmarkAdd size={20} />
        ),
      onClickFn: () => bookmarkMessageHandler(message),
      display: true, //settings.contextMenue?.bookmark ?? true,
      className: ''
    },
    {
      title: 'Copy to Doc',
      icon: <MdOutlineFileOpen size={20} />,
      onClickFn: () => copyMessageToDocHandler(message),
      display: true, //settings.contextMenue?.copyToDoc ?? true,
      className: ''
    },
    {
      title: 'Reply in Thread',
      icon: <MdOutlineComment size={20} />,
      onClickFn: () => replyInThreadHandler(message),
      display: true, //settings.contextMenue?.replyInThread ?? true,
      className: 'text-docsy'
    },

    {
      title: 'Forward',
      icon: <BsForwardFill size={20} />,
      onClickFn: () => {}, //openModal('forwardMessageModal', messageData),
      display: false, //settings.contextMenue?.forward ?? true,
      className: ''
    },
    {
      title: isPinned ? 'Unpin' : 'Pin',
      icon: isPinned ? <BsFillPinAngleFill size={20} /> : <BsFillPinFill size={20} />,
      onClickFn: () => pinMessageHandler(message),
      display: false, //settings.contextMenue?.pin ?? true,
      className: ''
    },
    {
      title: 'Edit',
      icon: <MdOutlineEdit size={20} />,
      onClickFn: () => editMessageHandler(message),
      display: isOwner, //true, //settings.contextMenue?.edite ?? true,
      className: 'border-t pt-1 mt-1 border-base-300'
    },
    {
      title: 'Delete',
      icon: <MdDeleteOutline size={20} />,
      onClickFn: () => {
        openDialog(<DeleteMessageConfirmationDialog message={message} />, {
          size: 'sm'
        })
      },
      display: isOwner, //true, //settings.contextMenue?.delete ?? true,
      className: 'text-red-500'
    }
  ]

  return (
    <>
      {messageButtonList.map(
        (item) =>
          item.display && (
            <MenuItem
              key={item.title}
              //@ts-ignore
              onClick={(e) => {
                item.onClickFn(e)
                setIsOpen(false)
              }}
              className={`${item.className}`}>
              <a href="#">
                {item.icon}
                {item.title}
              </a>
            </MenuItem>
          )
      )}
    </>
  )
}

export default ContextMenuItems
