import { type GetServerSidePropsContext } from 'next'
import React from 'react'
import HeadSeo from '@components/HeadSeo'
import useAddDeviceTypeHtmlClass from '@components/pages/document/hooks/useAddDeviceTypeHtmlClass'
import { useHandleTurnstileVerficationState } from '@hooks/useHandleTurnstileVerficationState'
import dynamic from 'next/dynamic'
import { documentServerSideProps } from '@helpers'
import { SlugPageLoader } from '@components/skeleton/SlugPageLoader'
import { SlugPageLoaderWithTurnstile } from '@components/skeleton/SlugPageLoaderWithTurnstile'
import data from '@emoji-mart/data'
import { init } from 'emoji-mart'

// Initialize emoji-mart
init({ data })

const DocumentPage = dynamic(() => import('@components/pages/document/DocumentPage'), {
  ssr: false,
  loading: () => <SlugPageLoader loadingPage={true} />
})

const Document = ({ docMetadata, isMobile, channels, showTurnstile, session }: any) => {
  useAddDeviceTypeHtmlClass(isMobile)
  useHandleTurnstileVerficationState(showTurnstile)

  // if (showTurnstile) {
  //   return (
  //     <>
  //       <HeadSeo />
  //       <SlugPageLoaderWithTurnstile showTurnstile={showTurnstile} />
  //     </>
  //   )
  // }

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
  const result = await documentServerSideProps(context).catch((error) => {
    console.error('Error in getServerSideProps:', error)
    return {
      props: {}
    }
  })

  return result
}
