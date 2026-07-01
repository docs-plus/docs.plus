import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { backlogCount } from '@components/chatroom/utils/backlogCount'
import { useChatStore } from '@stores'
import { twMerge } from 'tailwind-merge'

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
    loadNewer,
    loadingNewer,
    currentUserId,
    isFeedReady
  } = useChatroomContext()

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
          'message-feed scrollbar-custom scrollbar-thin relative flex min-h-0 flex-1 flex-col overflow-hidden',
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
            !isFeedReady && 'pointer-events-none opacity-0',
            isFeedReady && 'motion-safe:animate-[doc-content-in_200ms_ease-out_both]'
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
              channelId={channelId}
              retry={retry}
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
          {showScrollToBottom && (
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
