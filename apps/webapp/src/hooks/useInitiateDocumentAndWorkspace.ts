import { useStore } from '@stores'
import { useEffect } from 'react'

const useInitiateDocumentAndWorkspace = (docMetadata: any) => {
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  useEffect(() => {
    if (!docMetadata) return
    setWorkspaceSetting('workspaceId', docMetadata.documentId)
    setWorkspaceSetting('metadata', docMetadata)
  }, [docMetadata, setWorkspaceSetting])
}

export default useInitiateDocumentAndWorkspace
