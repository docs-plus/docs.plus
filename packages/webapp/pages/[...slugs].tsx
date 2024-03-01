import React from 'react'
import MobileDetect from 'mobile-detect'
import DesktopLayout from '@components/pages/document/layouts/DesktopLayout'
import MobileLayout from '@components/pages/document/layouts/MobileLayout'
import useDocumentMetadata from '@hooks/useDocumentMetadata'
import { fetchDocument } from '@utils/fetchDocument'
import HeadSeo from '@components/HeadSeo'
import useMapDocumentAndWorkspace from '@hooks/useMapDocumentAndWorkspace'
import useInitiateDocumentAndWorkspace from '@hooks/useInitiateDocumentAndWorkspace'
import { createClient } from '@utils/supabase/server-propps'
import { getChannels, upsertWorkspace } from '@api'

const Document = ({ slugs, docMetadata, isMobile, channels }: any) => {
  useDocumentMetadata(slugs, docMetadata)
  useInitiateDocumentAndWorkspace(docMetadata)

  const { loading } = useMapDocumentAndWorkspace(docMetadata, channels)

  if (loading) {
    return (
      <>
        <HeadSeo />
        <div className="w-full h-full flex items-center justify-center">
          <span>Hang tight! content is loading</span>
          <span className="loading loading-dots loading-xs mt-2 ml-2"></span>
        </div>
      </>
    )
  }

  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

export default Document

export async function getServerSideProps(context: any) {
  const slug = context.query.slugs.at(0)
  const supabase = createClient(context)

  try {
    const { data, error } = await supabase.auth.getSession()
    const docMetadata = await fetchDocument(slug, data.session)
    const device = new MobileDetect(context.req.headers['user-agent'])
    let channels = null

    if (error) console.error('error:', error)

    if (data.session?.user) {
      await upsertWorkspace({
        id: docMetadata.documentId,
        name: docMetadata.title,
        description: docMetadata.description,
        slug: docMetadata.slug,
        created_by: data.session.user.id
      })

      channels = await getChannels(docMetadata.documentId)
    }

    return {
      props: {
        channels: channels?.data || null,
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
