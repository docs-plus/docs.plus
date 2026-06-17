import { useStore } from '@stores'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

const useInitiateDocumentAndWorkspace = (docMetadata: any) => {
  const router = useRouter()
  const slugs = router.query.slugs as string[]

  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  useEffect(() => {
    // Filtering is an instant, in-place fold — no full-doc skeleton. Toggle the
    // body class both ways so cleared filters don't leave stale `.filter-mode`.
    document.body.classList.toggle('filter-mode', (slugs?.length ?? 0) > 1)
  }, [slugs])

  useEffect(() => {
    if (!docMetadata) return
    setWorkspaceSetting('workspaceId', docMetadata.documentId)
    setWorkspaceSetting('metadata', docMetadata)
  }, [docMetadata, setWorkspaceSetting])
}

export default useInitiateDocumentAndWorkspace
