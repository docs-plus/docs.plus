import { useState, useEffect } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { HocuspocusProvider } from '@hocuspocus/provider';

const useYdocAndProvider = (docId, setLoading) => {
  const [ydoc, setYdoc] = useState(null);
  const [provider, setProvider] = useState(null);
  const [loadedData, setLoadedData] = useState(false);

  useEffect(() => {
    if (docId) {
      if (docId) {
        const ydoc = new Y.Doc()

        setYdoc(ydoc)

        const colabProvider = new HocuspocusProvider({
          url: `${ process.env.NEXT_PUBLIC_PROVIDER_URL }`,
          name: docId,
          document: ydoc,
          onStatus: (data) => {
            console.log('onStatus', data)
          },
          onSynced: (data) => {
            console.log('++onSynced', data)
            console.log(`++content loaded from Server, pad name: ${ docId }`, provider?.isSynced)
            if (data?.state) setLoading(false)
          },
          documentUpdateHandler: (update) => {
            // console.log('documentUpdateHandler', update)
          },
          onDisconnect: (data) => {
            // console.log("onDisconnect", data)
          },
          onMessage: (data) => {
            // console.log('onMessage', data)
          },
        })

        setProvider(colabProvider)

        // NOTE: This is not working yet, I need reconsider for offline mode
        // Store the Y document in the browser
        // const indexDbProvider = new IndexeddbPersistence(
        //   docId,
        //   colabProvider.document
        // )

        // indexDbProvider.on('synced', () => {
        //   console.log(`content loaded from indexdb, pad name: ${ docId }`)
        //   if (!loadedData) return
        //   setLoadedData(true)
        // })
      }
    }
  }, [docId]);

  return { ydoc, provider, loadedData, setLoadedData };
};

export default useYdocAndProvider
