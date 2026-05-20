import { useJoinChannel } from '@components/chatroom/hooks/useJoinChannel'
import Button from '@components/ui/Button'
import { Icons } from '@icons'

import { useChatroomContext } from '../../../ChatroomContext'
import { ChannelComposerSurface } from './ChannelComposerSurface'

export default function JoinGroupChannel() {
  const { channelId } = useChatroomContext()
  const { join, loading, user } = useJoinChannel(channelId)

  if (!user || !channelId) return null

  return (
    <ChannelComposerSurface>
      <Button
        variant="primary"
        shape="wide"
        size="sm"
        startIcon={Icons.userPlus}
        onClick={() => void join()}
        loading={loading}>
        Join Channel
      </Button>
    </ChannelComposerSurface>
  )
}
