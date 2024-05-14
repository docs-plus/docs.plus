import { useCallback } from 'react'
import { useStore } from '@stores'
import { useAuthStore, useChatStore } from '@stores'
import { join2Channel } from '@api'
import { useApi } from '@hooks/useApi'
import { useChannel } from '../context/ChannelProvider'

export default function JoinGroupChannel() {
  const { channelId } = useChannel()

  const user = useAuthStore((state) => state.profile)
  const { loading, request: request2JoinChannel } = useApi(join2Channel, null, false)
  const setOrUpdateChannel = useChatStore((state) => state.setOrUpdateChannel)
  const channel = useChatStore((state) => state.channels.get(channelId))
  const setWorkspaceChannelSetting = useChatStore((state: any) => state.setWorkspaceChannelSetting)

  // TODO: move to api layer
  const joinToChannel = useCallback(async () => {
    if (!channelId) return
    try {
      const { error, data } = await request2JoinChannel({
        channel_id: channelId,
        member_id: user?.id
      })

      if (error) console.error(error)
      setWorkspaceChannelSetting(channelId, 'isUserChannelMember', true)
      setOrUpdateChannel(channelId, {
        ...data.channel,
        member_count: (channel?.member_count ?? 0) + 1
      })
    } catch (error) {
      console.error(error)
    }
  }, [user, channelId, channel])

  if (!user || !channelId) return null

  return (
    <div className="flex w-full flex-col items-center justify-center p-2">
      <button className="btn btn-block" onClick={joinToChannel}>
        Join Channel
        {loading && <span className="loading loading-spinner ml-auto"></span>}
      </button>
    </div>
  )
}
