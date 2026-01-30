import { Editor } from '@tiptap/react'
import { HistoryItem } from '@types'
import { immer } from 'zustand/middleware/immer'
interface IHistoryStore {
  historyList: HistoryItem[]
  activeHistory: HistoryItem | null
  loadingHistory: boolean
  editor: Editor | null
  setHistoryList: (historyList: HistoryItem[]) => void
  setActiveHistory: (activeHistory: HistoryItem) => void
  setLoadingHistory: (loadingHistory: boolean) => void
  setEditor: (editor: Editor | null) => void
}

const history = immer<IHistoryStore>((set) => ({
  historyList: [],
  activeHistory: null,
  loadingHistory: true,
  editor: null,
  setHistoryList: (historyList: HistoryItem[]) => {
    set((state) => {
      state.historyList = historyList
    })
  },

  setActiveHistory: (activeHistory: HistoryItem) => {
    set((state) => {
      state.activeHistory = activeHistory
    })
  },

  setLoadingHistory: (loadingHistory: boolean) => {
    set((state) => {
      state.loadingHistory = loadingHistory
    })
  },

  setEditor: (editor: Editor | null) => {
    set((state) => {
      state.editor = editor as any
    })
  }
}))

export default history
