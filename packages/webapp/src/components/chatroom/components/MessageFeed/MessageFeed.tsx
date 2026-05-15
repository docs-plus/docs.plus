import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import React from 'react'
import { twMerge } from 'tailwind-merge'

import { ChatList } from '../ChatList/ChatList'
import { ChatListContextMenu } from '../ChatList/ChatListContextMenu'
import { JumpToPresentButton } from '../JumpToPresentButton'
import { PinnedMessagesBar } from '../PinnedMessagesBar'
import { MessageFeedError } from './components/FeedStates/MessageFeedError'
import { MessageFeedLoading } from './components/FeedStates/MessageFeedLoading'

interface Props {
  className?: string
  children?: React.ReactNode
  showScrollToBottom?: boolean
}

/**
 * v2 feed shim: preserves the `Chatroom.MessageFeed` static-property API
 * for desktop and mobile call-sites, but renders the new Virtuoso-backed
 * `<ChatList>` plus overlays. Pinned strip now uses the v2 PinnedMessagesBar.
 */
const MessageFeed = ({ className, showScrollToBottom = true }: Props) => {
  const {
    channelId,
    variant,
    listRef,
    retry,
    onAtBottomChange,
    onLastVisibleIndexChange,
    atBottom,
    newCount,
    hasMention,
    unreadCount,
    snapToPresent,
    scrollToMessage,
    loadOlder,
    hasMoreOlder,
    loadingOlder,
    currentUserId
  } = useChatroomContext()

  return (
    <MessageFeedError>
      <MessageFeedLoading>
        <PinnedMessagesBar channelId={channelId} onJumpToMessage={scrollToMessage} />
        <div
          className={twMerge(
            'message-feed scrollbar-custom scrollbar-thin relative flex min-h-0 flex-1 flex-col overflow-hidden',
            className
          )}>
          <ChatListContextMenu>
            <ChatList
              ref={listRef as any}
              channelId={channelId}
              retry={retry}
              onAtBottomChange={onAtBottomChange}
              onLastVisibleIndexChange={onLastVisibleIndexChange}
              loadOlder={loadOlder}
              hasMoreOlder={hasMoreOlder}
              loadingOlder={loadingOlder}
              currentUserId={currentUserId}
              variant={variant}
            />
          </ChatListContextMenu>
          {showScrollToBottom && (
            <JumpToPresentButton
              atBottom={atBottom}
              onTap={snapToPresent}
              newCount={newCount}
              unreadCount={unreadCount}
              hasMention={hasMention}
            />
          )}
        </div>
      </MessageFeedLoading>
    </MessageFeedError>
  )
}

export default MessageFeed

// Preserve the static-property name for external call-sites (DesktopEditor,
// ChatContainerMobile) but retarget to the v2 PinnedMessagesBar shim. The
// legacy PinnedMessages folder is now unreferenced and pruned.
MessageFeed.PinnedMessages = PinnedMessagesBar
