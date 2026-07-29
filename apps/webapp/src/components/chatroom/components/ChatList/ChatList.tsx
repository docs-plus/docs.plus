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
 * Virtuoso has no `startReached`/`endReached`; both ends are wired through
 * `onScroll`, firing within these px of the respective viewport edge.
 * Re-entry is gated inside `useChannelMessages` (loadingOlderRef /
 * loadingNewerRef, dataIncludesTailRef), so a per-scroll-tick call is safe.
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
        // `useVirtuosoLocation` re-renders only on coarse signals (isAtBottom
        // flips), never on index changes inside the viewport. `onScroll` is
        // the only surface emitting `lastVisibleItemIndex` per scroll tick,
        // which the read-cursor needs to advance as the user scans.
        if (onLastVisibleIndexChange && typeof location.lastVisibleItemIndex === 'number') {
          onLastVisibleIndexChange(location.lastVisibleItemIndex)
        }
        // listOffset is the distance between list top and viewport top;
        // 0 means at top, slightly-negative means just-past-top. Threshold
        // covers momentum scroll where we want to prefetch a bit early.
        if (loadOlder && hasMoreOlder && location.listOffset >= -LOAD_OLDER_PX_THRESHOLD) {
          void loadOlder()
        }
        // Mirror for the bottom edge; positive `bottomOffset` means unloaded
        // list below. No `hasMoreNewer` flag is needed — the hook's own
        // `dataIncludesTailRef` guard disarms loadNewer once the live tail
        // is reached.
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
