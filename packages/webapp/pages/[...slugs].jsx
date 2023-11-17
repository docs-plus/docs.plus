import React, { useEffect } from 'react'
import MobileDetect from 'mobile-detect'
import DesktopLayout from '@components/pages/document/layouts/DesktopLayout'
import MobileLayout from '@components/pages/document/layouts/MobileLayout'
import { getSupabaseSession } from '@utils/getSupabaseSession'
import { useEditorStateContext } from '@context/EditorContext'
import useDocumentMetadata from '@hooks/useDocumentMetadata'
import { fetchDocument } from '@utils/fetchDocument'
import HeadSeo from '@components/HeadSeo'
import { DocumentMetadataProvider } from '@context/DocumentMetadataContext'

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
      <HeadSeo
        title={title}
        description={description}
        keywords={keywords.length && keywords.join(',')}
      />
      <DocumentMetadataProvider docMetadata={docMetadata}>
        {isMobile ? <MobileLayout /> : <DesktopLayout />}
      </DocumentMetadataProvider>
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
    const message = error.message.includes("(reading 'isPrivate')")
      ? `Something went wrong on our server side. We're looking into it!`
      : error.message

    return {
      redirect: {
        destination: `/500?error=${encodeURIComponent(message)}`,
        permanent: false
      }
    }
  }
}
