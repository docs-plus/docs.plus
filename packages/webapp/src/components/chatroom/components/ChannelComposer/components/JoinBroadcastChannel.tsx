import { supabaseClient } from '@utils/supabase'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuthStore, useChatStore } from '@stores'
import { join2Channel } from '@api'
import { useApi } from '@hooks/useApi'
import { TChannelSettings } from '@types'
import { useChatroomContext } from '../../../ChatroomContext'
import Button from '@components/ui/Button'
import { LuBell, LuBellOff, LuUserPlus } from 'react-icons/lu'

export default function JoinBroadcastChannel() {
  const { channelId } = useChatroomContext()

  const [mute, setMute] = useState(false)
  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )
  // @ts-ignore
  const { isUserChannelMember } = channelSettings || {}
  const user = useAuthStore((state) => state.profile)
  const { loading, request: request2JoinChannel } = useApi(join2Channel, null, false)

  const channelMemberInfo = useChatStore((state) => state.channelMembers.get(channelId))
  const setOrUpdateChannel = useChatStore((state) => state.setOrUpdateChannel)
  const channelChat = useChatStore((state) => state.channels)
  const channel = useMemo(() => channelChat.get(channelId) ?? {}, [channelChat, channelId])
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
          //@ts-ignore
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
    <div className="border-base-300 bg-base-100 flex w-full items-center justify-center border-t p-3">
      {isUserChannelMember ? (
        <Button
          variant="ghost"
          shape="wide"
          size="sm"
          startIcon={mute ? LuBell : LuBellOff}
          onClick={() => muteHandler(!mute)}>
          {mute ? 'Unmute notifications' : 'Mute notifications'}
        </Button>
      ) : (
        <Button
          variant="primary"
          shape="wide"
          size="sm"
          startIcon={LuUserPlus}
          onClick={joinUserToChannel}
          loading={loading}>
          Join Channel
        </Button>
      )}
    </div>
  )
}
