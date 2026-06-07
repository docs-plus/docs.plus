import { useStore } from '@stores'
import { useEffect, useLayoutEffect } from 'react'

import { useDocumentHistory } from './useDocumentHistory'
import { useHistoryEditorApplyWhenReady } from './useHistoryEditorApplyWhenReady'
import { useStatelessMessage } from './useStatelessMessage'

export const useHocuspocusStateless = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const { handleStatelessMessage } = useStatelessMessage()
  const { fetchHistory } = useDocumentHistory()

  useHistoryEditorApplyWhenReady()

  /** Zustand history slice survives leaving `#history`; clear before paint so the sidebar never flashes the prior session. */
  useLayoutEffect(() => {
    const { setActiveHistory, setPendingWatchVersion, setHistoryList, setLoadingHistory } =
      useStore.getState()
    setActiveHistory(null)
    setPendingWatchVersion(null)
    setHistoryList([])
    setLoadingHistory(true)
  }, [hocuspocusProvider, documentId])

  useEffect(() => {
    if (!hocuspocusProvider) return
    hocuspocusProvider.on('stateless', handleStatelessMessage)
    fetchHistory()

    return () => {
      hocuspocusProvider.off('stateless', handleStatelessMessage)
    }
  }, [hocuspocusProvider, handleStatelessMessage, fetchHistory])
}
