import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
import { useEffect, useRef,useState } from 'react'
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

interface UseYdocAndProviderProps {
  accessToken: string
  deviceType?: DeviceType
}

const useYdocAndProvider = ({ accessToken, deviceType = 'desktop' }: UseYdocAndProviderProps) => {
  const {
    metadata: { documentId, slug }
  } = useStore((state) => state.settings)

  const [destroyed, setDestroyed] = useState(false)
  const ydocRef = useRef(new Y.Doc())
  const providerRef = useRef<any>(null)
  const isSyncedRef = useRef(false)
  const syncedTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const { hocuspocusProvider, providerStatus } = useStore((state) => state.settings)

  useEffect(() => {
    if (!documentId) return

    const createProvider = () => {
      if (typeof window !== 'undefined') {
        const providerUrl = process.env.NEXT_PUBLIC_PROVIDER_URL
        if (!providerUrl) {
          console.error('NEXT_PUBLIC_PROVIDER_URL not set')
          throw new Error('NEXT_PUBLIC_PROVIDER_URL not set')
        }
        providerRef.current = new HocuspocusProvider({
          url: providerUrl,
          name: documentId,
          document: ydocRef.current,
          token: JSON.stringify({ accessToken: accessToken || '', slug: slug, deviceType }),
          // onStatus: (data) => {
          //   console.log('onStatus', data)
          // },
          onSynced: (data) => {
            console.info('++onSynced', data)
            isSyncedRef.current = true

            // Initial sync complete - document loaded from server (already saved)
            setWorkspaceSetting('providerStatus', 'saved')

            if (data?.state) setWorkspaceEditorSetting('providerSyncing', false)

            // in case of renew provider, set the provider to the store
            if (data?.state && !hocuspocusProvider && providerRef.current) {
              setWorkspaceSetting('hocuspocusProvider', providerRef.current)
            }
          },

          // documentUpdateHandler: (update) => {
          // console.log('documentUpdateHandler', update)
          // },
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
          onMessage: (_data) => {
            // console.log('onMessage', data)
          },
          onAwarenessUpdate: () => {
            // console.log('onAwarenessUpdate')
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
          onOutgoingMessage: ({ message: _message }) => {
            // console.log('onOutgoingMessage', { message })
          },
          onClose: ({ event: _event }) => {
            // console.log('onClose', { event })
          },
          onDestroy: () => {
            console.info('destroy provider')
            setDestroyed(true)
            setWorkspaceSetting('providerStatus', 'saved')
            setWorkspaceEditorSetting('loading', true)
            setWorkspaceEditorSetting('providerSyncing', true)
            setWorkspaceEditorSetting('applyingFilters', false)
            setWorkspaceSetting('hocuspocusProvider', null)
            setWorkspaceEditorSetting('presentUsers', [])
            // setWorkspaceEditorSetting('filterResult', [])
          }
        })
      }
    }

    if (!providerRef.current || destroyed) {
      createProvider()
      if (!hocuspocusProvider && providerRef.current) {
        setWorkspaceSetting('hocuspocusProvider', providerRef.current)
      }
    }

    return () => {
      providerRef.current?.destroy()
    }
  }, [documentId])

  // Track Y.Doc updates for sync state (local changes only)
  useEffect(() => {
    const ydoc = ydocRef.current
    if (!ydoc) return

    const handleUpdate = (_update: Uint8Array, origin: any) => {
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
        // Only transition if we're still in "saving" state
        if (providerStatus === 'saving') {
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
  }, [setWorkspaceSetting, providerStatus])

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

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        if (onlineTimeout) {
          clearTimeout(onlineTimeout)
        }
      }
    }
  }, [setWorkspaceSetting])

  // NOTE: This is not working yet, I need reconsider for offline mode
  // Store the Y document in the browser
  // const indexDbProvider = new IndexeddbPersistence(
  //   documentId,
  //   colabProvider.document
  // )

  // indexDbProvider.on('synced', () => {
  //   console.log(`content loaded from indexdb, pad name: ${documentId}`)
  // })
  return { ydoc: ydocRef.current, provider: providerRef.current }
}

export default useYdocAndProvider
