import { useStore } from '@stores'
import { shouldShowSyncErrorWhileLoading } from '@utils/providerCollabStatus'
import { useLayoutEffect } from 'react'

import { resetHistorySessionForMount } from '../clearHistorySession'
import { useDocumentHistory } from './useDocumentHistory'
import { useHistoryEditorApplyWhenReady } from './useHistoryEditorApplyWhenReady'
import { useStatelessMessage } from './useStatelessMessage'

export const useHocuspocusStateless = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const providerStatus = useStore((state) => state.settings.providerStatus)
  const setLoadingHistory = useStore((state) => state.setLoadingHistory)
  const { handleStatelessMessage } = useStatelessMessage()
  const { fetchHistory } = useDocumentHistory()

  useHistoryEditorApplyWhenReady()

  useLayoutEffect(() => {
    resetHistorySessionForMount()
  }, [hocuspocusProvider, documentId])

  useLayoutEffect(() => {
    if (!providerSyncing) return
    if (!shouldShowSyncErrorWhileLoading(providerStatus)) return
    setLoadingHistory(false)
  }, [providerSyncing, providerStatus, setLoadingHistory])

  useLayoutEffect(() => {
    if (!hocuspocusProvider) return
    hocuspocusProvider.on('stateless', handleStatelessMessage)
    // A dropped socket loses the older-page reply, so free Show older for a retry.
    const clearPendingOlder = () => useStore.getState().setPendingOlderBefore(null)
    hocuspocusProvider.on('disconnect', clearPendingOlder)
    // StrictMode replays this effect in the same tick, and the server refuses a second
    // list inside its cooldown. Deferring lets the replay's cleanup cancel the first send.
    const listTimer = setTimeout(fetchHistory)

    return () => {
      clearTimeout(listTimer)
      hocuspocusProvider.off('stateless', handleStatelessMessage)
      hocuspocusProvider.off('disconnect', clearPendingOlder)
    }
  }, [hocuspocusProvider, handleStatelessMessage, fetchHistory])
}
