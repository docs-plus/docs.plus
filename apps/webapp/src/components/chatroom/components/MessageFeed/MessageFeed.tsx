import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { isMessage } from '@components/chatroom/types/chat-items'
import { backlogCount } from '@components/chatroom/utils/backlogCount'
import { useChatStore } from '@stores'
import { twMerge } from '@utils/twMerge'

import { ChatList } from '../ChatList/ChatList'
import { ChatListContextMenu } from '../ChatList/ChatListContextMenu'
import { JumpToPresentButton } from '../JumpToPresentButton'
import { PinnedMessagesBar } from '../PinnedMessagesBar'
import { ChatroomFeedSkeleton } from '../skeleton'
import { MessageFeedError } from './components/FeedStates/MessageFeedError'
import { NewMessagesBanner } from './NewMessagesBanner'

interface Props {
  className?: string
  showScrollToBottom?: boolean
}

const MessageFeed = ({ className, showScrollToBottom = true }: Props) => {
  const {
    channelId,
    variant,
    listRef,
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
    loadNewer,
    loadingNewer,
    currentUserId,
    isFeedReady
  } = useChatroomContext()

  // Virtuoso reports an empty list as not at the bottom, so the jump chip needs its own gate.
  // Leaving the tail flips atBottom and re-renders this feed, so the read stays fresh.
  const hasMessages = isFeedReady && (listRef.current?.data.get() ?? []).some(isMessage)
  const backlog = backlogCount(unreadCount, newCount)
  const showNewMessagesBanner = isFeedReady && !!currentUserId && !atBottom && backlog > 0
  const lastReadSince = useChatStore((state) => {
    if (!currentUserId) return null
    const member = state.channelMembers.get(channelId)?.get(currentUserId)
    return (
      (member as { last_read_update_at?: string | null } | undefined)?.last_read_update_at ?? null
    )
  })

  return (
    <MessageFeedError>
      <div
        className={twMerge(
          'message-feed scrollbar-custom relative flex min-h-0 flex-1 scrollbar-thin flex-col overflow-hidden',
          className
        )}
        data-key="chatroom-feed">
        {!isFeedReady && (
          <div className="bg-base-100 absolute inset-0 z-10 flex min-h-0 flex-col">
            <ChatroomFeedSkeleton variant={variant} className="flex-1" />
          </div>
        )}
        <div
          className={twMerge(
            'flex min-h-0 flex-1 flex-col',
            !isFeedReady && 'pointer-events-none opacity-0'
          )}>
          <PinnedMessagesBar channelId={channelId} onJumpToMessage={scrollToMessage} />
          {showNewMessagesBanner && (
            <NewMessagesBanner
              count={backlog}
              sinceIso={lastReadSince}
              onMarkAsRead={snapToPresent}
            />
          )}
          <ChatListContextMenu>
            <ChatList
              ref={listRef as any}
              onAtBottomChange={onAtBottomChange}
              onLastVisibleIndexChange={onLastVisibleIndexChange}
              loadOlder={loadOlder}
              hasMoreOlder={hasMoreOlder}
              loadingOlder={loadingOlder}
              loadNewer={loadNewer}
              loadingNewer={loadingNewer}
              currentUserId={currentUserId}
              variant={variant}
            />
          </ChatListContextMenu>
          {showScrollToBottom && hasMessages && (
            <JumpToPresentButton
              atBottom={atBottom}
              onTap={snapToPresent}
              newCount={newCount}
              unreadCount={unreadCount}
              hasMention={hasMention}
              subdued={showNewMessagesBanner}
            />
          )}
        </div>
      </div>
    </MessageFeedError>
  )
}

export default MessageFeed

MessageFeed.PinnedMessages = PinnedMessagesBar
