import { useStore } from '@stores'

import { bindHistoryDecodeCache, clearHistoryDecodeCache } from './historyDecodeCache'

export function resetHistorySessionForMount(): void {
  const state = useStore.getState()
  bindHistoryDecodeCache(state.settings.metadata?.documentId)
  state.setActiveHistory(null)
  state.setPendingWatchVersion(null)
  state.setHistoryList([])
  state.setLatestSnapshot(null)
  state.setLoadingHistory(true)
  clearHistoryDecodeCache()
}

export function clearHistorySession(): void {
  resetHistorySessionForMount()
  useStore.getState().setEditor(null)
}
