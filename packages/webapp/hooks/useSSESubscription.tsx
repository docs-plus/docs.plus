import { useEffect, useCallback } from 'react'
import { useAuthStore, useStore } from '@stores'
import { SSE_BROADCAST_TITLE_ADDRESS } from '@api'

const useSSESubscription = (docMetadata: any) => {
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const user = useAuthStore((state) => state.profile)
  const setOrUpdateUserPresence = useStore((state) => state.setOrUpdateUserPresence)

  const handleEventMessage = useCallback(
    (event: { data: string }) => {
      const data = JSON.parse(event.data)
      console.log({
        data: data.body
      })
      if (data.body.action === 'updateTitle' && data.body.title) {
        setWorkspaceSetting('metadata', { ...docMetadata, title: data.title })
      } else if (data.body.action === 'syncPresence') {
        data.body.userPrecenses?.forEach((presence: any) => {
          const userPresence = useStore.getState().usersPresence.get(presence.id)
          if (!userPresence) return
          const newUserPresence = {
            ...userPresence,
            channelId: presence?.channelId || null
          }
          setOrUpdateUserPresence(presence.id, newUserPresence)
        })
      }
    },
    [user]
  )

  const initializeEventSource = useCallback(() => {
    let eventSource: EventSource
    let attempt = 0
    const MAXATTEMPTS = 6

    const connect = () => {
      if (attempt >= MAXATTEMPTS) {
        console.error('Maximum reconnection attempts reached')
        return
      }

      eventSource = new EventSource(
        SSE_BROADCAST_TITLE_ADDRESS(docMetadata.documentId) + '?userId=' + user?.id
      )
      eventSource.onmessage = handleEventMessage
      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err)
        eventSource.close()
        attempt++
        // Set a timeout to try reconnecting. The delay before reconnection increases exponentially with each attempt.
        // The formula `1000 * Math.pow(2, attempt)` calculates the delay.
        // For example, if this is the first attempt (attempt = 1), the delay is 1000 * 2^1 = 2000 milliseconds (2 seconds).
        // If this is the second attempt (attempt = 2), the delay is 1000 * 2^2 = 4000 milliseconds (4 seconds), and so on.
        // This exponential backoff helps to avoid overwhelming the server with rapid reconnection attempts,
        // and gives the server time to recover in case it is experiencing issues.
        setTimeout(connect, 1000 * Math.pow(2, attempt))
      }
    }

    connect()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const cleanupEventSource = initializeEventSource()

    return () => {
      cleanupEventSource()
    }
  }, [user])
}
export default useSSESubscription
