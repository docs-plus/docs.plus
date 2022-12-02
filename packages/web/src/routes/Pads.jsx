import {
  createBrowserRouter,
  RouterProvider,
  useLoaderData,
  useParams
} from "react-router-dom";

import React, { useState, useMemo } from 'react'
import { EditorContent } from '@tiptap/react'

import { HocuspocusProvider } from '@hocuspocus/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import TipTap from '../components/TipTap/TipTap'
import Toolbar from '../components/TipTap/Toolbar'
import TableOfContents from '../components/TipTap/TableOfContents';
import { useEffect } from 'react';
import PadTitle from '../components/PadTitle'



export default function Root() {
  const { padName, } = useParams()
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
        // console.log("onStatus", data)
      },
      onSynced: (data) => {
        // console.log("onSynced", data)
        // console.log(`content loaded from Server, pad name: ${ newPadName }`, provider.isSynced)
        // if (data?.state) setLoadedData(true)
      },
      onDisconnect: (data) => {
        // console.log("onDisconnect", data)
      }
    })

    // Store the Y document in the browser
    const newProvider = new IndexeddbPersistence(newPadName, provider.document)

    newProvider.on('synced', () => {
      if (!loadedData) return
      // console.log(`content loaded from indexdb, pad name: ${ newPadName }`)
      setLoadedData(true)
    })

    // console.log("once ha ha ha", provider.isSynced)

    return [provider, ydoc]

  }, [loadedData])


  const editor = TipTap({ padName, provider, ydoc })


  return (
    <>
      <div className="pad tiptap flex flex-col border-solid border-2">
        <div className='header w-full min-h-14 px-2 py-3 flex flex-row items-center sm:border-b-0 border-b'>
          <PadTitle padName={padName} />
        </div>
        <div className='toolbars w-full bg-white h-auto z-10  sm:block fixed bottom-0 sm:relative'>
          {editor ? <Toolbar editor={editor} /> : "Loading..."}
        </div>
        <div className='editor w-full h-full flex relative flex-row align-top '>
          {editor ? <TableOfContents editor={editor} className="tiptap__toc pl-2 pb-4 sm:py-4  max-w-xs w-3/12 hidden overflow-hidden scroll-smooth hover:overflow-auto hover:overscroll-contain sm:block" /> : "Loading..."}
          <div className='w-9/12 grow flex items-start justify-center overflow-y-auto p-0 border-t-0 sm:py-4'>
            {editor ? <EditorContent editor={editor} className="tipta__editor  bg-white p-4 mb-12 sm:mb-0 sm:p-8 sm:border sm:rounded-sm sm:shadow-sm" /> : "Loading..."}
          </div>
        </div>
      </div>
    </>
  );
}
