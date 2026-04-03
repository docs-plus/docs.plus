import { useStore } from '@stores'
import { useCallback } from 'react'

export const useVersionContent = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)

  const setLoadingHistory = useStore((state) => state.setLoadingHistory)
  const setPendingWatchVersion = useStore((state) => state.setPendingWatchVersion)

  const watchVersionContent = useCallback(
    (version: number) => {
      if (!hocuspocusProvider) return

      setPendingWatchVersion(version)
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
    [hocuspocusProvider, documentId, setLoadingHistory, setPendingWatchVersion]
  )

  return { watchVersionContent }
}
