import { GetServerSidePropsContext } from 'next'
import React from 'react'
import MobileDetect from 'mobile-detect'
import { fetchDocument } from '@utils/fetchDocument'
import HeadSeo from '@components/HeadSeo'
import { upsertWorkspace, getChannelsByWorkspaceAndUserids } from '@api'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { LoadingDots } from '@components/LoadingDots'
import { useStore } from '@stores'
import * as cookie from 'cookie'
import TurnstilePage from '@components/TurnstilePage'
import useAddDeviceTypeHtmlClass from '@components/pages/document/hooks/useAddDeviceTypeHtmlClass'
import dynamic from 'next/dynamic'

const DocumentPage = dynamic(() => import('@components/pages/document/DocumentPage'), {
  ssr: false,
  loading: () => (
    <LoadingDots>
      <span>Hang tight! Document is loading</span>
    </LoadingDots>
  )
})

const Document = ({ docMetadata, isMobile, channels, showTurnstile }: any) => {
  const { isTurnstileVerified } = useStore((state) => state.settings)

  useAddDeviceTypeHtmlClass(isMobile)

  if (!isTurnstileVerified) {
    return (
      <>
        <HeadSeo />
        <TurnstilePage showTurnstile={showTurnstile} />
      </>
    )
  }

  return <DocumentPage docMetadata={docMetadata} isMobile={isMobile} channels={channels} />
}

export default Document

export async function getServerSideProps(context: GetServerSidePropsContext) {
  // first part
  const { req, query } = context
  const cookies = cookie.parse(req.headers.cookie || '') as { turnstileVerified?: string }

  // Check if TURNSTILE_SECRET_KEY exists and verify cookie accordingly
  const isTurnstileVerified = process.env.TURNSTILE_SECRET_KEY
    ? cookies.turnstileVerified === 'true'
    : true

  const userAgent = context.req.headers['user-agent'] || ''
  const device = new MobileDetect(userAgent)

  if (!isTurnstileVerified) {
    return {
      props: {
        showTurnstile: true,
        isMobile: device.mobile()
      }
    }
  }

  // second part
  const documentSlug = query.slugs?.at(0)
  const supabase = createPagesServerClient(context)

  try {
    const { data, error } = await supabase.auth.getSession()
    const docMetadata = await fetchDocument(documentSlug, data.session)
    let channels: any = null

    if (error) console.error('error:', error)

    if (data.session?.user) {
      const [upsertResult, channelsResult] = await Promise.allSettled([
        upsertWorkspace({
          id: docMetadata.documentId,
          name: docMetadata.title,
          description: docMetadata.description,
          slug: docMetadata.slug,
          created_by: data.session.user.id
        }),
        getChannelsByWorkspaceAndUserids(docMetadata.documentId, data.session.user.id)
      ])

      if (upsertResult.status === 'rejected') {
        throw new Error('Failed to upsert workspace', { cause: upsertResult.reason })
      }

      if (channelsResult.status === 'rejected') {
        throw new Error('Failed to get channels', { cause: channelsResult.reason })
      }

      channels = channelsResult.value

      // TODO: need db function to get all channels by workspaceId and not thread
      channels =
        channels?.data
          .filter((x: any) => x.workspace?.type && x.workspace?.type !== 'THREAD')
          .map((x: any) => ({ ...x, ...x.workspace })) || []
    }

    return {
      props: {
        channels: channels || null,
        docMetadata,
        showTurnstile: false,
        isMobile: device.mobile()
      }
    }
  } catch (error: any) {
    console.error('[getServerSideProps error]:', error)

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
