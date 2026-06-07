import type { ChatItem } from '@components/chatroom/types/chat-items'
import { computeItemKey } from '@components/chatroom/types/chat-items'
import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import {
  type ListScrollLocation,
  VirtuosoMessageList,
  type VirtuosoMessageListMethods,
  type VirtuosoMessageListProps
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
  loadingOlder: boolean
  loadingNewer: boolean
}

/**
 * Module-scope so identity stays stable across renders: Virtuoso silently
 * drops captured props if `Header` / `Footer` re-mount (inline or memoized
 * closures both re-mount). Changing values flow through the `context` prop
 * and are read from the `{ context }` slot here.
 */
const ChatListHeader: VirtuosoMessageListProps<ChatItem, ChatListContext>['Header'] = ({
  context
}) => (context.loadingOlder ? <PaginationLoader /> : null)

const ChatListFooter: VirtuosoMessageListProps<ChatItem, ChatListContext>['Footer'] = ({
  context
}) => (
  <>
    {context.loadingNewer ? <PaginationLoader /> : null}
    <AtBottomTracker onChange={context.onAtBottomChange} />
  </>
)

export type ChatListProps = {
  channelId: string
  retry: (clientId: string) => void
  onAtBottomChange: (atBottom: boolean) => void
  onLastVisibleIndexChange?: (index: number) => void
  initialData?: ChatItem[]
  loadingOlder?: boolean
  loadOlder?: () => Promise<void> | void
  hasMoreOlder?: boolean
  loadNewer?: () => Promise<void> | void
  loadingNewer?: boolean
  currentUserId?: string | null
  variant?: keyof ChatroomVariant
}

/**
 * Virtuoso has no `startReached`/`endReached` props; both ends are
 * wired through `onScroll`. We trigger load-older when the list top
 * has reached the viewport top (within `LOAD_OLDER_PX_THRESHOLD` px)
 * and load-newer when the list bottom is within
 * `LOAD_NEWER_PX_THRESHOLD` of the viewport bottom. Re-entry is gated
 * inside `useChannelMessages` (loadingOlderRef / loadingNewerRef and
 * dataIncludesTailRef), so a per-scroll-tick call is safe.
 */
const LOAD_OLDER_PX_THRESHOLD = 80
const LOAD_NEWER_PX_THRESHOLD = 80

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
      loadNewer,
      loadingNewer = false,
      currentUserId = null,
      variant = 'desktop'
    },
    externalRef
  ) => {
    const internalRef = useRef<VirtuosoMessageListMethods<ChatItem, ChatListContext>>(null)
    useImperativeHandle(externalRef, () => internalRef.current!)
    const context = useMemo<ChatListContext>(
      () => ({
        channelId,
        retry,
        onAtBottomChange,
        currentUserId,
        variant,
        loadingOlder,
        loadingNewer
      }),
      [channelId, retry, onAtBottomChange, currentUserId, variant, loadingOlder, loadingNewer]
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
        // listOffset is the distance between list top and viewport top;
        // 0 means at top, slightly-negative means just-past-top. Threshold
        // covers momentum scroll where we want to prefetch a bit early.
        if (loadOlder && hasMoreOlder && location.listOffset >= -LOAD_OLDER_PX_THRESHOLD) {
          void loadOlder()
        }
        // Mirror for the bottom edge. `bottomOffset` is 0 when the list
        // bottom is flush with the viewport bottom; positive means there's
        // unloaded list below. The hook's own `dataIncludesTailRef` guard
        // disarms loadNewer once the live tail is reached, so we don't
        // need a separate `hasMoreNewer` flag here.
        if (loadNewer && location.bottomOffset <= LOAD_NEWER_PX_THRESHOLD) {
          void loadNewer()
        }
      },
      [loadOlder, hasMoreOlder, loadNewer, onLastVisibleIndexChange]
    )
    return (
      <VirtuosoMessageList<ChatItem, ChatListContext>
        ref={internalRef as any}
        initialData={initialData}
        context={context}
        computeItemKey={computeItemKey as any}
        ItemContent={ItemContent as any}
        StickyHeader={StickyDayHeader as any}
        Header={ChatListHeader}
        Footer={ChatListFooter}
        EmptyPlaceholder={MessagesEmptyState as any}
        onScroll={onScroll}
        shortSizeAlign={'bottom-smooth' as any}
        style={{ height: '100%', overscrollBehavior: 'contain' } as any}
      />
    )
  }
)
ChatList.displayName = 'ChatList'
