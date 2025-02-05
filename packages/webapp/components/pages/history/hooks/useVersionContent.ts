import { useCallback } from 'react'
import { useStore } from '@stores'

export const useVersionContent = () => {
  const {
    hocuspocusProvider,
    metadata: { documentId }
  } = useStore((state) => state.settings)

  const { setLoadingHistory } = useStore((state) => state)

  const watchVersionContent = useCallback(
    (version: number) => {
      if (!hocuspocusProvider) return

      setLoadingHistory(true)

      hocuspocusProvider.sendStateless(
        JSON.stringify({
          msg: 'history',
          type: 'history.watch',
          version,
          documentId: documentId
        })
      )
    },
    [hocuspocusProvider, documentId]
  )

  return { watchVersionContent }
}
