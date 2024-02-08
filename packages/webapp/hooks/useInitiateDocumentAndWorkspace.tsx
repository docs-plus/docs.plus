import { useEffect } from 'react'
import { useStore } from '@stores'
import { useRouter } from 'next/router'

const useInitiateDocumentAndWorkspace = (docMetadata: any) => {
  const router = useRouter()
  const slugs = router.query.slugs as string[]

  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const {
    editor: { applyingFilters }
  } = useStore((state) => state.settings)

  const isFilterMode = slugs.length > 1
  useEffect(() => {
    if (isFilterMode) {
      document.body.classList.add('filter-mode')
      setWorkspaceEditorSetting('applyingFilters', true)
    }
  }, [slugs, applyingFilters, isFilterMode])

  useEffect(() => {
    if (!docMetadata) return
    setWorkspaceSetting('workspaceId', docMetadata.documentId)
    setWorkspaceSetting('metadata', docMetadata)
  }, [docMetadata])
}

export default useInitiateDocumentAndWorkspace
