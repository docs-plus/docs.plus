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
      className="group absolute bottom-0 z-40 flex h-[410px] w-full flex-row flex-wrap bg-slate-50"
      style={{ height: `${height}px` }}>
      <div
        className="gripper hover:bg-neutral absolute top-0 left-0 z-[51] w-full cursor-ns-resize border-t border-gray-300 transition-all duration-300 group-hover:h-[4px] hover:border-white hover:opacity-90"
        onMouseDown={handleMouseDown}
      />
      <div className="flex size-full flex-col justify-start">
        <Toolbar />
        <ChannelProvider
          key={chatRoom.headingId + chatRoom.fetchMsgsFromId + ''}
          initChannelId={chatRoom.headingId}
          initSettings={initSettings}>
          <ChatRoom className="flex h-full flex-col overflow-auto"></ChatRoom>
        </ChannelProvider>
      </div>
    </div>
  )
}

export default ChatContainer
