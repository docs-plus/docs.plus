import { getChannels, getChannelsWithMessageCounts } from '@api'
import { useAuthStore, useChatStore } from '@stores'
import { Channel } from '@types'
import { logger } from '@utils/logger'
import { useEffect, useState } from 'react'

interface DocMetadata {
  documentId: string
  title: string
  description: string
  slug: string
}

interface UseMapDocumentAndWorkspaceResult {
  loading: boolean
  error: Error | null
}

const useMapDocumentAndWorkspace = (docMetadata: DocMetadata): UseMapDocumentAndWorkspaceResult => {
  const [isWorkspaceUpserted, setIsWorkspaceUpserted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const profile = useAuthStore((state) => state.profile)
  const bulkSetChannels = useChatStore((state) => state.bulkSetChannels)
  const authLoading = useAuthStore((state) => state.loading)
  const clearAndInitialChannels = useChatStore((state) => state.clearAndInitialChannels)

  useEffect(() => {
    setIsWorkspaceUpserted(false)
  }, [docMetadata.documentId, profile?.id])

  // bulkSetChannels only merges — this is the sole clearing path on doc switch.
  useEffect(() => {
    clearAndInitialChannels([])
  }, [docMetadata.documentId, clearAndInitialChannels])

  const fetchChannels = async (
    documentId: string,
    userId: string | undefined
  ): Promise<Channel[]> => {
    if (!userId) {
      const { data: channelMessageCounts } = await getChannelsWithMessageCounts(documentId)
      return (
        channelMessageCounts?.map((channel: Channel) =>
          channel
            ? {
                ...channel,
                unread_message_count: channel.count?.message_count || 0
              }
            : channel
        ) || []
      )
    }

    const { data } = await getChannels(documentId, userId)
    return data || []
  }

  useEffect(() => {
    if (authLoading || isWorkspaceUpserted) return

    let isMounted = true

    const initializeWorkspace = async () => {
      setLoading(true)
      setError(null)
      try {
        // The workspace row is written server-side by join_workspace (SECURITY
        // DEFINER, via useJoinWorkspace). PostgREST cannot write it. `on_conflict`
        // and `select` both pull workspaces_member_select onto the new row, and the
        // caller is not a member yet, so the insert always 403s. See CLAUDE.md.
        const channels = await fetchChannels(docMetadata.documentId, profile?.id)
        if (isMounted && channels) {
          bulkSetChannels(channels)
          setIsWorkspaceUpserted(true)
        }
      } catch (err) {
        logger.error('[Workspace initialization error]', err, {
          documentId: docMetadata.documentId
        })
        if (isMounted)
          setError(err instanceof Error ? err : new Error('Failed to initialize workspace'))
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initializeWorkspace()

    return () => {
      isMounted = false
    }
  }, [
    authLoading,
    isWorkspaceUpserted,
    profile?.id,
    docMetadata.documentId,
    docMetadata.title,
    docMetadata.description,
    docMetadata.slug,
    bulkSetChannels
  ])

  return { loading, error }
}

export default useMapDocumentAndWorkspace
