import { CHAT_OPEN } from '@services/eventsHub'
import { useStore } from '@stores'
import PubSub from 'pubsub-js'
import { useEffect } from 'react'

export default function useApplyOpenChatAndFocusOnMessage() {
  const {
    settings: {
      editor: { providerSyncing, loading },
      joinedWorkspace
    }
  } = useStore((state) => state)

  useEffect(() => {
    if (loading || providerSyncing || !joinedWorkspace) return
    const url = new URL(window.location.href)
    const act = url.searchParams.get('act')
    const channelId = url.searchParams.get('c_id')
    const messageId = url.searchParams.get('m_id')

    if (act === 'ch' && channelId && messageId) {
      PubSub.publish(CHAT_OPEN, {
        headingId: channelId,
        toggleRoom: false,
        fetchMsgsFromId: messageId
      })
    }
  }, [loading, providerSyncing, joinedWorkspace])

  return null
}
