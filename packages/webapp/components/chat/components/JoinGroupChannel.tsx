/* eslint-disable no-use-before-define */
// @ts-nocheck

import { useCallback } from 'react'
import { useChatStore, useAuthStore } from '@stores'
import { join2Channel } from '@api'
import { useApi } from '@hooks/useApi'

export default function JoinGroupChannel() {
  const { headingId: channelId } = useChatStore((state) => state.chatRoom)

  const user = useAuthStore((state) => state.profile)
  const { loading, request: request2JoinChannel } = useApi(join2Channel, null, false)
  // const setWorkspaceSetting = useChatStore((state: any) => state.setWorkspaceSetting)
  const setOrUpdateChannel = useChatStore((state) => state.setOrUpdateChannel)
  const channel = useChatStore((state) => state.channels.get(channelId))

  // TODO: move to api layer
  const joinToChannel = useCallback(async () => {
    if (!channel) return
    try {
      const { error, data } = await request2JoinChannel({
        channel_id: channelId,
        member_id: user?.id
      })
      if (error) console.error(error)
      // setWorkspaceSetting('isUserChannelMember', true)
      setOrUpdateChannel(channelId, { ...channel, member_count: (channel?.member_count ?? 0) + 1 })
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
