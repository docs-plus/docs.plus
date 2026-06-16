import { useStore } from '@stores'
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
    if (providerStatus !== 'error' && providerStatus !== 'offline') return
    setLoadingHistory(false)
  }, [providerSyncing, providerStatus, setLoadingHistory])

  useLayoutEffect(() => {
    if (!hocuspocusProvider) return
    hocuspocusProvider.on('stateless', handleStatelessMessage)
    fetchHistory()

    return () => {
      hocuspocusProvider.off('stateless', handleStatelessMessage)
    }
  }, [hocuspocusProvider, handleStatelessMessage, fetchHistory])
}
