import { type TBookmarkTab, type TBookmarkWithMessage } from '@types'
import { immer } from 'zustand/middleware/immer'

type TBookmarkTabData = {
  label: TBookmarkTab
  count?: number
}

type TBookmarkStats = {
  total: number
  archived: number
  active: number
  unread: number
  read: number
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

function removeBookmarkFromLists(state: BookmarkDraft, bookmarkId: number) {
  for (const [tab, bookmarkList] of state.bookmarks) {
    if (!bookmarkList.some((b) => b.bookmark_id === bookmarkId)) continue

    state.bookmarks.set(
      tab,
      bookmarkList.filter((b) => b.bookmark_id !== bookmarkId)
    )
    state.bookmarkTabs = adjustBookmarkTabCount(state.bookmarkTabs, tab, -1)
  }
}

function relocateBookmark(
  state: BookmarkDraft,
  bookmarkId: number,
  fromTab: TBookmarkTab,
  toTab: TBookmarkTab,
  patch?: Partial<TBookmarkWithMessage>
) {
  const fromList = state.bookmarks.get(fromTab) || []
  const bookmark = fromList.find((b) => b.bookmark_id === bookmarkId)
  if (!bookmark) return

  const updated = patch ? { ...bookmark, ...patch } : bookmark
  state.bookmarks.set(
    fromTab,
    fromList.filter((b) => b.bookmark_id !== bookmarkId)
  )
  state.bookmarks.set(toTab, [updated, ...(state.bookmarks.get(toTab) || [])])
  state.bookmarkTabs = adjustBookmarkTabCount(
    adjustBookmarkTabCount(state.bookmarkTabs, fromTab, -1),
    toTab,
    1
  )
}

interface IBookmarkStore {
  bookmarkSummary: TBookmarkStats
  bookmarkTabs: TBookmarkTabData[]
  loadingBookmarks: boolean
  bookmarks: Map<TBookmarkTab, TBookmarkWithMessage[]>
  bookmarkActiveTab: TBookmarkTab
  bookmarkPage: number
  setBookmarkSummary: (summary: TBookmarkStats) => void
  setBookmarks: (tab: TBookmarkTab, bookmarks: TBookmarkWithMessage[]) => void
  setBookmarkTab: (tab: TBookmarkTab, count?: number) => void
  setLoadingBookmarks: (loading: boolean) => void
  setBookmarkActiveTab: (tab: TBookmarkTab) => void
  setBookmarkPage: (page: number) => void
  clearBookmarks: () => void
  updateBookmarks: (tab: TBookmarkTab, newBookmarks: TBookmarkWithMessage[]) => void
  commitBookmarkRemoved: (bookmarkId: number) => void
  commitBookmarkMarkedRead: (bookmarkId: number) => void
  commitBookmarkArchived: (bookmarkId: number, fromTab: TBookmarkTab) => void
  commitBookmarkRestored: (bookmarkId: number) => void
}

const bookmark = immer<IBookmarkStore>((set) => ({
  bookmarkSummary: {
    total: 0,
    archived: 0,
    active: 0,
    unread: 0,
    read: 0
  },
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

  setBookmarkSummary: (summary: TBookmarkStats) => {
    set((state) => {
      state.bookmarkSummary = summary
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

  clearBookmarks: () => {
    set((state) => {
      state.bookmarks.clear()
      state.bookmarkSummary = {
        total: 0,
        archived: 0,
        active: 0,
        unread: 0,
        read: 0
      }
      state.bookmarkTabs = state.bookmarkTabs.map((item) => ({
        ...item,
        count: 0
      }))
    })
  },

  commitBookmarkRemoved: (bookmarkId: number) => {
    set((state) => {
      removeBookmarkFromLists(state, bookmarkId)
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

  commitBookmarkArchived: (bookmarkId: number, fromTab: TBookmarkTab) => {
    set((state) => {
      const now = new Date().toISOString()
      relocateBookmark(state, bookmarkId, fromTab, 'archive', {
        bookmark_archived_at: now,
        bookmark_updated_at: now
      })
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
