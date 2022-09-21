import App from '../App'
import {
  createBrowserRouter,
  RouterProvider,
  useLoaderData,
} from "react-router-dom";
import React, { useEffect, useState, useCallback } from 'react'

import Tiptap from '../components/Tiptap.jsx'


import { HocuspocusProvider } from '@hocuspocus/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'



export default function Root() {
  const padName = useLoaderData()
  const ydoc = new Y.Doc()

  const provider = new HocuspocusProvider({
    url: import.meta.env.VITE_HOCUSPOCUS_PROVIDER_URL,
    name: `pads.${ padName }`,
    document: ydoc,
    onStatus: (data) => {
      // console.log("onOpen", data)
    },
    onSynced: (data) => {
      // console.log("onSynced", data)
    },
    onDisconnect: (data) => {
      // console.log("onDisconnect", data)
    }
  })

  // Store the Y document in the browser
  new IndexeddbPersistence(provider.name, provider.document)

  return (
    <>
      <div className="App">
        <h1>Docsy Editor: {padName}</h1>
        <Tiptap padName={padName} provider={provider} ydoc={ydoc} />
      </div>
    </>
  );
}
