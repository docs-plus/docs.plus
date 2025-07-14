import { useChatStore } from '@stores'
import ToolbarMobile from '@components/chat/components/ToolbarMobile'
import { ChannelProvider } from '@components/chat/context/ChannelProvider'
import { ChatRoom } from '@components/chat/ChatRoom'
import { Sheet } from 'react-modal-sheet'

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

const ChatContainerMobile = () => {
  const chatRoom = useChatStore((state) => state.chatRoom)
  const toggleChatRoom = useChatStore((state) => state.toggleChatRoom)

  if (!chatRoom?.headingId) return null

  return (
    <Sheet
      isOpen={chatRoom.open}
      onClose={() => toggleChatRoom()}
      id="chat_sheet"
      modalEffectRootId="chat_sheet">
      <Sheet.Container>
        <Sheet.Header />
        <Sheet.Content>
          <ToolbarMobile />
          <ChannelProvider initChannelId={chatRoom.headingId} initSettings={initSettings}>
            <ChatRoom className="flex h-auto flex-auto flex-col overflow-auto"></ChatRoom>
          </ChannelProvider>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop />
    </Sheet>
  )
}

export default ChatContainerMobile
