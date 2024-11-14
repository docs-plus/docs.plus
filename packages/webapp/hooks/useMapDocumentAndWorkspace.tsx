import { upsertWorkspace, getChannels } from '@api'
import { useAuthStore, useChatStore } from '@stores'
import { useEffect, useState } from 'react'

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
          created_by: user.id
        })

        const { data: channels } = await getChannels(docMetadata.documentId)
        if (channels) bulkSetChannels(channels)
      } catch (error) {
        console.error('check workspace error:', error)
      } finally {
        setUpsertWorkspace = true
        setLoading(false)
      }
      // setUpsertWorkspace = true
      setLoading(false)
    }
    if (user) checkworkspace()
    else setLoading(false)
  }, [authLoading, user])

  return { loading }
}

export default useMapDocumentAndWorkspace
