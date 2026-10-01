import { type TBookmarkTab, type TBookmarkWithMessage } from '@types'
import { immer } from 'zustand/middleware/immer'

type TBookmarkTabData = {
  label: TBookmarkTab
  count?: number
}

type BookmarkDraft = {
  bookmarkTabs: TBookmarkTabData[]
  bookmarks: Map<TBookmarkTab, TBookmarkWithMessage[]>
}

function adjustBookmarkTabCount(
  tabs: TBookmarkTabData[],
  tab: TBookmarkTab,
  delta: number
): TBookmarkTabData[] {
  return tabs.map((item) =>
    item.label === tab ? { ...item, count: Math.max(0, (item.count ?? 0) + delta) } : item
  )
}

// Split from the list mutation so the badge can drop on runWithExit's onStart
// while the row itself is removed later, on onComplete (notification-store parity).
function decrementBookmarkTabCount(state: BookmarkDraft, bookmarkId: number) {
  for (const [tab, bookmarkList] of state.bookmarks) {
    if (bookmarkList.some((b) => b.bookmark_id === bookmarkId)) {
      state.bookmarkTabs = adjustBookmarkTabCount(state.bookmarkTabs, tab, -1)
    }
  }
}

function removeBookmarkFromLists(state: BookmarkDraft, bookmarkId: number) {
  for (const [tab, bookmarkList] of state.bookmarks) {
    if (!bookmarkList.some((b) => b.bookmark_id === bookmarkId)) continue

    state.bookmarks.set(
      tab,
      bookmarkList.filter((b) => b.bookmark_id !== bookmarkId)
    )
  }
}

/** The one precondition both halves of a relocation share, so the badge and the list
 *  cannot disagree about whether the row is still in `fromTab`. */
function findBookmarkInTab(state: BookmarkDraft, bookmarkId: number, tab: TBookmarkTab) {
  return (state.bookmarks.get(tab) || []).find((b) => b.bookmark_id === bookmarkId)
}

function relocateBookmarkTabCount(
  state: BookmarkDraft,
  fromTab: TBookmarkTab,
  toTab: TBookmarkTab
) {
  state.bookmarkTabs = adjustBookmarkTabCount(
    adjustBookmarkTabCount(state.bookmarkTabs, fromTab, -1),
    toTab,
    1
  )
}

function relocateBookmarkTabCountIfPresent(
  state: BookmarkDraft,
  bookmarkId: number,
  fromTab: TBookmarkTab,
  toTab: TBookmarkTab
) {
  if (!findBookmarkInTab(state, bookmarkId, fromTab)) return
  relocateBookmarkTabCount(state, fromTab, toTab)
}

function relocateBookmark(
  state: BookmarkDraft,
  bookmarkId: number,
  fromTab: TBookmarkTab,
  toTab: TBookmarkTab,
  patch?: Partial<TBookmarkWithMessage>
) {
  const bookmark = findBookmarkInTab(state, bookmarkId, fromTab)
  if (!bookmark) return

  const updated = patch ? { ...bookmark, ...patch } : bookmark
  state.bookmarks.set(
    fromTab,
    (state.bookmarks.get(fromTab) || []).filter((b) => b.bookmark_id !== bookmarkId)
  )
  state.bookmarks.set(toTab, [updated, ...(state.bookmarks.get(toTab) || [])])
}

/** The 'in progress' tab count; the Bookmarks dot reads it. */
export const selectInProgressBookmarkCount = (state: { bookmarkTabs: TBookmarkTabData[] }) =>
  state.bookmarkTabs.find((tab) => tab.label === 'in progress')?.count ?? 0

/** The accessible name of a control that shows the Bookmarks dot. */
export const withInProgressBookmarks = (label: string, count: number) =>
  count > 0 ? `${label}, ${count} ${count === 1 ? 'bookmark' : 'bookmarks'} in progress` : label

interface IBookmarkStore {
  bookmarkTabs: TBookmarkTabData[]
  loadingBookmarks: boolean
  bookmarks: Map<TBookmarkTab, TBookmarkWithMessage[]>
  bookmarkActiveTab: TBookmarkTab
  bookmarkPage: number
  setBookmarks: (tab: TBookmarkTab, bookmarks: TBookmarkWithMessage[]) => void
  setBookmarkTab: (tab: TBookmarkTab, count?: number) => void
  setLoadingBookmarks: (loading: boolean) => void
  setBookmarkActiveTab: (tab: TBookmarkTab) => void
  setBookmarkPage: (page: number) => void
  clearBookmarks: () => void
  updateBookmarks: (tab: TBookmarkTab, newBookmarks: TBookmarkWithMessage[]) => void
  commitBookmarkRemovedCount: (bookmarkId: number) => void
  commitBookmarkRemoved: (bookmarkId: number) => void
  commitBookmarkMarkedReadCount: (bookmarkId: number) => void
  commitBookmarkMarkedRead: (bookmarkId: number) => void
  commitBookmarkArchivedCount: (fromTab: TBookmarkTab) => void
  commitBookmarkArchived: (bookmarkId: number, fromTab: TBookmarkTab) => void
  commitBookmarkRestoredCount: (bookmarkId: number) => void
  commitBookmarkRestored: (bookmarkId: number) => void
}

const bookmark = immer<IBookmarkStore>((set) => ({
  bookmarks: new Map<TBookmarkTab, TBookmarkWithMessage[]>(),
  bookmarkTabs: [
    { label: 'in progress', count: 0 },
    { label: 'archive', count: 0 },
    { label: 'read', count: 0 }
  ],
  loadingBookmarks: false,
  bookmarkActiveTab: 'in progress',
  bookmarkPage: 1,

  setLoadingBookmarks: (loading: boolean) => {
    set((state) => {
      state.loadingBookmarks = loading
    })
  },

  setBookmarkTab: (tab: TBookmarkTab, count?: number) => {
    set((state) => {
      state.bookmarkTabs = state.bookmarkTabs.map((item) => {
        if (item.label === tab) return { ...item, count }
        return item
      })
    })
  },

  setBookmarks: (tab: TBookmarkTab, newBookmarks: TBookmarkWithMessage[]) => {
    set((state) => {
      state.bookmarks.set(tab, newBookmarks)
    })
  },

  updateBookmarks: (tab: TBookmarkTab, newBookmarks: TBookmarkWithMessage[]) => {
    set((state) => {
      const existingBookmarks = state.bookmarks.get(tab) || []
      state.bookmarks.set(tab, [...existingBookmarks, ...newBookmarks])
    })
  },

  setBookmarkActiveTab: (tab: TBookmarkTab) => {
    set((state) => {
      state.bookmarkActiveTab = tab
    })
  },

  setBookmarkPage: (page: number) => {
    set((state) => {
      state.bookmarkPage = page
    })
  },

  // Keeps the counts: usePadBookmarkStats owns them, and the Bookmarks dot must not blink.
  clearBookmarks: () => {
    set((state) => {
      state.bookmarks.clear()
    })
  },

  commitBookmarkRemovedCount: (bookmarkId: number) => {
    set((state) => {
      decrementBookmarkTabCount(state, bookmarkId)
    })
  },

  commitBookmarkRemoved: (bookmarkId: number) => {
    set((state) => {
      removeBookmarkFromLists(state, bookmarkId)
    })
  },

  commitBookmarkMarkedReadCount: (bookmarkId: number) => {
    set((state) => {
      relocateBookmarkTabCountIfPresent(state, bookmarkId, 'in progress', 'read')
    })
  },

  commitBookmarkMarkedRead: (bookmarkId: number) => {
    set((state) => {
      const now = new Date().toISOString()
      relocateBookmark(state, bookmarkId, 'in progress', 'read', {
        bookmark_marked_at: now,
        bookmark_updated_at: now
      })
    })
  },

  commitBookmarkArchivedCount: (fromTab: TBookmarkTab) => {
    set((state) => {
      relocateBookmarkTabCount(state, fromTab, 'archive')
    })
  },

  commitBookmarkArchived: (bookmarkId: number, fromTab: TBookmarkTab) => {
    set((state) => {
      const now = new Date().toISOString()
      relocateBookmark(state, bookmarkId, fromTab, 'archive', {
        bookmark_archived_at: now,
        bookmark_updated_at: now
      })
    })
  },

  commitBookmarkRestoredCount: (bookmarkId: number) => {
    set((state) => {
      relocateBookmarkTabCountIfPresent(state, bookmarkId, 'archive', 'in progress')
    })
  },

  commitBookmarkRestored: (bookmarkId: number) => {
    set((state) => {
      const now = new Date().toISOString()
      relocateBookmark(state, bookmarkId, 'archive', 'in progress', {
        bookmark_archived_at: null,
        bookmark_updated_at: now
      })
    })
  }
}))

export default bookmark
