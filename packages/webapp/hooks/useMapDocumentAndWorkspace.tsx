import { upsertWorkspace, getChannels, getChannelsWithMessageCounts } from '@api'
import { useAuthStore, useChatStore } from '@stores'
import { useEffect, useState } from 'react'
import Config from '@config'
import { Channel } from '@types'
let setUpsertWorkspace = false

const useMapDocumentAndWorkspace = (docMetadata: any, channels: any) => {
  const [loading, setLoading] = useState(true)
  const bulkSetChannels = useChatStore((state: any) => state.bulkSetChannels)
  const user = useAuthStore((state: any) => state.profile)
  const authLoading = useAuthStore((state) => state.loading)
  const clearAndInitialChannels = useChatStore((state) => state.clearAndInitialChannels)

  useEffect(() => {
    if (!channels) return
    clearAndInitialChannels(channels)
  }, [channels])

  useEffect(() => {
    if (authLoading || setUpsertWorkspace) return
    const checkworkspace = async () => {
      setLoading(true)
      try {
        await upsertWorkspace({
          id: docMetadata.documentId,
          name: docMetadata.title,
          description: docMetadata.description,
          slug: docMetadata.slug,
          created_by: user?.id || Config.chat.systemUserId
        })

        let channels: Channel[] = []
        if (!user) {
          const { data: channelMessageCounts } = await getChannelsWithMessageCounts(
            docMetadata.documentId
          )
          channels = channelMessageCounts || []
        } else {
          const { data } = await getChannels(docMetadata.documentId)
          channels = data || []
        }
        if (channels) bulkSetChannels(channels)
      } catch (error) {
        console.error('check workspace error:', error)
      } finally {
        setUpsertWorkspace = true
        setLoading(false)
      }
    }
    checkworkspace()
  }, [authLoading, user])

  return { loading }
}

export default useMapDocumentAndWorkspace
