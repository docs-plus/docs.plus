import { sendHistoryListRequest } from '@components/pages/history/historyStatelessWire'
import { useStore } from '@stores'
import { useCallback } from 'react'

export const useDocumentHistory = () => {
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const setLoadingHistory = useStore((state) => state.setLoadingHistory)
  const setSilentListRefresh = useStore((state) => state.setSilentListRefresh)

  const fetchHistory = useCallback(() => {
    const hocuspocusProvider = useStore.getState().settings.hocuspocusProvider
    if (!hocuspocusProvider) return
    // A silent reply that never landed would latch the flag and make this foreground
    // list return early without hydrating — spinner up, nothing behind it.
    setSilentListRefresh(false)
    setLoadingHistory(true)
    sendHistoryListRequest(hocuspocusProvider, documentId, {
      since: useStore.getState().pendingCompareSince
    })
  }, [documentId, setLoadingHistory, setSilentListRefresh])

  return { fetchHistory }
}
