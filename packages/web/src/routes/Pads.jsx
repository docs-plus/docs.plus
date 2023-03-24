import {
  useParams
} from 'react-router-dom'
import React, { useState, useMemo, useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'

import { useQuery } from '@tanstack/react-query'

import { db } from '../db'

import editorConfig from '../components/TipTap/TipTap'
import Toolbar from '../components/TipTap/Toolbar'
import TableOfContents from '../components/TipTap/TableOfContents'
import PadTitle from '../components/PadTitle'
// import { useAuth } from '../contexts/Auth'

const useCustomeHook = (padName) => {
  const { isLoading, error, data, isSuccess } = useQuery({
    queryKey: ['getDocumentMetadataByDocName'],
    queryFn: () => {
      return fetch(`${import.meta.env.VITE_RESTAPI_URL}/documents/${padName}`)
        .then(res => res.json())
    }
  })

  return { isLoading, error, data, isSuccess }
}

export default function Root () {
  // const { signInWithOtp, signIn, signOut, user } = useAuth()
  const { padName } = useParams()
  const [loadedData, setLoadedData] = useState(false)
  const [newPadName, setNewPadName] = useState(null)
  const [ydoc, setYdoc] = useState(null)
  const [provider, setProvider] = useState(null)
  const [socket, setSocket] = useState(null)
  const [documentTitle, setDocumentTitle] = useState(padName)
  const [loading, setLoading] = useState(true)

  const { isLoading, error, data, isSuccess } = useCustomeHook(padName)

  useEffect(() => {
    // Use the data returned by useCustomHook in useEffect
    if (data?.data.documentId) {
      const { documentId, isPrivate } = data?.data

      window.document.title = data?.data.title

      setDocumentTitle(data?.data.title)
      setNewPadName(`${isPrivate ? 'private' : 'public'}.${documentId}`)
      localStorage.setItem('docId', documentId)
      localStorage.setItem('padName', `${isPrivate ? 'private' : 'public'}.${documentId}`)
      localStorage.setItem('slug', padName)
      localStorage.setItem('title', data?.data.title)
      db.documents.where({ docId: documentId }).toArray().then((data) => {
        localStorage.setItem('headingMap', JSON.stringify(data))
      })
    }
  }, [data])

  // run once
  useEffect(() => {
    if (newPadName) {
      const ydoc = new Y.Doc()

      setYdoc(ydoc)

      const provider = new HocuspocusProvider({
        url: `${import.meta.env.VITE_HOCUSPOCUS_PROVIDER_URL}/public`,
        name: newPadName,
        document: ydoc,
        onStatus: (data) => {
          // console.log('onStatus', data)
        },
        onSynced: (data) => {
          console.log('onSynced', data)
          // console.log(`content loaded from Server, pad name: ${ newPadName }`, provider.isSynced)
          if (data?.state) setLoading(false)
        },
        documentUpdateHandler: (update) => {
          console.log('documentUpdateHandler', update)
        },
        onDisconnect: (data) => {
        // console.log("onDisconnect", data)
        },
        onMessage: (data) => {
          // console.log('onMessage', data)
        }
      })

      setProvider(provider)

      // Store the Y document in the browser
      const indexDbProvider = new IndexeddbPersistence(newPadName, provider.document)

      indexDbProvider.on('synced', () => {
        if (!loadedData) return
        // console.log(`content loaded from indexdb, pad name: ${ newPadName }`)
        setLoadedData(true)
      })
    }
  }, [newPadName])

  const editor = useEditor(editorConfig({ padName: newPadName, provider, ydoc }), [provider])

  useEffect(() => {
    if (!loading && editor?.isEmpty) {
      console.log('editor is empty', editor?.isEmpty)

      editor?.chain().focus().insertContentAt(2, '' +
         '<h1>&shy;</h1>' +
         '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>' +
         '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>' +
         '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>' +
         '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>',
      {
        updateSelection: false
      }).setTextSelection(0).run()
    }
  }, [loading, editor])

  const scrollHeadingSelection = (event) => {
    const scrollTop = event.currentTarget.scrollTop
    const toc = document.querySelector('.toc__list')
    const tocLis = [...toc.querySelectorAll('.toc__item')]
    const closest = tocLis
      .map(li => {
        li.classList.remove('active')

        return li
      })
      .filter(li => {
        const thisOffsetTop = +li.getAttribute('data-offsettop') - 220
        // const nextSiblingOffsetTop = +li.querySelector('div > .toc__item')?.getAttribute('data-offsettop') - 220

        return thisOffsetTop <= scrollTop // && nextSiblingOffsetTop >= scrollTop
      })

    // if (event.target.offsetHeight === (event.target.scrollHeight - scrollTop) - 0.5) {
    //   tocLis.at(-1)?.classList.add('active')
    //   tocLis.at(-1)?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })

    //   return
    // }

    // console.log(closest)
    closest.at(-1)?.classList.add('active')
    closest.at(-1)?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
  }

  return (
    <>
      <div className="pad tiptap flex flex-col border-solid border-2">
        <div className='header w-full min-h-14 px-2 py-3 flex flex-row items-center sm:border-b-0 border-b'>
          {documentTitle && <PadTitle docId={newPadName} docTitle={documentTitle} provider={provider} />}
        </div>
        <div className='toolbars w-full bg-white h-auto z-10  sm:block fixed bottom-0 sm:relative'>
          { editor ? <Toolbar editor={editor} /> : 'Loading...'}
        </div>
        <div className='editor w-full h-full flex relative flex-row align-top '>
          {loading ? 'loading...' : editor ? <TableOfContents className="tiptap__toc pl-2 pb-4 sm:py-4 sm:pb-14  max-w-xs w-3/12 hidden overflow-hidden scroll-smooth hover:overflow-auto hover:overscroll-contain sm:block" editor={editor} /> : 'Loading...'}
          <div className='editorWrapper w-9/12 grow flex items-start justify-center overflow-y-auto p-0 border-t-0 sm:py-4' onScroll={scrollHeadingSelection}>
            {loading ? 'loading...' : editor ? <EditorContent className="tipta__editor mb-12 sm:mb-0 sm:p-8  " documentid={newPadName} editor={editor} /> : 'Loading...'}
          </div>
        </div>
      </div>
    </>
  )
}
