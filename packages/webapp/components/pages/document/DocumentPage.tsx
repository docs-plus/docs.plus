import HeadSeo from '@components/HeadSeo'
import { LoadingDots } from '@components/LoadingDots'
import useMapDocumentAndWorkspace from '@hooks/useMapDocumentAndWorkspace'
import useInitiateDocumentAndWorkspace from '@hooks/useInitiateDocumentAndWorkspace'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import DocumentLayouts from '@components/pages/document/layouts/DocumentLayouts'
import useDocumentMetadata from '@hooks/useDocumentMetadata'
import { useStore } from '@stores'
import { useRouter } from 'next/router'
import { GoogleOneTapLayout } from '@layouts'

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
  useYdocAndProvider()

  if (loading || providerSyncing) {
    return (
      <>
        <HeadSeo />
        <LoadingDots>
          {loading && <span>Hang tight! Fetching profile data</span>}
          {providerSyncing && <span>Hang tight! Provider is syncing</span>}
        </LoadingDots>
      </>
    )
  }

  return (
    <GoogleOneTapLayout>
      <DocumentLayouts isMobile={isMobile} />
    </GoogleOneTapLayout>
  )
}

export default DocumentPage
