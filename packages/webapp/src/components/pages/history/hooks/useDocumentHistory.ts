import { useCallback } from 'react'
import { useStore } from '@stores'

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
