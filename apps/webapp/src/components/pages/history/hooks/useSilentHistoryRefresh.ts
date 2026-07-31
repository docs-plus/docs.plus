import { sendHistoryListRequest } from '@components/pages/history/historyStatelessWire'
import { useStore } from '@stores'
import { useCallback, useEffect, useRef } from 'react'

/** Every collaborator autosave broadcasts, so an undebounced re-list is a background loop. */
const SILENT_REFRESH_DEBOUNCE_MS = 2000

export const useSilentHistoryRefresh = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const setSilentListRefresh = useStore((state) => state.setSilentListRefresh)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const requestSilentListRefresh = useCallback(() => {
    if (!hocuspocusProvider) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      // Re-checked at fire time, not at schedule time: two seconds is long enough for
      // the reader to open a version or enter compare.
      const state = useStore.getState()
      if (state.silentListRefresh) return
      if (state.loadingHistory) return
      if (state.pendingWatchVersion != null) return
      if (state.pendingCompareVersion != null) return

      setSilentListRefresh(true)
      sendHistoryListRequest(hocuspocusProvider, documentId)
    }, SILENT_REFRESH_DEBOUNCE_MS)
  }, [hocuspocusProvider, documentId, setSilentListRefresh])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  return { requestSilentListRefresh }
}
