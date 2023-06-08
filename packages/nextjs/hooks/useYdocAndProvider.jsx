import { useState, useEffect } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { HocuspocusProvider } from '@hocuspocus/provider'

const useYdocAndProvider = (documentId, setLoading) => {
  const [ydoc, setYdoc] = useState(null)
  const [provider, setProvider] = useState(null)
  const [loadedData, setLoadedData] = useState(false)

  useEffect(() => {
    if (documentId) {
      const ydoc = new Y.Doc()
      const colabProvider = new HocuspocusProvider({
        url: `${process.env.NEXT_PUBLIC_PROVIDER_URL}`,
        name: documentId,
        document: ydoc,
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
        }
      })

      setProvider(colabProvider)
      setYdoc(ydoc)

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
    }
  }, [documentId])

  return { ydoc, provider, loadedData, setLoadedData }
}

export default useYdocAndProvider
