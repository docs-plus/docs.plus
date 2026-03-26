import { useStore } from '@stores'
import { useCallback } from 'react'

export const useDocumentHistory = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)

  const fetchHistory = useCallback(() => {
    if (!hocuspocusProvider) return
    hocuspocusProvider.sendStateless(
      JSON.stringify({
        msg: 'history',
        type: 'history.list',
        documentId: documentId
      })
    )
  }, [hocuspocusProvider, documentId])

  return { fetchHistory }
}
