import { useState, useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'

const useYdocAndProvider = (documentId: string) => {
  const [destroyed, setDestroyed] = useState(false)
  const ydocRef = useRef(new Y.Doc())
  const providerRef = useRef<any>(null)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const { hocuspocusProvider } = useStore((state) => state.settings)
  console.log({
    websocket: process.env.NEXT_PUBLIC_PROVIDER_URL
  })

  useEffect(() => {
    console.log('useYdocAndProvider', {
      documentId,
      hocuspocusProvider,
      destroyed,
      url: `${process.env.NEXT_PUBLIC_PROVIDER_URL}`
    })
    const createProvider = () => {
      if (typeof window !== 'undefined') {
        providerRef.current = new HocuspocusProvider({
          url: `${process.env.NEXT_PUBLIC_PROVIDER_URL}`,
          name: documentId,
          document: ydocRef.current,
          onStatus: (data) => {
            console.log('onStatus', data)
          },
          onSynced: (data) => {
            console.log('++onSynced', data)
            // console.log(`++content loaded from Server, pad name: ${ documentId }`, provider?.isSynced)
            if (data?.state) setWorkspaceEditorSetting('rendering', false)
          },
          // documentUpdateHandler: (update) => {
          // console.log('documentUpdateHandler', update)
          // },
          onDisconnect: (data) => {
            console.log('onDisconnect', data)
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
            console.log('onOutgoingMessage', { message })
          },
          onClose: ({ event }) => {
            console.log('onClose', { event })
          },
          onDestroy: () => {
            console.info('destroy provider')
            setDestroyed(true)
            setWorkspaceEditorSetting('loading', true)
            setWorkspaceEditorSetting('rendering', true)
            setWorkspaceEditorSetting('applyingFilters', false)
            setWorkspaceSetting('hocuspocusProvider', null)
            setWorkspaceEditorSetting('presentUsers', [])
            setWorkspaceEditorSetting('filterResult', [])

            // setTimeout(() => {
            //   console.log('craete new provider')
            //   createProvider()
            // }, 1000)
          }
        })
      }
    }

    if (!providerRef.current || destroyed) {
      createProvider()
    }

    return () => {
      providerRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    if (!hocuspocusProvider && providerRef.current) {
      console.log({ hocuspocusProvider, providerRef })
      setWorkspaceSetting('hocuspocusProvider', providerRef.current)
    }
  }, [providerRef.current])

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
