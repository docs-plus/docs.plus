import { sendHistoryRevertRequest } from '@components/pages/history/historyStatelessWire'
import * as toast from '@components/toast'
import { useAuthStore, useStore } from '@stores'
import { isProviderDisconnected } from '@utils/providerCollabStatus'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Matches the server's own version-op budget. A restore that has not answered by
 * then may still land, so the copy on expiry must not claim it failed.
 */
const RESTORE_TIMEOUT_MS = 30_000

export const useVersionRestore = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const providerStatus = useStore((state) => state.settings.providerStatus)
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const loadingHistory = useStore((state) => state.loadingHistory)
  const pendingWatchVersion = useStore((state) => state.pendingWatchVersion)
  const setLoadingHistory = useStore((state) => state.setLoadingHistory)
  const activeHistory = useStore((state) => state.activeHistory)
  const user = useAuthStore((state) => state.profile)

  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  // The ack and every refusal clear `loadingHistory`, so its falling edge is the
  // one signal that reaches this hook. The outcome itself is owned by the handler.
  useEffect(() => {
    if (!restoring || loadingHistory) return
    clearTimer()
    setRestoring(false)
  }, [restoring, loadingHistory, clearTimer])

  useEffect(() => clearTimer, [clearTimer])

  // `activeHistory` still names the PREVIOUS version while a watch is in flight.
  // Restoring here would replace the document for everyone with a version the reader
  // did not ask for. `canRestore` also keeps the 30s timeout from being cancelled by the
  // incoming watch clearing the shared `loadingHistory` flag.
  const canRestore = pendingWatchVersion == null && !restoring

  const requestRestore = useCallback(() => {
    if (!activeHistory?.version) return
    if (pendingWatchVersion != null) return
    if (!user) {
      toast.Error('Sign in to restore a version.')
      return
    }
    setRestoreOpen(true)
  }, [activeHistory?.version, pendingWatchVersion, user])

  const confirmRestore = useCallback(() => {
    if (!activeHistory?.version) return
    if (restoring) return

    // A frame sent on a closed socket is QUEUED by the provider and flushed on
    // reconnect. An unguarded click can therefore replace the document minutes later
    // against content that has moved on, with nobody watching.
    if (!hocuspocusProvider || isProviderDisconnected(providerStatus)) {
      toast.Error('You are not connected to this document. Reconnect, then try again.')
      return
    }

    // The server rewrites the live Y.Doc, so the restored text arrives over normal
    // y-sync. The ack handler owns the outcome and the exit from the history view.
    setRestoring(true)
    setLoadingHistory(true)
    sendHistoryRevertRequest(hocuspocusProvider, activeHistory.version, documentId)

    clearTimer()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setRestoring(false)
      setLoadingHistory(false)
      toast.Error(
        'We did not get an answer from the server. The restore may still have run. Go back to the document and check the text.'
      )
    }, RESTORE_TIMEOUT_MS)
  }, [
    activeHistory?.version,
    clearTimer,
    documentId,
    hocuspocusProvider,
    providerStatus,
    restoring,
    setLoadingHistory
  ])

  return { restoreOpen, setRestoreOpen, requestRestore, confirmRestore, restoring, canRestore }
}
