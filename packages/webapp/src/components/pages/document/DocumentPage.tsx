import HeadSeo from '@components/HeadSeo'
import DocumentLayouts from '@components/pages/document/layouts/DocumentLayouts'
import { SlugPageLoader } from '@components/skeleton/SlugPageLoader'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import useDocumentMetadata from '@hooks/useDocumentMetadata'
import useInitiateDocumentAndWorkspace from '@hooks/useInitiateDocumentAndWorkspace'
import useJoinWorkspace from '@hooks/useJoinWorkspace'
import useMapDocumentAndWorkspace from '@hooks/useMapDocumentAndWorkspace'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import { GoogleOneTapLayout } from '@layouts'
import { useStore } from '@stores'
import { useRouter } from 'next/router'

type DocumentPageProps = {
  docMetadata: any
  isMobile: boolean
  channels: any
  accessToken: string
}

const DocumentPage = ({ docMetadata, isMobile, channels, accessToken }: DocumentPageProps) => {
  const router = useRouter()
  const slugs = (router.query.slugs as string[]) || []
  const { loading } = useMapDocumentAndWorkspace(docMetadata, channels)
  const {
    editor: { providerSyncing }
  } = useStore((state) => state.settings)

  useDocumentMetadata(slugs, docMetadata)
  useInitiateDocumentAndWorkspace(docMetadata)
  // Pass deviceType for document view analytics
  const deviceType = isMobile ? 'mobile' : 'desktop'
  const { provider } = useYdocAndProvider({ accessToken, deviceType })
  const { join2WorkspaceLoading } = useJoinWorkspace({
    documentId: docMetadata.documentId,
    loading
  })

  if (loading || providerSyncing || join2WorkspaceLoading) {
    return (
      <>
        <HeadSeo />
        <SlugPageLoader loading={loading} providerSyncing={providerSyncing} />
      </>
    )
  }

  return (
    <GoogleOneTapLayout>
      <HeadSeo />
      <DocumentLayouts isMobile={isMobile} provider={provider} />
      <GlobalDialog />
    </GoogleOneTapLayout>
  )
}

export default DocumentPage
