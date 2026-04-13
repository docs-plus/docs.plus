import { replaceHistoryHashVersion } from '@components/pages/history/historyShareUrl'
import { sendHistoryWatchRequest } from '@components/pages/history/historyStatelessWire'
import { useStore } from '@stores'
import { useCallback } from 'react'

export type WatchVersionContentOptions = {
  /** When false, keep `#history` without `?version=` (initial plain history load). */
  updateUrl?: boolean
}

export const useVersionContent = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)

  const setLoadingHistory = useStore((state) => state.setLoadingHistory)
  const setPendingWatchVersion = useStore((state) => state.setPendingWatchVersion)

  const watchVersionContent = useCallback(
    (version: number, options: WatchVersionContentOptions = {}) => {
      if (!hocuspocusProvider) return

      const { updateUrl = true } = options
      setPendingWatchVersion(version)
      setLoadingHistory(true)
      if (updateUrl) {
        replaceHistoryHashVersion(version)
      }

      sendHistoryWatchRequest(hocuspocusProvider, version, documentId)
    },
    [hocuspocusProvider, documentId, setLoadingHistory, setPendingWatchVersion]
  )

  return { watchVersionContent }
}
