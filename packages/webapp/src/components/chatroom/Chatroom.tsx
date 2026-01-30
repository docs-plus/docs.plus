import { useChatStore } from '@stores'

import { ChatroomProvider } from './ChatroomContext'
import ChannelComposer from './components/ChannelComposer/ChannelComposer'
import { DesktopLayout, MobileLayout } from './components/Chatroom/layouts'
import ChatroomToolbar from './components/ChatroomToolbar/ChatroomToolbar'
import MessageFeed from './components/MessageFeed/MessageFeed'
import { ChatroomLayout } from './Layouts/ChatroomLayout'
import { ChatroomProps } from './types/chatroom.types'

const ChatRoom = ({ variant = 'desktop', className, children }: ChatroomProps) => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  if (!chatRoom?.headingId) return null

  return (
    <div className={`chatroom chatroom--${variant} ${className}`}>
      <ChatroomLayout variant={variant}>
        <ChatroomProvider
          channelId={chatRoom?.headingId}
          variant={variant}
          key={chatRoom?.headingId}>
          {children}
        </ChatroomProvider>
      </ChatroomLayout>
    </div>
  )
}

export default ChatRoom

ChatRoom.Toolbar = ChatroomToolbar

// ChannelComposer
ChatRoom.ChannelComposer = ChannelComposer

// Layouts
ChatRoom.DesktopLayout = DesktopLayout
ChatRoom.MobileLayout = MobileLayout
ChatRoom.Layout = ChatroomLayout // Autoselects the correct layout based on the variant

// MessageFeed
ChatRoom.MessageFeed = MessageFeed
