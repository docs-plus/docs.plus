import { type GetServerSidePropsContext } from 'next'
import React from 'react'
import useAddDeviceTypeHtmlClass from '@components/pages/document/hooks/useAddDeviceTypeHtmlClass'
import dynamic from 'next/dynamic'
import { documentServerSideProps } from '@helpers'
import { SlugPageLoader } from '@components/skeleton/SlugPageLoader'
import data from '@emoji-mart/data'
import { init } from 'emoji-mart'

// Initialize emoji-mart
init({ data })

const DocumentPage = dynamic(() => import('@components/pages/document/DocumentPage'), {
  ssr: false,
  loading: () => <SlugPageLoader loadingPage={true} />
})

const Document = ({ docMetadata, isMobile, channels, session }: any) => {
  useAddDeviceTypeHtmlClass(isMobile)

  return (
    <DocumentPage
      docMetadata={docMetadata}
      isMobile={isMobile}
      channels={channels}
      accessToken={session?.access_token}
    />
  )
}

export default Document

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return documentServerSideProps(context)
}
