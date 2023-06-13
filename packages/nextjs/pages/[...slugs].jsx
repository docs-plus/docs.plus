import React, { useEffect } from 'react'
import MobileDetect from 'mobile-detect'

import { useEditorStateContext } from '@context/EditorContext'
import useDocumentMetadata from '@hooks/useDocumentMetadata'

import MobileLayout from '@components/pages/document/layouts/MobileLayout'
import DesktopLayout from '@components/pages/document/layouts/DesktopLayout'

const Document = ({ slugs, docMetadata }) => {
  useDocumentMetadata(slugs, docMetadata)

  useEffect(() => {
    // if editor is in the filter mode
    if (slugs.length > 1) {
      document.body.classList.add('filter-mode')
    }
  }, [slugs])

  const { isMobile } = useEditorStateContext()

  // if (isMobile) return <MobileLayout docMetadata={docMetadata} />

  return <DesktopLayout docMetadata={docMetadata} />
}

export default Document

export async function getServerSideProps(context) {
  const slug = context.query.slugs.at(0)
  const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${slug}`
  const res = await fetch(url)
  const { data } = await res.json()

  const userAgent = context.req.headers['user-agent']
  const device = new MobileDetect(userAgent)
  const docClientId = `${data.isPrivate ? 'private' : 'public'}.${data.documentId}`

  const docMetadata = {
    ...data,
    docClientId
  }

  return {
    props: {
      docMetadata,
      isMobile: device.mobile() ? true : false,
      slugs: context.query.slugs
    }
  }
}
