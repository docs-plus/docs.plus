import { join2Workspace } from '@api'
import { useApi } from '@hooks/useApi'
import { useAuthStore, useStore } from '@stores'
import { useEffect } from 'react'

type UseJoinWorkspaceParams = {
  documentId: string
  loading: boolean
}

export default function useJoinWorkspace({ documentId, loading }: UseJoinWorkspaceParams) {
  const user = useAuthStore((state) => state.profile)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  const { request: join2WorkspaceRequest, loading: join2WorkspaceLoading } = useApi(
    join2Workspace,
    null,
    false
  )

  useEffect(() => {
    if (!user || !documentId || loading) return
    join2WorkspaceRequest({
      workspaceId: documentId
    }).catch((error) => {
      console.error('[workspace], join2WorkspaceRequest!', error)
    })
  }, [user?.id, documentId, loading, join2WorkspaceRequest])

  useEffect(() => {
    if (!join2WorkspaceLoading) return

    setWorkspaceSetting('joined2Workspace', true)
  }, [join2WorkspaceLoading])

  return { join2WorkspaceLoading }
}
