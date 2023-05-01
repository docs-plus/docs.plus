import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { useEditor } from '@tiptap/react'
import editorConfig from '../../components/TipTap/TipTap'
import { useEditorStateContext } from '../../context/EditorContext'

import useYdocAndProvider from "../../hooks/useYdocAndProvider"
import useApplyFilters from '../../hooks/useApplyFilters'
import useDocumentMetadata from '../../hooks/useDocumentMetadata'

import MobileLayout from './layouts/MobileLayout'
import DesktopLayout from './layouts/DesktopLayout'


const OpenDocuments = ({ docTitle, docSlug }) => {
  const router = useRouter()
  const { slugs } = router?.query

  // if editor is in the filter mode
  if (typeof window !== 'undefined' && slugs.length > 1) {
    // localStorage.removeItem('headingMap');
    document.body.classList.add('filter-mode')
  }

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
  useEffect(() => {
    if (slugs.length > 1) {
      setApplyingFilters(true)
    }
  }, [])

  const { documentTitle, docId, isLoading, error, isSuccess } = useDocumentMetadata(docSlug, docTitle, slugs)
  const { ydoc, provider, loadedData, setLoadedData } = useYdocAndProvider(docId, setLoading)

  const editor = useEditor(
    editorConfig({ padName: docId, provider, ydoc }),
    [loading, applyingFilters]
  )

  useApplyFilters(editor, slugs, applyingFilters, setApplyingFilters, router, rendering)



  function setDefaultContent(editor) {
    const contentLength = editor?.getHTML().trim().length
    if (contentLength === 70 || contentLength === 97) {
      editor?.chain().focus('start').insertContentAt(2, '' +
        '<h1>&shy;</h1>' +
        '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>' +
        '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>' +
        '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>' +
        '<p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>',
        {
          updateSelection: false
        }).setTextSelection(0).run()
    } else {
      // editor.editor?.chain().focus('start').setTextSelection(0).run()
    }
  }

  useEffect(() => {
    if (!editor || loading) return
    setDefaultContent(editor)
    setRendering(false)
  }, [editor])

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
  const url = `${ process.env.NEXT_PUBLIC_RESTAPI_URL }/documents/${ documentSlug }`
  const res = await fetch(url)
  const data = await res.json()
  return {
    props: { docTitle: data.data.title, docSlug: documentSlug },
  }
}
