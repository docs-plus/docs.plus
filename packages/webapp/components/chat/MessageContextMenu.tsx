import React, { forwardRef, useMemo, useCallback, useState, useEffect } from 'react'
import {
  ChannelMemberReadUpdate,
  deleteMessage,
  getChannelMembersByLastReadUpdate,
  pinMessage
} from '@api'
import { BsForwardFill, BsFillPinFill, BsFillPinAngleFill } from 'react-icons/bs'
// import { useForwardMessageModalStore } from '@/components/messages/components/ForwardMessageModal'
import toast from 'react-hot-toast'
import { ContextMenu, MenuItem, useContextMenuContext } from './components/ui/ContextMenu'
import { useAuthStore, useChatStore } from '@stores'
import { useChannel } from './context/ChannelProvider'
import { TChannelSettings } from '@types'
import { IoCheckmarkDoneSharp, IoCheckmarkSharp } from 'react-icons/io5'
import {
  MdDeleteOutline,
  MdOutlineBookmarkAdd,
  MdOutlineComment,
  MdOutlineEdit,
  MdOutlineFileOpen,
  MdBookmarkRemove,
  MdOutlineEmojiEmotions
} from 'react-icons/md'
import { ReplyMD } from '@components/icons/Icons'
import AvatarStack from '@components/AvatarStack'
import { useApi } from '@hooks/useApi'
import AvatarStackLoader from '@components/skeleton/AvatarStackLoader'
import { useBookmarkMessage } from '@components/pages/document/hooks/useBookmarkMessage'
import { useReplyInThread } from '@hooks/useReplyInThread'
import { useEmojiPicker } from '@hooks/useEmojiPicker'
import { useCopyToDoc } from '@hooks/useCopyToDoc'

const UserReadStatus = ({ messageData }: { messageData: any }) => {
  const { channelId } = useChannel()
  const { setIsOpen, isOpen } = useContextMenuContext()
  const [readUsers, setReadUsers] = useState<ChannelMemberReadUpdate[]>([])

  const { request: fetchReadUsers, loading: readUsersLoading } = useApi(
    getChannelMembersByLastReadUpdate,
    [messageData.channel_id, messageData.created_at],
    false
  )

  useEffect(() => {
    const fetchData = async () => {
      if (isOpen) {
        const { data } = await fetchReadUsers(channelId, messageData.created_at)
        setReadUsers(data as ChannelMemberReadUpdate[])
      }
    }

    fetchData()
  }, [isOpen])

  return (
    messageData.readed_at &&
    (readUsersLoading ? (
      <MenuItem className="menu-disabled flex flex-row items-center gap-2 border-t border-gray-300">
        <div className="skeleton ml-2 h-4 w-4 rounded-full p-0"></div>
        <div className="skeleton h-4 w-10 rounded-full"></div>
        <AvatarStackLoader size={7} repeat={3} className="ml-auto !-space-x-6 pr-1" />
      </MenuItem>
    ) : (
      <MenuItem className="menu-disabled !my-1 border-t border-gray-300">
        <div className="flex items-center gap-2 py-0 pt-2">
          <span className="text-xs text-gray-500">
            {!messageData.readed_at ? (
              <IoCheckmarkSharp className="text-base-content size-4 text-gray-400" />
            ) : (
              <span className="flex items-center gap-3">
                <IoCheckmarkDoneSharp className="text-base-content size-4 text-gray-400" />
                {readUsers.length} seen
              </span>
            )}
          </span>

          <AvatarStack
            className="ml-auto !-space-x-4"
            users={(readUsers as ChannelMemberReadUpdate[]).map((user) => ({
              id: user.id,
              username: user.username,
              full_name: user.full_name,
              avatar_url: user.avatar_url,
              avatar_updated_at: user.avatar_updated_at
            }))}
            size={8}
            maxDisplay={5}
          />
        </div>
      </MenuItem>
    ))
  )
}

export const MessageContextMenu = forwardRef<
  HTMLUListElement,
  { messageData: any; className: string; parrentRef: any }
>(({ messageData, className, parrentRef }, ref) => {
  const { channelId, settings } = useChannel()

  const { handleBookmarkMessage, bookmarkLoading } = useBookmarkMessage()
  const { handleReplyInThread } = useReplyInThread()
  const { openEmojiPicker } = useEmojiPicker()
  const { handleCopyToDoc } = useCopyToDoc()

  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )
  // const openModal = useForwardMessageModalStore((state: any) => state.openModal)
  const addChannelPinnedMessage = useChatStore((state) => state.addChannelPinnedMessage)
  const removeChannelPinnedMessage = useChatStore((state) => state.removeChannelPinnedMessage)
  const { workspaceBroadcaster } = useChatStore((state) => state.workspaceSettings)
  const setEditMessageMemory = useChatStore((state) => state.setEditMessageMemory)
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const user = useAuthStore((state) => state.profile)

  const handleReplyMessage = useCallback(() => {
    if (!messageData) return
    setReplyMessageMemory(channelId, messageData)
    // Trigger editor focus
    const event = new CustomEvent('editor:focus')
    document.dispatchEvent(event)
  }, [channelId, messageData])

  const handleDeleteMessage = useCallback(async () => {
    if (!messageData) return
    const { error } = await deleteMessage(messageData.channel_id, messageData.id)
    if (error) {
      toast.error('Message not deleted')
    } else {
      toast.success('Message deleted')
    }
  }, [messageData])

  const handlePinMessage = useCallback(async () => {
    if (!messageData) return
    const actionType = messageData.metadata?.pinned ? 'unpin' : 'pin'
    const { error } = await pinMessage(messageData.channel_id, messageData.id, actionType)
    if (error) {
      toast.error(`Message not ${actionType}`)
    } else {
      toast.success(`Message ${actionType} successfully`)
      actionType === 'pin'
        ? addChannelPinnedMessage(messageData.channel_id, messageData)
        : removeChannelPinnedMessage(messageData.channel_id, messageData.id)

      await workspaceBroadcaster.send({
        type: 'broadcast',
        event: 'pinnedMessage',
        payload: { message: messageData, actionType }
      })
    }
  }, [messageData])

  const handleEdit = useCallback(() => {
    if (!messageData) return
    setEditMessageMemory(channelId, messageData)
  }, [channelId, messageData])

  const handleThread = useCallback(() => {
    if (!messageData) return
    useChatStore.getState().setStartThreadMessage(messageData)
  }, [messageData])

  const isPinned = useMemo(() => {
    return messageData?.metadata?.pinned
  }, [messageData])

  const messageButtonList = [
    {
      title: 'Reply',
      icon: <ReplyMD size={20} />,
      onClickFn: handleReplyMessage,
      display: settings.contextMenue?.reply ?? true,
      className: ''
    },
    {
      title: 'Add reaction',
      icon: <MdOutlineEmojiEmotions size={20} />,
      onClickFn: (e: React.MouseEvent, mouseEvent: MouseEvent | null) => {
        if (mouseEvent) {
          openEmojiPicker(
            mouseEvent as unknown as React.MouseEvent<Element, MouseEvent>,
            messageData
          )
        }
      },
      display: settings.contextMenue?.reaction ?? true,
      className: 'border-b border-gray-300 pb-1 mb-1'
    },
    {
      title: 'Bookmark',
      icon:
        messageData.is_bookmarked || messageData.bookmark_id ? (
          <MdBookmarkRemove size={20} />
        ) : (
          <MdOutlineBookmarkAdd size={20} />
        ),
      onClickFn: () => handleBookmarkMessage(messageData),
      display: settings.contextMenue?.bookmark ?? true,
      className: ''
    },
    {
      title: 'Copy to Doc',
      icon: <MdOutlineFileOpen size={20} />,
      onClickFn: () => handleCopyToDoc(messageData, channelId),
      display: settings.contextMenue?.copyToDoc ?? true,
      className: ''
    },
    {
      title: 'Reply in Thread',
      icon: <MdOutlineComment size={20} />,
      onClickFn: () => handleReplyInThread(messageData),
      display: settings.contextMenue?.replyInThread ?? true,
      className: 'text-docsy'
    },

    {
      title: 'Forward',
      icon: <BsForwardFill size={20} />,
      onClickFn: () => {}, //openModal('forwardMessageModal', messageData),
      display: settings.contextMenue?.forward ?? true,
      className: ''
    },
    {
      title: isPinned ? 'Unpin' : 'Pin',
      icon: isPinned ? <BsFillPinAngleFill size={20} /> : <BsFillPinFill size={20} />,
      onClickFn: () => handlePinMessage(),
      display: settings.contextMenue?.pin ?? true,
      className: ''
    },
    {
      title: 'Edit',
      icon: <MdOutlineEdit size={20} />,
      onClickFn: () => handleEdit(),
      display: settings.contextMenue?.edite ?? true,
      className: 'border-t pt-1 mt-1 border-gray-300'
    },
    {
      title: 'Delete',
      icon: <MdDeleteOutline size={20} />,
      onClickFn: () => handleDeleteMessage(),
      display: settings.contextMenue?.delete ?? true,
      className: 'text-red-500'
    }
  ]

  // Do not show edit and delete button if user is not the owner of the message
  if (user && messageData.user_id !== user.id) {
    messageButtonList.splice(messageButtonList.length - 2, 2)
  }

  if (!channelId) return null

  // Do not show context menu if user is not a member of the channel
  if (!channelSettings?.isUserChannelMember) return

  return (
    <ContextMenu className={className} parrentRef={parrentRef} ref={ref}>
      {/* {settings.contextMenue?.replyInThread && (
        <MenuItem onClick={handleThread} className="border-b pb-1">
          <a href="#" className="no-underline">
            <BiSolidMessageDetail size={20} />
            Reply in Thread
          </a>
        </MenuItem>
      )} */}

      {messageButtonList.map(
        (item) =>
          item.display && (
            <MenuItem
              key={item.title}
              //@ts-ignore
              onClick={(e, mouseEvent) => {
                item.onClickFn(e, mouseEvent)
              }}
              className={`${item.className}`}>
              <a href="#">
                {item.icon}
                {item.title}
              </a>
            </MenuItem>
          )
      )}

      <UserReadStatus messageData={messageData} />
    </ContextMenu>
  )
})

MessageContextMenu.displayName = 'MessageContextMenu'
