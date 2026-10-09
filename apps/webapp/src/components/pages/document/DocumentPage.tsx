import HeadSeo from '@components/HeadSeo'
import DocumentLayouts from '@components/pages/document/layouts/DocumentLayouts'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import useInitiateDocumentAndWorkspace from '@hooks/useInitiateDocumentAndWorkspace'
import useJoinWorkspace from '@hooks/useJoinWorkspace'
import useMapDocumentAndWorkspace from '@hooks/useMapDocumentAndWorkspace'
import useTouchDocumentOpened from '@hooks/useTouchDocumentOpened'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import { GoogleOneTapLayout } from '@layouts'
import { closeOpenChatRoom } from '@services/openHeadingChatroom'
import { useStore } from '@stores'
import { ensureEmojiData } from '@utils/ensureEmojiData'
import { useEffect, useLayoutEffect } from 'react'

type DocumentPageProps = {
  docMetadata: any
  isMobile: boolean
  deviceType?: 'desktop' | 'mobile' | 'tablet'
}

const DocumentPage = ({ docMetadata, isMobile, deviceType = 'desktop' }: DocumentPageProps) => {
  const { loading: channelsLoading } = useMapDocumentAndWorkspace(docMetadata)

  // The page's single gate: set synchronously at provider creation (no network wait),
  // nulled on destroy (doc switch). Channel, join, and sync state must never re-gate
  // this tree — once the layout mounts, the editor is never unmounted for the same doc.
  const provider = useStore((state) => state.settings.hocuspocusProvider)

  useInitiateDocumentAndWorkspace(docMetadata)
  useYdocAndProvider({
    documentId: docMetadata.documentId,
    slug: docMetadata.slug,
    deviceType
  })
  useJoinWorkspace({ documentId: docMetadata.documentId, channelsLoading })
  useTouchDocumentOpened(docMetadata.documentId, docMetadata.ownerId)

  useEffect(() => {
    ensureEmojiData()
  }, [])

  // This page stays mounted across a document switch. The layout cleanup closes A's room
  // before B paints, while the presence channel is still A's.
  useLayoutEffect(() => closeOpenChatRoom, [docMetadata.documentId])

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
