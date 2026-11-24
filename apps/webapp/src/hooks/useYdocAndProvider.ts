import { HocuspocusProvider } from '@hocuspocus/provider'
import { authStore, useStore } from '@stores'
import { applyAccessStateless } from '@utils/applyAccessStateless'
import { captureCollabIssueOnce, captureMessageOnce } from '@utils/observability'
import { isProviderDisconnected } from '@utils/providerCollabStatus'
import { supabaseClient } from '@utils/supabase'
import { onDocTitleStateless } from '@utils/titleWrite'
import { useCallback, useEffect, useRef } from 'react'
import { IndexeddbPersistence, storeState } from 'y-indexeddb'
import * as Y from 'yjs'

import {
  AUTH_REARM_DELAY_MS,
  authFailureToProviderStatus,
  DISCONNECT_ERROR_GRACE_MS,
  FIRST_SYNC_TIMEOUT_MS,
  hasUnpushedLocalState,
  isDocumentAccessReadOnly,
  isSelfHealingCloseCode,
  parseIncomingSyncStep,
  resolveAuthFailure,
  resolveUnsyncedChangesAction,
  shouldFireFirstSyncTimeout,
  shouldRestoreSavedOnReconnect,
  SYNCED_SETTLE_DELAY_MS
} from './collabSession'
import { guardProviderAwareness } from './guardProviderAwareness'

/**
 * Collab provider status. The saving → synced → saved ladder covers local
 * edits, in-memory sync, and DB persist. Terminal: offline, error,
 * unauthenticated. Self-healing disconnects defer error by DISCONNECT_ERROR_GRACE_MS.
 */

type DeviceType = 'desktop' | 'mobile' | 'tablet'

let persistRequested = false

// Keeps the mirror merge out of the load frames.
const MIRROR_COMPACT_DELAY_MS = 2000

// Asked on the first local edit, not on open, so readers never see Firefox's
// permission prompt. persisted() first stops a second ask once granted.
const requestPersistentStorage = () => {
  if (persistRequested) return
  persistRequested = true
  const storage = navigator.storage
  if (typeof storage?.persist !== 'function' || typeof storage.persisted !== 'function') return
  void storage
    .persisted()
    .then((granted) => granted || storage.persist())
    .catch(() => {})
}

interface UseYdocAndProviderProps {
  documentId: string
  slug: string
  deviceType?: DeviceType
}

const useYdocAndProvider = ({
  documentId,
  slug,
  deviceType = 'desktop'
}: UseYdocAndProviderProps): void => {
  const ydocRef = useRef(new Y.Doc())
  const ydocDocumentIdRef = useRef<string | null>(null)
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const persistenceRef = useRef<IndexeddbPersistence | null>(null)
  const isSyncedRef = useRef(false)
  const hasPendingLocalEditsRef = useRef(false)
  const lastUnsyncedCountRef = useRef(0)
  const pendingServerSVRef = useRef<Uint8Array | null>(null)
  const syncedTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const authStoppedRef = useRef(false)
  const authRearmTimerRef = useRef<NodeJS.Timeout | null>(null)
  const authRearmCountRef = useRef(0)
  // The server decides readOnly once, inside onAuthenticate. A visitor who signs
  // in on a live anonymous socket therefore keeps anonymous scope until it reopens.
  const connectedWithSessionRef = useRef(false)
  const rescopePendingRef = useRef(false)
  const errorGraceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const collabReportedRef = useRef(new Set<string>())
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  const clearSyncedTimeout = useCallback(() => {
    if (syncedTimeoutRef.current) {
      clearTimeout(syncedTimeoutRef.current)
      syncedTimeoutRef.current = null
    }
  }, [])

  const isReadOnlyConnection = useCallback(
    () =>
      providerRef.current?.authorizedScope === 'readonly' ||
      isDocumentAccessReadOnly(useStore.getState().settings, authStore.getState().profile?.id),
    []
  )

  useEffect(() => {
    const providerUrl = process.env.NEXT_PUBLIC_PROVIDER_URL
    if (!providerUrl) {
      console.error('NEXT_PUBLIC_PROVIDER_URL not set')
      throw new Error('NEXT_PUBLIC_PROVIDER_URL not set')
    }

    if (ydocDocumentIdRef.current && ydocDocumentIdRef.current !== documentId) {
      ydocRef.current = new Y.Doc()
    }
    ydocDocumentIdRef.current = documentId

    // Local mirror of every Y update: content typed just before a reload survives
    // a wedged persistence worker and re-syncs on reconnect. Cached doc bytes are
    // readable by later users of this browser profile — accepted trade-off.
    const persistence =
      typeof window.indexedDB !== 'undefined'
        ? new IndexeddbPersistence(documentId, ydocRef.current)
        : null
    persistenceRef.current = persistence

    // The y-indexeddb patch (#751) reports failed writes as an 'error' event. Only a failed
    // update write means edits stop reaching the mirror. A full disk shows only as a commit
    // abort (QuotaExceededError in Chromium). `_db` is the only handle for a failed open.
    let mirrorDisposed = false
    const flagMirrorFailed = () => {
      if (!mirrorDisposed) setWorkspaceSetting('mirrorWriteFailed', true)
    }
    persistence?._db
      .then((db) =>
        db.addEventListener('abort', (event) => {
          const error = (event.target as IDBTransaction | null)?.error
          if (error?.name === 'QuotaExceededError') flagMirrorFailed()
        })
      )
      .catch(flagMirrorFailed)
    persistence?.on('error', (err: unknown, kind: 'update' | 'load' | 'compact') => {
      if (kind === 'update') flagMirrorFailed()
      captureMessageOnce(`idb:${kind}`, `idb:${kind}`, {
        level: 'warning',
        tags: { surface: 'offline-mirror' },
        extra: { detail: err instanceof Error ? err.message : String(err) }
      })
    })

    // y-indexeddb adds a full doc copy on each load and trims only past 500 rows, so the
    // replay grew by about 10 ms per reload of a large pad (#638). Merge to one row once
    // per mount, after first sync, with y-indexeddb's own trim.
    let mirrorCompactArmed = false
    const compactMirror = () => {
      if (!persistence || mirrorCompactArmed) return
      mirrorCompactArmed = true
      void persistence.whenSynced.then(() =>
        setTimeout(() => {
          if (mirrorDisposed || persistence._destroyed || persistence._dbsize <= 1) return
          storeState(persistence).catch((err) => persistence.emit('error', [err, 'compact']))
        }, MIRROR_COMPACT_DELAY_MS)
      )
    }

    providerRef.current = new HocuspocusProvider({
      url: providerUrl,
      name: documentId,
      document: ydocRef.current,
      token: async () => {
        let { data, error } = await supabaseClient.auth.getSession()
        if (error) ({ data, error } = await supabaseClient.auth.getSession())
        if (error)
          console.debug(
            'WS token: getSession() failed twice, connecting anonymously',
            error.message
          )
        connectedWithSessionRef.current = Boolean(data.session?.user)
        return JSON.stringify({
          accessToken: data.session?.access_token ?? '',
          slug,
          deviceType
        })
      },
      onAuthenticationFailed: async ({ reason }) => {
        console.warn('WS authentication failed:', reason)
        authStoppedRef.current = true
        pendingServerSVRef.current = null
        clearSyncedTimeout()
        providerRef.current?.disconnect()

        const { data } = await supabaseClient.auth.getSession()
        if (ydocDocumentIdRef.current !== documentId) return

        const resolution = resolveAuthFailure({
          hasSession: Boolean(data.session),
          rearmCount: authRearmCountRef.current
        })

        if (resolution === 'rearm') {
          authRearmCountRef.current += 1
          if (authRearmTimerRef.current) clearTimeout(authRearmTimerRef.current)
          authRearmTimerRef.current = setTimeout(
            () => providerRef.current?.connect(),
            AUTH_REARM_DELAY_MS
          )
          return
        }

        setWorkspaceSetting('providerStatus', authFailureToProviderStatus(resolution))
        captureCollabIssueOnce(collabReportedRef.current, documentId, slug, 'auth-failed', {
          reason
        })
      },
      onSynced: (data) => {
        isSyncedRef.current = true
        authStoppedRef.current = false
        authRearmCountRef.current = 0
        if (errorGraceTimerRef.current) clearTimeout(errorGraceTimerRef.current)
        clearSyncedTimeout()

        if (
          !isReadOnlyConnection() &&
          hasPendingLocalEditsRef.current &&
          providerRef.current?.hasUnsyncedChanges
        ) {
          setWorkspaceSetting('providerStatus', 'saving')
        } else {
          hasPendingLocalEditsRef.current = false
          setWorkspaceSetting('providerStatus', 'saved')
        }
        lastUnsyncedCountRef.current = providerRef.current?.unsyncedChanges ?? 0

        if (data?.state) {
          setWorkspaceEditorSetting('providerSyncing', false)
          compactMirror()
        }

        if (data?.state && !useStore.getState().settings.hocuspocusProvider) {
          setWorkspaceSetting('hocuspocusProvider', providerRef.current)
        }
      },
      onDisconnect: (data) => {
        isSyncedRef.current = false
        lastUnsyncedCountRef.current = 0
        pendingServerSVRef.current = null
        clearSyncedTimeout()

        // Reconnect from here, not back-to-back with disconnect(): connect()
        // early-returns while the status is still Connected, which would strand
        // the editor offline. Returning skips the status writes, so this
        // deliberate close cannot arm a false 'error' timer.
        if (rescopePendingRef.current) {
          rescopePendingRef.current = false
          providerRef.current?.connect()
          return
        }

        if (authStoppedRef.current) return

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setWorkspaceSetting('providerStatus', 'offline')
        } else if (data.event?.code && data.event.code !== 1000) {
          const closeCode = data.event.code
          if (isSelfHealingCloseCode(closeCode)) {
            if (errorGraceTimerRef.current) clearTimeout(errorGraceTimerRef.current)
            errorGraceTimerRef.current = setTimeout(() => {
              setWorkspaceSetting('providerStatus', 'error')
            }, DISCONNECT_ERROR_GRACE_MS)
          } else {
            setWorkspaceSetting('providerStatus', 'error')
            captureCollabIssueOnce(
              collabReportedRef.current,
              documentId,
              slug,
              'disconnect',
              { closeCode },
              'warning'
            )
          }
        }
      },
      onStateless: ({ payload }) => {
        try {
          const data = JSON.parse(payload)

          if (data.msg === 'document:saved' && data.documentId === documentId) {
            console.info('📝 Document saved to DB:', data)
            const current = useStore.getState().settings.providerStatus
            if (isProviderDisconnected(current) || authStoppedRef.current) return
            if (!isReadOnlyConnection() && providerRef.current?.hasUnsyncedChanges) return
            hasPendingLocalEditsRef.current = false
            clearSyncedTimeout()
            setWorkspaceSetting('providerStatus', 'saved')
            return
          }

          if (data.type === 'docTitle') {
            onDocTitleStateless()
            return
          }

          // applyAccessStateless owns the list of access types and ignores the rest.
          if (typeof data.type === 'string') {
            applyAccessStateless({
              documentId,
              slug,
              data,
              stopReconnect: () => {
                authStoppedRef.current = true
              },
              destroyProvider: () => {
                providerRef.current?.destroy()
                providerRef.current = null
              }
            })
            if (data.type === 'readOnly' && isReadOnlyConnection()) {
              hasPendingLocalEditsRef.current = false
              const status = useStore.getState().settings.providerStatus
              if (status === 'saving' || status === 'synced') {
                clearSyncedTimeout()
                setWorkspaceSetting('providerStatus', 'saved')
              }
            }
          }
        } catch {
          // Ignore malformed payloads
        }
      },
      onUnsyncedChanges: ({ number }) => {
        const previousUnsyncedCount = lastUnsyncedCountRef.current
        lastUnsyncedCountRef.current = number
        const currentStatus = useStore.getState().settings.providerStatus
        if (
          number === 0 &&
          isSyncedRef.current &&
          !authStoppedRef.current &&
          !isProviderDisconnected(currentStatus)
        ) {
          hasPendingLocalEditsRef.current = false
        }
        const action = resolveUnsyncedChangesAction({
          unsyncedCount: number,
          previousUnsyncedCount,
          isSynced: isSyncedRef.current,
          authStopped: authStoppedRef.current,
          isReadOnly: isReadOnlyConnection(),
          currentStatus
        })

        if (action.type === 'ignore') {
          clearSyncedTimeout()
          return
        }

        if (action.type === 'saving') {
          clearSyncedTimeout()
          setWorkspaceSetting('providerStatus', 'saving')
          return
        }

        clearSyncedTimeout()
        syncedTimeoutRef.current = setTimeout(() => {
          syncedTimeoutRef.current = null
          const latest = useStore.getState().settings.providerStatus
          if (
            latest === 'saving' &&
            isSyncedRef.current &&
            !authStoppedRef.current &&
            !isReadOnlyConnection() &&
            !providerRef.current?.hasUnsyncedChanges
          ) {
            setWorkspaceSetting('providerStatus', 'synced')
          }
        }, SYNCED_SETTLE_DELAY_MS)
      },
      onDestroy: () => {
        clearSyncedTimeout()
        hasPendingLocalEditsRef.current = false
        lastUnsyncedCountRef.current = 0
        pendingServerSVRef.current = null
        setWorkspaceSetting('providerStatus', 'saved')
        setWorkspaceEditorSetting('loading', true)
        setWorkspaceEditorSetting('providerSyncing', true)
        setWorkspaceSetting('hocuspocusProvider', null)
      },
      ...{ autoConnect: false }
    })
    const provider = providerRef.current
    guardProviderAwareness(provider)

    const handleProviderMessage = ({ event }: { event?: { data?: unknown } }) => {
      try {
        const parsed = parseIncomingSyncStep(event?.data)
        if (!parsed) return
        if (parsed.syncType === 0) {
          pendingServerSVRef.current = parsed.payload
        } else if (pendingServerSVRef.current) {
          const serverSV = pendingServerSVRef.current
          pendingServerSVRef.current = null
          if (
            !isReadOnlyConnection() &&
            !hasPendingLocalEditsRef.current &&
            hasUnpushedLocalState(ydocRef.current, serverSV, parsed.payload)
          ) {
            hasPendingLocalEditsRef.current = true
          }
        }
      } catch {
        pendingServerSVRef.current = null
      }
    }
    provider.on('message', handleProviderMessage)

    setWorkspaceSetting('hocuspocusProvider', provider)

    const connectTimer = setTimeout(() => providerRef.current?.connect(), 0)
    const collabReported = collabReportedRef.current

    const reconnect = () => {
      if (authStoppedRef.current) return
      const { providerStatus: current } = useStore.getState().settings
      if (shouldRestoreSavedOnReconnect(isSyncedRef.current, current)) {
        if (!isReadOnlyConnection() && hasPendingLocalEditsRef.current) {
          if (providerRef.current?.hasUnsyncedChanges) {
            setWorkspaceSetting('providerStatus', 'saving')
          } else {
            hasPendingLocalEditsRef.current = false
            setWorkspaceSetting('providerStatus', 'synced')
          }
        } else {
          hasPendingLocalEditsRef.current = false
          setWorkspaceSetting('providerStatus', 'saved')
        }
      }
      providerRef.current?.connect()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reconnect()
    }
    window.addEventListener('online', reconnect)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearSyncedTimeout()
      persistence?.destroy()
      persistenceRef.current = null
      mirrorDisposed = true
      setWorkspaceSetting('mirrorWriteFailed', false)
      clearTimeout(connectTimer)
      window.removeEventListener('online', reconnect)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (authRearmTimerRef.current) clearTimeout(authRearmTimerRef.current)
      if (errorGraceTimerRef.current) clearTimeout(errorGraceTimerRef.current)
      provider.off('message', handleProviderMessage)
      providerRef.current?.destroy()
      providerRef.current = null
      isSyncedRef.current = false
      hasPendingLocalEditsRef.current = false
      lastUnsyncedCountRef.current = 0
      pendingServerSVRef.current = null
      authStoppedRef.current = false
      authRearmCountRef.current = 0
      connectedWithSessionRef.current = false
      rescopePendingRef.current = false
      collabReported.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  useEffect(() => {
    const { data } = supabaseClient.auth.onAuthStateChange((event) => {
      if (event !== 'TOKEN_REFRESHED' && event !== 'SIGNED_IN') return

      if (authStoppedRef.current) {
        authRearmCountRef.current = 0
        providerRef.current?.connect()
        return
      }

      // A healthy socket opened anonymously must reopen to pick up the new scope.
      if (event === 'SIGNED_IN' && !connectedWithSessionRef.current) {
        rescopePendingRef.current = true
        providerRef.current?.disconnect()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const deadline = setTimeout(() => {
      const { providerStatus: current } = useStore.getState().settings
      if (shouldFireFirstSyncTimeout(isSyncedRef.current, current)) {
        setWorkspaceSetting('providerStatus', 'error')
        captureCollabIssueOnce(collabReportedRef.current, documentId, slug, 'first-sync-timeout', {
          timeoutMs: FIRST_SYNC_TIMEOUT_MS
        })
      }
    }, FIRST_SYNC_TIMEOUT_MS)
    return () => clearTimeout(deadline)
  }, [documentId, setWorkspaceSetting, slug])

  useEffect(() => {
    const ydoc = ydocRef.current

    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === providerRef.current) return
      const isInitialMirrorReplay =
        persistenceRef.current !== null && origin === persistenceRef.current && !isSyncedRef.current
      if (!isInitialMirrorReplay && !isReadOnlyConnection()) {
        hasPendingLocalEditsRef.current = true
      }
      // Past first sync, so mirror replay and the mount scaffold never ask, but an
      // offline edit does. providerSyncing stays false through a disconnect.
      if (!useStore.getState().settings.editor.providerSyncing) requestPersistentStorage()
    }

    ydoc.on('update', handleUpdate)

    return () => {
      ydoc.off('update', handleUpdate)
    }
  }, [documentId, isReadOnlyConnection])

  useEffect(() => {
    const handleOffline = () => {
      console.info('Browser is offline')
      clearSyncedTimeout()
      setWorkspaceSetting('providerStatus', 'offline')
    }

    window.addEventListener('offline', handleOffline)
    return () => window.removeEventListener('offline', handleOffline)
  }, [clearSyncedTimeout, setWorkspaceSetting])
}

export default useYdocAndProvider
