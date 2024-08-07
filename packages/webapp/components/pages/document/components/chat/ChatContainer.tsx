import useResizeContainer from './hooks/useResizeContainer'
import { useChatStore } from '@stores'
import Toolbar from '@components/chat/components/Toolbar'
import { ChannelProvider } from '@components/chat/context/ChannelProvider'
import { ChatRoom } from '@components/chat/ChatRoom'

const initSettings = {
  displayChannelBar: false,
  contextMenue: {
    replyInThread: false,
    forward: false,
    pin: false
  }
}

const ChatContainer = () => {
  const chatRoom = useChatStore((state) => state.chatRoom)
  const { handleMouseDown, gripperRef, height } = useResizeContainer()

  if (!chatRoom?.headingId) return null

  return (
    <div
      ref={gripperRef}
      className="group absolute bottom-0 z-40 flex h-[300px] w-full flex-row flex-wrap bg-slate-50"
      style={{ height: `${height}px` }}>
      <div
        className="gripper absolute left-0 top-0 z-[51] w-full cursor-ns-resize border-t border-gray-200 transition-all duration-300 hover:border-white hover:bg-neutral hover:opacity-90 group-hover:h-[4px] dark:border-gray-700"
        onMouseDown={handleMouseDown}
      />
      <div className="flex size-full flex-col justify-start">
        <Toolbar />
        <ChannelProvider initChannelId={chatRoom.headingId} initSettings={initSettings}>
          <ChatRoom className="flex h-full flex-col overflow-auto "></ChatRoom>
        </ChannelProvider>
      </div>
    </div>
  )
}

export default ChatContainer
