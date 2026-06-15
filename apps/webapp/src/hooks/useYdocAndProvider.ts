import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
import { useEffect, useRef } from 'react'
import * as Y from 'yjs'

/**
 * Provider Status Flow (Single Source of Truth):
 *
 * 1. User types → "saving" (changes being sent to server)
 * 2. Server receives → "synced" (in server memory, visible to other users)
 * 3. Server persists to DB → "saved" (durably stored, survives restart)
 *
 * The server debounces DB writes (10s), but syncs to memory immediately.
 * We only show "saved" when we get actual confirmation from the server.
 */

type DeviceType = 'desktop' | 'mobile' | 'tablet'

const FIRST_SYNC_TIMEOUT_MS = 15_000

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
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  useEffect(() => {
    const providerUrl = process.env.NEXT_PUBLIC_PROVIDER_URL
    if (!providerUrl) {
      console.error('NEXT_PUBLIC_PROVIDER_URL not set')
      throw new Error('NEXT_PUBLIC_PROVIDER_URL not set')
    }

    // Doc switch: the previous Y.Doc still holds the old document's content and
    // metadata (incl. needsInitialization=false) and would merge it into the new
    // room on sync — the new provider must wrap a clean doc.
    if (ydocDocumentIdRef.current && ydocDocumentIdRef.current !== documentId) {
      ydocRef.current = new Y.Doc()
    }
    ydocDocumentIdRef.current = documentId

    providerRef.current = new HocuspocusProvider({
      url: providerUrl,
      name: documentId,
      document: ydocRef.current,
      token: JSON.stringify({ accessToken: accessToken || '', slug: slug, deviceType }),
      onSynced: (data) => {
        console.info('++onSynced', data)
        isSyncedRef.current = true

        // Initial sync complete - document loaded from server (already saved)
        setWorkspaceSetting('providerStatus', 'saved')

        if (data?.state) setWorkspaceEditorSetting('providerSyncing', false)

        // in case of renew provider, set the provider to the store
        // (live store read — the effect closure can hold a stale value across doc switches)
        if (data?.state && !useStore.getState().settings.hocuspocusProvider) {
          setWorkspaceSetting('hocuspocusProvider', providerRef.current)
        }
      },
      onDisconnect: (data) => {
        isSyncedRef.current = false

        // Check if browser is offline
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setWorkspaceSetting('providerStatus', 'offline')
        } else if (data.event?.code && data.event.code !== 1000) {
          // Non-normal closure, show error
          setWorkspaceSetting('providerStatus', 'error')
        }
      },
      onStateless: ({ payload }) => {
        try {
          const data = JSON.parse(payload)

          // Listen for save confirmations from server (real DB persistence)
          // This is the ONLY place where we set "saved" - Single Source of Truth
          if (data.msg === 'document:saved' && data.documentId === documentId) {
            console.info('📝 Document saved to DB:', data)
            setWorkspaceSetting('providerStatus', 'saved')
          }
        } catch {
          // Ignore malformed payloads
        }
      },
      onDestroy: () => {
        console.info('destroy provider')
        setWorkspaceSetting('providerStatus', 'saved')
        setWorkspaceEditorSetting('loading', true)
        setWorkspaceEditorSetting('providerSyncing', true)
        setWorkspaceEditorSetting('applyingFilters', false)
        setWorkspaceSetting('hocuspocusProvider', null)
        setWorkspaceEditorSetting('presentUsers', [])
      }
    })

    // Unconditional + idempotent: the store value here is either null (fresh
    // mount / post-destroy) or this same provider; a closure-guarded set goes
    // stale across doc switches and strands the page on the skeleton.
    setWorkspaceSetting('hocuspocusProvider', providerRef.current)

    return () => {
      providerRef.current?.destroy()
      // Without these, the next documentId's effect would see a truthy ref to a
      // destroyed provider and skip recreation, and its watchdog would see the
      // old doc's synced=true.
      providerRef.current = null
      isSyncedRef.current = false
    }
    // slug/accessToken/deviceType are connection metadata — only a documentId
    // change warrants a provider rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  // First-sync watchdog per document: a created-but-never-syncing provider would
  // otherwise leave the shell on bones forever. Keep an accurate 'offline' as is.
  useEffect(() => {
    const deadline = setTimeout(() => {
      const { providerStatus: current } = useStore.getState().settings
      if (!isSyncedRef.current && current !== 'offline') {
        setWorkspaceSetting('providerStatus', 'error')
      }
    }, FIRST_SYNC_TIMEOUT_MS)
    return () => clearTimeout(deadline)
  }, [documentId, setWorkspaceSetting])

  // Track Y.Doc updates for sync state (local changes only)
  useEffect(() => {
    const ydoc = ydocRef.current

    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      // Only track local updates, ignore remote updates from provider
      if (origin === providerRef.current) return

      // Don't change state if browser is offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }

      // Clear any pending timeout
      if (syncedTimeoutRef.current) {
        clearTimeout(syncedTimeoutRef.current)
      }

      // Show "saving" immediately - changes are being sent to server
      setWorkspaceSetting('providerStatus', 'saving')

      // After 300ms of no updates, show "synced" (WebSocket is real-time, ~50-100ms latency)
      // This gives user feedback that changes are on the server (in memory)
      // "saved" will come from server when DB write completes (after 10s debounce)
      syncedTimeoutRef.current = setTimeout(() => {
        // Live read — a closure-captured status here is stale by the time the
        // timer fires and would cancel its own transition.
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
    // documentId re-attaches the listener to the fresh Y.Doc after a doc switch.
  }, [setWorkspaceSetting, documentId])

  // Track browser online/offline state
  useEffect(() => {
    let onlineTimeout: NodeJS.Timeout | null = null

    const handleOnline = () => {
      console.info('Browser is online')

      // Show "online" status immediately
      setWorkspaceSetting('providerStatus', 'online')

      // After 1.5 seconds, transition to "synced"
      onlineTimeout = setTimeout(() => {
        if (providerRef.current) {
          setWorkspaceSetting('providerStatus', 'synced')
        }
      }, 1500)
    }

    const handleOffline = () => {
      console.info('Browser is offline')
      setWorkspaceSetting('providerStatus', 'offline')

      // Clear any pending online timeout
      if (onlineTimeout) {
        clearTimeout(onlineTimeout)
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (onlineTimeout) {
        clearTimeout(onlineTimeout)
      }
    }
  }, [setWorkspaceSetting])
}

export default useYdocAndProvider
