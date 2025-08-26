import { useChatroomContext } from '../../../ChatroomContext'
import { useChatStore } from '@stores'
import { twMerge } from 'tailwind-merge'

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
    <div className={twMerge('flex w-full flex-col items-center justify-center p-2', className)}>
      <div className="btn btn-block" onClick={openSignInModalHandler}>
        Please sign in to join the heading chat.
      </div>
    </div>
  )
}
