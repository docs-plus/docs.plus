import { sendHistoryListRequest } from '@components/pages/history/historyStatelessWire'
import { useStore } from '@stores'
import { useCallback } from 'react'

export const useDocumentHistory = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const setLoadingHistory = useStore((state) => state.setLoadingHistory)
  const setSilentListRefresh = useStore((state) => state.setSilentListRefresh)
  const setPendingOlderBefore = useStore((state) => state.setPendingOlderBefore)

  const fetchHistory = useCallback(() => {
    if (!hocuspocusProvider) return
    // A silent reply that never landed would latch the flag and make this foreground
    // list return early without hydrating — spinner up, nothing behind it.
    setSilentListRefresh(false)
    setLoadingHistory(true)
    sendHistoryListRequest(hocuspocusProvider, documentId, {
      since: useStore.getState().pendingCompareSince
    })
  }, [hocuspocusProvider, documentId, setLoadingHistory, setSilentListRefresh])

  const fetchOlderHistory = useCallback(() => {
    if (!hocuspocusProvider) return
    const { historyNextBefore: beforeVersion, pendingOlderBefore } = useStore.getState()
    // One older page at a time: a second press would trip the list cooldown.
    if (beforeVersion == null || pendingOlderBefore != null) return
    setPendingOlderBefore(beforeVersion)
    sendHistoryListRequest(hocuspocusProvider, documentId, { beforeVersion })
  }, [hocuspocusProvider, documentId, setPendingOlderBefore])

  return { fetchHistory, fetchOlderHistory }
}
