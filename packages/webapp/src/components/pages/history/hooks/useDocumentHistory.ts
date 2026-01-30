import { useStore } from '@stores'
import { useCallback } from 'react'

export const useDocumentHistory = () => {
  const {
    hocuspocusProvider,
    metadata: { documentId }
  } = useStore((state) => state.settings)

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
