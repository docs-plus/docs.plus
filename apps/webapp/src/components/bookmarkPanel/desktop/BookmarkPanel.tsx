import { PanelFeedSkeleton } from '@components/PanelFeedItem'
import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import { TabbedPanelBody } from '@components/TabbedPanelBody'
import { EmptyState } from '@components/ui/EmptyState'
import { useChatStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'
import { LuBookmark } from 'react-icons/lu'

import { BookmarkItem } from '../components/BookmarkItem'
import { useBookmarkPanelFeed } from '../feed/useBookmarkPanelFeed'

interface BookmarkPanelProps {
  variant?: PanelSurfaceVariant
}

export const BookmarkPanel = ({ variant = 'popover' }: BookmarkPanelProps) => {
  const bookmarkActiveTab = useChatStore((state) => state.bookmarkActiveTab)
  const bookmarkTabs = useChatStore((state) => state.bookmarkTabs)
  const setBookmarkActiveTab = useChatStore((state) => state.setBookmarkActiveTab)
  const isSheet = variant === 'sheet'

  const { bookmarks, isLoading, isLoadingMore, hasMore, isError, retry, sentinelRef } =
    useBookmarkPanelFeed()

  return (
    <PanelSurfaceShell
      variant={variant}
      title="Bookmarks"
      fillHeight
      bodyClassName="min-h-0 overflow-hidden">
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
        loadingSkeleton={<PanelFeedSkeleton count={isSheet ? 5 : 4} />}
        emptyState={
          <EmptyState
            icon={LuBookmark}
            title="No bookmarks here."
            body="Bookmarked messages will appear in this tab."
          />
        }
        isError={isError}
        errorState={<EmptyState tone="error" title="Couldn’t load bookmarks." onRetry={retry} />}
      />
    </PanelSurfaceShell>
  )
}
