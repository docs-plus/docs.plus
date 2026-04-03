import { useStore } from '@stores'
import { useCallback } from 'react'

export const useDocumentHistory = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const setLoadingHistory = useStore((state) => state.setLoadingHistory)

  const fetchHistory = useCallback(() => {
    if (!hocuspocusProvider) return
    setLoadingHistory(true)
    hocuspocusProvider.sendStateless(
      JSON.stringify({
        msg: 'history',
        type: 'history.list',
        documentId: documentId
      })
    )
  }, [hocuspocusProvider, documentId, setLoadingHistory])

  return { fetchHistory }
}
