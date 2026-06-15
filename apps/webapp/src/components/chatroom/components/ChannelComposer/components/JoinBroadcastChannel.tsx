import { useJoinChannel } from '@components/chatroom/hooks/useJoinChannel'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useChatStore } from '@stores'
import { supabaseClient } from '@utils/supabase'
import { useCallback, useEffect, useState } from 'react'

import { useChatroomContext } from '../../../ChatroomContext'
import { ChannelComposerSurface } from './ChannelComposerSurface'

export default function JoinBroadcastChannel() {
  const { channelId } = useChatroomContext()
  const { join, loading: joinLoading, user } = useJoinChannel(channelId)

  const [mute, setMute] = useState(false)
  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) ?? null
  )
  const { isUserChannelMember } = channelSettings || {}
  const channelMemberInfo = useChatStore((state) => state.channelMembers.get(channelId))

  useEffect(() => {
    if (!channelMemberInfo || !user) return
    const currentChannelMember = channelMemberInfo.get(user.id)
    setMute(currentChannelMember?.mute_in_app_notifications ?? false)
  }, [channelMemberInfo, user])

  const muteHandler = useCallback(
    async (muteOrUnmute: boolean) => {
      setMute(muteOrUnmute)
      try {
        const { error } = await supabaseClient
          .from('channel_members')
          .update({ mute_in_app_notifications: muteOrUnmute })
          .eq('channel_id', channelId)
          .eq('member_id', user?.id)
          .select()
        if (error) console.error(error)
      } catch (error) {
        console.error(error)
      }
    },
    [user, channelId]
  )

  if (!user || !channelId) return null

  return (
    <ChannelComposerSurface>
      {isUserChannelMember ? (
        <Button
          variant="ghost"
          shape="wide"
          size="sm"
          startIcon={mute ? Icons.notifications : Icons.notificationsOff}
          onClick={() => muteHandler(!mute)}>
          {mute ? 'Unmute notifications' : 'Mute notifications'}
        </Button>
      ) : (
        <Button
          variant="primary"
          shape="wide"
          size="sm"
          startIcon={Icons.userPlus}
          onClick={() => void join()}
          loading={joinLoading}>
          Join Channel
        </Button>
      )}
    </ChannelComposerSurface>
  )
}
