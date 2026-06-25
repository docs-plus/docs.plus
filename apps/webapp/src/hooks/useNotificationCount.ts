import { getUnreadNotificationCount } from '@api'
import { wasClientRead } from '@components/notificationPanel/feed/readDedupe'
import { useAuthStore, useStore } from '@stores'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'
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

/** Per-user `notifications:<uid>` broadcast counter. Requires `{ config: { private: true } }`
 * on channel subscribe — matches SQL trigger + `notifications_topic_access` RLS;
 * omit it and subscribe() silently fails. */
export const useNotificationCount = ({ workspaceId }: UseNotificationCountProps) => {
  const profile = useAuthStore((state) => state.profile)
  const unreadCount = useStore((state) => state.totalNotificationUnreadCount)
  const setUnreadCount = useStore((state) => state.setTotalNotificationUnreadCount)
  const subscriptionRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!profile?.id) return

    const fetchInitialCount = async () => {
      const count = await getUnreadNotificationCount({
        workspace_id: workspaceId || null
      })
      setUnreadCount(count)
    }

    fetchInitialCount()

    if (!navigator.onLine) return

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
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
    }
  }, [profile?.id, workspaceId, setUnreadCount])

  return unreadCount
}
