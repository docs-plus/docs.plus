import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useChatStore } from '@stores'
import { twMerge } from 'tailwind-merge'

import { useChatroomContext } from '../../../ChatroomContext'

export default function SignInToJoinChannel({ className }: { className?: string }) {
  const { channelId } = useChatroomContext()

  const handleSignIn = () => {
    openComposerSignIn(channelId)
    useChatStore.getState().destroyChatRoom()
  }

  return (
    <div
      className={twMerge(
        'border-base-300 bg-base-100 flex w-full items-center justify-center border-t p-3',
        className
      )}>
      <Button
        variant="primary"
        shape="wide"
        size="sm"
        startIcon={Icons.logIn}
        onClick={handleSignIn}>
        Sign in to join
      </Button>
    </div>
  )
}
