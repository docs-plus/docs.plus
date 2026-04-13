import { sendHistoryListRequest } from '@components/pages/history/historyStatelessWire'
import { useStore } from '@stores'
import { useCallback } from 'react'

export const useDocumentHistory = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const setLoadingHistory = useStore((state) => state.setLoadingHistory)

  const fetchHistory = useCallback(() => {
    if (!hocuspocusProvider) return
    setLoadingHistory(true)
    sendHistoryListRequest(hocuspocusProvider, documentId)
  }, [hocuspocusProvider, documentId, setLoadingHistory])

  return { fetchHistory }
}
