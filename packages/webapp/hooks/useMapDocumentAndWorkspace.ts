import { upsertWorkspace, getChannels, getChannelsWithMessageCounts } from '@api'
import { useAuthStore, useChatStore } from '@stores'
import { useEffect, useState } from 'react'
import Config from '@config'
import { Channel } from '@types'

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

const useMapDocumentAndWorkspace = (
  docMetadata: DocMetadata,
  initialChannels?: Channel[]
): UseMapDocumentAndWorkspaceResult => {
  const [isWorkspaceUpserted, setIsWorkspaceUpserted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const profile = useAuthStore((state) => state.profile)
  const bulkSetChannels = useChatStore((state) => state.bulkSetChannels)
  const authLoading = useAuthStore((state) => state.loading)
  const clearAndInitialChannels = useChatStore((state) => state.clearAndInitialChannels)

  // Handle initial channels
  useEffect(() => {
    if (!initialChannels) return
    clearAndInitialChannels(initialChannels)
  }, [initialChannels])

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
        // move this to server side
        await upsertWorkspace({
          id: docMetadata.documentId,
          name: docMetadata.title,
          description: docMetadata.description,
          slug: docMetadata.slug,
          created_by: profile?.id || Config.chat.systemUserId
        })

        const channels = await fetchChannels(docMetadata.documentId, profile?.id)
        if (isMounted && channels) {
          bulkSetChannels(channels)
          setIsWorkspaceUpserted(true)
        }
      } catch (err) {
        console.error('[Workspace initialization error]:', err)
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
  }, [authLoading, profile])

  return { loading, error }
}

export default useMapDocumentAndWorkspace
