// INFO: disable the typing indicator and user subscribtion counter

import Breadcrumb from './Breadcrumb'
import { useStore, useChatStore } from '@stores'
import AvatarStack from '@components/AvatarStack'
import { useEffect, useState } from 'react'
import { IoCloseSharp } from 'react-icons/io5'
import { CopyUrlButton } from './CopyUrlButton'
import { NotificationToggle } from './NotificationToggle'

const CloseButton = ({ onClick, dataTip, className }: any) => (
  <button
    className={`btn btn-ghost btn-sm btn-square ${className}`}
    onClick={onClick}
    data-tip={dataTip}>
    <IoCloseSharp size={20} />
  </button>
)

const Toolbar = () => {
  // const { headingId: channelId } = useChatStore((state) => state.chatRoom)

  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const usersPresence = useStore((state) => state.usersPresence)
  const [presentUsers, setPresentUsers] = useState<any>([])
  const chatRoom = useChatStore((state) => state.chatRoom)
  const setReplayMessageMemory = useChatStore((state) => state.setReplayMessageMemory)
  const setCommentMessageMemory = useChatStore((state) => state.setCommentMessageMemory)
  const setEditMessageMemory = useChatStore((state) => state.setEditMessageMemory)
  // const channel = useChatStore((state: any) => state.channels.get(channelId))

  useEffect(() => {
    if (!chatRoom) return
    const precenseUsers = usersPresence.values()
    const users = Array.from(precenseUsers)
      .filter((user) => user?.channelId === chatRoom.headingId)
      .filter((user) => user?.status !== 'OFFLINE')

    setPresentUsers(users)
  }, [usersPresence, chatRoom])

  const handelCloseChatRoom = () => {
    // clear reply, comment, edit message memory
    if (chatRoom?.headingId) {
      setReplayMessageMemory(chatRoom.headingId, null)
      setCommentMessageMemory(chatRoom.headingId, null)
      setEditMessageMemory(chatRoom.headingId, null)
    }

    destroyChatRoom()
  }

  const getChatRoomUrl = () => {
    if (!chatRoom?.headingId) return ''
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('chatroom', chatRoom.headingId)
    return newUrl.toString()
  }

  return (
    <div className="relative z-50 flex w-full items-center border-b border-gray-300 bg-white p-2">
      <div className="px-1">
        <Breadcrumb />
        {/* <div className="flex items-center justify-start space-x-2 ">
          <FaUsers className="" size={16} />
          <div className="flex space-x-3">
            <p className="text-xs text-base-content">{channel?.member_count} subscribers</p>
            <span className="msgIndicator block truncate text-xs text-accent"></span>
          </div>
        </div> */}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex h-9 items-center">
          <AvatarStack
            size={9}
            users={presentUsers}
            showStatus={true}
            tooltipPosition="tooltip-bottom"
          />
        </div>

        <div className="join bg-base-300 rounded-md">
          <CopyUrlButton
            url={getChatRoomUrl()}
            dataTip="Copy chat room URL"
            className="join-item btn btn-ghost btn-sm btn-square tooltip tooltip-left"
          />

          <NotificationToggle className="join-item" />

          <CloseButton
            className="join-item tooltip tooltip-left"
            onClick={handelCloseChatRoom}
            dataTip="Close chat room"
          />
        </div>
      </div>
    </div>
  )
}

export default Toolbar
