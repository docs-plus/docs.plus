import { useState, useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useEditorStateContext } from '@context/EditorContext'

const useYdocAndProvider = (documentId, setLoading) => {
  const [loadedData, setLoadedData] = useState(false)
  const ydocRef = useRef(new Y.Doc())
  const providerRef = useRef(null)
  const { EditorProvider, setEditorProvider } = useEditorStateContext()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      providerRef.current = new HocuspocusProvider({
        url: `${process.env.NEXT_PUBLIC_PROVIDER_URL}`,
        name: documentId,
        document: ydocRef.current,
        onStatus: (data) => {
          // console.log('onStatus', data)
        },
        onSynced: (data) => {
          // console.log('++onSynced', data)
          // console.log(`++content loaded from Server, pad name: ${ documentId }`, provider?.isSynced)
          if (data?.state) setLoading(false)
        },
        documentUpdateHandler: (update) => {
          // console.log('documentUpdateHandler', update)
        },
        onDisconnect: (data) => {
          // console.log('onDisconnect', data)
        },
        onMessage: (data) => {
          // console.log('onMessage', data)
        },
        onDisconnect: ({ event }) => {
          // console.log('onDisconnect', event)
        },
        onDestroy() {
          // console.log('onDestroy')
        },
        onAwarenessUpdate: ({ added, updated, removed }) => {
          // console.log('onAwarenessUpdate', { added, updated, removed })
        },
        onStateless: ({ payload }) => {
          // console.log('onStateless', { payload })
        },
        onDestroy: () => {
          console.info('destroy provider')
        }
      })
    }

    return () => {
      providerRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    if (!EditorProvider && providerRef.current) {
      setEditorProvider(providerRef.current)
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
  //   if (!loadedData) return
  //   setLoadedData(true)
  // })
  return { ydoc: ydocRef.current, provider: providerRef.current, loadedData, setLoadedData }
}

export default useYdocAndProvider