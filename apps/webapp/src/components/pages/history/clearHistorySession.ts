import { useStore } from '@stores'

import { bindHistoryDecodeCache, clearHistoryDecodeCache } from './historyDecodeCache'

export function resetHistorySessionForMount(): void {
  const state = useStore.getState()
  bindHistoryDecodeCache(state.settings.metadata?.documentId)
  state.setActiveHistory(null)
  state.setPendingWatchVersion(null)
  state.setHistoryList([])
  state.setLatestSnapshot(null)
  state.setProfiles({})
  state.setClientAuthors([])
  state.setSilentListRefresh(false)
  state.setCompareMode(false)
  state.setCompareBaseItem(null)
  state.setPendingCompareVersion(null)
  state.setLoadingHistory(true)
  clearHistoryDecodeCache()
}

export function clearHistorySession(): void {
  resetHistorySessionForMount()
  useStore.getState().setEditor(null)
}
