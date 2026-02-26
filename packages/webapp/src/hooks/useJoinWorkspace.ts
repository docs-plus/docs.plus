import { joinWorkspace } from '@api'
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

  const { request: joinWorkspaceRequest, loading: joinWorkspaceLoading } = useApi(
    joinWorkspace,
    null,
    false
  )

  useEffect(() => {
    if (!user || !documentId || loading) return
    joinWorkspaceRequest({
      workspaceId: documentId
    }).catch((error) => {
      console.error('[workspace], joinWorkspaceRequest!', error)
    })
  }, [user?.id, documentId, loading, joinWorkspaceRequest])

  useEffect(() => {
    if (!joinWorkspaceLoading) return

    setWorkspaceSetting('joinedWorkspace', true)
  }, [joinWorkspaceLoading])

  return { joinWorkspaceLoading }
}
