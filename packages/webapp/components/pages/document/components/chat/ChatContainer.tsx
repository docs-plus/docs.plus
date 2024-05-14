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
      className="bg-slate-50 flex group flex-row h-[300px] w-full  flex-wrap absolute bottom-0 z-40"
      style={{ height: `${height}px` }}>
      <div
        className="gripper absolute group-hover:h-[4px] hover:border-white hover:bg-neutral hover:opacity-90 transition-all duration-300 left-0 z-[51] border-t border-gray-200 dark:border-gray-700 top-0 w-full cursor-ns-resize"
        onMouseDown={handleMouseDown}
      />
      <div className="flex w-full flex-col h-full justify-start">
        <Toolbar />
        <ChannelProvider initChannelId={chatRoom.headingId} initSettings={initSettings}>
          <ChatRoom className="flex h-full flex-col overflow-auto "></ChatRoom>
        </ChannelProvider>
      </div>
    </div>
  )
}

export default ChatContainer
