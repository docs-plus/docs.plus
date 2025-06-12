import useResizeContainer from './hooks/useResizeContainer'
import { useChatStore } from '@stores'
import Toolbar from '@components/chat/components/Toolbar'
import { ChannelProvider } from '@components/chat/context/ChannelProvider'
import { ChatRoom } from '@components/chat/ChatRoom'

const initSettings = {
  displayChannelBar: false,
  contextMenue: {
    replyInThread: true,
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
      className="group absolute bottom-0 z-40 flex h-[410px] w-full flex-row flex-wrap border-t border-gray-300 bg-white pt-0.5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]"
      style={{ height: `${height}px` }}>
      <div
        className="gripper absolute -top-5 left-0 z-[51] w-full bg-transparent pt-10"
        // onMouseDown={handleMouseDown}
      />
      <div
        onMouseDown={handleMouseDown}
        className="active:bg-block absolute top-2 left-1/2 z-[52] h-1.5 w-22 -translate-x-1/2 cursor-row-resize rounded-full bg-gray-400 transition-all duration-200 group-hover:opacity-100"
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
