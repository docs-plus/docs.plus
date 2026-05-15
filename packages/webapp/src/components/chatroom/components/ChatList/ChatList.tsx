import type { ChatItem } from '@components/chatroom/types/chat-items'
import { computeItemKey } from '@components/chatroom/types/chat-items'
import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import {
  type ListScrollLocation,
  VirtuosoMessageList,
  type VirtuosoMessageListMethods
} from '@virtuoso.dev/message-list'
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react'

import { AtBottomTracker } from './AtBottomTracker'
import { ItemContent } from './ItemContent'
import { MessagesEmptyState } from './MessagesEmptyState'
import { PaginationLoader } from './PaginationLoader'
import { StickyDayHeader } from './StickyDayHeader'

export type ChatListContext = {
  channelId: string
  retry: (clientId: string) => void
  onAtBottomChange: (atBottom: boolean) => void
  currentUserId: string | null
  variant: keyof ChatroomVariant
}

export type ChatListProps = {
  channelId: string
  retry: (clientId: string) => void
  onAtBottomChange: (atBottom: boolean) => void
  onLastVisibleIndexChange?: (index: number) => void
  initialData?: ChatItem[]
  loadingOlder?: boolean
  loadOlder?: () => Promise<void> | void
  hasMoreOlder?: boolean
  currentUserId?: string | null
  variant?: keyof ChatroomVariant
}

/**
 * Virtuoso has no `startReached` prop; load-older is wired through
 * `onScroll`. We trigger when the list top has reached the viewport top
 * (within a small px threshold) and the hook still has more older rows.
 * `loadingOlderRef` inside `useChannelMessages` already guards re-entry,
 * so a per-scroll-tick call is safe.
 */
const LOAD_OLDER_PX_THRESHOLD = 80

export const ChatList = forwardRef<
  VirtuosoMessageListMethods<ChatItem, ChatListContext>,
  ChatListProps
>(
  (
    {
      channelId,
      retry,
      onAtBottomChange,
      onLastVisibleIndexChange,
      initialData = [],
      loadingOlder = false,
      loadOlder,
      hasMoreOlder = false,
      currentUserId = null,
      variant = 'desktop'
    },
    externalRef
  ) => {
    const internalRef = useRef<VirtuosoMessageListMethods<ChatItem, ChatListContext>>(null)
    useImperativeHandle(externalRef, () => internalRef.current!)
    const Footer = useMemo(
      () => () => <AtBottomTracker onChange={onAtBottomChange} />,
      [onAtBottomChange]
    )
    const context = useMemo<ChatListContext>(
      () => ({ channelId, retry, onAtBottomChange, currentUserId, variant }),
      [channelId, retry, onAtBottomChange, currentUserId, variant]
    )
    const onScroll = useCallback(
      (location: ListScrollLocation) => {
        // `useVirtuosoLocation` only re-renders on isAtBottom flips and
        // similar coarse signals, so it never re-fires for fine-grained
        // index changes inside the viewport. `onScroll` is the only
        // surface that emits `lastVisibleItemIndex` on every scroll tick,
        // which is what the read-cursor needs to advance as the user
        // scans messages.
        if (onLastVisibleIndexChange && typeof location.lastVisibleItemIndex === 'number') {
          onLastVisibleIndexChange(location.lastVisibleItemIndex)
        }
        if (!loadOlder || !hasMoreOlder) return
        // listOffset is the distance between list top and viewport top;
        // 0 means at top, slightly-negative means just-past-top. Threshold
        // covers momentum scroll where we want to prefetch a bit early.
        if (location.listOffset >= -LOAD_OLDER_PX_THRESHOLD) {
          void loadOlder()
        }
      },
      [loadOlder, hasMoreOlder, onLastVisibleIndexChange]
    )
    return (
      <VirtuosoMessageList<ChatItem, ChatListContext>
        ref={internalRef as any}
        initialData={initialData}
        context={context}
        computeItemKey={computeItemKey as any}
        ItemContent={ItemContent as any}
        StickyHeader={StickyDayHeader as any}
        Header={loadingOlder ? PaginationLoader : undefined}
        Footer={Footer}
        EmptyPlaceholder={MessagesEmptyState as any}
        onScroll={onScroll}
        shortSizeAlign={'bottom-smooth' as any}
        style={{ height: '100%', overscrollBehavior: 'contain' } as any}
      />
    )
  }
)
ChatList.displayName = 'ChatList'
