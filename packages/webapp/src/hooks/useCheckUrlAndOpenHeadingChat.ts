import { useEffect } from 'react'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import { CHAT_OPEN } from '@services/eventsHub'
import { useStore, useAuthStore } from '@stores'

const useCheckUrlAndOpenHeadingChat = () => {
  const { slugs } = useRouter().query
  const user = useAuthStore((state) => state.profile)
  const { workspaceId, editor: editorSetting } = useStore((state) => state.settings)

  useEffect(() => {
    if (!workspaceId) return

    const url = new URL(window.location.href)
    const openHeadingChatId = url.searchParams.get('open_heading_chat')

    if (openHeadingChatId && !editorSetting?.loading) {
      // TODO: we need better flag rather than using setTimeout
      setTimeout(() => {
        PubSub.publish(CHAT_OPEN, {
          headingId: openHeadingChatId
        })
      }, 800)
    }
  }, [editorSetting?.loading, slugs, workspaceId, user])
}

export default useCheckUrlAndOpenHeadingChat
