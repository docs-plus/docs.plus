import { useChatStore } from '@stores'

import { ChatroomProvider } from './ChatroomContext'
import ChannelComposer from './components/ChannelComposer/ChannelComposer'
import ChatroomToolbar from './components/ChatroomToolbar/ChatroomToolbar'
import MessageFeed from './components/MessageFeed/MessageFeed'
import { ChatroomLayout } from './Layouts/ChatroomLayout'
import { ChatroomProps } from './types/chatroom.types'

const ChatRoom = ({
  variant = 'desktop',
  className,
  children,
  deepLinkMessageId = null
}: ChatroomProps) => {
  const chatRoom = useChatStore((state) => state.chatRoom)
  const storeMsgId = useChatStore((state) => state.chatRoom.fetchMsgsFromId) ?? null

  if (!chatRoom?.headingId) return null

  // The four in-app deep-link entry points (BookmarkItem, hrefEventHandler,
  // NotificationItem, usePushNotifications) push `fetchMsgsFromId` into the
  // store; shared links land with `?msg_id=` on first paint and no store
  // value. Prop wins if a parent passes one explicitly.
  const urlMsgId =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('msg_id') : null
  const effectiveDeepLink = deepLinkMessageId ?? storeMsgId ?? urlMsgId

  return (
    <div className={`chatroom chatroom--${variant} ${className}`}>
      {/* Provider wraps the layout, not the reverse: the mobile ChatroomSheetLayout
          renders a header (MediaFilterToggle, Breadcrumb) that consumes useChatroomContext
          as a sibling of {children}, so nesting the provider inside left it context-less. */}
      <ChatroomProvider
        channelId={chatRoom?.headingId}
        variant={variant}
        deepLinkMessageId={effectiveDeepLink}
        key={chatRoom?.headingId}>
        <ChatroomLayout variant={variant}>{children}</ChatroomLayout>
      </ChatroomProvider>
    </div>
  )
}

export default ChatRoom

ChatRoom.Toolbar = ChatroomToolbar
ChatRoom.ChannelComposer = ChannelComposer
ChatRoom.Layout = ChatroomLayout
ChatRoom.MessageFeed = MessageFeed
