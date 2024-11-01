import { type GetServerSidePropsContext } from 'next'
import React from 'react'
import HeadSeo from '@components/HeadSeo'
import { LoadingDots } from '@components/LoadingDots'
import { useStore } from '@stores'
import TurnstilePage from '@components/TurnstilePage'
import useAddDeviceTypeHtmlClass from '@components/pages/document/hooks/useAddDeviceTypeHtmlClass'
import dynamic from 'next/dynamic'
import { documentServerSideProps } from '@helpers'

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
  return documentServerSideProps(context)
}
