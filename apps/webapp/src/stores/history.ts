import { Editor } from '@tiptap/react'
import { ClientAuthorBinding, HistoryAnchor, HistoryItem, HistoryProfileMap } from '@types'
import { immer } from 'zustand/middleware/immer'
interface IHistoryStore {
  historyList: HistoryItem[]
  activeHistory: HistoryItem | null
  /** Uid -> author, shipped beside the list rather than repeated on every row. */
  profiles: HistoryProfileMap
  /** Yjs clientID -> person, per document. Ships once beside `profiles`. */
  clientAuthors: ClientAuthorBinding[]
  loadingHistory: boolean
  editor: Editor | null
  /** Last `history.watch` version we asked for — ignore older `history.watch` payloads (race). */
  pendingWatchVersion: number | null
  compareMode: boolean
  /** Compare's A side, held whole: list rows carry no `data`, so a version number cannot decode. */
  compareBaseItem: HistoryItem | null
  /** Version of the second in-flight watch that fills `compareBaseItem`. */
  pendingCompareVersion: number | null
  /**
   * Last left: the ISO instant this reader's last live session on the document
   * closed, never the notification's own `created_at`. History compare consumes
   * it once, so it must survive `resetHistorySessionForMount`.
   */
  pendingCompareSince: string | null
  /** The server's Anchor for one `since`, from a list reply that echoed it. Never part of `historyList`. */
  historyAnchor: HistoryAnchor | null
  /** A background `document:saved` re-list is in flight; its failure must not blank the sidebar. */
  silentListRefresh: boolean
  /** The loaded page is not the whole list. */
  historyHasMore: boolean
  historyNextBefore: number | null
  setHistoryList: (historyList: HistoryItem[]) => void
  setActiveHistory: (activeHistory: HistoryItem | null) => void
  setProfiles: (profiles: HistoryProfileMap) => void
  setClientAuthors: (clientAuthors: ClientAuthorBinding[]) => void
  setLoadingHistory: (loadingHistory: boolean) => void
  setEditor: (editor: Editor | null) => void
  setPendingWatchVersion: (version: number | null) => void
  setCompareMode: (compareMode: boolean) => void
  setCompareBaseItem: (item: HistoryItem | null) => void
  setPendingCompareVersion: (version: number | null) => void
  setPendingCompareSince: (since: string | null) => void
  setHistoryAnchor: (anchor: HistoryAnchor | null) => void
  setSilentListRefresh: (silent: boolean) => void
  setHistoryHasMore: (historyHasMore: boolean) => void
  setHistoryNextBefore: (historyNextBefore: number | null) => void
}

const history = immer<IHistoryStore>((set) => ({
  historyList: [],
  activeHistory: null,
  profiles: {},
  clientAuthors: [],
  loadingHistory: true,
  editor: null,
  pendingWatchVersion: null,
  compareMode: false,
  compareBaseItem: null,
  pendingCompareVersion: null,
  pendingCompareSince: null,
  historyAnchor: null,
  silentListRefresh: false,
  historyHasMore: false,
  historyNextBefore: null,
  setHistoryList: (historyList: HistoryItem[]) => {
    set((state) => {
      state.historyList = historyList
    })
  },

  setActiveHistory: (activeHistory: HistoryItem | null) => {
    set((state) => {
      state.activeHistory = activeHistory
    })
  },

  setProfiles: (profiles: HistoryProfileMap) => {
    set((state) => {
      state.profiles = profiles
    })
  },

  setClientAuthors: (clientAuthors: ClientAuthorBinding[]) => {
    set((state) => {
      state.clientAuthors = clientAuthors
    })
  },

  setLoadingHistory: (loadingHistory: boolean) => {
    set((state) => {
      state.loadingHistory = loadingHistory
    })
  },

  setEditor: (editor: Editor | null) => {
    set((state) => {
      // immer Draft rejects TipTap Editor's readonly schema graph.
      state.editor = editor as typeof state.editor
    })
  },

  setPendingWatchVersion: (version: number | null) => {
    set((state) => {
      state.pendingWatchVersion = version
    })
  },

  setCompareMode: (compareMode: boolean) => {
    set((state) => {
      state.compareMode = compareMode
    })
  },

  setCompareBaseItem: (compareBaseItem: HistoryItem | null) => {
    set((state) => {
      state.compareBaseItem = compareBaseItem
    })
  },

  setPendingCompareVersion: (version: number | null) => {
    set((state) => {
      state.pendingCompareVersion = version
    })
  },

  setPendingCompareSince: (pendingCompareSince: string | null) => {
    set((state) => {
      state.pendingCompareSince = pendingCompareSince
    })
  },

  setHistoryAnchor: (historyAnchor: HistoryAnchor | null) => {
    set((state) => {
      state.historyAnchor = historyAnchor
    })
  },

  setSilentListRefresh: (silentListRefresh: boolean) => {
    set((state) => {
      state.silentListRefresh = silentListRefresh
    })
  },

  setHistoryHasMore: (historyHasMore: boolean) => {
    set((state) => {
      state.historyHasMore = historyHasMore
    })
  },

  setHistoryNextBefore: (historyNextBefore: number | null) => {
    set((state) => {
      state.historyNextBefore = historyNextBefore
    })
  }
}))

export default history
