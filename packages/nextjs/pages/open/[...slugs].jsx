import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { useEditor } from '@tiptap/react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { HocuspocusProvider } from '@hocuspocus/provider'
import editorConfig from '../../components/TipTap/TipTap'
import { useQuery } from '@tanstack/react-query'
import { db, initDB } from '../../db'
import { useEditorStateContext } from '../../context/EditorContext'

import MobileLayout from './layouts/MobileLayout'
import DesktopLayout from './layouts/DesktopLayout'

const getHeaderParents = (heading) => {
  if (!heading) return
  const hLevel = heading.getAttribute('level')
  const parents = []
  // console.log("heading", heading, hLevel)
  // loop through the headings to find the parent heading untile the level is 1
  for (let i = +hLevel; i >= 1; i--) {
    const pHeading = heading.closest(`[level="${ i }"]`)?.querySelector('.title')
    if (pHeading)
      parents.push({
        node: pHeading,
        text: pHeading.textContent,
        hLevel: i,
        id: pHeading.closest('.wrapBlock').getAttribute('data-id'),
      })
  }

  return parents
}

const useCustomeHook = (documentSlug) => {
  // NOTE: This is a hack to get the correct URL in the build time
  const url = `${ process.env.NEXT_PUBLIC_RESTAPI_URL }/documents/${ documentSlug }`

  const { isLoading, error, data, isSuccess } = useQuery({
    queryKey: ['getDocumentMetadataByDocName'],
    queryFn: () => {
      return fetch(url).then((res) => res.json())
    },
  })

  return { isLoading, error, data, isSuccess }
}

const OpenDocuments = ({ docTitle, docSlug }) => {
  const router = useRouter()
  const { slugs } = router?.query

  // if editor is in the filter mode
  if (typeof window !== 'undefined' && slugs.length > 1) {
    // localStorage.removeItem('headingMap');
    document.body.classList.add('filter-mode')
  }

  const [ydoc, setYdoc] = useState(null)
  const [provider, setProvider] = useState(null)
  const [loadedData, setLoadedData] = useState(false)
  const { isLoading, error, data, isSuccess } = useCustomeHook(docSlug)
  const [documentTitle, setDocumentTitle] = useState(docTitle)
  const [docId, setDocId] = useState(null)

  const {
    rendering,
    setRendering,
    loading,
    setLoading,
    applyingFilters,
    setApplyingFilters,
    isMobile
  } = useEditorStateContext()

  // check if the document is in the filter mode
  useMemo(() => {
    if (slugs.length > 1) {
      setApplyingFilters(true)
    }
  }, [])

  useEffect(() => {
    // Use the data returned by useCustomHook in useEffect
    if (data?.data?.documentId) {
      const { documentId, isPrivate } = data?.data

      setDocumentTitle(data?.data.title)
      setDocId(`${ isPrivate ? 'private' : 'public' }.${ documentId }`)
      localStorage.setItem('docId', documentId)
      localStorage.setItem(
        'padName',
        `${ isPrivate ? 'private' : 'public' }.${ documentId }`
      )
      localStorage.setItem('slug', docSlug)
      localStorage.setItem('title', data?.data.title)

      initDB(
        `meta.${ documentId }`,
        `${ isPrivate ? 'private' : 'public' }.${ documentId }`
      )

      // get the heading map from indexdb, when the document is not in the filter mode
      if (slugs.length === 1) {
        // console.log('get db.meta data from indexdb')
        db.meta
          .where({ docId: documentId })
          .toArray()
          .then((data) => {
            localStorage.setItem('headingMap', JSON.stringify(data))
          })
      }
    }
  }, [data])

  useEffect(() => {
    if (docId) {
      const ydoc = new Y.Doc()

      setYdoc(ydoc)

      const colabProvider = new HocuspocusProvider({
        url: `${ process.env.NEXT_PUBLIC_PROVIDER_URL }`,
        name: docId,
        document: ydoc,
        onStatus: (data) => {
          // console.log('onStatus', data)
        },
        onSynced: (data) => {
          // console.log('onSynced', data)
          // console.log(`content loaded from Server, pad name: ${ docId }`, provider.isSynced)
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

      // Store the Y document in the browser
      const indexDbProvider = new IndexeddbPersistence(
        docId,
        colabProvider.document
      )

      indexDbProvider.on('synced', () => {
        if (!loadedData) return
        // console.log(`content loaded from indexdb, pad name: ${ docId }`)
        setLoadedData(true)
      })
    }
  }, [docId])

  const editor = useEditor(editorConfig({ padName: docId, provider, ydoc }), [
    // provider,
    loading,
    applyingFilters,
  ])

  // listen to the editor transaction state change, in order to update rendering state
  useEffect(() => {
    if (!editor) return
    if (loading) return

    setRendering(false)

  }, [editor])

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

  // apply the filter when the document is in the filter mode
  useEffect(() => {
    if (rendering) return
    if (slugs.length === 1) return

    const headings = document.querySelectorAll('.heading .title')
    // search through the headings that has text content with "diet" with regex
    const filteredHeadings = Array.from(headings)
      .filter((heading) => {
        const key = slugs.at(-1)

        const regex = new RegExp(key, 'i') // i flag makes the regex case-insensitive
        if (regex.test(heading.textContent)) {
          return { node: heading, text: heading.textContent }
        }
      })
      .map((heading) => {
        return {
          node: heading,
          parents: getHeaderParents(heading).map((parent) => parent.id),
          text: heading.textContent,
          hLevel: heading.getAttribute('level'),
          id: heading.closest('.wrapBlock').getAttribute('data-id'),
        }
      })
      .map((heading) => {
        return {
          ...heading,
          openSectionIds: [heading.id, ...heading.parents],
        }
      })

    const headingIds = filteredHeadings
      .map((heading) => heading.openSectionIds)
      .flat()

    const uniqueArr = [...new Set(headingIds)]

    // if the filter result is empty, then redirect to the first slug
    if (uniqueArr.length === 0) router.push(slugs.at(0))

    const dbMap = []
    headings.forEach((header) => {
      const wrapBlock = header.closest('.wrapBlock')
      const id = wrapBlock.getAttribute('data-id')

      if (!uniqueArr.includes(id)) {
        dbMap.push({
          headingId: id,
          crinkleOpen: false,
        })
      } else {
        dbMap.push({
          headingId: id,
          crinkleOpen: true,
        })
      }
    })

    localStorage.setItem('headingMap', JSON.stringify(dbMap))
    // console.log(dbMap, '=-==-=-=-dbMap')

    // console.log('appling filter render again')
    setApplyingFilters(false)

    // console.log({
    //   uniqueArr,
    //   state: editor.state.doc,
    //   headings,
    //   headingIds,
    //   filteredHeadings,
    // })
  }, [rendering, editor])

  return (
    <>
      {isMobile ? (
        <MobileLayout documentTitle={documentTitle} docSlug={docSlug} docId={docId} provider={provider} editor={editor} />
      ) : (
        <DesktopLayout documentTitle={documentTitle} docSlug={docSlug} docId={docId} provider={provider} editor={editor} />
      )}
    </>
  );
}

export default OpenDocuments

export async function getServerSideProps(context) {
  const documentSlug = context.query.slugs.at(0)
  const res = await fetch(
    `${ process.env.NEXT_PUBLIC_RESTAPI_URL }/documents/${ documentSlug }`
  )
  const data = await res.json()
  return {
    props: { docTitle: data.data.title, docSlug: documentSlug },
  }
}
