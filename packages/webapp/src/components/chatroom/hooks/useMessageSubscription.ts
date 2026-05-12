import { useAuthStore, useChatStore } from '@stores'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'
import { useEffect, useState } from 'react'

import { dbMessagesListener } from './listener'

export const useMessageSubscription = (channelId: string) => {
  const [isDbSubscriptionReady, setIsDbSubscriptionReady] = useState(false)
  const { documentId: workspaceId } = useChatStore((state) => state.chatRoom)

  const userId = useAuthStore((state) => state.profile?.id)

  useEffect(() => {
    // Reset ready on identity/context change so downstream gates don't trust stale SUBSCRIBED.
    setIsDbSubscriptionReady(false)
    if (!channelId || !workspaceId) return

    let cancelled = false
    let realtimeChannel: RealtimeChannel | null = null

    const disconnect = () => {
      realtimeChannel?.unsubscribe()
      realtimeChannel = null
      setIsDbSubscriptionReady(false)
    }

    const connect = () => {
      if (cancelled || !navigator.onLine) return
      disconnect()

      realtimeChannel = supabaseClient
        .channel(`channel:${channelId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
          dbMessagesListener
        )
        .subscribe((status) => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') {
            if (!navigator.onLine) {
              disconnect()
              return
            }
            setIsDbSubscriptionReady(true)
            return
          }
          setIsDbSubscriptionReady(false)
        })
    }

    connect()

    const onOffline = () => disconnect()
    const onOnline = () => connect()

    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    return () => {
      cancelled = true
      disconnect()
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [channelId, workspaceId, userId])

  return { isDbSubscriptionReady }
}
