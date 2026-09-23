import { getUnreadNotificationCount } from '@api'
import { trackClientRead, wasClientRead } from '@components/notificationPanel/feed/readDedupe'
import { NOTIFICATION_STATE_CHANGED } from '@hooks/usePushNotifications'
import { useAuthStore, useStore } from '@stores'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'
import PubSub from 'pubsub-js'
import { useEffect, useRef } from 'react'

interface UseNotificationCountProps {
  workspaceId?: string | null
}

type NotificationBroadcastPayload = {
  payload: {
    event: 'INSERT' | 'UPDATE' | 'DELETE'
    workspace_id: string | null
    record: {
      id: string
      receiver_user_id: string
      readed_at: string | null
    } | null
    old_record: {
      id: string
      receiver_user_id: string
      readed_at: string | null
    } | null
  }
}

function matchesWorkspace(
  filterId: string | null | undefined,
  payloadWorkspaceId: string | null
): boolean {
  return !filterId || payloadWorkspaceId === filterId
}

/** Copies the bell count onto the installed app icon. Only desktop Chromium promises to
 * show it. A missing API or a rejected promise is a silent no-op. */
export const writeAppBadge = (count: number) => {
  if (!('setAppBadge' in navigator)) return
  const write = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()
  write.catch(() => {})
}

/** Per-user `notifications:<uid>` broadcast counter. Requires `{ config: { private: true } }`
 * on channel subscribe — matches SQL trigger + `notifications_topic_access` RLS;
 * omit it and subscribe() silently fails. */
export const useNotificationCount = ({ workspaceId }: UseNotificationCountProps) => {
  const profile = useAuthStore((state) => state.profile)
  const unreadCount = useStore((state) => state.totalNotificationUnreadCount)
  const setUnreadCount = useStore((state) => state.setTotalNotificationUnreadCount)
  const subscriptionRef = useRef<RealtimeChannel | null>(null)
  // Realtime deltas on a count that never loaded are wrong, so they stay off the icon.
  const badgeReadyRef = useRef(false)

  useEffect(() => {
    if (badgeReadyRef.current) writeAppBadge(unreadCount)
  }, [unreadCount])

  useEffect(() => {
    badgeReadyRef.current = false
    if (!profile?.id) return
    let stale = false

    const fetchCount = async () => {
      const count = await getUnreadNotificationCount({ workspace_id: workspaceId || null })
      if (stale) return
      if (count === null) {
        badgeReadyRef.current = false
        setUnreadCount(0)
        return
      }
      setUnreadCount(count)
      badgeReadyRef.current = true
      // The store skips an equal value, so the effect above may not run.
      writeAppBadge(count)
    }

    fetchCount()

    // A push click marks a read, maybe before the channel below is live. Refetch,
    // and keep its realtime UPDATE from lowering the count a second time.
    const pushToken = PubSub.subscribe(
      NOTIFICATION_STATE_CHANGED,
      (_message: string | symbol, data?: { notification_id?: string }) => {
        if (data?.notification_id) trackClientRead(data.notification_id)
        fetchCount()
      }
    )
    const stop = () => {
      stale = true
      PubSub.unsubscribe(pushToken)
    }

    if (!navigator.onLine) return stop

    const topic = `notifications:${profile.id}`

    const channel = supabaseClient.channel(topic, {
      config: { private: true }
    })

    channel.on('broadcast', { event: 'INSERT' }, (data: NotificationBroadcastPayload) => {
      const payload = data.payload

      if (matchesWorkspace(workspaceId, payload.workspace_id)) {
        setUnreadCount(useStore.getState().totalNotificationUnreadCount + 1)
      }
    })

    channel.on('broadcast', { event: 'UPDATE' }, (data: NotificationBroadcastPayload) => {
      const payload = data.payload
      const oldRecord = payload.old_record
      const newRecord = payload.record

      if (matchesWorkspace(workspaceId, payload.workspace_id)) {
        if (oldRecord && newRecord && !oldRecord.readed_at && newRecord.readed_at) {
          if (wasClientRead(newRecord.id)) return
          setUnreadCount(Math.max(0, useStore.getState().totalNotificationUnreadCount - 1))
        }
      }
    })

    channel.on('broadcast', { event: 'DELETE' }, (data: NotificationBroadcastPayload) => {
      const payload = data.payload
      const oldRecord = payload.old_record

      if (matchesWorkspace(workspaceId, payload.workspace_id)) {
        if (oldRecord && !oldRecord.readed_at) {
          setUnreadCount(Math.max(0, useStore.getState().totalNotificationUnreadCount - 1))
        }
      }
    })

    subscriptionRef.current = channel.subscribe()

    return () => {
      stop()
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
    }
  }, [profile?.id, workspaceId, setUnreadCount])

  return unreadCount
}
