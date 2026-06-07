import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useChatStore } from '@stores'

import { useChatroomContext } from '../../../ChatroomContext'
import { ChannelComposerSurface } from './ChannelComposerSurface'

export default function SignInToJoinChannel() {
  const { channelId } = useChatroomContext()

  const handleSignIn = () => {
    openComposerSignIn(channelId)
    useChatStore.getState().destroyChatRoom()
  }

  return (
    <ChannelComposerSurface>
      <Button
        variant="primary"
        shape="wide"
        size="sm"
        startIcon={Icons.logIn}
        onClick={handleSignIn}>
        Sign in to join
      </Button>
    </ChannelComposerSurface>
  )
}
