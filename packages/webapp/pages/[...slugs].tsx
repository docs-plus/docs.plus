import React from 'react'
import MobileDetect from 'mobile-detect'
import DesktopLayout from '@components/pages/document/layouts/DesktopLayout'
import MobileLayout from '@components/pages/document/layouts/MobileLayout'
import { getSupabaseSession } from '@utils/getSupabaseSession'
import useDocumentMetadata from '@hooks/useDocumentMetadata'
import { fetchDocument } from '@utils/fetchDocument'
import HeadSeo from '@components/HeadSeo'
import useMapDocumentAndWorkspace from '@hooks/useMapDocumentAndWorkspace'
import useInitiateDocumentAndWorkspace from '@hooks/useInitiateDocumentAndWorkspace'
import useSSESubscription from '@hooks/useSSESubscription'

const Document = ({ slugs, docMetadata, isMobile }: any) => {
  useDocumentMetadata(slugs, docMetadata)
  useInitiateDocumentAndWorkspace(docMetadata)
  useSSESubscription(docMetadata)

  const { loading } = useMapDocumentAndWorkspace(docMetadata)

  if (loading) {
    return (
      <>
        <HeadSeo />
        <div className="w-full h-full flex items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </>
    )
  }

  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

export default Document

export async function getServerSideProps(context: any) {
  const slug = context.query.slugs.at(0)

  try {
    const session = await getSupabaseSession(context)
    const docMetadata = await fetchDocument(slug, session)
    const device = new MobileDetect(context.req.headers['user-agent'])

    return {
      props: {
        docMetadata,
        isMobile: device.mobile() ? true : false,
        slugs: context.query.slugs
      }
    }
  } catch (error: any) {
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
