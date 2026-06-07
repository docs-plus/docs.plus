import { Icons } from '@icons'
import { useAuthStore } from '@stores'

import { useChatroomContext } from '../../../ChatroomContext'
import { ChannelInfoSurface } from './ChannelInfoSurface'

export default function JoinPrivateChannel() {
  const { channelId } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)

  if (!user || !channelId) return null

  return (
    <ChannelInfoSurface icon={Icons.lock} message="Private channel — join by invitation only" />
  )
}
