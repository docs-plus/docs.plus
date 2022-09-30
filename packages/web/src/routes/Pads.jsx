import {
  createBrowserRouter,
  RouterProvider,
  useLoaderData,
  useParams
} from "react-router-dom";

import React, { useEffect, useState, useCallback, useMemo } from 'react'

import Tiptap from '../components/Tiptap.jsx'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'


export default function Root() {
  const { padName } = useParams()
  const [loadedData, setLoadedData] = useState(false)
  const newPadName = `pads.${ padName }`

  // run once
  const [provider, ydoc] = useMemo(() => {
    const ydoc = new Y.Doc()
    const provider = new HocuspocusProvider({
      url: import.meta.env.VITE_HOCUSPOCUS_PROVIDER_URL,
      name: newPadName,
      document: ydoc,
      onStatus: (data) => {
        // console.log("onOpen", data)
      },
      onSynced: (data) => {
        // console.log("onSynced", data)
        console.log(`content loaded from Server, pad name: ${ newPadName }`, provider.isSynced)
        if (data?.state) setLoadedData(true)
      },
      onDisconnect: (data) => {
        // console.log("onDisconnect", data)
      }
    })


    // Store the Y document in the browser
    // const newProvider = new IndexeddbPersistence(newPadName, provider.document)

    // newProvider.on('synced', () => {
    //   if (!loadedData) return
    //   console.log(`content loaded from indexdb, pad name: ${ newPadName }`)
    //   setLoadedData(true)
    // })

    console.log("once ha ha ha", provider.isSynced)

    return [provider, ydoc]

  }, [loadedData])

  console.log("component load", provider)


  return (
    <>
      <div className="App">
        <h1>Docsy Editor: {padName}</h1>
        {loadedData ? <Tiptap padName={padName} provider={provider} ydoc={ydoc} /> : "loading..."}
      </div>
    </>
  );
}
