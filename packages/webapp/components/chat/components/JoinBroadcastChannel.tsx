import { supabaseClient } from '@utils/supabase'
import { useEffect, useState, useCallback } from 'react'
import { useStore, useAuthStore, useChatStore } from '@stores'
import { join2Channel } from '@api'
import { useApi } from '@hooks/useApi'
import { useChannel } from '../context/ChannelProvider'

export default function JoinBroadcastChannel() {
  const { channelId } = useChannel()

  const [mute, setMute] = useState(false)
  const channelSettings = useStore((state: any) => state.workspaceSettings.channels.get(channelId))
  const { isUserChannelMember } = channelSettings || {}
  const user = useAuthStore((state) => state.profile)
  const { loading, request: request2JoinChannel } = useApi(join2Channel, null, false)

  const channelMemberInfo = useChatStore((state) => state.channelMembers.get(channelId))
  const setOrUpdateChannel = useChatStore((state) => state.setOrUpdateChannel)
  const channel = useChatStore((state) => state.channels.get(channelId))
  const setWorkspaceChannelSetting = useChatStore((state: any) => state.setWorkspaceChannelSetting)

  useEffect(() => {
    if (!channelMemberInfo || !user) return
    const currentChannelMember = channelMemberInfo.get(user.id)
    setMute(currentChannelMember?.mute_in_app_notifications)
  }, [channelMemberInfo, user])

  const joinUserToChannel = useCallback(async () => {
    if (!channel) return
    try {
      if (user) {
        const { error, data } = await request2JoinChannel({
          channel_id: channelId,
          member_id: user?.id
        })
        if (error) console.error(error)
        setOrUpdateChannel(channelId, {
          ...data.channel,
          member_count: (channel?.member_count ?? 0) + 1
        })
      }

      setWorkspaceChannelSetting(channelId, 'isUserChannelMember', user ? true : false)
    } catch (error) {
      console.error(error)
    }
  }, [user, channelId, channel])

  // we do not need to reload the page, the mute/unmute notification will be handled from the server
  const muteHandler = useCallback(
    async (muteOrUnmute: boolean) => {
      setMute(muteOrUnmute)

      try {
        // TODO: move to api layer
        const { error } = await supabaseClient
          .from('channel_members')
          .update({
            mute_in_app_notifications: muteOrUnmute
          })
          .eq('channel_id', channelId)
          .eq('member_id', user?.id)
          .select()

        if (error) {
          console.error(error)
        }
      } catch (error) {
        console.error(error)
      }
    },
    [user, channelId]
  )

  if (!user || !channelId) return null

  return (
    <div className="flex w-full flex-col items-center justify-center p-2">
      {isUserChannelMember ? (
        <button className="btn btn-block" onClick={() => muteHandler(!mute)}>
          {mute ? 'Unmute' : 'Mute'}
        </button>
      ) : (
        <button className="btn btn-block" onClick={joinUserToChannel}>
          Join
          {loading && <span className="loading loading-spinner ml-auto"></span>}
        </button>
      )}
    </div>
  )
}
