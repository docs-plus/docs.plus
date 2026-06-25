import { PanelPopoverHeader } from '@components/PanelPopoverHeader'
import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import { TabbedPanelBody } from '@components/TabbedPanelBody'
import { useChatStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'

import { BookmarkItem } from '../components/BookmarkItem'
import { BookmarkSkeleton } from '../components/BookmarkSkeleton'
import { EmptyBookmarkState } from '../components/EmptyBookmarkState'
import { useBookmarkPanelFeed } from '../feed/useBookmarkPanelFeed'

interface BookmarkPanelProps {
  onClose?: () => void
  variant?: PanelSurfaceVariant
}

export const BookmarkPanel = ({ onClose, variant = 'popover' }: BookmarkPanelProps) => {
  const bookmarkActiveTab = useChatStore((state) => state.bookmarkActiveTab)
  const bookmarkTabs = useChatStore((state) => state.bookmarkTabs)
  const setBookmarkActiveTab = useChatStore((state) => state.setBookmarkActiveTab)
  const isSheet = variant === 'sheet'

  const { bookmarks, isLoading, isLoadingMore, hasMore, sentinelRef } = useBookmarkPanelFeed()

  return (
    <PanelSurfaceShell
      variant={variant}
      title="Bookmarks"
      fillHeight
      bodyClassName="min-h-0 overflow-hidden"
      popoverHeader={<PanelPopoverHeader title="Bookmarks" onClose={onClose} showClose />}>
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
        renderItem={(bookmark) => <BookmarkItem bookmark={bookmark} variant={variant} />}
        loadingSkeleton={<BookmarkSkeleton count={isSheet ? 5 : 4} />}
        emptyState={<EmptyBookmarkState show={!isLoading && bookmarks.length === 0} />}
        endMessage="No more bookmarks"
      />
    </PanelSurfaceShell>
  )
}
