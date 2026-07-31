import { Editor } from '@tiptap/react'
import { ClientAuthorBinding, HistoryItem, HistoryProfileMap } from '@types'
import { immer } from 'zustand/middleware/immer'
interface IHistoryStore {
  historyList: HistoryItem[]
  activeHistory: HistoryItem | null
  /** `history.list` latestSnapshot — hydrate head when watch fails. */
  latestSnapshot: HistoryItem | null
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
  /** A background `document:saved` re-list is in flight; its failure must not blank the sidebar. */
  silentListRefresh: boolean
  setHistoryList: (historyList: HistoryItem[]) => void
  setActiveHistory: (activeHistory: HistoryItem | null) => void
  setLatestSnapshot: (item: HistoryItem | null) => void
  setProfiles: (profiles: HistoryProfileMap) => void
  setClientAuthors: (clientAuthors: ClientAuthorBinding[]) => void
  setLoadingHistory: (loadingHistory: boolean) => void
  setEditor: (editor: Editor | null) => void
  setPendingWatchVersion: (version: number | null) => void
  setCompareMode: (compareMode: boolean) => void
  setCompareBaseItem: (item: HistoryItem | null) => void
  setPendingCompareVersion: (version: number | null) => void
  setSilentListRefresh: (silent: boolean) => void
}

const history = immer<IHistoryStore>((set) => ({
  historyList: [],
  activeHistory: null,
  latestSnapshot: null,
  profiles: {},
  clientAuthors: [],
  loadingHistory: true,
  editor: null,
  pendingWatchVersion: null,
  compareMode: false,
  compareBaseItem: null,
  pendingCompareVersion: null,
  silentListRefresh: false,
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

  setLatestSnapshot: (latestSnapshot: HistoryItem | null) => {
    set((state) => {
      state.latestSnapshot = latestSnapshot
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

  setSilentListRefresh: (silentListRefresh: boolean) => {
    set((state) => {
      state.silentListRefresh = silentListRefresh
    })
  }
}))

export default history
