import Breadcrumb from './Breadcrumb'
import { useStore, useChatStore } from '@stores'
import AvatarStack from '@components/AvatarStack'
import { useEffect, useState } from 'react'
import { IoCloseSharp } from 'react-icons/io5'

const CloseButton = ({ onClick }: any) => (
  <button className="btn btn-circle btn-xs ml-auto" onClick={onClick}>
    <IoCloseSharp size={20} />
  </button>
)

const Toolbar = () => {
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const usersPresence = useStore((state) => state.usersPresence)
  const [presentUsers, setPresentUsers] = useState<any>([])
  const chatRoom = useChatStore((state) => state.chatRoom)

  useEffect(() => {
    if (!chatRoom) return
    const precenseUsers = usersPresence.values()
    const users = Array.from(precenseUsers).filter((user) => user?.channelId === chatRoom.headingId)
    setPresentUsers(users)
  }, [usersPresence])

  const handelCloseChatRoom = () => {
    destroyChatRoom()
  }

  return (
    <div className="w-full bg-white p-2 pt-2 flex items-center relative z-50 border-b border-gray-200 pb-1">
      <div>
        <Breadcrumb />
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
