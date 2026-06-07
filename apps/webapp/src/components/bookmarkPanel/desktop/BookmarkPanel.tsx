import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import { TabbedPanelBody } from '@components/TabbedPanelBody'
import { useChatStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'

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

  useBookmarkSummary()

  const { bookmarks, isLoading, isLoadingMore, hasMore, sentinelRef } = useInfiniteBookmarks()

  return (
    <PanelSurfaceShell
      variant={variant}
      title="Bookmarks"
      fillHeight
      bodyClassName="min-h-0 overflow-hidden"
      popoverHeader={<BookmarkHeader onClose={onClose} showClose />}>
      <TabbedPanelBody
        variant={variant}
        tabs={bookmarkTabs}
        activeTab={bookmarkActiveTab}
        onSelect={setBookmarkActiveTab}
        capitalize
        items={bookmarks}
        getItemKey={(bookmark) => bookmark.bookmark_id}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        sentinelRef={sentinelRef}
        renderItem={(bookmark) => <BookmarkItem bookmark={bookmark} />}
        loadingSkeleton={<BookmarkSkeleton count={4} />}
        emptyState={<EmptyBookmarkState show={!isLoading && bookmarks.length === 0} />}
        endMessage="No more bookmarks"
      />
    </PanelSurfaceShell>
  )
}
