import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { HocuspocusProvider } from '@hocuspocus/provider'
import editorConfig from '../../components/TipTap/TipTap'
import { useQuery } from '@tanstack/react-query'

import Toolbar from '../../components/TipTap/Toolbar'
import PadTitle from '../../components/TipTap/PadTitle'
import TableOfContents from '../../components/TipTap/TableOfContents'
import { db, initDB } from '../../db'

const useCustomeHook = (documentSlug) => {
  // NOTE: This is a hack to get the correct URL in the build time
  const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentSlug}`

  const { isLoading, error, data, isSuccess } = useQuery({
    queryKey: ['getDocumentMetadataByDocName'],
    queryFn: () => {
      return fetch(url)
        .then(res => res.json())
    }
  })

  return { isLoading, error, data, isSuccess }
}

const OpenDocuments = ({ docTitle, docSlug}) => {
    const [loading, setLoading] = useState(false)
    const [ydoc, setYdoc] = useState(null)
    const [provider, setProvider] = useState(null)
    const [loadedData, setLoadedData] = useState(false)
    const { isLoading, error, data, isSuccess } = useCustomeHook(docSlug)
    const [documentTitle, setDocumentTitle] = useState(docTitle)
    const [docId, setDocId] = useState(null)

    useEffect(() => {
      // Use the data returned by useCustomHook in useEffect
      if (data?.data?.documentId) {
        const { documentId, isPrivate } = data?.data

        setDocumentTitle(data?.data.title)
        setDocId(`${isPrivate ? 'private' : 'public'}.${documentId}`)
        localStorage.setItem('docId', documentId)
        localStorage.setItem('padName', `${isPrivate ? 'private' : 'public'}.${documentId}`)
        localStorage.setItem('slug', docSlug)
        localStorage.setItem('title', data?.data.title)
  
        initDB(`meta.${documentId}`, `${isPrivate ? 'private' : 'public'}.${documentId}`)
  
        db.meta.where({ docId: documentId }).toArray().then((data) => {
          localStorage.setItem('headingMap', JSON.stringify(data))
        })
      }
    }, [data])
    
    useEffect(() => {
      if (docId) {
        const ydoc = new Y.Doc()
  
        setYdoc(ydoc)
  
        const colabProvider = new HocuspocusProvider({
          url: `${process.env.NEXT_PUBLIC_PROVIDER_URL}`,
          name: docId,
          document: ydoc,
          onStatus: (data) => {
            console.log('onStatus', data)
          },
          onSynced: (data) => {
            console.log('onSynced', data)
            // console.log(`content loaded from Server, pad name: ${ docId }`, provider.isSynced)
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
  
        setProvider(colabProvider)

        console.log(colabProvider)
  
        // Store the Y document in the browser
        const indexDbProvider = new IndexeddbPersistence(docId, colabProvider.document)
  
        indexDbProvider.on('synced', () => {
          if (!loadedData) return
          // console.log(`content loaded from indexdb, pad name: ${ docId }`)
          setLoadedData(true)
        })
      }
    }, [docId])

    const editor = useEditor(editorConfig({ padName: docId, provider, ydoc }), [provider])

    // useEffect(() => {
    //   if (!loading && editor?.isEmpty) {
    //     console.log('editor is empty', editor?.isEmpty)
  
    //     editor?.chain().focus().insertContentAt(2, '' +
    //        '<h1>&shy;</h1>' +
    //        '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>' +
    //        '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>' +
    //        '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>' +
    //        '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>',
    //     {
    //       updateSelection: false
    //     }).setTextSelection(0).run()
    //   }
    // }, [loading, editor])

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
          <Head>
            <title>{documentTitle}</title>
            <meta content="another open docs plus document" name="description" />
          </Head>
          <div className="pad tiptap flex flex-col border-solid border-2">
            <div className='header w-full min-h-14 px-2 py-3 flex flex-row items-center sm:border-b-0 border-b'>
              {docSlug && <PadTitle docSlug={docSlug} docId={docId} docTitle={documentTitle} provider={provider} />}
            </div>
            <div className='toolbars w-full bg-white h-auto z-10  sm:block fixed bottom-0 sm:relative'>
              { editor ? <Toolbar editor={editor} /> : 'Loading...'}
            </div>
            <div className='editor w-full h-full flex relative flex-row align-top '>
              {loading ? 'loading...' : editor ? <TableOfContents className="tiptap__toc pl-2 pb-4 sm:py-4 sm:pb-14  max-w-xs w-3/12 hidden overflow-hidden scroll-smooth hover:overflow-auto hover:overscroll-contain sm:block" editor={editor} /> : 'Loading...'}
              <div className='editorWrapper w-9/12 grow flex items-start justify-center overflow-y-auto p-0 border-t-0 sm:py-4' onScroll={scrollHeadingSelection}>
                {loading ? 'loading...' : editor ? <EditorContent className="tipta__editor mb-12 sm:mb-0 sm:p-8" editor={editor} /> : 'Loading...'}
              </div>
            </div>
          </div>
        </>
      )
}

export default OpenDocuments


export async function getServerSideProps(context) {
    const documentSlug = context.query.slug
    const res = await fetch(`${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentSlug}`)
    const data = await res.json()
    return {
        props: {name: "hassan", docTitle: data.data.title, docSlug: documentSlug}, // will be passed to the page component as props
    }
}