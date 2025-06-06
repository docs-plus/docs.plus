import HeadSeo from '@components/HeadSeo'
import useMapDocumentAndWorkspace from '@hooks/useMapDocumentAndWorkspace'
import useInitiateDocumentAndWorkspace from '@hooks/useInitiateDocumentAndWorkspace'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import DocumentLayouts from '@components/pages/document/layouts/DocumentLayouts'
import useDocumentMetadata from '@hooks/useDocumentMetadata'
import { useAuthStore, useStore } from '@stores'
import { useRouter } from 'next/router'
import { GoogleOneTapLayout } from '@layouts'
import { SlugPageLoader } from '@components/skeleton/SlugPageLoader'
import useJoinWorkspace from '@hooks/useJoinWorkspace'

type DocumentPageProps = {
  docMetadata: any
  isMobile: boolean
  channels: any
}

const DocumentPage = ({ docMetadata, isMobile, channels }: DocumentPageProps) => {
  const router = useRouter()
  const slugs = (router.query.slugs as string[]) || []
  const { loading } = useMapDocumentAndWorkspace(docMetadata, channels)
  const {
    editor: { providerSyncing }
  } = useStore((state) => state.settings)

  useDocumentMetadata(slugs, docMetadata)
  useInitiateDocumentAndWorkspace(docMetadata)
  const { provider } = useYdocAndProvider()
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
    </GoogleOneTapLayout>
  )
}

export default DocumentPage
