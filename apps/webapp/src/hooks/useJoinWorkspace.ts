import { joinWorkspace } from '@api'
import { useAuthStore, useStore } from '@stores'
import { useEffect, useRef } from 'react'

type UseJoinWorkspaceParams = {
  documentId: string
  channelsLoading: boolean
}

export default function useJoinWorkspace({
  documentId,
  channelsLoading
}: UseJoinWorkspaceParams): void {
  const userId = useAuthStore((state) => state.profile?.id) ?? ''
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const joinKey = `${userId}:${documentId}`
  const joinKeyRef = useRef('')

  // The flag means this user joined this document's workspace. The chat writes and the
  // Follow toggle need that membership row. So a new user or document clears the flag,
  // and a late answer for an old pair does nothing.
  useEffect(() => {
    joinKeyRef.current = joinKey
    const { joinedWorkspace, joinWorkspaceFailed } = useStore.getState().settings
    if (joinedWorkspace) setWorkspaceSetting('joinedWorkspace', false)
    if (joinWorkspaceFailed) setWorkspaceSetting('joinWorkspaceFailed', false)
    return () => {
      joinKeyRef.current = ''
    }
  }, [joinKey, setWorkspaceSetting])

  useEffect(() => {
    if (!userId || !documentId || channelsLoading) return
    joinWorkspace({ workspaceId: documentId })
      .then((response) => {
        if (joinKeyRef.current !== joinKey) return
        if (response.error) throw response.error
        setWorkspaceSetting('joinedWorkspace', true)
      })
      .catch((error) => {
        console.error('[workspace], joinWorkspaceRequest!', error)
        if (joinKeyRef.current === joinKey) setWorkspaceSetting('joinWorkspaceFailed', true)
      })
  }, [userId, documentId, channelsLoading, joinKey, setWorkspaceSetting])
}
