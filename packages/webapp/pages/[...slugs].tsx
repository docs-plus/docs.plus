import { type GetServerSidePropsContext } from 'next'
import React from 'react'
import HeadSeo from '@components/HeadSeo'
import { useStore } from '@stores'
import useAddDeviceTypeHtmlClass from '@components/pages/document/hooks/useAddDeviceTypeHtmlClass'
import dynamic from 'next/dynamic'
import { documentServerSideProps } from '@helpers'
import { SlugPageLoader } from '@components/skeleton/SlugPageLoader'
import { SlugPageLoaderWithTurnstile } from '@components/skeleton/SlugPageLoaderWithTurnstile'
const DocumentPage = dynamic(() => import('@components/pages/document/DocumentPage'), {
  ssr: false,
  loading: () => <SlugPageLoader loadingPage={true} />
})

const Document = ({ docMetadata, isMobile, channels, showTurnstile }: any) => {
  const { isTurnstileVerified } = useStore((state) => state.settings)

  useAddDeviceTypeHtmlClass(isMobile)

  if (!isTurnstileVerified) {
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
  return documentServerSideProps(context)
}
