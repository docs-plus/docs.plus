import { useAuthStore, useChatStore } from '@stores'
import { useEffect, useState } from 'react'

let setUpsertWorkspace = false

const useMapDocumentAndWorkspace = (docMetadata: any, channels: any) => {
  const [loading, setLoading] = useState(true)
  const bulkSetChannels = useChatStore((state: any) => state.bulkSetChannels)
  const user = useAuthStore((state: any) => state.profile)
  const authLoading = useAuthStore((state) => state.loading)

  useEffect(() => {
    if (authLoading || setUpsertWorkspace) return
    const checkworkspace = async () => {
      setLoading(true)
      bulkSetChannels(channels)
      setUpsertWorkspace = true
      setLoading(false)
    }
    if (user) checkworkspace()
    else setLoading(false)
  }, [authLoading, user])

  return { loading }
}

export default useMapDocumentAndWorkspace
