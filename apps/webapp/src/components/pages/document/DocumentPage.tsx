import HeadSeo from '@components/HeadSeo'
import DocumentLayouts from '@components/pages/document/layouts/DocumentLayouts'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import usePadSession from '@hooks/usePadSession'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import { GoogleOneTapLayout } from '@layouts'
import { useStore } from '@stores'
import { ensureEmojiData } from '@utils/ensureEmojiData'
import type { DocumentMetadata } from '@utils/fetchDocument'
import { useEffect } from 'react'

type DocumentPageProps = {
  docMetadata: DocumentMetadata
  isMobile: boolean
  deviceType?: 'desktop' | 'mobile' | 'tablet'
}

const DocumentPage = ({ docMetadata, isMobile, deviceType = 'desktop' }: DocumentPageProps) => {
  usePadSession(docMetadata)

  // The page's single gate: set synchronously at provider creation (no network wait),
  // nulled on destroy (doc switch). Channel, join, and sync state must never re-gate
  // this tree — once the layout mounts, the editor is never unmounted for the same doc.
  const provider = useStore((state) => state.settings.hocuspocusProvider)

  useYdocAndProvider({
    documentId: docMetadata.documentId,
    slug: docMetadata.slug,
    deviceType
  })

  useEffect(() => {
    ensureEmojiData()
  }, [])

  if (!provider) return <HeadSeo />

  return (
    <GoogleOneTapLayout enabled={!isMobile}>
      <HeadSeo />
      <DocumentLayouts isMobile={isMobile} provider={provider} />
      <GlobalDialog />
    </GoogleOneTapLayout>
  )
}

export default DocumentPage
