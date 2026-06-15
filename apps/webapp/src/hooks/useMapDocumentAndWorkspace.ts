import { getChannels, getChannelsWithMessageCounts, upsertWorkspace } from '@api'
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
        // Workspace bootstrap is authenticated-only. RLS requires
        // `created_by = auth.uid()`, so anon callers can't insert. Anon
        // still fetches channels via getChannelsWithMessageCounts below
        // (read-only path through PUBLIC RLS policies).
        if (profile?.id) {
          await upsertWorkspace({
            id: docMetadata.documentId,
            name: docMetadata.title,
            description: docMetadata.description,
            slug: docMetadata.slug,
            created_by: profile.id
          })
        }

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
