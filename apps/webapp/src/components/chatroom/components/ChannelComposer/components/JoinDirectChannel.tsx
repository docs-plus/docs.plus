import { Icons } from '@icons'
import { useAuthStore } from '@stores'

import { useChatroomContext } from '../../../ChatroomContext'
import { ChannelInfoSurface } from './ChannelInfoSurface'

export default function JoinDirectChannel() {
  const { channelId } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)

  if (!user || !channelId) return null

  return <ChannelInfoSurface icon={Icons.thread} message="Direct message — private conversation" />
}
