import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useEditor } from '@tiptap/react'
import editorConfig from '../components/TipTap/TipTap'
import { useEditorStateContext } from '../context/EditorContext'

import useYdocAndProvider from '../hooks/useYdocAndProvider'
import useApplyFilters from '../hooks/useApplyFilters'
import useDocumentMetadata from '../hooks/useDocumentMetadata'

import MobileLayout from './layouts/MobileLayout'
import DesktopLayout from './layouts/DesktopLayout'

import MobileDetect from 'mobile-detect'

const OpenDocuments = ({ docTitle, docSlug, documentDescription, keywords, isMobile: isMobileServerDetection }) => {
  const router = useRouter()
  const { slugs } = router?.query

  // if editor is in the filter mode
  if (typeof window !== 'undefined' && slugs.length > 1) {
    // localStorage.removeItem('headingMap');
    document.body.classList.add('filter-mode')
  }

  const { rendering, setRendering, loading, setIsMobile, isMobile, setLoading, applyingFilters, setApplyingFilters } =
    useEditorStateContext()

  useEffect(() => {
    setIsMobile(isMobileServerDetection)
  }, [])

  // check if the document is in the filter mode
  useEffect(() => {
    if (slugs.length > 1) {
      setApplyingFilters(true)
    }
  }, [slugs, setApplyingFilters])

  const { documentTitle, docId, isLoading, error, isSuccess, documentId } = useDocumentMetadata(
    docSlug,
    docTitle,
    slugs
  )

  const { ydoc, provider, loadedData, setLoadedData } = useYdocAndProvider(documentId, setLoading)

  const editor = useEditor(editorConfig({ padName: docId, provider, ydoc }), [loading, applyingFilters])

  useApplyFilters(editor, slugs, applyingFilters, setApplyingFilters, router, rendering)

  useEffect(() => {
    if (!editor || loading) return
    setRendering(false)
  }, [editor, loading, setRendering])

  return (
    <>
      {isMobile ? (
        <MobileLayout
          documentTitle={documentTitle}
          keywords={keywords}
          documentDescription={documentDescription}
          docSlug={docSlug}
          docId={docId}
          provider={provider}
          editor={editor}
        />
      ) : (
        <DesktopLayout
          documentTitle={documentTitle}
          keywords={keywords}
          documentDescription={documentDescription}
          docSlug={docSlug}
          docId={docId}
          provider={provider}
          editor={editor}
        />
      )}
    </>
  )
}

export default OpenDocuments

export async function getServerSideProps(context) {
  const documentSlug = context.query.slugs.at(0)
  const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentSlug}`
  const res = await fetch(url)
  const { data } = await res.json()

  const userAgent = context.req.headers['user-agent']
  const device = new MobileDetect(userAgent)

  return {
    props: {
      isMobile: device.mobile() ? true : false,
      docTitle: data?.title,
      documentDescription: data?.description,
      keywords: data?.keywords,
      docSlug: documentSlug
    }
  }
}
