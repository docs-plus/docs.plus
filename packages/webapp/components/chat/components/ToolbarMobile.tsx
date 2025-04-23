import { useChatStore } from '@stores'
import { IoCloseSharp } from 'react-icons/io5'
import BreadcrumbMobile from './BreadcrumbMobile'
import { CopyUrlButton } from './CopyUrlButton'
import { NotificationToggle } from './NotificationToggle'

const CloseButton = ({ onClick, className }: any) => (
  <button className={`btn btn-sm ${className}`} onClick={onClick}>
    <IoCloseSharp size={20} />
  </button>
)

const ToolbarMobile = ({ className }: { className?: string }) => {
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const chatRoom = useChatStore((state) => state.chatRoom)

  const getChatRoomUrl = () => {
    if (!chatRoom?.headingId) return ''
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('chatroom', chatRoom.headingId)
    return newUrl.toString()
  }

  return (
    <div className={`relative z-50 flex w-full items-center bg-white p-2 ${className}`}>
      <div className="min-w-0 flex-1">
        <BreadcrumbMobile />
      </div>
      <div className="join flex items-center rounded-md p-1 px-2">
        <CopyUrlButton url={getChatRoomUrl()} className="btn join-item btn-sm" />
        <NotificationToggle className="join-item btn-sm" />
        <CloseButton onClick={destroyChatRoom} className="join-item btn-sm" />
      </div>
    </div>
  )
}

export default ToolbarMobile
