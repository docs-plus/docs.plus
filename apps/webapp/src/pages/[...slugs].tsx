import PrivateDocumentGate from '@components/pages/document/components/PrivateDocumentGate'
import useAddDeviceTypeHtmlClass from '@components/pages/document/hooks/useAddDeviceTypeHtmlClass'
import { SlugPageLoader } from '@components/skeleton/SlugPageLoader'
import Button from '@components/ui/Button'
import { EmptyState } from '@components/ui/EmptyState'
import { useStore } from '@stores'
import { documentServerSideProps } from '@utils/documentServerSideProps'
import { isIPadDevice } from '@utils/platform'
import type { PrivateGateVariant } from '@utils/toPrivateGateVariant'
import { type GetServerSidePropsContext } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import React from 'react'

// Chunk-load failure (e.g. stale hashes after a deploy) would otherwise leave the
// SSR skeleton up forever — every in-app recovery path lives inside the failed chunk.
const ChunkLoadError = () => (
  <div className="bg-base-100 fixed inset-0 z-50 flex items-center justify-center">
    <EmptyState
      tone="error"
      title="Couldn’t load the editor."
      body="A new version may have been deployed."
      action={
        <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
          Reload
        </Button>
      }
    />
  </div>
)

const DocumentPage = dynamic(() => import('@components/pages/document/DocumentPage'), {
  ssr: false,
  loading: ({ error }) => (error ? <ChunkLoadError /> : null)
})

function resolveDeviceType(isMobileDevice: boolean, deviceType?: 'desktop' | 'mobile' | 'tablet') {
  if (!isMobileDevice) return 'desktop'
  if (deviceType === 'mobile' || deviceType === 'tablet') return deviceType
  return 'tablet'
}

const Document = ({
  docMetadata,
  isMobile,
  deviceType,
  isAuthed,
  gateVariant,
  slug,
  gateTitle
}: any) => {
  // iPadOS sends a Macintosh user-agent, so the server prop reads desktop. The store
  // write is an effect; `isIPadDevice` covers the first client paint so the html
  // class and DocumentPage do not spend a frame on desktop.
  const isMobileDevice =
    useStore((state) => state.settings.editor.isMobile) ?? (isMobile || isIPadDevice())
  const resolvedDeviceType = resolveDeviceType(isMobileDevice, deviceType)
  useAddDeviceTypeHtmlClass(isMobileDevice)

  // Zustand's initial state has no provider, so the skeleton is part of the SSR HTML
  // and survives the dynamic-chunk load without a remount. The skeleton unmounts exactly
  // when the real layout mounts (provider created), and returns on doc switch (provider destroyed).
  const hasProvider = useStore((state) => Boolean(state.settings.hocuspocusProvider))

  // Blocked viewers short-circuit BEFORE SlugPageLoader/DocumentPage — no provider, no WS,
  // no private title/description/OG. Hooks run first so the order stays stable across navs.
  if (gateVariant) {
    return (
      <>
        <Head>
          <title>docs.plus</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <PrivateDocumentGate
          variant={gateVariant as PrivateGateVariant}
          slug={slug}
          title={gateTitle}
        />
      </>
    )
  }

  // Title and OG tags live in _app.tsx (DocumentHead).
  return (
    <>
      {!hasProvider && <SlugPageLoader isMobile={isMobile} isAuthed={isAuthed} />}

      <DocumentPage
        docMetadata={docMetadata}
        isMobile={isMobileDevice}
        deviceType={resolvedDeviceType}
      />
    </>
  )
}

export default Document

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return documentServerSideProps(context)
}
