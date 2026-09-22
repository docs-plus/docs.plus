import { useStore } from '@stores'

import { bindHistoryDecodeCache, clearHistoryDecodeCache } from './historyDecodeCache'
import { cancelDeepLinkWalk } from './statelessMessageHandlers'

export function resetHistorySessionForMount(): void {
  const state = useStore.getState()
  cancelDeepLinkWalk()
  bindHistoryDecodeCache(state.settings.metadata?.documentId)
  state.setActiveHistory(null)
  state.setPendingWatchVersion(null)
  state.setHistoryList([])
  state.setProfiles({})
  state.setClientAuthors([])
  state.setSilentListRefresh(false)
  state.setHistoryHasMore(false)
  state.setHistoryNextBefore(null)
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
