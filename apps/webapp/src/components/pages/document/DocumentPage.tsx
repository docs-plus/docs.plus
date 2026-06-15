import HeadSeo from '@components/HeadSeo'
import DocumentLayouts from '@components/pages/document/layouts/DocumentLayouts'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import useDocumentMetadata from '@hooks/useDocumentMetadata'
import useInitiateDocumentAndWorkspace from '@hooks/useInitiateDocumentAndWorkspace'
import useJoinWorkspace from '@hooks/useJoinWorkspace'
import useMapDocumentAndWorkspace from '@hooks/useMapDocumentAndWorkspace'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import { GoogleOneTapLayout } from '@layouts'
import { useStore } from '@stores'
import { ensureEmojiData } from '@utils/ensureEmojiData'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

type DocumentPageProps = {
  docMetadata: any
  isMobile: boolean
  deviceType?: 'desktop' | 'mobile' | 'tablet'
  accessToken?: string | null
}

const DocumentPage = ({
  docMetadata,
  isMobile,
  deviceType = 'desktop',
  accessToken
}: DocumentPageProps) => {
  const router = useRouter()
  const slugs = (router.query.slugs as string[]) || []
  const { loading: channelsLoading } = useMapDocumentAndWorkspace(docMetadata)

  // The page's single gate: set synchronously at provider creation (no network wait),
  // nulled on destroy (doc switch). Channel, join, and sync state must never re-gate
  // this tree — once the layout mounts, the editor is never unmounted for the same doc.
  const provider = useStore((state) => state.settings.hocuspocusProvider)

  useDocumentMetadata(slugs, docMetadata)
  useInitiateDocumentAndWorkspace(docMetadata)
  useYdocAndProvider({
    documentId: docMetadata.documentId,
    slug: docMetadata.slug,
    accessToken: accessToken ?? '',
    deviceType
  })
  useJoinWorkspace({ documentId: docMetadata.documentId, channelsLoading })

  useEffect(() => {
    ensureEmojiData()
  }, [])

  if (!provider) return <HeadSeo />

  return (
    <GoogleOneTapLayout>
      <HeadSeo />
      <DocumentLayouts isMobile={isMobile} provider={provider} />
      <GlobalDialog />
    </GoogleOneTapLayout>
  )
}

export default DocumentPage
