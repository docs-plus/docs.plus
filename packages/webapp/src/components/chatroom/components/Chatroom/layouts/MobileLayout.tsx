// TODO: refactor this component in order to follow the compound component pattern
import { useChatStore, useSheetStore } from '@stores'
import SheetHeader from '@components/SheetHeader'
import { CopyUrlButton } from '@components/chatroom/components/CopyUrlButton'
import { NotificationToggle } from '@components/chatroom/components/ChatroomToolbar/components/NotificationToggle'
import { IoCloseSharp } from 'react-icons/io5'

type Props = {
  children: React.ReactNode
}

const ChatRoomHeader = () => {
  const chatRoom = useChatStore((state) => state.chatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const { closeSheet } = useSheetStore()

  const getChatRoomUrl = () => {
    if (!chatRoom?.headingId) return ''
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('chatroom', chatRoom.headingId)
    return newUrl.toString()
  }
  return (
    <SheetHeader className="!mb-0 p-4 pt-0">
      <SheetHeader.Title>Chat</SheetHeader.Title>
      <SheetHeader.Actions>
        <div className="join flex items-center rounded-md">
          <CopyUrlButton
            url={getChatRoomUrl()}
            className="btn btn-ghost join-item btn-sm w-12 bg-transparent"
          />
          <NotificationToggle className="btn btn-ghost join-item btn-sm w-12 bg-transparent" />

          <button
            className={`btn btn-sm btn btn-ghost join-item btn-sm w-12 bg-transparent`}
            onClick={() => {
              destroyChatRoom()
              closeSheet()
            }}>
            <IoCloseSharp size={20} />
          </button>
        </div>
      </SheetHeader.Actions>
    </SheetHeader>
  )
}
export const MobileLayout = ({ children }: Props) => {
  return (
    <>
      <ChatRoomHeader />
      {children}
    </>
  )
}
