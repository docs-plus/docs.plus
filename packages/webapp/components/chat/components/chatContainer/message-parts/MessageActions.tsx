import React, { useCallback, useEffect, useState } from 'react'
import PubSub from 'pubsub-js'
import {
  deleteMessage,
  TMessageWithUser as TMsg,
  getChannelMembersByLastReadUpdate,
  ChannelMemberReadUpdate
} from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useApi } from '@hooks/useApi'
import { useBookmarkMessage } from '@components/pages/document/hooks/useBookmarkMessage'
import { useReplyInThread } from '@hooks/useReplyInThread'
import { useEmojiPicker } from '@hooks/useEmojiPicker'
import { useCopyToDoc } from '@hooks/useCopyToDoc'
import { useChannel } from '../../../context/ChannelProvider'
import ENUMS from '@components/TipTap/enums'
import * as toast from '@components/toast'
import AvatarStack from '@components/AvatarStack'
import { IoCheckmarkDoneSharp, IoCheckmarkSharp } from 'react-icons/io5'
import {
  MdOutlineComment,
  MdDeleteOutline,
  MdOutlineEmojiEmotions,
  MdMoreVert,
  MdOutlineEdit,
  MdOutlineFileOpen,
  MdBookmarkRemove,
  MdOutlineBookmarkAdd
} from 'react-icons/md'
import { ReplyMD } from '@components/icons/Icons'
import { CHAT_OPEN } from '@services/eventsHub'
import Dropdown, { useDropdown } from '@components/ui/Dropdown'
import AvatarStackLoader from '@components/skeleton/AvatarStackLoader'

type MessageActionsProps = {
  className?: string
  message: TMsg
}

const DropdownContent = ({ message }: { message: TMsg }) => {
  const { isOpen } = useDropdown()
  const user = useAuthStore((state) => state.profile)
  const { channelId } = useChannel()
  const [readUsers, setReadUsers] = useState<ChannelMemberReadUpdate[]>([])
  const setEditMessageMemory = useChatStore((state) => state.setEditMessageMemory)
  const { handleCopyToDoc } = useCopyToDoc()

  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const { request: fetchReadUsers, loading: readUsersLoading } = useApi(
    getChannelMembersByLastReadUpdate,
    [message.channel_id, message.created_at],
    false
  )

  useEffect(() => {
    const fetchData = async () => {
      if (isOpen) {
        const { data } = await fetchReadUsers(channelId, message.created_at)
        setReadUsers(data as ChannelMemberReadUpdate[])
        console.log({
          readUsers
        })
      }
    }

    fetchData()
  }, [isOpen])

  const handleEdit = useCallback(() => {
    if (!message) return
    setEditMessageMemory(channelId, message)
  }, [channelId, message, setEditMessageMemory])

  const handleDeleteMessage = useCallback(async () => {
    if (!message) return
    const { error } = await deleteMessage(message.channel_id, message.id)
    if (error) return toast.Error('Message not deleted')

    toast.Success('Message deleted')
  }, [message])

  return (
    <ul className="menu bg-base-100 w-52 !p-1">
      <li>
        <a className="flex items-center gap-2" onClick={() => handleCopyToDoc(message, channelId)}>
          <MdOutlineFileOpen size={20} />
          Copy to doc
        </a>
      </li>
      {user && message.user_id === user.id && (
        <>
          <li>
            <a className="flex items-center gap-2" onClick={handleEdit}>
              <MdOutlineEdit size={20} />
              Edit Message
            </a>
          </li>
          <li className="border-gray-300">
            <a className="text-error flex items-center gap-2" onClick={handleDeleteMessage}>
              <MdDeleteOutline size={20} />
              Delete Message
            </a>
          </li>
        </>
      )}

      {message.readed_at &&
        (readUsersLoading ? (
          <li className="menu-disabled flex flex-row items-center gap-2 border-t border-gray-300">
            <div className="skeleton ml-2 h-4 w-4 rounded-full p-0"></div>
            <div className="skeleton h-4 w-10 rounded-full"></div>
            <AvatarStackLoader size={7} repeat={4} className="ml-auto !-space-x-6 pr-1" />
          </li>
        ) : (
          <li className="menu-disabled !my-1 border-t border-gray-300">
            <div className="flex items-center gap-2 py-0 pt-2">
              <span className="text-xs text-gray-500">
                {!message.readed_at ? (
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
          </li>
        ))}
    </ul>
  )
}

export const MessageActions = ({ className, message }: MessageActionsProps) => {
  const { channelId } = useChannel()
  const user = useAuthStore((state) => state.profile)
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const { handleBookmarkMessage, bookmarkLoading } = useBookmarkMessage()
  const { handleReplyInThread } = useReplyInThread()
  const { openEmojiPicker } = useEmojiPicker()

  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const handleReply = useCallback(() => {
    setReplyMessageMemory(message.channel_id, message)
    document.dispatchEvent(new CustomEvent('editor:focus'))
  }, [message, setReplyMessageMemory])

  return (
    <div className={`join bg-base-300 rounded-md shadow-xs ${className}`}>
      <button
        className="btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left"
        data-tip="Add Reaction"
        onClick={(e) => openEmojiPicker(e, message)}>
        <MdOutlineEmojiEmotions size={20} className="text-gray-600" />
      </button>

      <button
        className="btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left"
        data-tip="Reply to Message"
        onClick={handleReply}>
        <ReplyMD size={20} className="text-gray-600" />
      </button>

      <button
        className="btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left"
        data-tip="Bookmark Message"
        disabled={bookmarkLoading}
        onClick={() => handleBookmarkMessage(message)}>
        {bookmarkLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        ) : message.is_bookmarked || message.bookmark_id ? (
          <MdBookmarkRemove size={20} className="text-blue-600" />
        ) : (
          <MdOutlineBookmarkAdd size={20} className="text-gray-600" />
        )}
      </button>

      <button
        className="btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left"
        data-tip="Reply in thread"
        onClick={() => handleReplyInThread(message)}>
        <MdOutlineComment size={20} className="text-docsy" />
      </button>

      <Dropdown
        button={
          <button className="btn btn-sm btn-square join-item btn-ghost">
            <MdMoreVert size={20} className="text-gray-600" />
          </button>
        }
        className="dropdown-bottom dropdown-end"
        contentClassName="dropdown-content bg-base-100 overflow-hidden rounded-box z-[1]  border border-gray-300 shadow-md">
        <DropdownContent message={message} />
      </Dropdown>
    </div>
  )
}
