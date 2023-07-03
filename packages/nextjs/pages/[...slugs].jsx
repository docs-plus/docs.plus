import React, { useEffect } from 'react'
import MobileDetect from 'mobile-detect'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

import { useEditorStateContext } from '@context/EditorContext'
import useDocumentMetadata from '@hooks/useDocumentMetadata'

import MobileLayout from '@components/pages/document/layouts/MobileLayout'
import DesktopLayout from '@components/pages/document/layouts/DesktopLayout'
import HeadSeo from '@components/HeadSeo'

const Document = ({ slugs, docMetadata }) => {
  useDocumentMetadata(slugs, docMetadata)
  const { title, description, keywords } = docMetadata
  const { setApplyingFilters, isMobile } = useEditorStateContext()

  const isFilterMode = slugs.length > 1

  useEffect(() => {
    if (isFilterMode) {
      document.body.classList.add('filter-mode')
      setApplyingFilters(true)
    }
  }, [slugs, setApplyingFilters, isFilterMode])

  return (
    <>
      <HeadSeo title={title} description={description} keywords={keywords.length && keywords.join(',')} />
      {isMobile ? <MobileLayout docMetadata={docMetadata} /> : <DesktopLayout docMetadata={docMetadata} />}
    </>
  )
}

export default Document

export async function getServerSideProps(context) {
  const slug = context.query.slugs.at(0)
  const supabase = createPagesServerClient(context)

  try {
    const {
      data: { session }
    } = await supabase.auth.getSession()

    let baseAPIUrl = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${slug}`
    const url = session ? `${baseAPIUrl}?userId=${session.user.id}` : baseAPIUrl
    const fetchOptions = session ? { headers: { token: session.access_token || '' } } : {}

    const documentMetadata = await fetch(url, fetchOptions)
    const { data } = await documentMetadata.json()

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
  } catch (error) {
    console.error('getServerSideProps error:', error)
  }
  return { props: {} }
}
