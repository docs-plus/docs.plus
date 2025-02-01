import { useCallback } from 'react'
import { useStore } from '@stores'

export const useVersionContent = (
  setCurrentVersion: (version: number) => void,
  setIsLoading: (loading: boolean) => void
) => {
  const {
    hocuspocusProvider,
    metadata: { documentId }
  } = useStore((state) => state.settings)

  const watchVersionContent = useCallback(
    (version: number) => {
      if (!hocuspocusProvider) return

      setCurrentVersion(version)
      setIsLoading(true)

      hocuspocusProvider.sendStateless(
        JSON.stringify({
          msg: 'history',
          type: 'history.watch',
          version,
          documentId: documentId
        })
      )
    },
    [hocuspocusProvider, documentId, setCurrentVersion, setIsLoading]
  )

  return { watchVersionContent }
}
