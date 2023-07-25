import React, { useEffect } from 'react'
import MobileDetect from 'mobile-detect'

import DesktopLayout from '@components/pages/document/layouts/DesktopLayout'
import MobileLayout from '@components/pages/document/layouts/MobileLayout'
import { getSupabaseSession } from '@utils/getSupabaseSession'
import { useEditorStateContext } from '@context/EditorContext'
import useDocumentMetadata from '@hooks/useDocumentMetadata'
import { fetchDocument } from '@utils/fetchDocument'
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
  const session = await getSupabaseSession(context)

  try {
    const docMetadata = await fetchDocument(slug, session)
    const device = new MobileDetect(context.req.headers['user-agent'])

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
