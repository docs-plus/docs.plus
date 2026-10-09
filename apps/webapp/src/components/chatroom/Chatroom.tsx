import { useChatStore } from '@stores'

import { ChatroomProvider } from './ChatroomContext'
import ChannelComposer from './components/ChannelComposer/ChannelComposer'
import ChatroomToolbar from './components/ChatroomToolbar/ChatroomToolbar'
import MessageFeed from './components/MessageFeed/MessageFeed'
import { useHeadingChannel } from './hooks/useHeadingChannel'
import { ChatroomLayout } from './Layouts/ChatroomLayout'
import { ChatroomProps } from './types/chatroom.types'

const ChatRoom = ({
  variant = 'desktop',
  className,
  children,
  deepLinkMessageId = null
}: ChatroomProps) => {
  const headingId = useChatStore((state) => state.chatRoom.headingId)
  const channelId = useChatStore((state) => state.chatRoom.channelId)
  const storeMsgId = useChatStore((state) => state.chatRoom.fetchMsgsFromId) ?? null
  const resolveError = useHeadingChannel()

  if (!headingId) return null

  // The four in-app deep-link entry points (BookmarkItem, hrefEventHandler,
  // NotificationItem, useNotificationClickBridge) push `fetchMsgsFromId` into the
  // store. Shared links land with `?msg_id=` on first paint and no store
  // value. Prop wins if a parent passes one explicitly.
  const urlMsgId =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('msg_id') : null
  const effectiveDeepLink = deepLinkMessageId ?? storeMsgId ?? urlMsgId

  return (
    <div className={`chatroom chatroom--${variant} ${className}`}>
      {/* Provider wraps the layout: the pane header, a sibling of {children}, reads the
          context. Keyed by the heading and its resolve state, it remounts when the row resolves,
          even when the row id equals the heading id. So no hook holds a value from the
          unresolved state. */}
      <ChatroomProvider
        channelId={channelId ?? ''}
        resolveError={resolveError}
        variant={variant}
        deepLinkMessageId={effectiveDeepLink}
        key={`${headingId}:${channelId}`}>
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
