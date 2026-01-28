// TODO: refactor this component in order to follow the compound component pattern
import { useChatStore, useSheetStore } from '@stores'
import SheetHeader from '@components/SheetHeader'
import { CopyUrlButton } from '@components/chatroom/components/CopyUrlButton'
import { NotificationToggle } from '@components/chatroom/components/ChatroomToolbar/components/NotificationToggle'
import CloseButton from '@components/ui/CloseButton'

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

          <CloseButton
            onClick={() => {
              destroyChatRoom()
              closeSheet()
            }}
            className="join-item w-12 bg-transparent"
            aria-label="Close chat"
          />
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
