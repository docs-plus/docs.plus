import { useCallback } from 'react'
import { useChatStore, useAuthStore, useStore } from '@stores'
import { useRouter } from 'next/router'
import slugify from 'slugify'
import ENUMS from '../../enums'
import * as toast from '@components/toast'

const useOpenChatContainer = () => {
  const router = useRouter()
  const { query } = router
  const setChatRoom = useChatStore((state) => state.setChatRoom)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const user = useAuthStore((state) => state.profile)
  const {
    workspaceId,
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const openChatContainerHandler = useCallback(
    (item: any) => {
      if (!editor) return

      // toggle chatroom
      if (headingId === item.id) {
        return destroyChatRoom()
      }

      destroyChatRoom()

      // TODO: change naming => open chatroom
      if (workspaceId) setChatRoom(item.id, workspaceId, [], user)
    },
    [editor, workspaceId, headingId, user]
  )

  return openChatContainerHandler
}

export default useOpenChatContainer
