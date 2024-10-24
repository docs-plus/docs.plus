import { GetServerSidePropsContext } from 'next'
import React, { useEffect } from 'react'
import MobileDetect from 'mobile-detect'
import useDocumentMetadata from '@hooks/useDocumentMetadata'
import { fetchDocument } from '@utils/fetchDocument'
import HeadSeo from '@components/HeadSeo'
import useMapDocumentAndWorkspace from '@hooks/useMapDocumentAndWorkspace'
import useInitiateDocumentAndWorkspace from '@hooks/useInitiateDocumentAndWorkspace'
import { upsertWorkspace, getChannelsByWorkspaceAndUserids } from '@api'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { LoadingDots } from '@components/LoadingDots'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import { useStore } from '@stores'
import DocumentLayouts from '@components/pages/document/layouts/DocumentLayouts'

const Document = ({ slugs, docMetadata, isMobile, channels }: any) => {
  useDocumentMetadata(slugs, docMetadata)
  useInitiateDocumentAndWorkspace(docMetadata)
  const { loading } = useMapDocumentAndWorkspace(docMetadata, channels)
  const { editor: editorSetting } = useStore((state) => state.settings)

  // initialize the editor and its provider!
  useYdocAndProvider()

  useEffect(() => {
    document?.querySelector('html')?.classList.add(isMobile ? 'm_mobile' : 'm_desktop')
  }, [isMobile])

  if (loading && editorSetting.loading) {
    return (
      <>
        <HeadSeo />
        <LoadingDots>
          <span>Hang tight! content is loading</span>
        </LoadingDots>
      </>
    )
  }

  return <DocumentLayouts isMobile={isMobile} />
}

export default Document

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const slug = context.query.slugs?.at(0)
  const supabase = createPagesServerClient(context)

  try {
    const { data, error } = await supabase.auth.getSession()
    const docMetadata = await fetchDocument(slug, data.session)
    const device = new MobileDetect(context.req.headers['user-agent'] || '')
    let channels: any = null

    if (error) console.error('error:', error)

    if (data.session?.user) {
      await upsertWorkspace({
        id: docMetadata.documentId,
        name: docMetadata.title,
        description: docMetadata.description,
        slug: docMetadata.slug,
        created_by: data.session.user.id
      })

      channels = await getChannelsByWorkspaceAndUserids(
        docMetadata.documentId,
        data.session.user.id
      )
      // TODO: need db function to get all channels by workspaceId and not thread
      channels =
        channels?.data
          .filter((x: any) => x.workspace?.type && x.workspace?.type !== 'THREAD')
          .map((x: any) => ({ ...x, ...x.workspace })) || [] //data || [];
    }

    return {
      props: {
        channels: channels || null,
        docMetadata,
        isMobile: device.mobile(),
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
