import { useChatStore } from '@stores'
import { EmptyBookmarkState } from '../components/EmptyBookmarkState'
import { BookmarkItem } from '../components/BookmarkItem'
import { BookmarkHeader } from '../components/BookmarkHeader'
import { BookmarkSkeleton } from '../components/BookmarkSkeleton'
import { useBookmarkSummary } from '../hooks/useBookmarkSummary'
import { useInfiniteBookmarks } from '../hooks/useInfiniteBookmarks'
import { ScrollArea } from '@components/ui/ScrollArea'

type TBookmarkTab = 'in progress' | 'archive' | 'read'

interface BookmarkPanelProps {
  onClose?: () => void
}

export const BookmarkPanel = ({ onClose }: BookmarkPanelProps) => {
  const { bookmarkActiveTab, bookmarkTabs, setBookmarkActiveTab } = useChatStore((state) => state)

  useBookmarkSummary()

  const { bookmarks, isLoading, isLoadingMore, hasMore, sentinelRef } = useInfiniteBookmarks()

  return (
    <div className="bg-base-100 flex w-full flex-col">
      {/* Header */}
      <div className="border-base-300 border-b px-4 py-3">
        <BookmarkHeader onClose={onClose} />
      </div>

      {/* Tabs */}
      <div className="border-base-300 flex gap-1 border-b px-4 py-2">
        {bookmarkTabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setBookmarkActiveTab(tab.label as TBookmarkTab)}
            className={`rounded-selector px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              bookmarkActiveTab === tab.label
                ? 'bg-primary text-primary-content'
                : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
            }`}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`ml-1.5 ${
                  bookmarkActiveTab === tab.label
                    ? 'text-primary-content/80'
                    : 'text-base-content/50'
                }`}>
                ({tab.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content with infinite scroll */}
      <ScrollArea
        className="max-h-96 min-h-48 p-3"
        scrollbarSize="thin"
        hideScrollbar
        preserveWidth={false}>
        {/* Loading skeleton */}
        {isLoading && bookmarks.length === 0 && <BookmarkSkeleton count={4} />}

        {/* Empty state */}
        <EmptyBookmarkState show={!isLoading && bookmarks.length === 0} />

        {/* Bookmarks list */}
        {bookmarks.length > 0 && (
          <div className="flex flex-col gap-2">
            {bookmarks.map((bookmark) => (
              <BookmarkItem key={bookmark.bookmark_id} bookmark={bookmark} />
            ))}

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-3">
                {isLoadingMore && (
                  <div className="loading loading-spinner loading-sm text-primary" />
                )}
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && bookmarks.length > 0 && (
              <p className="text-base-content/40 py-3 text-center text-xs">No more bookmarks</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
