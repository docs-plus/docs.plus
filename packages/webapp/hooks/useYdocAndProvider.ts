import { useState, useEffect, useRef, useMemo } from 'react'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { debounce } from 'lodash'
import { useStore } from '@stores'

const useYdocAndProvider = ({ accessToken }: { accessToken: string }) => {
  const {
    metadata: { documentId, slug }
  } = useStore((state) => state.settings)

  const [destroyed, setDestroyed] = useState(false)
  const ydocRef = useRef(new Y.Doc())
  const providerRef = useRef<any>(null)
  const isSyncedRef = useRef(false)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const { hocuspocusProvider } = useStore((state) => state.settings)

  // Debounced function to set synced state
  const setSyncedState = useMemo(
    () =>
      debounce(() => {
        if (isSyncedRef.current) {
          setWorkspaceSetting('providerStatus', 'synced')
        }
      }, 500),
    [setWorkspaceSetting]
  )

  useEffect(() => {
    if (!documentId) return

    const createProvider = () => {
      if (typeof window !== 'undefined') {
        providerRef.current = new HocuspocusProvider({
          url: `${process.env.NEXT_PUBLIC_PROVIDER_URL}`,
          name: documentId,
          document: ydocRef.current,
          token: JSON.stringify({ accessToken: accessToken || '', slug: slug }),
          // onStatus: (data) => {
          //   console.log('onStatus', data)
          // },
          onSynced: (data) => {
            console.info('++onSynced', data)
            isSyncedRef.current = true
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
            if (data.event?.code && data.event.code !== 1000) {
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
              if (data.msg === 'document:saved' && data.documentId === documentId) {
                console.info('📝 Document saved to DB:', data)
                setWorkspaceSetting('providerStatus', 'saved')

                // Cancel any pending debounced call since we have real server confirmation
                setSyncedState.cancel()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  // Track Y.Doc updates for sync state (local changes only)
  useEffect(() => {
    const ydoc = ydocRef.current
    if (!ydoc) return

    const handleUpdate = (update: Uint8Array, origin: any) => {
      // Only track local updates, ignore remote updates from provider
      if (origin === providerRef.current) return

      setWorkspaceSetting('providerStatus', 'saving')

      // After 500ms of no typing → "synced" (synced to server memory)
      // Server will send "document:saved" message when actually persisted to DB
      setSyncedState()
    }

    ydoc.on('update', handleUpdate)

    return () => {
      ydoc.off('update', handleUpdate)
      setSyncedState.cancel() // Cancel pending debounced calls
    }
  }, [setSyncedState, setWorkspaceSetting])

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
