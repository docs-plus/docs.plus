import { Editor } from '@tiptap/react'
import { HistoryItem } from '@types'
import { immer } from 'zustand/middleware/immer'
interface IHistoryStore {
  historyList: HistoryItem[]
  activeHistory: HistoryItem | null
  /** `history.list` latestSnapshot — hydrate head when watch fails. */
  latestSnapshot: HistoryItem | null
  loadingHistory: boolean
  editor: Editor | null
  /** Last `history.watch` version we asked for — ignore older `history.watch` payloads (race). */
  pendingWatchVersion: number | null
  setHistoryList: (historyList: HistoryItem[]) => void
  setActiveHistory: (activeHistory: HistoryItem | null) => void
  setLatestSnapshot: (item: HistoryItem | null) => void
  setLoadingHistory: (loadingHistory: boolean) => void
  setEditor: (editor: Editor | null) => void
  setPendingWatchVersion: (version: number | null) => void
}

const history = immer<IHistoryStore>((set) => ({
  historyList: [],
  activeHistory: null,
  latestSnapshot: null,
  loadingHistory: true,
  editor: null,
  pendingWatchVersion: null,
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
  }
}))

export default history
