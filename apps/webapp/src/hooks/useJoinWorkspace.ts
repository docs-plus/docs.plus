import { joinWorkspace } from '@api'
import { useAuthStore, useStore } from '@stores'
import { useEffect } from 'react'

type UseJoinWorkspaceParams = {
  documentId: string
  channelsLoading: boolean
}

export default function useJoinWorkspace({
  documentId,
  channelsLoading
}: UseJoinWorkspaceParams): void {
  const user = useAuthStore((state) => state.profile)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  useEffect(() => {
    if (!user || !documentId || channelsLoading) return
    joinWorkspace({ workspaceId: documentId })
      .then((response) => {
        if (response.error) throw response.error
        // Deep-link consumers gate on joinedWorkspace — it must mean membership
        // exists, not "request started".
        setWorkspaceSetting('joinedWorkspace', true)
      })
      .catch((error) => {
        console.error('[workspace], joinWorkspaceRequest!', error)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, documentId, channelsLoading])
}
