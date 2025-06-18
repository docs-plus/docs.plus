import { useState, useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'

const useYdocAndProvider = () => {
  const {
    editor: { instance: editor },
    metadata: { documentId }
  } = useStore((state) => state.settings)

  const [destroyed, setDestroyed] = useState(false)
  const ydocRef = useRef(new Y.Doc())
  const providerRef = useRef<any>(null)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const { hocuspocusProvider } = useStore((state) => state.settings)
  useEffect(() => {
    if (!documentId) return

    const createProvider = () => {
      if (typeof window !== 'undefined') {
        providerRef.current = new HocuspocusProvider({
          url: `${process.env.NEXT_PUBLIC_PROVIDER_URL}`,
          name: documentId,
          document: ydocRef.current,
          // onStatus: (data) => {
          //   console.log('onStatus', data)
          // },
          onSynced: (data) => {
            console.log('++onSynced', data)

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
            // console.log('onDisconnect', data)
          },
          onMessage: (data) => {
            // console.log('onMessage', data)
          },
          onAwarenessUpdate: () => {
            // console.log('onAwarenessUpdate')
          },
          onStateless: ({ payload }) => {
            // console.log('onStateless', { payload })
          },
          onOutgoingMessage: ({ message }) => {
            // console.log('onOutgoingMessage', { message })
          },
          onClose: ({ event }) => {
            // console.log('onClose', { event })
          },
          onDestroy: () => {
            console.info('destroy provider')
            setDestroyed(true)
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
