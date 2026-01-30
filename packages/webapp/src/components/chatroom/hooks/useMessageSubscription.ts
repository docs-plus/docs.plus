import { useChatStore } from '@stores'
import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'
import { useEffect, useState } from 'react'

import { dbMessagesListener } from './listner'

// there is not relation join in realtime subscription
// so we first get the online members and save it to the channel member state store
// and then we put the current user into that state store
// then if new message comes from the online user, we have those user data in the channel member state store
// and if a new user online or join the channel, we put it into the channel member state store

// with this approach we can have runtime join and we do not need to have join or view or other approach!
// I suppose this approch hase more performance than the other one!

// reply message!
// forward message!

// for forward messages we need first check if for the coming message we have the user data in state store.
// otherwise we need to fetch the user data from the database and then put it into the state store

// pinned message, I just put the contnet to the pinned message

export const useMessageSubscription = (channelId: string) => {
  const [isDbSubscriptionReady, setIsDbSubscriptionReady] = useState(false)
  const { documentId: workspaceId } = useChatStore((state) => state.chatRoom)

  const user = useAuthStore((state) => state.profile)
  useEffect(() => {
    if (!channelId || !workspaceId) return

    // Skip subscription if offline (prevents retry spam)
    if (!navigator.onLine) {
      return
    }

    const messageSubscription = supabaseClient
      .channel(`channel:${channelId}`)
      // todo: move to worksapce channel

      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        dbMessagesListener
      )
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return

        // Skip if we went offline during subscription
        if (!navigator.onLine) {
          messageSubscription.unsubscribe()
          return
        }

        setIsDbSubscriptionReady(true)
      })

    // Unsubscribe when going offline
    const handleOffline = () => {
      messageSubscription.unsubscribe()
    }

    window.addEventListener('offline', handleOffline)

    return () => {
      messageSubscription.unsubscribe()
      window.removeEventListener('offline', handleOffline)
    }
  }, [channelId, workspaceId, user])

  return { isDbSubscriptionReady }
}
