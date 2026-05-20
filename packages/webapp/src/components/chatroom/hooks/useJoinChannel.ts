import { joinChannel } from '@api'
import { useApi } from '@hooks/useApi'
import { useAuthStore, useChatStore } from '@stores'
import { useCallback } from 'react'

export function useJoinChannel(channelId: string) {
  const user = useAuthStore((state) => state.profile)
  const { loading, request } = useApi(joinChannel, null, false)
  const setOrUpdateChannel = useChatStore((state) => state.setOrUpdateChannel)
  const setWorkspaceChannelSetting = useChatStore((state) => state.setWorkspaceChannelSetting)
  const join = useCallback(async () => {
    if (!channelId || !user) return
    const { error, data } = await request({ channel_id: channelId })
    if (error) {
      console.error(error)
      return
    }
    setOrUpdateChannel(channelId, data.channel)
    setWorkspaceChannelSetting(channelId, 'isUserChannelMember', true)
  }, [channelId, user, request, setOrUpdateChannel, setWorkspaceChannelSetting])

  return { join, loading, user }
}
