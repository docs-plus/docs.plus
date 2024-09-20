import { useChannel } from '../context/ChannelProvider'
import { useChatStore } from '@stores'

export default function SignInToJoinChannel({}) {
  const { channelId } = useChannel()

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
    <div className="flex w-full flex-col items-center justify-center p-2">
      <div className="btn btn-block" onClick={openSignInModalHandler}>
        Please sign in to join the heading chat.
      </div>
    </div>
  )
}
