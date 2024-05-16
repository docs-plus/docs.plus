import Breadcrumb from './Breadcrumb'
import { useStore, useChatStore } from '@stores'
import AvatarStack from '@components/AvatarStack'
import { useEffect, useState } from 'react'
import { IoCloseSharp } from 'react-icons/io5'
import { FaUsers } from 'react-icons/fa'

const CloseButton = ({ onClick }: any) => (
  <button className="btn btn-circle btn-xs ml-auto" onClick={onClick}>
    <IoCloseSharp size={20} />
  </button>
)

const Toolbar = () => {
  const { headingId: channelId } = useChatStore((state) => state.chatRoom)

  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const usersPresence = useStore((state) => state.usersPresence)
  const [presentUsers, setPresentUsers] = useState<any>([])
  const chatRoom = useChatStore((state) => state.chatRoom)
  const channel = useChatStore((state: any) => state.channels.get(channelId))

  useEffect(() => {
    if (!chatRoom) return
    const precenseUsers = usersPresence.values()
    const users = Array.from(precenseUsers)
      .filter((user) => user?.channelId === chatRoom.headingId)
      .filter((user) => user?.status !== 'OFFLINE')

    setPresentUsers(users)
  }, [usersPresence, chatRoom])

  const handelCloseChatRoom = () => {
    destroyChatRoom()
  }

  return (
    <div className="relative z-50 flex w-full items-center border-b border-gray-200 bg-white p-2 ">
      <div className="px-1">
        <Breadcrumb />
        <div className="flex items-center justify-start space-x-2 ">
          <FaUsers className="" size={16} />

          <div className="flex space-x-3">
            <p className="text-xs text-base-content">{channel?.member_count} subscribers</p>

            <span className="msgIndicator block truncate text-xs text-accent"></span>
          </div>
        </div>
      </div>
      <div className="ml-auto flex items-center justify-end">
        <div className="mr-4 h-8">
          <AvatarStack size={8} users={presentUsers} tooltipPosition="tooltip-left" />
        </div>
        <CloseButton onClick={handelCloseChatRoom} />
      </div>
    </div>
  )
}

export default Toolbar
