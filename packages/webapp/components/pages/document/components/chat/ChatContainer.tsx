import React, { useState, useRef } from 'react'
import useResizeContainer from './hooks/useResizeContainer'
import { useChatStore } from '@stores'
import MessageContainer from '@components/chat/MessageContainer'

const ChatContainer = () => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  if (!chatRoom?.headingPath.length) return null

  const { handleMouseDown, gripperRef, height } = useResizeContainer()

  return (
    <div
      ref={gripperRef}
      className="bg-slate-50 flex flex-row h-[300px] w-full overflow-auto flex-wrap absolute bottom-0 z-50"
      style={{ height: `${height}px` }}>
      <div
        className="gripper absolute  left-0 z-[51] border-t border-gray-200 dark:border-gray-700 top-0 w-full cursor-ns-resize"
        onMouseDown={handleMouseDown}
      />
      <MessageContainer workspaceId={chatRoom.documentId} channelId={chatRoom.headingId} />
    </div>
  )
}

export default ChatContainer
