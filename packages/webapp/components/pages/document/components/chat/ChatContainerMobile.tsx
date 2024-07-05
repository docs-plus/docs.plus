import { useChatStore } from '@stores'
import ToolbarMobile from '@components/chat/components/ToolbarMobile'
import { ChannelProvider } from '@components/chat/context/ChannelProvider'
import { ChatRoom } from '@components/chat/ChatRoom'

const initSettings = {
  displayChannelBar: false,
  textEditor: {
    toolbar: false,
    emojiPicker: false,
    attachmentButton: false
  },
  contextMenue: {
    replyInThread: false,
    forward: false,
    pin: false
  }
}

const ChatContainerMobile = () => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  if (!chatRoom?.headingId) return null

  return (
    <div className="group sticky bottom-0 z-40 flex h-2/6 min-h-[300px] w-full flex-row flex-wrap">
      <div className="flex size-full flex-col justify-start">
        <ToolbarMobile />
        <ChannelProvider initChannelId={chatRoom.headingId} initSettings={initSettings}>
          <ChatRoom className="flex h-full flex-col overflow-auto "></ChatRoom>
        </ChannelProvider>
      </div>
    </div>
  )
}

export default ChatContainerMobile
