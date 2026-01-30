import Button from '@components/ui/Button'
import { useChatStore } from '@stores'
import { LuLogIn } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

import { useChatroomContext } from '../../../ChatroomContext'

export default function SignInToJoinChannel({ className }: { className?: string }) {
  const { channelId } = useChatroomContext()

  const openSignInModalHandler = () => {
    // append search query to the URL
    const url = new URL(window.location.href)
    url.searchParams.set('open_heading_chat', channelId)
    window.history.pushState({}, '', url.href)

    document.getElementById('btn_signin')?.click()

    // destroy the chat room
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
        startIcon={LuLogIn}
        onClick={openSignInModalHandler}>
        Sign in to join
      </Button>
    </div>
  )
}
