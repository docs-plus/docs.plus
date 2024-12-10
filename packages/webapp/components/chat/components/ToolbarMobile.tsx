import { useChatStore } from '@stores'
import { IoCloseSharp } from 'react-icons/io5'
import BreadcrumbMobile from './BreadcrumbMobile'
import { CopyUrlButton } from './CopyUrlButton'

const CloseButton = ({ onClick }: any) => (
  <button className="btn btn-circle btn-xs ml-auto" onClick={onClick}>
    <IoCloseSharp size={20} />
  </button>
)

const ToolbarMobile = () => {
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const chatRoom = useChatStore((state) => state.chatRoom)

  const handelCloseChatRoom = () => {
    destroyChatRoom()
  }

  const getChatRoomUrl = () => {
    if (!chatRoom?.headingId) return ''
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('chatroom', chatRoom.headingId)
    return newUrl.toString()
  }

  return (
    <div className="relative z-50 flex w-full items-center bg-white p-2">
      <div className="min-w-0 flex-1">
        <BreadcrumbMobile />
      </div>
      <div className="ml-2 shrink-0">
        <CopyUrlButton url={getChatRoomUrl()} className="btn btn-circle btn-ghost btn-xs mr-2" />
        <CloseButton onClick={handelCloseChatRoom} />
      </div>
    </div>
  )
}

export default ToolbarMobile
