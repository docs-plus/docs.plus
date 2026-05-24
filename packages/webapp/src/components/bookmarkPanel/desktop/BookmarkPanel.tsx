import { PanelTabBar } from '@components/ui/PanelTabBar'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useChatStore } from '@stores'
import { type PanelSurfaceVariant, type TBookmarkTab } from '@types'
import { twMerge } from 'tailwind-merge'

import { BookmarkHeader } from '../components/BookmarkHeader'
import { BookmarkItem } from '../components/BookmarkItem'
import { BookmarkSkeleton } from '../components/BookmarkSkeleton'
import { EmptyBookmarkState } from '../components/EmptyBookmarkState'
import { useBookmarkSummary } from '../hooks/useBookmarkSummary'
import { useInfiniteBookmarks } from '../hooks/useInfiniteBookmarks'

interface BookmarkPanelProps {
  onClose?: () => void
  variant?: PanelSurfaceVariant
}

export const BookmarkPanel = ({ onClose, variant = 'popover' }: BookmarkPanelProps) => {
  const bookmarkActiveTab = useChatStore((state) => state.bookmarkActiveTab)
  const bookmarkTabs = useChatStore((state) => state.bookmarkTabs)
  const setBookmarkActiveTab = useChatStore((state) => state.setBookmarkActiveTab)
  const isSheet = variant === 'sheet'

  useBookmarkSummary()

  const { bookmarks, isLoading, isLoadingMore, hasMore, sentinelRef } = useInfiniteBookmarks()

  return (
    <div
      className={twMerge(
        'bg-base-100 flex min-h-0 w-full flex-col overflow-hidden',
        isSheet && 'h-full flex-1'
      )}>
      <div className="border-base-300 shrink-0 border-b px-4 py-3">
        <BookmarkHeader onClose={onClose} showClose={!isSheet} />
      </div>

      <PanelTabBar<TBookmarkTab>
        tabs={bookmarkTabs}
        activeTab={bookmarkActiveTab}
        onSelect={setBookmarkActiveTab}
        capitalize
      />

      <ScrollArea
        className={twMerge('p-3', isSheet ? 'min-h-0 flex-1' : 'max-h-96 min-h-48')}
        scrollbarSize="thin"
        hideScrollbar
        preserveWidth={false}>
        {isLoading && bookmarks.length === 0 && <BookmarkSkeleton count={4} />}

        <EmptyBookmarkState show={!isLoading && bookmarks.length === 0} />

        {bookmarks.length > 0 && (
          <div className="flex flex-col gap-2">
            {bookmarks.map((bookmark) => (
              <BookmarkItem key={bookmark.bookmark_id} bookmark={bookmark} />
            ))}

            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-3">
                {isLoadingMore && (
                  <div className="loading loading-spinner loading-sm text-primary" />
                )}
              </div>
            )}

            {!hasMore && bookmarks.length > 0 && (
              <p className="text-base-content/40 py-3 text-center text-xs">No more bookmarks</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
