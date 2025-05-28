import { immer } from 'zustand/middleware/immer'

type TBookmarkTab = 'in progress' | 'archive' | 'read'

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

type TUserDetails = {
  id: string
  username: string
  fullname: string
  avatar_url: string | null
  avatar_updated_at: string | null
}

type TBookmark = {
  bookmark_id: number
  bookmark_created_at: string
  bookmark_updated_at: string
  bookmark_archived_at: string | null
  bookmark_marked_at: string | null
  bookmark_metadata: Record<string, any>
  message_id: string
  message_content: string
  message_html: string
  message_created_at: string
  message_user_id: string
  message_channel_id: string
  message_type: string
  user_details: TUserDetails
  channel_name: string
  channel_slug: string
  workspace_id: string
  workspace_name: string
  workspace_slug: string
}

interface IBookmarkStore {
  bookmarkSummary: TBookmarkStats
  bookmarkTabs: TBookmarkTabData[]
  loadingBookmarks: boolean
  bookmarks: Map<TBookmarkTab, TBookmark[]>
  bookmarkActiveTab: TBookmarkTab
  bookmarkPage: number
  setBookmarkSummary: (summary: TBookmarkStats) => void
  setBookmarks: (tab: TBookmarkTab, bookmarks: TBookmark[]) => void
  setBookmarkTab: (tab: TBookmarkTab, count?: number) => void
  setLoadingBookmarks: (loading: boolean) => void
  setBookmarkActiveTab: (tab: TBookmarkTab) => void
  setBookmarkPage: (page: number) => void
  clearBookmarks: () => void
  updateBookmarks: (tab: TBookmarkTab, newBookmarks: TBookmark[]) => void
  removeBookmark: (bookmarkId: number) => void
  updateBookmarkStatus: (bookmarkId: number, updates: Partial<TBookmark>) => void
  moveBookmarkBetweenTabs: (bookmarkId: number, fromTab: TBookmarkTab, toTab: TBookmarkTab) => void
  updateTabCounts: () => void
}

const bookmark = immer<IBookmarkStore>((set) => ({
  bookmarkSummary: {
    total: 0,
    archived: 0,
    active: 0,
    unread: 0,
    read: 0
  },
  bookmarks: new Map<TBookmarkTab, TBookmark[]>(),
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

  setBookmarks: (tab: TBookmarkTab, newBookmarks: TBookmark[]) => {
    set((state) => {
      state.bookmarks.set(tab, newBookmarks)
    })
  },

  updateBookmarks: (tab: TBookmarkTab, newBookmarks: TBookmark[]) => {
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
      // Note: We intentionally don't reset bookmarkActiveTab to preserve user's tab selection
    })
  },

  removeBookmark: (bookmarkId: number) => {
    set((state) => {
      // Remove bookmark from all tabs
      for (const [tab, bookmarkList] of state.bookmarks) {
        const filteredBookmarks = bookmarkList.filter((b) => b.bookmark_id !== bookmarkId)
        state.bookmarks.set(tab, filteredBookmarks)
      }

      // Update tab counts
      state.bookmarkTabs = state.bookmarkTabs.map((tab) => ({
        ...tab,
        count: (state.bookmarks.get(tab.label) || []).length
      }))
    })
  },

  updateBookmarkStatus: (bookmarkId: number, updates: Partial<TBookmark>) => {
    set((state) => {
      // Update bookmark in all tabs where it exists
      for (const [tab, bookmarkList] of state.bookmarks) {
        const updatedBookmarks = bookmarkList.map((bookmark) =>
          bookmark.bookmark_id === bookmarkId ? { ...bookmark, ...updates } : bookmark
        )
        state.bookmarks.set(tab, updatedBookmarks)
      }
    })
  },

  moveBookmarkBetweenTabs: (bookmarkId: number, fromTab: TBookmarkTab, toTab: TBookmarkTab) => {
    set((state) => {
      const fromList = state.bookmarks.get(fromTab) || []
      const toList = state.bookmarks.get(toTab) || []

      // Find the bookmark to move
      const bookmarkToMove = fromList.find((b) => b.bookmark_id === bookmarkId)

      if (bookmarkToMove) {
        // Remove from source tab
        const newFromList = fromList.filter((b) => b.bookmark_id !== bookmarkId)
        state.bookmarks.set(fromTab, newFromList)

        // Add to destination tab (at the beginning for newest first)
        const newToList = [bookmarkToMove, ...toList]
        state.bookmarks.set(toTab, newToList)

        // Update tab counts
        state.bookmarkTabs = state.bookmarkTabs.map((tab) => ({
          ...tab,
          count: (state.bookmarks.get(tab.label) || []).length
        }))
      }
    })
  },

  updateTabCounts: () => {
    set((state) => {
      state.bookmarkTabs = state.bookmarkTabs.map((tab) => ({
        ...tab,
        count: (state.bookmarks.get(tab.label) || []).length
      }))
    })
  }
}))

export default bookmark
