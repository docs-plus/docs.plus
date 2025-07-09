import { type GetServerSidePropsContext } from 'next'
import React from 'react'
import HeadSeo from '@components/HeadSeo'
import useAddDeviceTypeHtmlClass from '@components/pages/document/hooks/useAddDeviceTypeHtmlClass'
import { useHandleTurnstileVerficationState } from '@hooks/useHandleTurnstileVerficationState'
import dynamic from 'next/dynamic'
import { documentServerSideProps } from '@helpers'
import { SlugPageLoader } from '@components/skeleton/SlugPageLoader'
import { SlugPageLoaderWithTurnstile } from '@components/skeleton/SlugPageLoaderWithTurnstile'
const DocumentPage = dynamic(() => import('@components/pages/document/DocumentPage'), {
  ssr: false,
  loading: () => <SlugPageLoader loadingPage={true} />
})

const Document = ({ docMetadata, isMobile, channels, showTurnstile }: any) => {
  useAddDeviceTypeHtmlClass(isMobile)
  useHandleTurnstileVerficationState(showTurnstile)

  if (showTurnstile) {
    return (
      <>
        <HeadSeo />
        <SlugPageLoaderWithTurnstile showTurnstile={showTurnstile} />
      </>
    )
  }

  return <DocumentPage docMetadata={docMetadata} isMobile={isMobile} channels={channels} />
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
