import useAddDeviceTypeHtmlClass from '@components/pages/document/hooks/useAddDeviceTypeHtmlClass'
import { SlugPageLoader } from '@components/skeleton/SlugPageLoader'
import data from '@emoji-mart/data'
import { documentServerSideProps } from '@helpers'
import { init } from 'emoji-mart'
import { type GetServerSidePropsContext } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import React from 'react'

// Initialize emoji-mart
init({ data })

const DocumentPage = dynamic(() => import('@components/pages/document/DocumentPage'), {
  ssr: false,
  loading: () => <SlugPageLoader loadingPage={true} />
})

/**
 * Site URL for absolute OG/meta tags.
 * Social crawlers require absolute URLs — relative paths like "/icons/..." are ignored.
 * Falls back gracefully for local development.
 */
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://docs.plus'
const DEFAULT_OG_IMAGE = `${SITE_URL}/icons/android-chrome-512x512.png`

const Document = ({ docMetadata, isMobile, channels, session }: any) => {
  useAddDeviceTypeHtmlClass(isMobile)

  // Build SSR-safe OG metadata from server-fetched docMetadata
  const ogTitle = docMetadata?.title || 'docs.plus'
  const ogDescription =
    docMetadata?.description ||
    'docs.plus is an open-source, real-time collaborative tool that enables communities to share and organize knowledge efficiently.'
  const ogUrl = docMetadata?.slug ? `${SITE_URL}/${docMetadata.slug}` : SITE_URL
  const ogImage = DEFAULT_OG_IMAGE

  return (
    <>
      {/*
        OG/Twitter tags rendered SERVER-SIDE — this is critical.
        Social crawlers (Slack, Discord, Twitter, Facebook, iMessage, LinkedIn)
        do NOT execute JavaScript. They only see server-rendered HTML.
        HeadSeo.tsx inside DocumentPage is ssr:false and will NOT be seen by crawlers.
      */}
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />

        {/* Open Graph — server-rendered for social crawlers */}
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:url" content={ogUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />

        {/* Twitter Card — server-rendered for Twitter/X crawler */}
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:url" content={ogUrl} />
        <meta name="twitter:image" content={ogImage} />
      </Head>

      <DocumentPage
        docMetadata={docMetadata}
        isMobile={isMobile}
        channels={channels}
        accessToken={session?.access_token}
      />
    </>
  )
}

export default Document

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return documentServerSideProps(context)
}
