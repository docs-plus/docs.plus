import { join2Channel } from '@api'
import Button from '@components/ui/Button'
import { useApi } from '@hooks/useApi'
import { useAuthStore, useChatStore } from '@stores'
import { useCallback, useMemo } from 'react'
import { LuUserPlus } from 'react-icons/lu'

import { useChatroomContext } from '../../../ChatroomContext'

export default function JoinGroupChannel() {
  const { channelId } = useChatroomContext()

  const user = useAuthStore((state) => state.profile)
  const { loading, request: request2JoinChannel } = useApi(join2Channel, null, false)
  const setOrUpdateChannel = useChatStore((state) => state.setOrUpdateChannel)
  const channelChat = useChatStore((state) => state.channels)
  const channel = useMemo(() => channelChat.get(channelId) ?? {}, [channelChat, channelId])
  const setWorkspaceChannelSetting = useChatStore((state: any) => state.setWorkspaceChannelSetting)

  // TODO: move to api layer
  const joinToChannel = useCallback(async () => {
    if (!channelId) return
    try {
      if (user) {
        const { error, data } = await request2JoinChannel({
          channel_id: channelId,
          member_id: user?.id
        })
        if (error) {
          console.error(error)
          return
        }
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

  if (!user || !channelId) return null

  return (
    <div className="border-base-300 bg-base-100 flex w-full items-center justify-center border-t p-3">
      <Button
        variant="primary"
        shape="wide"
        size="sm"
        startIcon={LuUserPlus}
        onClick={joinToChannel}
        loading={loading}>
        Join Channel
      </Button>
    </div>
  )
}
