import { supabaseClient } from '@utils/supabase'
import { useStore, useAuthStore, useChatStore } from '@stores'
import { getChannels } from '@api'
import { useEffect, useState } from 'react'

const useMapDocumentAndWorkspace = (docMetadata: any) => {
  const [loading, setLoading] = useState(true)
  const bulkSetChannels = useChatStore((state: any) => state.bulkSetChannels)
  const user = useAuthStore((state: any) => state.profile)

  useEffect(() => {
    const checkworkspace = async () => {
      setLoading(true)
      try {
        const data = await supabaseClient
          .from('workspaces')
          .upsert({
            id: docMetadata.documentId,
            name: docMetadata.title,
            description: docMetadata.description,
            slug: docMetadata.slug,
            created_by: user.id
          })
          .select()

        const { data: channels } = await getChannels(docMetadata.documentId)
        if (channels) bulkSetChannels(channels)
      } catch (error) {
        console.error('checkworkspace error:', error)
      } finally {
        setLoading(false)
      }
    }
    if (user) checkworkspace()
    else setLoading(false)
  }, [user])

  return { loading }
}

export default useMapDocumentAndWorkspace
