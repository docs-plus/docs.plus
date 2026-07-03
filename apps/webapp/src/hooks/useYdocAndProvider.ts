import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
import {
  AUTH_REARM_DELAY_MS,
  authFailureToProviderStatus,
  DISCONNECT_ERROR_GRACE_MS,
  FIRST_SYNC_TIMEOUT_MS,
  isSelfHealingCloseCode,
  resolveAuthFailure,
  shouldFireFirstSyncTimeout,
  shouldRestoreSavedOnReconnect
} from '@utils/collabProviderLifecycle'
import { captureCollabIssueOnce } from '@utils/observability'
import { supabaseClient } from '@utils/supabase'
import { useEffect, useRef } from 'react'
import * as Y from 'yjs'

/**
 * Collab provider status (store.settings.providerStatus):
 * saving → synced → saved (local edits, in-memory sync, DB persistence).
 * Terminal branches: offline, error, unauthenticated (auth-stop + no session).
 * Self-healing disconnects defer 'error' behind DISCONNECT_ERROR_GRACE_MS.
 */

type DeviceType = 'desktop' | 'mobile' | 'tablet'

interface UseYdocAndProviderProps {
  documentId: string
  slug: string
  accessToken: string
  deviceType?: DeviceType
}

const useYdocAndProvider = ({
  documentId,
  slug,
  accessToken,
  deviceType = 'desktop'
}: UseYdocAndProviderProps): void => {
  const ydocRef = useRef(new Y.Doc())
  const ydocDocumentIdRef = useRef<string | null>(null)
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const isSyncedRef = useRef(false)
  const syncedTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const authStoppedRef = useRef(false)
  const authRearmTimerRef = useRef<NodeJS.Timeout | null>(null)
  const authRearmCountRef = useRef(0)
  const errorGraceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const collabReportedRef = useRef(new Set<string>())
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

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
        return JSON.stringify({
          accessToken: data.session?.access_token ?? (error ? '' : (accessToken ?? '')),
          slug,
          deviceType
        })
      },
      onAuthenticationFailed: async ({ reason }) => {
        console.warn('WS authentication failed:', reason)
        authStoppedRef.current = true
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

        setWorkspaceSetting('providerStatus', 'saved')

        if (data?.state) setWorkspaceEditorSetting('providerSyncing', false)

        if (data?.state && !useStore.getState().settings.hocuspocusProvider) {
          setWorkspaceSetting('hocuspocusProvider', providerRef.current)
        }
      },
      onDisconnect: (data) => {
        isSyncedRef.current = false

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
            setWorkspaceSetting('providerStatus', 'saved')
          }
        } catch {
          // Ignore malformed payloads
        }
      },
      onDestroy: () => {
        setWorkspaceSetting('providerStatus', 'saved')
        setWorkspaceEditorSetting('loading', true)
        setWorkspaceEditorSetting('providerSyncing', true)
        setWorkspaceSetting('hocuspocusProvider', null)
        setWorkspaceEditorSetting('presentUsers', [])
      },
      ...{ autoConnect: false }
    })

    setWorkspaceSetting('hocuspocusProvider', providerRef.current)

    const connectTimer = setTimeout(() => providerRef.current?.connect(), 0)
    const collabReported = collabReportedRef.current

    const reconnect = () => {
      if (authStoppedRef.current) return
      const { providerStatus: current } = useStore.getState().settings
      if (shouldRestoreSavedOnReconnect(isSyncedRef.current, current)) {
        setWorkspaceSetting('providerStatus', 'saved')
      }
      providerRef.current?.connect()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reconnect()
    }
    window.addEventListener('online', reconnect)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearTimeout(connectTimer)
      window.removeEventListener('online', reconnect)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (authRearmTimerRef.current) clearTimeout(authRearmTimerRef.current)
      if (errorGraceTimerRef.current) clearTimeout(errorGraceTimerRef.current)
      providerRef.current?.destroy()
      providerRef.current = null
      isSyncedRef.current = false
      authStoppedRef.current = false
      authRearmCountRef.current = 0
      collabReported.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  useEffect(() => {
    const { data } = supabaseClient.auth.onAuthStateChange((event) => {
      if (event !== 'TOKEN_REFRESHED' && event !== 'SIGNED_IN') return
      if (!authStoppedRef.current) return
      authRearmCountRef.current = 0
      providerRef.current?.connect()
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
      if (!isSyncedRef.current) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      if (authStoppedRef.current) return

      if (syncedTimeoutRef.current) {
        clearTimeout(syncedTimeoutRef.current)
      }

      setWorkspaceSetting('providerStatus', 'saving')

      syncedTimeoutRef.current = setTimeout(() => {
        const { providerStatus: current } = useStore.getState().settings
        if (current === 'saving') {
          setWorkspaceSetting('providerStatus', 'synced')
        }
      }, 300)
    }

    ydoc.on('update', handleUpdate)

    return () => {
      ydoc.off('update', handleUpdate)
      if (syncedTimeoutRef.current) {
        clearTimeout(syncedTimeoutRef.current)
      }
    }
  }, [setWorkspaceSetting, documentId])

  useEffect(() => {
    const handleOffline = () => {
      console.info('Browser is offline')
      setWorkspaceSetting('providerStatus', 'offline')
    }

    window.addEventListener('offline', handleOffline)
    return () => window.removeEventListener('offline', handleOffline)
  }, [setWorkspaceSetting])
}

export default useYdocAndProvider
