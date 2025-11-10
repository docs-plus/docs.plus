import { useEffect } from 'react'
import useUnreadMessage from './useUnreadMessage'

const useUnreadMessageEffect = (workspaceId: string) => {
  const unreadMessage = useUnreadMessage({ id: workspaceId })

  useEffect(() => {
    if (!unreadMessage) return

    const element = document.querySelector(
      `.wrapBlock[data-id="${workspaceId}"] > .buttonWrapper .btn_openChatBox`
    )
    if (!element) return
    if (unreadMessage > 0) {
      element.setAttribute('data-unread-count', unreadMessage.toString())
    } else {
      element.removeAttribute('data-unread-count')
    }
  }, [unreadMessage, workspaceId])

  return unreadMessage
}

export default useUnreadMessageEffect
