import { useChatStore, useSheetStore } from '@stores'
import { ChannelProvider } from '@components/chat/context/ChannelProvider'
import { ChatRoom } from '@components/chat/ChatRoom'
import SheetHeader from '@components/SheetHeader'
import { CopyUrlButton } from '@components/chat/components/CopyUrlButton'
import { NotificationToggle } from '@components/chat/components/NotificationToggle'
import { IoCloseSharp } from 'react-icons/io5'
import BreadcrumbMobile from '@components/chat/components/BreadcrumbMobile'

const initSettings = {
  displayChannelBar: false,
  pickEmoji: true,
  textEditor: {
    toolbar: false,
    emojiPicker: false,
    attachmentButton: false
  },
  contextMenue: {
    replyInThread: true,
    forward: false,
    pin: false
  }
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

const ChatContainerMobile = () => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  if (!chatRoom?.headingId) return null

  return (
    <>
      <ChatRoomHeader />
      <div className="border-b border-gray-200 bg-gray-100 py-1">
        <BreadcrumbMobile />
      </div>
      <ChannelProvider initChannelId={chatRoom.headingId} initSettings={initSettings}>
        <ChatRoom className="flex h-auto flex-auto flex-col overflow-auto"></ChatRoom>
      </ChannelProvider>
    </>
  )
}

export default ChatContainerMobile
